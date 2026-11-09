// ============================================================
// IPL DYNASTY - Long-Term CPU Franchise Career AI
// Manages CPU season post-mortems, intelligent releases before mini-auctions,
// retention picks before mega-auctions, and dynamic GM persona shifts.
// ============================================================

import type { Franchise, Player, StandingsEntry, AuctionType, RetentionDecision, GMPersonality } from '@/lib/types/game';
import type { PlayerContract } from '@/lib/types/career';
import { calculateFranchiseUpcomingPurse, releasePlayerFromFranchise } from './contract-engine';
import { RETENTION_RULES_2026 } from '@/lib/data/retention-rules';
import { getRetentionCost } from '@/lib/engines/retention-engine';

export interface CpuSeasonPostMortem {
  franchiseId: string;
  seasonPosition: number;
  isChampion: boolean;
  isPlayoffQualifier: boolean;
  squadDiagnosis: 'Contender' | 'PlayoffBubble' | 'RebuildNeeded';
  adjustedGMPersonality: GMPersonality;
  recommendedReleases: string[]; // Player IDs
  targetNeeds: string[]; // Tactical roles to acquire
}

/**
 * Conducts season review and strategic planning for a CPU franchise.
 */
export function evaluateCpuSeasonAndPlan(
  franchise: Franchise,
  standings: StandingsEntry[],
  seasonYear: number,
  isChampion: boolean
): CpuSeasonPostMortem {
  const standing = standings.find((s) => s.franchiseId === franchise.id);
  const position = standing?.position || 5;
  const isPlayoffQualifier = position <= 4;

  let squadDiagnosis: CpuSeasonPostMortem['squadDiagnosis'] = 'PlayoffBubble';
  let adjustedPersonality = franchise.gmPersonality;

  if (isChampion || position === 1) {
    squadDiagnosis = 'Contender';
    // Champions stay confident, focusing on value and core continuity
    adjustedPersonality = 'BalancedBuilder';
  } else if (position <= 4) {
    squadDiagnosis = 'PlayoffBubble';
    adjustedPersonality = 'AnalyticsDriven';
  } else if (position >= 8) {
    squadDiagnosis = 'RebuildNeeded';
    // Bottom-finish franchises shift to aggressive rebuild or youth investment
    adjustedPersonality = position === 10 ? 'Aggressive' : 'YouthFocused';
  }

  // Identify release candidates (overpriced underperformers or aging non-core players)
  const recommendedReleases: string[] = [];

  // Sort squad by value-for-money ratio: rating vs salary
  const sortedByEfficiency = [...franchise.players].sort((a, b) => {
    const costA = a.soldPrice || a.currentContractValue || a.basePrice;
    const costB = b.soldPrice || b.currentContractValue || b.basePrice;
    const efficiencyA = a.ratings.overall / Math.max(20, costA);
    const efficiencyB = b.ratings.overall / Math.max(20, costB);
    return efficiencyA - efficiencyB; // lowest efficiency first
  });

  // Depending on diagnosis, decide number of releases for Mini Auction
  const targetReleaseCount = squadDiagnosis === 'RebuildNeeded' ? 4 : squadDiagnosis === 'PlayoffBubble' ? 3 : 2;

  for (const player of sortedByEfficiency) {
    if (recommendedReleases.length >= targetReleaseCount) break;

    // Never release franchise superstars (90+ OVR) unless over 39 and declining heavily
    if (player.ratings.overall >= 88 && player.age <= 38) continue;

    // Good candidates for release:
    // 1. High price tag (> ₹8 Cr) with low rating (< 75)
    // 2. Older players (> 36) with rating < 76
    // 3. Bench players with rating < 68
    const price = player.soldPrice || player.currentContractValue || player.basePrice;
    const isOverpriced = price >= 800 && player.ratings.overall <= 76;
    const isDecliningVeteran = player.age >= 36 && player.ratings.overall <= 75;
    const isWeakDepth = player.ratings.overall <= 68;

    if (isOverpriced || isDecliningVeteran || isWeakDepth) {
      recommendedReleases.push(player.id);
    }
  }

  // Identify positional needs
  const targetNeeds: string[] = [];
  const pacers = franchise.players.filter((p) => p.role === 'Bowler' && !p.isSpinner).length;
  const spinners = franchise.players.filter((p) => p.isSpinner).length;
  const openers = franchise.players.filter((p) => p.isOpener).length;

  if (pacers < 3) targetNeeds.push('Death-over specialist');
  if (spinners < 2) targetNeeds.push('Wrist spinner');
  if (openers < 2) targetNeeds.push('Opening batter');

  return {
    franchiseId: franchise.id,
    seasonPosition: position,
    isChampion,
    isPlayoffQualifier,
    squadDiagnosis,
    adjustedGMPersonality: adjustedPersonality,
    recommendedReleases,
    targetNeeds,
  };
}

