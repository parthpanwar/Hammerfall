'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GameState,
  GameSettings,
  GamePhase,
  Franchise,
  Player,
  RetentionDecision,
  AuctionSession,
  AuctionPurchase,
  Fixture,
  StandingsEntry,
  MatchResult,
  PlayerSeasonStats,
  PlayingXI,
  SeasonAward,
  SeasonSummary,
  AuctionState,
  AuctionLot,
  AuctionBid,
} from '@/lib/types/game';
import type { CareerState, PlayerContract, TransactionRecord } from '@/lib/types/career';
import type { AuctionType } from '@/lib/types/game';
import type { RegisteredPlayer, RegistrationSummary } from '@/lib/types/registration';
import type { FranchiseShortlist, ShortlistPriority } from '@/lib/types/scouting';
import type { SquadRules } from '@/lib/types/squad-rules';
import { OFFICIAL_IPL_SQUAD_RULES } from '@/lib/types/squad-rules';
import { generateAuctionRegistrationPool, isFreshDomesticBreakout, isWorthRegistering } from '@/lib/engines/registration/registration-engine';
import { generateAllFranchiseShortlists } from '@/lib/engines/scouting/cpu-shortlist-generator';
import { compileFinalAuctionPool } from '@/lib/engines/auction/shortlist-compiler';
import { checkAndEnsureAuctionPoolFeasibility } from '@/lib/engines/auction/feasibility-checker';
import { createAuctionSession } from '@/lib/engines/auction-engine';
import { executeSeasonAdvance } from '@/lib/engines/career/multi-season-controller';
import { initializeFranchiseHistory } from '@/lib/engines/career/history-tracker';
import { createInitialContracts, releasePlayerFromFranchise, syncRosterContracts } from '@/lib/engines/career/contract-engine';
import { auctionTypeFor, isFinalSeason } from '@/lib/flow/season-flow';
import { planCpuMiniReleases } from '@/lib/engines/career/mini-release';
import { generateTradeRequests } from '@/lib/engines/trade/trade-requests';
import type { CpuTradeEvaluation, TradeBlockStatus, TradeProposal, TradeRules, TradeState } from '@/lib/types/trade';
import { createTradeState, isWindowOpen, validateTrade } from '@/lib/engines/trade/trade-rules';
import { evaluateProposal, buildCounter, tradeUtility, thresholdFor } from '@/lib/engines/trade/trade-ai';
import { advanceTradeMarket, executeTrade, rollTradeSeason, type TradeWorld } from '@/lib/engines/trade/trade-executor';
import { saveCareerToSlot, loadCareerFromSlot } from '@/lib/engines/career/save-manager';
import { finalizeAuction, countOverseas } from '@/lib/engines/auction/auction-runner';
import { createCompactStorage } from './player-compaction';
import { applyMatchToPlayer, linesFromInnings } from '@/lib/engines/season-form';
import { selectCpuXI } from '@/lib/engines/squad-engine';
import { hashString, mulberry32 } from '@/lib/engines/career/dev-rng';

/** One finished match, as recordMatchForm needs it. */
export interface MatchFormInput {
  /** Stable per-match key (fixture id) for the seeded blooding roll. */
  matchKey: string;
  team1Id: string;
  team2Id: string;
  team1XI: string[];
  team2XI: string[];
  batsmen: { playerId: string; runs: number; balls: number }[];
  bowlers: { playerId: string; wickets: number; overs: number; runs: number }[];
  /** Playoff / must-win: the CPU fields its strongest XI. */
  mustWin?: boolean;
}

/** Phases that belong to an in-progress career (used by Continue). */
/** Steps of the season flow. Side pages (Franchise Office, Points table, Trades) are
 *  deliberately excluded so "where you are in the season" survives visiting them. */
const RESUMABLE_PHASES: GamePhase[] = [
  'Retention', 'Registration', 'Scouting', 'ShortlistReveal', 'Auction', 'SquadManagement',
  'Tournament', 'Playoffs', 'SeasonReview',
];

/** Current salary of a rostered player: contract first, then auction/retention price. */
function salaryLakhs(p: Player, contracts: Record<string, PlayerContract>): number {
  return contracts[p.id]?.salaryLakhs || p.soldPrice || p.currentContractValue || p.basePrice || 20;
}

function txn(
  season: number,
  type: TransactionRecord['type'],
  franchiseId: string,
  p: Player,
  amountLakhs: number,
  window: AuctionType,
  note?: string
): TransactionRecord {
  return {
    id: `${season}-${type}-${franchiseId}-${p.id}`,
    season,
    type,
    franchiseId,
    playerId: p.id,
    playerName: p.name,
    overall: p.ratings.overall,
    role: p.role,
    amountLakhs,
    window,
    timestamp: Date.now(),
    note,
  };
}

/** Append without duplicates (ids are deterministic per season/type/team/player). */
function addTransactions(existing: TransactionRecord[] | undefined, add: TransactionRecord[]): TransactionRecord[] {
  const seen = new Set((existing || []).map((t) => t.id));
  return [...(existing || []), ...add.filter((t) => !seen.has(t.id))];
}

/** Snapshot of everything the trade engine needs, derived from store state. */
export function buildTradeWorld(state: GameState & { careerState: CareerState; tradeReturnPhase?: GamePhase | null }): TradeWorld {
  const trade = state.careerState.trade ?? createTradeState(state.franchises, state.currentSeason);
  return {
    franchises: state.franchises,
    contracts: state.careerState.contracts,
    retentionDecisions: state.retentionDecisions,
    phase: state.phase === 'TradeCenter' ? state.tradeReturnPhase || 'SquadManagement' : state.phase,
    season: state.currentSeason,
    // In-season = a league match has been played and the Final has not. After the
    // Final the offseason window reopens (Season Review onwards).
    seasonStarted:
      state.fixtures.some((f) => f.isCompleted) &&
      !(state.playoffFixtures || []).some((f) => f.playoffType === 'Final' && f.isCompleted),
    auctionComplete: state.auctionComplete,
    humanFranchiseId: state.humanFranchiseId,
    difficulty: state.settings.cpuDifficulty,
    trade,
    allPlayers: state.allPlayers,
    playingXIs: state.playingXIs,
  };
}

/** Rebuild the per-set view of the auction pool from a session's dynamic sets. */
function buildSetMap(session: AuctionSession | null): Record<string, RegisteredPlayer[]> {
  const map: Record<string, RegisteredPlayer[]> = {};
  if (!session?.sets) return map;
  const lookup = new Map(session.playerPool.map((p) => [p.id, p as RegisteredPlayer]));
  for (const set of session.sets) {
    map[set.code] = set.playerIds.map((id) => lookup.get(id)).filter(Boolean) as RegisteredPlayer[];
  }
  return map;
}

