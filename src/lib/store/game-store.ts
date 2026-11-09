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
import type { CareerState } from '@/lib/types/career';
import type { RegisteredPlayer, RegistrationSummary } from '@/lib/types/registration';
import type { FranchiseShortlist, ShortlistPriority } from '@/lib/types/scouting';
import type { SquadRules } from '@/lib/types/squad-rules';
import { OFFICIAL_IPL_SQUAD_RULES } from '@/lib/types/squad-rules';
import { generateAuctionRegistrationPool } from '@/lib/engines/registration/registration-engine';
import { generateAllFranchiseShortlists } from '@/lib/engines/scouting/cpu-shortlist-generator';
import { compileFinalAuctionPool } from '@/lib/engines/auction/shortlist-compiler';
import { checkAndEnsureAuctionPoolFeasibility } from '@/lib/engines/auction/feasibility-checker';
import { createAuctionSession } from '@/lib/engines/auction-engine';
import { executeSeasonAdvance } from '@/lib/engines/career/multi-season-controller';
import { initializeFranchiseHistory } from '@/lib/engines/career/history-tracker';
import { createInitialContracts, releasePlayerFromFranchise } from '@/lib/engines/career/contract-engine';
import { saveCareerToSlot, loadCareerFromSlot } from '@/lib/engines/career/save-manager';

interface GameStore extends GameState {
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
  initializePlayerSeasonStats: (players: Player[]) => void;

  // Awards
  setSeasonAwards: (awards: SeasonAward[]) => void;

  // Playoffs
  setPlayoffFixtures: (fixtures: Fixture[]) => void;

  // Career & Dynasty
  careerState: CareerState;
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

      initializeGame: (settings, humanFranchiseId, franchises, players) => {
        const now = Date.now();
        const initHistory = initializeFranchiseHistory(franchises);
        const initContracts = createInitialContracts(franchises, settings.startingSeason, settings.auctionType);

        set({
          id: `game-${now}`,
          phase: 'Retention',
          settings,
          currentSeason: settings.startingSeason,
          humanFranchiseId,
          franchises: franchises.map((f) => ({
            ...f,
            players: players.filter((p) => p.currentFranchiseId === f.id),
            isHumanControlled: f.id === humanFranchiseId,
            cpuDifficulty: settings.cpuDifficulty,
          })),
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
          },
          retentionDecisions: [],
          retentionComplete: false,
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

      resetGame: () => set(initialState),

      setPhase: (phase) => set({ phase, updatedAt: Date.now() }),

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

      initializeRegistration: () => {
        const state = get();
        const retainedIds = new Set(state.retentionDecisions.map((d) => d.playerId));
        const { registeredPlayers, summary } = generateAuctionRegistrationPool(
          state.allPlayers,
          retainedIds
        );
        const cpuShortlists = generateAllFranchiseShortlists(
          state.franchises,
          registeredPlayers,
          state.franchiseShortlists[state.humanFranchiseId]
        );

        set({
          registrationPool: registeredPlayers,
          registrationSummary: summary,
          franchiseShortlists: cpuShortlists,
          phase: 'Registration',
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
            auctionType: state.settings.auctionType,
            pace: state.settings.auctionPace,
            totalRounds: 3,
            seed: auctionSeed,
          }
        );

        // Group final pool players into their dynamically generated sets for the UI
        const dynamicSetMap: Record<string, RegisteredPlayer[]> = {};
        if (session.sets && session.setAssignments) {
          const playerLookup = new Map(feasibility.finalPool.map((p) => [p.id, p]));
          for (const s of session.sets) {
            dynamicSetMap[s.code] = s.playerIds
              .map((id) => playerLookup.get(id))
              .filter(Boolean) as RegisteredPlayer[];
          }
        }

        set({
          finalAuctionPool: session.playerPool as RegisteredPlayer[],
          auctionSets: Object.keys(dynamicSetMap).length > 0 ? dynamicSetMap : compilation.auctionSets,
          auctionSession: session,
          phase: 'ShortlistReveal',
          updatedAt: Date.now(),
        });
      },

      setSquadRules: (rules) => set({ squadRules: rules, updatedAt: Date.now() }),

      setAuctionSession: (session) =>
        set({ auctionSession: session, updatedAt: Date.now() }),

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

      completeAuction: () => set({ auctionComplete: true, updatedAt: Date.now() }),

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

      updatePlayerSeasonStats: (playerId, stats) =>
        set((state) => ({
          playerSeasonStats: {
            ...state.playerSeasonStats,
            [playerId]: {
              ...(state.playerSeasonStats[playerId] || createEmptySeasonStats(playerId, state.currentSeason, '')),
              ...stats,
            },
          },
          updatedAt: Date.now(),
        })),

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
        const result = executeSeasonAdvance(state, state.careerState);
        set({
          ...result.updatedGameState,
          careerState: result.updatedCareerState,
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
      partialize: (state) => ({
        id: state.id,
        phase: state.phase,
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