/**
 * Executes automated pre-auction decisions for a CPU franchise.
 * - In Mini Auctions: releases 2-4 underperforming players, replenishing purse.
 * - In Mega Auctions: picks top 4-6 retentions adhering to rules.
 */
export function executeCpuPreAuctionDecisions(
  franchise: Franchise,
  auctionType: AuctionType,
  contracts: Record<string, PlayerContract>,
  postMortem: CpuSeasonPostMortem,
  seasonYear: number
): {
  updatedFranchise: Franchise;
  updatedContracts: Record<string, PlayerContract>;
  releasedPlayers: Player[];
  retentionDecisions: RetentionDecision[];
} {
  let currentFranchise = { ...franchise, gmPersonality: postMortem.adjustedGMPersonality };
  let currentContracts = { ...contracts };
  const releasedPlayers: Player[] = [];
  const retentionDecisions: RetentionDecision[] = [];

  if (auctionType === 'Mini') {
    // Mini Auction: execute releases
    for (const playerId of postMortem.recommendedReleases) {
      const { updatedFranchise, updatedContracts, releasedPlayer } = releasePlayerFromFranchise(
        currentFranchise,
        playerId,
        currentContracts
      );
      if (releasedPlayer) {
        currentFranchise = updatedFranchise;
        currentContracts = updatedContracts;
        releasedPlayers.push(releasedPlayer);
      }
    }

    // Update remaining purse
    const { remainingPurse } = calculateFranchiseUpcomingPurse(
      currentFranchise,
      currentFranchise.players,
      seasonYear
    );
    currentFranchise.remainingPurse = remainingPurse;
  } else {
    // Mega Auction: select up to 4-6 retentions
    // Sort players by quality, youth potential, and star impact
    const retentionCandidates = [...currentFranchise.players].sort((a, b) => {
      const scoreA = a.ratings.overall * 1.5 + (a.age <= 26 ? 10 : 0) + (a.ratings.potential * 0.5);
      const scoreB = b.ratings.overall * 1.5 + (b.age <= 26 ? 10 : 0) + (b.ratings.potential * 0.5);
      return scoreB - scoreA;
    });

    const maxRetain = Math.min(RETENTION_RULES_2026.maxRetentions, 5); // Retain top 4-5
    const retainedPlayersList: Player[] = [];

    for (let slot = 1; slot <= maxRetain && slot <= retentionCandidates.length; slot++) {
      const candidate = retentionCandidates[slot - 1];
      // Only retain high-tier players (78+ OVR)
      if (candidate.ratings.overall < 78) break;

      const cost = getRetentionCost(slot, RETENTION_RULES_2026);
      retentionDecisions.push({
        franchiseId: currentFranchise.id,
        playerId: candidate.id,
        playerName: candidate.name,
        retentionNumber: slot,
        cost,
        isRTM: false,
      });

      const retainedPlayer = { ...candidate, isRetained: true, retentionCost: cost };
      retainedPlayersList.push(retainedPlayer);
    }

    // Non-retained players are released into the mega auction pool
    for (const p of currentFranchise.players) {
      if (!retainedPlayersList.some((rp) => rp.id === p.id)) {
        const released = { ...p, isRetained: false, isSold: false, isAvailableForAuction: true, currentFranchiseId: null };
        releasedPlayers.push(released);
      }
    }

    // Set franchise players to only retained players
    currentFranchise.players = retainedPlayersList;
    currentFranchise.retainedPlayers = retainedPlayersList;

    const totalSpent = retentionDecisions.reduce((sum, r) => sum + r.cost, 0);
    currentFranchise.totalPurse = RETENTION_RULES_2026.totalPurse;
    currentFranchise.remainingPurse = Math.max(0, RETENTION_RULES_2026.totalPurse - totalSpent);
  }

  return {
    updatedFranchise: currentFranchise,
    updatedContracts: currentContracts,
    releasedPlayers,
    retentionDecisions,
  };
}