/** Copy live auction rosters/purses back onto the store's franchises. */
function syncFranchisesFromSession(franchises: Franchise[], session: AuctionSession | null): Franchise[] {
  if (!session) return franchises;
  const live = new Map(session.franchises.map((f) => [f.id, f]));
  return franchises.map((f) => {
    const s = live.get(f.id);
    if (!s) return f;
    return {
      ...f,
      players: s.players,
      remainingPurse: s.remainingPurse,
      auctionPurchases: s.auctionPurchases,
      currentOverseasCount: countOverseas(s.players),
    };
  });
}

interface GameStore extends GameState {
  /** Last in-career phase, so "Continue" from the main menu resumes correctly. */
  lastActivePhase: GamePhase | null;
  returnToMainMenu: () => void;
  resumeCareer: () => void;
  /** Regenerate non-persisted pre-auction data (registration pool, shortlists, set views) after a reload. */
  ensurePhaseData: () => void;

  // Initialization
  initializeGame: (settings: GameSettings, humanFranchiseId: string, franchises: Franchise[], players: Player[]) => void;
  resetGame: () => void;

  // Phase management
  setPhase: (phase: GamePhase) => void;

  // Franchise management
  updateFranchise: (id: string, updates: Partial<Franchise>) => void;
  setHumanFranchise: (id: string) => void;

  // Player management
  updatePlayer: (id: string, updates: Partial<Player>) => void;

  // Retention
  addRetentionDecision: (decision: RetentionDecision) => void;
  removeRetentionDecision: (franchiseId: string, playerId: string) => void;
  completeRetention: () => void;
  setRetentionDecisions: (decisions: RetentionDecision[]) => void;

  // Registration & Scouting
  registrationPool: RegisteredPlayer[];
  registrationSummary: RegistrationSummary | null;
  franchiseShortlists: Record<string, FranchiseShortlist>;
  finalAuctionPool: RegisteredPlayer[];
  auctionSets: Record<string, RegisteredPlayer[]>;
  squadRules: SquadRules;
  initializeRegistration: () => void;
  /** Mini-auction years: keep the squad, release the given players, then open the pool. */
  confirmMiniReleases: (releaseIds: string[]) => { ok: boolean; message: string };
  updateHumanShortlist: (playerId: string, priority: ShortlistPriority, notes?: string, maxBid?: number) => void;
  removeHumanShortlist: (playerId: string) => void;
  compileAuctionPool: () => void;
  setSquadRules: (rules: SquadRules) => void;

  // Auction
  setAuctionSession: (session: AuctionSession | null) => void;
  updateAuctionSession: (updates: Partial<AuctionSession>) => void;
  updateAuctionState: (state: AuctionState) => void;
  setCurrentLot: (lot: AuctionLot | null) => void;
  addAuctionBid: (bid: AuctionBid) => void;
  addAuctionPurchase: (purchase: AuctionPurchase) => void;
  completeAuction: () => void;

  // Tournament
  setFixtures: (fixtures: Fixture[]) => void;
  updateFixture: (index: number, updates: Partial<Fixture>) => void;
  setStandings: (standings: StandingsEntry[]) => void;
  updateStandings: (standings: StandingsEntry[]) => void;
  setCurrentFixtureIndex: (index: number) => void;
  advanceFixture: () => void;

  // Match
  setCurrentMatch: (result: MatchResult | null) => void;

  // Playing XI
  setPlayingXI: (franchiseId: string, xi: PlayingXI) => void;

  // Season Stats
  updatePlayerSeasonStats: (playerId: string, stats: Partial<PlayerSeasonStats>) => void;
  /**
   * After a match: fold each player's numbers into recentForm, log appearances for
   * both squads, and re-pick the CPU sides' XIs (form + blooding) for their next game.
   */
  recordMatchForm: (match: MatchFormInput) => void;
  initializePlayerSeasonStats: (players: Player[]) => void;

  // Awards
  setSeasonAwards: (awards: SeasonAward[]) => void;

  // Playoffs
  setPlayoffFixtures: (fixtures: Fixture[]) => void;

  // Career & Dynasty
  careerState: CareerState;

  // Trading
  tradeReturnPhase: GamePhase | null;
  tradeEvents: string[];
  openTradeCenter: () => void;
  closeTradeCenter: () => void;
  ensureTradeState: () => TradeState;
  setTradeRules: (rules: TradeRules) => void;
  setTradeBlock: (playerId: string, status: TradeBlockStatus | null) => void;
  submitTrade: (proposal: TradeProposal) => CpuTradeEvaluation;
  requestCounteroffer: (proposal: TradeProposal) => { counter: TradeProposal | null; message: string };
  respondToOffer: (proposalId: string, response: 'accept' | 'reject') => { ok: boolean; message: string };
  confirmTrade: (proposalId: string) => { ok: boolean; message: string };
  cancelTrade: (proposalId: string) => void;
  tradeMarketTick: () => string[];
  dismissTradeEvents: () => void;
  updateCareerState: (updates: Partial<CareerState>) => void;
  releaseHumanPlayer: (playerId: string) => void;
  saveToSlot: (slotNumber: number, name?: string) => void;
  loadFromSlot: (slotNumber: number) => boolean;
  addSeasonSummary: (summary: SeasonSummary) => void;
  advanceSeason: () => void;

  // Save
  saveGame: () => void;
}

const initialCareerState: CareerState = {
  currentSeason: 2026,
  contracts: {},
  retirements: [],
  franchiseHistory: {},
  playerCareerRecords: {},
  storylines: [],
  recentProgressionDeltas: [],
  activeSaveSlot: 1,
};

