// ============================================================
// IPL DYNASTY - Multi-Season Career & Dynasty Controller
// Orchestrates the end-to-end multi-season lifecycle:
// Season review -> Records -> Player Dev -> Retirements -> Rookies
// -> Contracts -> Mini/Mega Rules -> Pre-Auction Decisions -> Next Season
// ============================================================

import type { GameState, Franchise, Player, StandingsEntry, SeasonAward, PlayerSeasonStats, AuctionType } from '@/lib/types/game';
import type { CareerState, PlayerProgressionDelta, RetirementRecord, LeagueStoryline } from '@/lib/types/career';
import { progressAllPlayers } from './player-progression';
import { processSeasonRetirements } from './retirement-engine';
import { generateRookieDraftClass } from './player-generator';
import {
  getAuctionTypeForSeason,
  getLeaguePurseForSeason,
  advanceContractsForNewSeason,
  createInitialContracts,
} from './contract-engine';
import { evaluateCpuSeasonAndPlan, executeCpuPreAuctionDecisions } from './cpu-franchise-career';
import { recordSeasonForFranchises, recordSeasonForPlayers } from './history-tracker';
import { generateSeasonStorylines } from './storylines';

export interface SeasonTransitionResult {
  updatedGameState: GameState;
  updatedCareerState: CareerState;
  progressionDeltas: PlayerProgressionDelta[];
  newRetirements: RetirementRecord[];
  newRookies: Player[];
  storylines: LeagueStoryline[];
  upcomingAuctionType: AuctionType;
  newLeaguePurse: number;
}

/**
 * Executes the complete multi-season transition from season T to season T+1.
 */
