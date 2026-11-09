// ============================================================
// IPL DYNASTY - CPU Manager AI
// Multi-layered decision engine: Dynamic utility model U = Q + N + S + F - C,
// tactical role coverage (11 roles), opponent modeling, and Monte Carlo planning.
// ============================================================

import type {
  Franchise,
  Player,
  AuctionSession,
  AuctionLot,
  SeededRandom,
} from '@/lib/types/game';
import {
  decideCPUBid,
  calculateSpendingLimit,
  calculateDynamicUtility,
  calculatePlayerQuality,
  calculateRoleScarcity,
  calculateOpportunityCost,
  CpuGMDecision,
} from './cpu-gm/cpu-gm-engine';
import {
  getPlayerTacticalRoles,
  evaluateTacticalNeed,
  TacticalRole,
} from './cpu-gm/tactical-roles';
import {
  FRANCHISE_STRATEGY_PROFILES,
  FranchiseProfile,
} from './cpu-gm/opponent-model';

// Backward compatible export type
export type CpuBidDecision = CpuGMDecision;

/** Main CPU bidding decision function. */
export function cpuDecideBid(
  franchise: Franchise,
  currentLot: AuctionLot,
  session: AuctionSession,
  rng: SeededRandom
): CpuBidDecision {
  return decideCPUBid(franchise, currentLot, session, rng);
}

/** Calculate player value based on spending limit and utility. */
export function calculatePlayerValue(
  player: Player,
  franchise: Franchise,
  session: AuctionSession
): number {
  return calculateSpendingLimit(franchise, player, session);
}

/** Evaluate need for a player based on tactical role coverage. */
export function evaluateNeed(franchise: Franchise, player: Player): number {
  return evaluateTacticalNeed(franchise, player) / 10;
}

/** Evaluate scarcity across remaining pool. */
export function evaluateScarcity(player: Player, session: AuctionSession): number {
  return calculateRoleScarcity(player, session) / 10;
}

/** Legacy check for withdraw condition. */
export function shouldWithdraw(
  franchise: Franchise,
  bidAmount: number,
  playerValue: number
): boolean {
  if (bidAmount > playerValue) return true;
  const openSlots = Math.max(0, franchise.minSquadSize - franchise.players.length - 1);
  const minReserve = openSlots * 20;
  return franchise.remainingPurse - bidAmount < minReserve;
}

/** Select best XI IDs based on player ratings. */
export function selectBestXI(franchise: Franchise): string[] {
  return [...franchise.players]
    .sort((a, b) => b.ratings.overall - a.ratings.overall)
    .slice(0, 11)
    .map((p) => p.id);
}

// Re-export advanced modules
export {
  getPlayerTacticalRoles,
  evaluateTacticalNeed,
  FRANCHISE_STRATEGY_PROFILES,
};

export {
  onAuctionLotCompleted,
  getDecisionLogs,
  clearDecisionLogs,
  initializeFranchisePlans,
} from './cpu-gm/cpu-gm-engine';

export {
  getFranchiseActivePersonality,
  evolveFranchisePersonality,
  GM_PERSONALITY_ARCHETYPES,
} from './cpu-gm/personalities';

export {
  getFranchiseShortlist,
} from './cpu-gm/shortlist-manager';