const initialState: GameState = {
  id: '',
  phase: 'MainMenu',
  settings: {
    startingSeason: 2026,
    auctionType: 'Mega',
    rulesPreset: 'Official',
    cpuDifficulty: 'Normal',
    auctionPace: 'Normal',
    matchSimMode: 'Detailed',
    allowCustomPurse: false,
    enableInjuries: false,
    enablePlayerDevelopment: true,
    seed: 0,
  },
  currentSeason: 2026,
  humanFranchiseId: '',
  franchises: [],
  allPlayers: [],
  retentionDecisions: [],
  retentionComplete: false,
  registrationPool: [],
  registrationSummary: null,
  franchiseShortlists: {},
  finalAuctionPool: [],
  auctionSets: {},
  squadRules: OFFICIAL_IPL_SQUAD_RULES,
  auctionSession: null,
  auctionComplete: false,
  fixtures: [],
  standings: [],
  currentFixtureIndex: 0,
  currentMatch: null,
  playerSeasonStats: {},
  playingXIs: {},
  playoffFixtures: [],
  seasonAwards: [],
  seasonHistory: [],
  careerYear: 1,
  createdAt: 0,
  updatedAt: 0,
  savedAt: 0,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      careerState: initialCareerState,
      lastActivePhase: null,
      tradeReturnPhase: null,
      tradeEvents: [],

      // ------------------------------------------------------------
      // Trading
      // ------------------------------------------------------------
      ensureTradeState: () => {
        const state = get();
        const existing = state.careerState.trade;
        if (existing) {
          // Older saves (or a new season) without this season's trade requests.
          if (!existing.tradeRequests || Object.values(existing.tradeRequests).some((r) => r.season !== state.currentSeason)) {
            const trade = { ...existing, tradeRequests: generateTradeRequests(state.franchises, state.currentSeason, state.settings.seed || 1, state.humanFranchiseId) };
            set({ careerState: { ...state.careerState, trade } });
            return trade;
          }
          return existing;
        }
        // Older saves: create trade state and bring contracts in line with real rosters.
        const trade = {
          ...createTradeState(state.franchises, state.currentSeason),
          tradeRequests: generateTradeRequests(state.franchises, state.currentSeason, state.settings.seed || 1, state.humanFranchiseId),
        };
        const contracts = syncRosterContracts(state.franchises, state.careerState.contracts, state.retentionDecisions, state.currentSeason, auctionTypeFor(state.currentSeason, state.settings));
        set({ careerState: { ...state.careerState, contracts, trade } });
        return trade;
      },

      openTradeCenter: () => {
        const state = get();
        state.ensureTradeState();
        if (state.phase === 'TradeCenter') return;
        set({ tradeReturnPhase: state.phase, phase: 'TradeCenter', updatedAt: Date.now() });
      },

      closeTradeCenter: () => {
        const { tradeReturnPhase } = get();
        set({ phase: tradeReturnPhase || 'SquadManagement', tradeReturnPhase: null, updatedAt: Date.now() });
      },

      setTradeRules: (rules) => {
        const state = get();
        const trade = state.ensureTradeState();
        set({ careerState: { ...get().careerState, trade: { ...trade, rules } }, updatedAt: Date.now() });
        void state;
      },

      setTradeBlock: (playerId, status) => {
        const trade = get().ensureTradeState();
        const humanBlock = { ...trade.humanBlock };
        if (status) humanBlock[playerId] = status;
        else delete humanBlock[playerId];
        set({ careerState: { ...get().careerState, trade: { ...trade, humanBlock } } });
      },

      submitTrade: (proposal) => {
        get().ensureTradeState();
        const world = buildTradeWorld(get());
        const submitted: TradeProposal = { ...proposal, status: 'UNDER_REVIEW', updatedTick: world.trade.tick, createdTick: proposal.createdTick ?? world.trade.tick };
        const evaluation = evaluateProposal(submitted, { ...world, trade: { ...world.trade, proposals: world.trade.proposals.filter((p) => p.id !== proposal.id) } });
        const cpuId = proposal.sides[1].franchiseId;
        const memory = { ...world.trade.memory };
        if (evaluation.utility < evaluation.threshold - 8) {
          // Repeated lopsided offers make the CPU harder to deal with (anti-exploit).
          memory[cpuId] = { lowballs: (memory[cpuId]?.lowballs || 0) + 1, lastTick: world.trade.tick };
        }
        const status: TradeProposal['status'] =
          evaluation.decision === 'ACCEPT' ? 'ACCEPTED' : evaluation.decision === 'COUNTER' ? 'COUNTEROFFERED' : 'REJECTED';
        const finalProposal = { ...submitted, status, messages: evaluation.reasons };
        const counter = evaluation.counter ? { ...evaluation.counter, status: 'SUBMITTED' as const } : null;
        const proposals = [
          ...world.trade.proposals.filter((p) => p.id !== proposal.id),
          finalProposal,
          ...(counter ? [counter] : []),
        ];
        set({ careerState: { ...get().careerState, trade: { ...world.trade, proposals, memory } }, updatedAt: Date.now() });
        return { ...evaluation, counter: counter ?? undefined };
      },

      requestCounteroffer: (proposal) => {
        get().ensureTradeState();
        const world = buildTradeWorld(get());
        const v = validateTrade(proposal, world);
        const u = tradeUtility(proposal, world, 1, world.difficulty).utility;
        if (v.valid && u >= thresholdFor(world, proposal.sides[1].franchiseId, world.difficulty)) {
          return { counter: null, message: 'They would take this deal as it stands — submit it.' };
        }
        const counter = buildCounter(proposal, world, 1);
        if (!counter) return { counter: null, message: 'They see no version of this deal that works for them.' };
        const c = { ...counter, status: 'SUBMITTED' as const };
        set({ careerState: { ...get().careerState, trade: { ...world.trade, proposals: [...world.trade.proposals, c] } } });
        return { counter: c, message: c.messages[0] };
      },

      respondToOffer: (proposalId, response) => {
        const world = buildTradeWorld(get());
        const p = world.trade.proposals.find((x) => x.id === proposalId);
        if (!p) return { ok: false, message: 'Offer not found.' };
        if (response === 'reject') {
          const proposals = world.trade.proposals.map((x) => (x.id === proposalId ? { ...x, status: 'REJECTED' as const } : x));
          set({ careerState: { ...get().careerState, trade: { ...world.trade, proposals } } });
          return { ok: true, message: 'Offer declined.' };
        }
        const v = validateTrade(p, { ...world, trade: { ...world.trade, proposals: world.trade.proposals.filter((x) => x.id !== p.id) } });
        if (!v.valid) return { ok: false, message: v.issues[0]?.message || 'This offer is no longer valid.' };
        const proposals = world.trade.proposals.map((x) => (x.id === proposalId ? { ...x, status: 'ACCEPTED' as const } : x));
        set({ careerState: { ...get().careerState, trade: { ...world.trade, proposals } } });
        return { ok: true, message: 'Accepted — review the summary and confirm.' };
      },

      confirmTrade: (proposalId) => {
        const world = buildTradeWorld(get());
        const p = world.trade.proposals.find((x) => x.id === proposalId);
        if (!p || p.status !== 'ACCEPTED') return { ok: false, message: 'Only an agreed trade can be completed.' };
        const res = executeTrade(world, p);
        if (!res.ok) return { ok: false, message: res.error };
        // Single atomic commit of rosters, contracts, money, XIs and history.
        set((s) => ({
          franchises: res.franchises,
          allPlayers: res.allPlayers,
          playingXIs: res.playingXIs,
          careerState: { ...s.careerState, contracts: res.contracts, trade: res.trade },
          updatedAt: Date.now(),
        }));
        return { ok: true, message: 'Trade completed.' };
      },

      cancelTrade: (proposalId) => {
        const world = buildTradeWorld(get());
        const proposals = world.trade.proposals.map((x) =>
          x.id === proposalId && !['COMPLETED', 'REJECTED', 'EXPIRED'].includes(x.status) ? { ...x, status: 'CANCELLED' as const } : x
        );
        set({ careerState: { ...get().careerState, trade: { ...world.trade, proposals } } });
      },

      tradeMarketTick: () => {
        const state = get();
        if (!state.id || !state.careerState.trade) return [];
        const world = buildTradeWorld(state);
        const res = advanceTradeMarket(world, (state.settings.seed || 1) * 31 + world.trade.tick * 7919);
        set((s) => ({
          franchises: res.world.franchises,
          allPlayers: res.world.allPlayers,
          playingXIs: res.world.playingXIs,
          careerState: { ...s.careerState, contracts: res.world.contracts, trade: res.world.trade },
          tradeEvents: [...s.tradeEvents, ...res.events].slice(-6),
        }));
        return res.events;
      },

      dismissTradeEvents: () => set({ tradeEvents: [] }),

      returnToMainMenu: () => {
        const { phase } = get();
        set({
          lastActivePhase: RESUMABLE_PHASES.includes(phase) ? phase : get().lastActivePhase,
          phase: 'MainMenu',
          updatedAt: Date.now(),
        });
      },

      resumeCareer: () => {
        const { lastActivePhase, id } = get();
        if (!id) return;
        set({ phase: lastActivePhase || 'Retention', updatedAt: Date.now() });
        get().ensurePhaseData();
      },

      ensurePhaseData: () => {
        const state = get();
        if ((state.phase === 'Registration' || state.phase === 'Scouting') && state.registrationPool.length === 0) {
          const humanList = state.franchiseShortlists[state.humanFranchiseId];
          state.initializeRegistration();
          // initializeRegistration forces the Registration phase; restore the actual one
          // and the human's own shortlist (CPU lists are regenerated deterministically).
          set((s) => ({
            phase: state.phase,
            franchiseShortlists: humanList
              ? { ...s.franchiseShortlists, [state.humanFranchiseId]: humanList }
              : s.franchiseShortlists,
          }));
        }
        if ((state.phase === 'ShortlistReveal' || state.phase === 'Auction') && state.auctionSession) {
          if (Object.keys(state.auctionSets).length === 0 || state.finalAuctionPool.length === 0) {
            set({
              auctionSets: buildSetMap(state.auctionSession),
              finalAuctionPool: state.auctionSession.playerPool as RegisteredPlayer[],
            });
          }
        }
      },

      initializeGame: (settings, humanFranchiseId, franchises, players) => {
        const now = Date.now();
        const rostered = franchises.map((f) => ({
          ...f,
          players: players.filter((p) => p.currentFranchiseId === f.id),
          isHumanControlled: f.id === humanFranchiseId,
          cpuDifficulty: settings.cpuDifficulty,
        }));
        const initHistory = initializeFranchiseHistory(rostered);
        // Contracts must be built from the rostered squads (the bare franchise list has no players).
        // Mid-cycle starts (Real IPL, mini year) run to the end of the current cycle: 1 season left.
        const initContracts = createInitialContracts(rostered, settings.startingSeason, settings.auctionType);

        set({
          id: `game-${now}`,
          phase: 'Retention',
          lastActivePhase: 'Retention',
          settings,
          currentSeason: settings.startingSeason,
          humanFranchiseId,
          franchises: rostered,
          allPlayers: players,
          careerState: {
            currentSeason: settings.startingSeason,
            contracts: initContracts,
            retirements: [],
            franchiseHistory: initHistory,
            playerCareerRecords: {},
            storylines: [],
            recentProgressionDeltas: [],
            activeSaveSlot: 1,
            trade: {
              ...createTradeState(rostered, settings.startingSeason),
              tradeRequests: generateTradeRequests(rostered, settings.startingSeason, settings.seed || 1, humanFranchiseId),
            },
          },
          tradeReturnPhase: null,
          tradeEvents: [],
          retentionDecisions: [],
          retentionComplete: false,
          registrationPool: [],
          registrationSummary: null,
          franchiseShortlists: {},
          finalAuctionPool: [],
          auctionSets: {},
          auctionSession: null,
          auctionComplete: false,
          fixtures: [],
          standings: [],
          currentFixtureIndex: 0,
          currentMatch: null,
          playerSeasonStats: {},
          playingXIs: {},
          playoffFixtures: [],
          seasonAwards: [],
          createdAt: now,
          updatedAt: now,
          savedAt: now,
        });
      },

      resetGame: () => set({ ...initialState, lastActivePhase: null }),

      setPhase: (phase) => {
        const prev = get().phase;
        set((state) => ({
          phase,
          lastActivePhase: RESUMABLE_PHASES.includes(phase) ? phase : state.lastActivePhase,
          updatedAt: Date.now(),
        }));
        // Each move through the calendar is a trade-market "day" (offers, expiry, CPU deals).
        const s = get();
        if (prev !== phase && phase !== 'TradeCenter' && prev !== 'TradeCenter' && s.careerState.trade && isWindowOpen(buildTradeWorld(s)).open) {
          s.tradeMarketTick();
        }
      },

      updateFranchise: (id, updates) =>
        set((state) => ({
          franchises: state.franchises.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
          updatedAt: Date.now(),
        })),

      setHumanFranchise: (id) =>
        set((state) => ({
          humanFranchiseId: id,
          franchises: state.franchises.map((f) => ({
            ...f,
            isHumanControlled: f.id === id,
          })),
          updatedAt: Date.now(),
        })),

      updatePlayer: (id, updates) =>
        set((state) => ({
          allPlayers: state.allPlayers.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
          updatedAt: Date.now(),
        })),

      addRetentionDecision: (decision) =>
        set((state) => ({
          retentionDecisions: [...state.retentionDecisions, decision],
          updatedAt: Date.now(),
        })),

      removeRetentionDecision: (franchiseId, playerId) =>
        set((state) => ({
          retentionDecisions: state.retentionDecisions.filter(
            (d) => !(d.franchiseId === franchiseId && d.playerId === playerId)
          ),
          updatedAt: Date.now(),
        })),

      completeRetention: () => set({ retentionComplete: true, updatedAt: Date.now() }),

      setRetentionDecisions: (decisions) =>
        set({ retentionDecisions: decisions, updatedAt: Date.now() }),

      confirmMiniReleases: (releaseIds) => {
        const state = get();
        const human = state.franchises.find((f) => f.id === state.humanFranchiseId);
        if (!human) return { ok: false, message: 'No franchise selected.' };
        const contracts = state.careerState.contracts;
        const release = new Set(releaseIds);
        const kept = human.players.filter((p) => !release.has(p.id));
        const released = human.players.filter((p) => release.has(p.id));
        const committed = kept.reduce((t, p) => t + salaryLakhs(p, contracts), 0);
        const overseas = kept.filter((p) => p.nationality === 'Overseas').length;
        if (kept.length > human.maxSquadSize) return { ok: false, message: `Release at least ${kept.length - human.maxSquadSize} more — squads are capped at ${human.maxSquadSize}.` };
        if (overseas > human.maxOverseas) return { ok: false, message: `Release ${overseas - human.maxOverseas} more overseas player(s) — the cap is ${human.maxOverseas}.` };
        if (committed > human.totalPurse) return { ok: false, message: 'Your kept salaries exceed the purse. Release more players.' };

        // CPU releases normally happen at the season rollover. A campaign that STARTS in
        // a mini year (Real IPL cycle) has had no rollover, so the CPUs release now.
        const cpuLog: TransactionRecord[] = [];
        const cpusPending = state.careerState.cpuReleaseSeason !== state.currentSeason;
        const franchises = state.franchises.map((f) => {
          if (f.id === human.id) {
            return { ...f, players: kept, retainedPlayers: kept, releasedPlayers: released, remainingPurse: f.totalPurse - committed };
          }
          if (!cpusPending) return { ...f, retainedPlayers: f.players };
          const plan = planCpuMiniReleases(f, (p) => salaryLakhs(p, contracts), f.totalPurse, state.currentSeason);
          const out = new Set(plan.release.map((p) => p.id));
          const cpuKept = f.players.filter((p) => !out.has(p.id));
          cpuLog.push(...plan.release.map((p) => txn(state.currentSeason, 'Released', f.id, p, salaryLakhs(p, contracts), 'Mini')));
          return { ...f, players: cpuKept, retainedPlayers: cpuKept, releasedPlayers: plan.release, remainingPurse: f.totalPurse - plan.keptSalary };
        });
        // Every kept player is carried as a "retention" so registration keeps him off the pool.
        const decisions: RetentionDecision[] = franchises.flatMap((f) =>
          f.players.map((p, i) => ({ franchiseId: f.id, playerId: p.id, playerName: p.name, retentionNumber: i + 1, cost: salaryLakhs(p, contracts), isRTM: false }))
        );
        const log = [...released.map((p) => txn(state.currentSeason, 'Released', human.id, p, salaryLakhs(p, contracts), 'Mini')), ...cpuLog];
        set({
          franchises,
          retentionDecisions: decisions,
          retentionComplete: true,
          careerState: { ...state.careerState, cpuReleaseSeason: state.currentSeason, transactions: addTransactions(state.careerState.transactions, log) },
          updatedAt: Date.now(),
        });
        return { ok: true, message: released.length ? `Released ${released.length} player(s).` : 'Kept the full squad.' };
      },

      initializeRegistration: () => {
        const state = get();
        const retainedIds = new Set(state.retentionDecisions.map((d) => d.playerId));
        // Players not retained are released back into the pool. Without clearing their old
        // franchise tag the eligibility engine treats them as "under contract" and silently
        // drops every released star from the auction.
        const releasedPlayers = state.allPlayers.map((p) =>
          retainedIds.has(p.id)
            ? { ...p, isRetained: true }
            : { ...p, isRetained: false, currentFranchiseId: null, isSold: false, soldPrice: 0 }
        );
        // Eligibility filtering was previously skipped whenever a retained-ID set was
        // passed, letting retired/withdrawn players into the auction pool.
        const { registeredPlayers, summary } = generateAuctionRegistrationPool(
          releasedPlayers,
          retainedIds,
          undefined,
          { filterEligibility: true, seasonYear: state.currentSeason }
        );
        const windowType = auctionTypeFor(state.currentSeason, state.settings);
        let pool = registeredPlayers;
        if (windowType === 'Mini') {
          // Mini auctions are small: this window's releases, the new intake, and only the
          // best of the unsigned free agents (about two players per slot teams will fill).
          const releasedNow = new Set(
            (state.careerState.transactions || []).filter((t) => t.season === state.currentSeason && t.type === 'Released').map((t) => t.playerId)
          );
          const isNew = (id: string) => id.startsWith(`gen_${state.currentSeason}_`);
          // Domestic breakouts always register: they are the off-season's story.
          const breakout = (p: Player) => isFreshDomesticBreakout(p, state.currentSeason) && p.nationality === 'Indian';
          // Realistic demand: teams top up to ~21, not to the 25 cap.
          const need = state.franchises.reduce((t, f) => t + Math.max(0, 21 - f.players.length), 0);
          const target = Math.max(90, Math.min(140, Math.round(need * 2.2)));
          const core = registeredPlayers.filter((p) => releasedNow.has(p.id) || isNew(p.id) || breakout(p));
          // Scouts register more than the highest overalls: about a quarter of the open
          // spots go to prospects — young uncapped Indians with upside and anyone coming
          // off a breakout domestic season (the next Shashank or Ashutosh).
          const others = registeredPlayers.filter(
            (p) => !releasedNow.has(p.id) && !isNew(p.id) && !breakout(p) && isWorthRegistering(p, state.currentSeason)
          );
          const open = Math.max(0, target - core.length);
          const isProspect = (p: Player) =>
            p.nationality === 'Indian' &&
            p.status === 'Uncapped' &&
            ((p.development?.trend === 'Domestic breakout' && p.development.season >= state.currentSeason - 1) ||
              (p.age <= 23 && p.ratings.potential - p.ratings.overall >= 8));
          const prospectScore = (p: Player) =>
            p.ratings.potential + (p.development?.trend === 'Domestic breakout' ? 12 : 0) - Math.max(0, p.age - 21);
          const prospects = others
            .filter(isProspect)
            .sort((a, b) => prospectScore(b) - prospectScore(a))
            .slice(0, Math.round(open * 0.25));
          const taken = new Set(prospects.map((p) => p.id));
          // Overseas registrations scale with the overseas slots teams actually have free
          // (most squads carry 7–8 already); the rest of the room goes to Indians.
          const overseasOpen = state.franchises.reduce(
            (t, f) => t + Math.max(0, (f.maxOverseas ?? 8) - f.players.filter((p) => p.nationality === 'Overseas').length),
            0
          );
          let overseasRoom = Math.max(8, Math.round(overseasOpen * 3)) - core.filter((p) => p.nationality === 'Overseas').length;
          const rest: RegisteredPlayer[] = [];
          for (const p of others.filter((p) => !taken.has(p.id)).sort((a, b) => b.ratings.overall - a.ratings.overall)) {
            if (rest.length >= Math.max(0, open - prospects.length)) break;
            if (p.nationality === 'Overseas') {
              if (overseasRoom <= 0) continue;
              overseasRoom--;
            }
            rest.push(p);
          }
          pool = [...core, ...prospects, ...rest];
        }
        // Pass the human id when there is no list yet; otherwise the generator treats the
        // human as a CPU and silently fills their shortlist with ~80 auto-picked players.
        const cpuShortlists = generateAllFranchiseShortlists(
          state.franchises,
          pool,
          state.franchiseShortlists[state.humanFranchiseId] ?? state.humanFranchiseId,
          state.currentSeason
        );
        const retainLog =
          windowType === 'Mega'
            ? state.retentionDecisions.flatMap((d) => {
                const p = state.allPlayers.find((x) => x.id === d.playerId);
                return p ? [txn(state.currentSeason, 'Retained', d.franchiseId, p, d.cost, 'Mega')] : [];
              })
            : [];

        set({
          allPlayers: releasedPlayers,
          careerState: {
            ...state.careerState,
            contracts: syncRosterContracts(state.franchises, state.careerState.contracts, state.retentionDecisions, state.currentSeason, windowType),
            transactions: addTransactions(state.careerState.transactions, retainLog),
          },
          registrationPool: pool,
          registrationSummary: summary,
          franchiseShortlists: cpuShortlists,
          phase: 'Registration',
          lastActivePhase: 'Registration',
          updatedAt: Date.now(),
        });
      },

      updateHumanShortlist: (playerId, priority, notes, maxBid) => {
        const state = get();
        const humanId = state.humanFranchiseId;
        const currentList = state.franchiseShortlists[humanId] || {
          franchiseId: humanId,
          seasonYear: state.currentSeason,
          entries: {},
        };

        const updatedEntries = {
          ...currentList.entries,
          [playerId]: {
            playerId,
            franchiseId: humanId,
            priority,
            scoutingNotes: notes,
            targetMaxBidLakhs: maxBid,
            addedTimestamp: Date.now(),
          },
        };

        set({
          franchiseShortlists: {
            ...state.franchiseShortlists,
            [humanId]: {
              ...currentList,
              entries: updatedEntries,
            },
          },
          updatedAt: Date.now(),
        });
      },

      removeHumanShortlist: (playerId) => {
        const state = get();
        const humanId = state.humanFranchiseId;
        const currentList = state.franchiseShortlists[humanId];
        if (!currentList) return;

        const updatedEntries = { ...currentList.entries };
        delete updatedEntries[playerId];

        set({
          franchiseShortlists: {
            ...state.franchiseShortlists,
            [humanId]: {
              ...currentList,
              entries: updatedEntries,
            },
          },
          updatedAt: Date.now(),
        });
      },

      compileAuctionPool: () => {
        const state = get();
        const compilation = compileFinalAuctionPool(
          state.registrationPool,
          state.franchiseShortlists,
          500
        );

        // Check feasibility and auto-supplement if needed
        const feasibility = checkAndEnsureAuctionPoolFeasibility(
          state.franchises,
          compilation.finalAuctionPool,
          state.registrationPool,
          state.squadRules
        );

        // Generate dynamic auction sequence with fresh seed
        const auctionSeed = Math.floor(Math.random() * 1000000) + 1;

        // Create new auction session with the dynamic sequenced pool
        const session = createAuctionSession(
          state.franchises,
          feasibility.finalPool,
          {
            seasonYear: state.currentSeason,
            auctionType: auctionTypeFor(state.currentSeason, state.settings),
            pace: state.settings.auctionPace,
            totalRounds: 3,
            seed: auctionSeed,
          }
        );

        // Group final pool players into their dynamically generated sets for the UI
        const dynamicSetMap = buildSetMap(session);

        set({
          finalAuctionPool: session.playerPool as RegisteredPlayer[],
          auctionSets: Object.keys(dynamicSetMap).length > 0 ? dynamicSetMap : compilation.auctionSets,
          auctionSession: session,
          phase: 'ShortlistReveal',
          lastActivePhase: 'ShortlistReveal',
          updatedAt: Date.now(),
        });
      },

      setSquadRules: (rules) => set({ squadRules: rules, updatedAt: Date.now() }),

      // The auction session is the source of truth for squads while bidding;
      // mirror it onto `franchises` so every screen (header, squads viewer) agrees.
      setAuctionSession: (session) =>
        set((state) => ({
          auctionSession: session,
          franchises: syncFranchisesFromSession(state.franchises, session),
          updatedAt: Date.now(),
        })),

      updateAuctionSession: (updates) =>
        set((state) => ({
          auctionSession: state.auctionSession
            ? { ...state.auctionSession, ...updates }
            : null,
          updatedAt: Date.now(),
        })),

      updateAuctionState: (auctionState) =>
        set((state) => ({
          auctionSession: state.auctionSession
            ? { ...state.auctionSession, state: auctionState }
            : null,
          updatedAt: Date.now(),
        })),

      setCurrentLot: (lot) =>
        set((state) => ({
          auctionSession: state.auctionSession
            ? { ...state.auctionSession, currentLot: lot }
            : null,
          updatedAt: Date.now(),
        })),

      addAuctionBid: (bid) =>
        set((state) => {
          if (!state.auctionSession?.currentLot) return {};
          return {
            auctionSession: {
              ...state.auctionSession,
              currentLot: {
                ...state.auctionSession.currentLot,
                currentBid: bid.amount,
                currentBidderId: bid.franchiseId,
                bids: [...state.auctionSession.currentLot.bids, bid],
              },
            },
            updatedAt: Date.now(),
          };
        }),

      addAuctionPurchase: (purchase) =>
        set((state) => ({
          auctionSession: state.auctionSession
            ? {
                ...state.auctionSession,
                soldPlayers: [...state.auctionSession.soldPlayers, purchase],
              }
            : null,
          updatedAt: Date.now(),
        })),

      completeAuction: () =>
        set((state) => {
          if (!state.auctionSession) return { auctionComplete: true, updatedAt: Date.now() };
          // Guarantee every franchise (including the human) meets the 18-player minimum.
          const { session } = finalizeAuction(state.auctionSession);
          session.state = 'COMPLETED';
          const franchises = syncFranchisesFromSession(state.franchises, session);
          const owner = new Map<string, { franchiseId: string; price: number }>();
          for (const f of franchises) {
            for (const p of f.players) owner.set(p.id, { franchiseId: f.id, price: p.soldPrice || p.currentContractValue });
          }
          const allPlayers = state.allPlayers.map((p) => {
            const o = owner.get(p.id);
            if (o) return { ...p, currentFranchiseId: o.franchiseId, isSold: true, soldPrice: o.price };
            return p.currentFranchiseId && !state.retentionDecisions.some((d) => d.playerId === p.id)
              ? { ...p, currentFranchiseId: null }
              : p;
          });
          const windowType = auctionTypeFor(state.currentSeason, state.settings);
          const contracts = syncRosterContracts(franchises, state.careerState.contracts, state.retentionDecisions, state.currentSeason, windowType);
          const kept = new Set(state.retentionDecisions.map((d) => d.playerId));
          const signings = franchises.flatMap((f) =>
            f.players
              .filter((p) => !kept.has(p.id))
              .map((p) => txn(state.currentSeason, 'Signed', f.id, p, p.soldPrice || p.currentContractValue || p.basePrice, windowType))
          );
          return {
            auctionSession: session,
            franchises,
            allPlayers,
            auctionComplete: true,
            careerState: { ...state.careerState, contracts, transactions: addTransactions(state.careerState.transactions, signings) },
            updatedAt: Date.now(),
          };
        }),

      setFixtures: (fixtures) => set({ fixtures, updatedAt: Date.now() }),

      updateFixture: (index, updates) =>
        set((state) => ({
          fixtures: state.fixtures.map((f, i) =>
            i === index ? { ...f, ...updates } : f
          ),
          updatedAt: Date.now(),
        })),

      setStandings: (standings) => set({ standings, updatedAt: Date.now() }),

      updateStandings: (standings) => set({ standings, updatedAt: Date.now() }),

      setCurrentFixtureIndex: (index) =>
        set({ currentFixtureIndex: index, updatedAt: Date.now() }),

      advanceFixture: () =>
        set((state) => ({
          currentFixtureIndex: state.currentFixtureIndex + 1,
          updatedAt: Date.now(),
        })),

      setCurrentMatch: (result) =>
        set({ currentMatch: result, updatedAt: Date.now() }),

      setPlayingXI: (franchiseId, xi) =>
        set((state) => ({
          playingXIs: { ...state.playingXIs, [franchiseId]: xi },
          updatedAt: Date.now(),
        })),

      // Callers pass ONE match's numbers; they are added to the season totals.
      // (Previously each match overwrote the last, so awards reflected one game.)
      updatePlayerSeasonStats: (playerId, stats) =>
        set((state) => {
          const prev = state.playerSeasonStats[playerId] || createEmptySeasonStats(playerId, state.currentSeason, '');
          const add = (k: keyof PlayerSeasonStats) => ((prev[k] as number) || 0) + ((stats[k] as number) || 0);
          const batted = stats.ballsFaced !== undefined || stats.runs !== undefined;
          const runs = add('runs');
          const ballsFaced = add('ballsFaced');
          const innings = batted ? Math.max(add('innings'), (prev.innings || 0) + 1) : prev.innings || 0;
          const wickets = add('wickets');
          const oversBowled = add('oversBowled');
          const runsConceded = add('runsConceded');
          const matchRuns = stats.runs || 0;
          const next: PlayerSeasonStats = {
            ...prev,
            runs,
            ballsFaced,
            innings,
            // One appearance per match is passed explicitly by the match recorders.
            matches: stats.matches !== undefined ? add('matches') : Math.max(prev.matches || 0, innings),
            fours: add('fours'),
            sixes: add('sixes'),
            fifties: (prev.fifties || 0) + (matchRuns >= 50 && matchRuns < 100 ? 1 : 0),
            hundreds: (prev.hundreds || 0) + (matchRuns >= 100 ? 1 : 0),
            highScore: Math.max(prev.highScore || 0, matchRuns),
            battingAverage: innings ? runs / innings : 0,
            strikeRate: ballsFaced ? (runs / ballsFaced) * 100 : 0,
            wickets,
            oversBowled,
            runsConceded,
            bowlingAverage: wickets ? runsConceded / wickets : 0,
            economyRate: oversBowled ? runsConceded / oversBowled : 0,
          };
          return { playerSeasonStats: { ...state.playerSeasonStats, [playerId]: next }, updatedAt: Date.now() };
        }),

      recordMatchForm: (m) =>
        set((state) => {
          const season = state.currentSeason;
          const lines = linesFromInnings(m.batsmen, m.bowlers);
          const played = new Set([...m.team1XI, ...m.team2XI]);
          const blooded = new Set(
            [state.playingXIs[m.team1Id]?.bloodedId, state.playingXIs[m.team2Id]?.bloodedId].filter(
              (id): id is string => !!id && played.has(id)
            )
          );
          const updated = new Map<string, Player>();
          const teams = state.franchises.filter((f) => f.id === m.team1Id || f.id === m.team2Id);
          for (const f of teams) {
            for (const p of f.players) updated.set(p.id, applyMatchToPlayer(p, season, played.has(p.id), lines.get(p.id), blooded.has(p.id)));
          }
          const franchises = state.franchises.map((f) =>
            f.id === m.team1Id || f.id === m.team2Id ? { ...f, players: f.players.map((p) => updated.get(p.id) ?? p) } : f
          );
          const allPlayers = state.allPlayers.map((p) => updated.get(p.id) ?? p);
          const playingXIs = { ...state.playingXIs };
          for (const f of franchises) {
            if ((f.id !== m.team1Id && f.id !== m.team2Id) || f.id === state.humanFranchiseId) continue;
            const rng = mulberry32((hashString(`${m.matchKey}:${f.id}`) ^ (state.settings.seed ?? 0)) >>> 0);
            playingXIs[f.id] = selectCpuXI(f, { rng, season, mustWin: m.mustWin });
          }
          return { franchises, allPlayers, playingXIs, updatedAt: Date.now() };
        }),

      initializePlayerSeasonStats: (players) =>
        set((state) => {
          const stats: Record<string, PlayerSeasonStats> = {};
          players.forEach((p) => {
            stats[p.id] = createEmptySeasonStats(p.id, state.currentSeason, p.currentFranchiseId || '');
          });
          return { playerSeasonStats: stats, updatedAt: Date.now() };
        }),

      setSeasonAwards: (awards) => set({ seasonAwards: awards, updatedAt: Date.now() }),

      setPlayoffFixtures: (fixtures) =>
        set({ playoffFixtures: fixtures, updatedAt: Date.now() }),

      addSeasonSummary: (summary) =>
        set((state) => ({
          seasonHistory: [...state.seasonHistory, summary],
          updatedAt: Date.now(),
        })),

      updateCareerState: (updates) =>
        set((state) => ({
          careerState: { ...state.careerState, ...updates },
          updatedAt: Date.now(),
        })),

      releaseHumanPlayer: (playerId) =>
        set((state) => {
          const humanFranchise = state.franchises.find((f) => f.id === state.humanFranchiseId);
          if (!humanFranchise) return state;

          const { updatedFranchise, updatedContracts, releasedPlayer } = releasePlayerFromFranchise(
            humanFranchise,
            playerId,
            state.careerState.contracts
          );

          if (!releasedPlayer) return state;

          return {
            franchises: state.franchises.map((f) => (f.id === humanFranchise.id ? updatedFranchise : f)),
            allPlayers: state.allPlayers.map((p) => (p.id === playerId ? releasedPlayer : p)),
            careerState: {
              ...state.careerState,
              contracts: updatedContracts,
            },
            updatedAt: Date.now(),
          };
        }),

      advanceSeason: () => {
        const state = get();
        // A campaign is one mega cycle (3 seasons); there is no season after the last.
        if (isFinalSeason(state.currentSeason, state.settings)) return;
        const result = executeSeasonAdvance(state, state.careerState);
        const contracts = state.careerState.contracts;
        const releaseLog = result.cpuReleases.map(({ franchiseId, player }) =>
          txn(result.updatedGameState.currentSeason, 'Released', franchiseId, player, salaryLakhs(player, contracts), 'Mini')
        );
        set({
          ...result.updatedGameState,
          // A new season starts with a clean slate of scouting targets.
          franchiseShortlists: {},
          registrationPool: [],
          registrationSummary: null,
          finalAuctionPool: [],
          auctionSets: {},
          careerState: {
            ...result.updatedCareerState,
            // Trade history, cash accounts and blocks carry across seasons.
            trade: state.careerState.trade
              ? {
                  ...rollTradeSeason(state.careerState.trade, result.updatedGameState.currentSeason),
                  tradeRequests: generateTradeRequests(
                    result.updatedGameState.franchises,
                    result.updatedGameState.currentSeason,
                    state.settings.seed || 1,
                    state.humanFranchiseId
                  ),
                }
              : undefined,
            transactions: addTransactions(state.careerState.transactions, releaseLog),
            cpuReleaseSeason: result.upcomingAuctionType === 'Mini' ? result.updatedGameState.currentSeason : undefined,
          },
          updatedAt: Date.now(),
        });
      },

      saveGame: () => {
        const state = get();
        saveCareerToSlot(0, state, state.careerState, 'Autosave');
        set({ savedAt: Date.now() });
      },

      saveToSlot: (slotNumber: number, name?: string) => {
        const state = get();
        saveCareerToSlot(slotNumber, state, state.careerState, name);
        set({ savedAt: Date.now() });
      },

      loadFromSlot: (slotNumber: number) => {
        const payload = loadCareerFromSlot(slotNumber);
        if (!payload) return false;
        set({
          ...payload.gameState,
          careerState: payload.careerState,
          savedAt: payload.savedAt,
          updatedAt: Date.now(),
        });
        return true;
      },
    }),
    {
      name: 'ipl-dynasty-save',
      storage: createCompactStorage<Partial<GameStore>>(),
      partialize: (state) => ({
        id: state.id,
        phase: state.phase,
        lastActivePhase: state.lastActivePhase,
        tradeReturnPhase: state.tradeReturnPhase,
        // Only the human shortlist is persisted (small); CPU lists and the
        // registration pool are regenerated by ensurePhaseData() after reload.
        franchiseShortlists: state.franchiseShortlists[state.humanFranchiseId]
          ? { [state.humanFranchiseId]: state.franchiseShortlists[state.humanFranchiseId] }
          : {},
        settings: state.settings,
        currentSeason: state.currentSeason,
        humanFranchiseId: state.humanFranchiseId,
        franchises: state.franchises,
        allPlayers: state.allPlayers,
        careerState: state.careerState,
        retentionDecisions: state.retentionDecisions,
        retentionComplete: state.retentionComplete,
        auctionSession: state.auctionSession,
        auctionComplete: state.auctionComplete,
        fixtures: state.fixtures,
        standings: state.standings,
        currentFixtureIndex: state.currentFixtureIndex,
        playerSeasonStats: state.playerSeasonStats,
        playingXIs: state.playingXIs,
        playoffFixtures: state.playoffFixtures,
        seasonAwards: state.seasonAwards,
        seasonHistory: state.seasonHistory,
        careerYear: state.careerYear,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        savedAt: state.savedAt,
      }),
    }
  )
);

function createEmptySeasonStats(playerId: string, season: number, franchiseId: string): PlayerSeasonStats {
  return {
    playerId,
    seasonYear: season,
    franchiseId,
    matches: 0,
    innings: 0,
    runs: 0,
    ballsFaced: 0,
    battingAverage: 0,
    strikeRate: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    highScore: 0,
    wickets: 0,
    oversBowled: 0,
    runsConceded: 0,
    bowlingAverage: 0,
    economyRate: 0,
    bestBowling: '0/0',
    catches: 0,
    playerOfMatch: 0,
    dotBallPercentage: 0,
    boundaryPercentage: 0,
    powerplayRuns: 0,
    deathOverRuns: 0,
    powerplayWickets: 0,
    deathOverWickets: 0,
  };
}