export function executeSeasonAdvance(
  gameState: GameState,
  careerState: CareerState
): SeasonTransitionResult {
  const currentSeason = gameState.currentSeason;
  const nextSeason = currentSeason + 1;
  const upcomingAuctionType = getAuctionTypeForSeason(nextSeason);
  const newLeaguePurse = getLeaguePurseForSeason(nextSeason);

  // 1. Identify Champion and Runner-up
  const finalMatch = gameState.playoffFixtures.find((f) => f.playoffType === 'Final' && f.isCompleted);
  let championId = finalMatch?.result?.winnerId || '';
  let runnerUpId = '';
  if (finalMatch?.result) {
    runnerUpId = finalMatch.result.winnerId === finalMatch.result.team1Id ? finalMatch.result.team2Id : finalMatch.result.team1Id;
  }
  if (!championId) {
    // Fallback to top standings if playoffs weren't played
    const sortedStandings = [...gameState.standings].sort((a, b) => b.points - a.points);
    championId = sortedStandings[0]?.franchiseId || 'mi';
    runnerUpId = sortedStandings[1]?.franchiseId || 'csk';
  }

  // 2. Update Franchise & Player Career Historical Records
  const updatedFranchiseHistory = recordSeasonForFranchises(
    careerState.franchiseHistory,
    gameState.franchises,
    gameState.standings,
    championId,
    runnerUpId,
    currentSeason,
    gameState.playerSeasonStats
  );

  const updatedPlayerRecords = recordSeasonForPlayers(
    careerState.playerCareerRecords,
    gameState.allPlayers,
    gameState.playerSeasonStats,
    gameState.seasonAwards,
    championId,
    currentSeason
  );

  // 3. Player Development & Aging
  const { updatedPlayers: developedPlayers, deltas: progressionDeltas } = progressAllPlayers(
    gameState.allPlayers,
    gameState.playerSeasonStats,
    nextSeason
  );

  // 4. Probabilistic Retirements
  const {
    activePlayers,
    retiredPlayers,
    retirementRecords: newRetirements,
  } = processSeasonRetirements(developedPlayers, gameState.playerSeasonStats, currentSeason, gameState.settings.seed);

  // 5. Generate Rookie Draft Class (24 new domestic and international talents)
  const newRookies = generateRookieDraftClass(nextSeason, 24);
  const fullPlayerPool = [...activePlayers, ...newRookies];

  // 6. Contract Advancement & Pre-Auction Setup
  let currentContracts = { ...careerState.contracts };
  // If first transition, ensure initial contracts exist
  if (Object.keys(currentContracts).length === 0) {
    currentContracts = createInitialContracts(gameState.franchises, currentSeason, 'Mega');
  }
  const advancedContracts = advanceContractsForNewSeason(currentContracts, nextSeason);

  // 7. Dynamic Storylines Generation
  const newStorylines = generateSeasonStorylines(
    currentSeason,
    gameState.franchises,
    gameState.standings,
    gameState.seasonAwards,
    gameState.playerSeasonStats,
    developedPlayers,
    championId,
    runnerUpId,
    updatedFranchiseHistory,
    newRetirements
  );

  // 8. CPU Pre-Auction Processing (Releases in Mini Auction or Retentions in Mega Auction)
  const updatedFranchises: Franchise[] = [];
  let updatedContractsPostAuction = { ...advancedContracts };
  const releasedPool: Player[] = [];

  for (const franchise of gameState.franchises) {
    // Sync franchise players with developed, non-retired players
    const currentActivePlayers = franchise.players
      .filter((p) => !retiredPlayers.some((rp) => rp.id === p.id))
      .map((p) => developedPlayers.find((dp) => dp.id === p.id) || p);

    let syncedFranchise: Franchise = {
      ...franchise,
      totalPurse: newLeaguePurse,
      players: currentActivePlayers,
    };

    if (franchise.id !== gameState.humanFranchiseId) {
      // CPU franchise executes automated decisions
      const postMortem = evaluateCpuSeasonAndPlan(
        syncedFranchise,
        gameState.standings,
        currentSeason,
        franchise.id === championId
      );

      const cpuDecisions = executeCpuPreAuctionDecisions(
        syncedFranchise,
        upcomingAuctionType,
        updatedContractsPostAuction,
        postMortem,
        nextSeason
      );

      syncedFranchise = cpuDecisions.updatedFranchise;
      updatedContractsPostAuction = cpuDecisions.updatedContracts;
      releasedPool.push(...cpuDecisions.releasedPlayers);
    } else {
      // Human franchise: in Mini auction keep roster until user releases; in Mega auction reset to retentions
      if (upcomingAuctionType === 'Mega') {
        syncedFranchise.retainedPlayers = [];
        syncedFranchise.remainingPurse = newLeaguePurse;
      } else {
        const spent = syncedFranchise.players.reduce(
          (sum, p) => sum + (p.soldPrice || p.currentContractValue || p.basePrice),
          0
        );
        syncedFranchise.remainingPurse = Math.max(0, newLeaguePurse - spent);
      }
    }

    updatedFranchises.push(syncedFranchise);
  }

  // 9. Prepare New Game State for Season T+1
  const updatedGameState: GameState = {
    ...gameState,
    currentSeason: nextSeason,
    careerYear: gameState.careerYear + 1,
    phase: 'Retention',
    franchises: updatedFranchises,
    allPlayers: fullPlayerPool,
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
    updatedAt: Date.now(),
  };

  const updatedCareerState: CareerState = {
    currentSeason: nextSeason,
    contracts: updatedContractsPostAuction,
    retirements: [...careerState.retirements, ...newRetirements],
    franchiseHistory: updatedFranchiseHistory,
    playerCareerRecords: updatedPlayerRecords,
    storylines: [...newStorylines, ...careerState.storylines],
    recentProgressionDeltas: progressionDeltas,
    activeSaveSlot: careerState.activeSaveSlot,
  };

  return {
    updatedGameState,
    updatedCareerState,
    progressionDeltas,
    newRetirements,
    newRookies,
    storylines: newStorylines,
    upcomingAuctionType,
    newLeaguePurse,
  };
}

