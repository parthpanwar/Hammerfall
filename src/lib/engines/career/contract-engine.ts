// ============================================================
// IPL DYNASTY - Multi-Season Contract & Auction Lifecycle Engine
// Tracks player contracts, salary commitments, releases, purse inflation,
// and governs the 3-year Mega / Mini auction cycle.
// ============================================================

import type { Franchise, Player, AuctionType, RetentionRule } from '@/lib/types/game';
import type { PlayerContract } from '@/lib/types/career';

/** Base purse in 2026 is 120 Cr (12,000 Lakhs), increasing by 5 Cr (500 Lakhs) each season */
export function getLeaguePurseForSeason(seasonYear: number): number {
  const inflationYears = Math.max(0, seasonYear - 2026);
  return 12000 + inflationYears * 500;
}

/**
 * Determines whether the upcoming season features a Mega or Mini Auction.
 * Official IPL operates on a 3-year mega auction cycle:
 * 2026: Mega (Season 1 of cycle)
 * 2027: Mini (Season 2)
 * 2028: Mini (Season 3)
 * 2029: Mega (Season 1 of next cycle)
 * 2030: Mini, etc.
 */
export function getAuctionTypeForSeason(seasonYear: number): AuctionType {
  const cycleOffset = (seasonYear - 2026) % 3;
  return cycleOffset === 0 ? 'Mega' : 'Mini';
}

/**
 * Creates initial contracts for a franchise after an auction or retention phase.
 */
export function createInitialContracts(
  franchises: Franchise[],
  seasonYear: number,
  auctionType: AuctionType
): Record<string, PlayerContract> {
  const contracts: Record<string, PlayerContract> = {};
  const defaultDuration = auctionType === 'Mega' ? 3 : 1;

  for (const franchise of franchises) {
    for (const player of franchise.players) {
      // Determine salary: check soldPrice or currentContractValue or basePrice
      const salary = player.soldPrice > 0 ? player.soldPrice : player.currentContractValue > 0 ? player.currentContractValue : player.basePrice;

      contracts[player.id] = {
        playerId: player.id,
        playerName: player.name,
        franchiseId: franchise.id,
        salaryLakhs: salary,
        yearsRemaining: defaultDuration,
        signingSeason: seasonYear,
        status: 'Active',
        originalAcquisition: player.isRetained ? 'Retention' : 'Auction',
        isRetained: player.isRetained,
      };
    }
  }

  return contracts;
}

/**
 * Advances player contracts at season end: decrements remaining years,
 * flags expiring contracts, and prepares for Mini or Mega auction.
 */
export function advanceContractsForNewSeason(
  contracts: Record<string, PlayerContract>,
  seasonYear: number
): Record<string, PlayerContract> {
  const updatedContracts: Record<string, PlayerContract> = {};
  const upcomingAuctionType = getAuctionTypeForSeason(seasonYear);

  for (const [playerId, contract] of Object.entries(contracts)) {
    if (contract.status === 'Retired' || contract.status === 'Released') {
      updatedContracts[playerId] = { ...contract };
      continue;
    }

    const newYearsRemaining = Math.max(0, contract.yearsRemaining - 1);

    // If entering a Mega Auction, all contracts expire for major squad reset
    if (upcomingAuctionType === 'Mega' || newYearsRemaining === 0) {
      updatedContracts[playerId] = {
        ...contract,
        yearsRemaining: 0,
        status: 'Expiring',
      };
    } else {
      updatedContracts[playerId] = {
        ...contract,
        yearsRemaining: newYearsRemaining,
        status: 'Active',
      };
    }
  }

  return updatedContracts;
}

/**
 * Calculates a franchise's available auction purse for the upcoming season.
 * Purse = New Season Total Purse - Sum of continuing player contracts
 */
export function calculateFranchiseUpcomingPurse(
  franchise: Franchise,
  retainedPlayers: Player[],
  seasonYear: number
): { totalPurse: number; spentOnRetained: number; remainingPurse: number } {
  const totalPurse = getLeaguePurseForSeason(seasonYear);
  const spentOnRetained = retainedPlayers.reduce(
    (sum, p) => sum + (p.soldPrice > 0 ? p.soldPrice : p.retentionCost || p.basePrice),
    0
  );
  const remainingPurse = Math.max(0, totalPurse - spentOnRetained);

  return { totalPurse, spentOnRetained, remainingPurse };
}

/**
 * Executes a player release from a franchise prior to an auction.
 * Removes player from franchise roster, adds salary back to purse, and moves player to auction pool.
 */
export function releasePlayerFromFranchise(
  franchise: Franchise,
  playerId: string,
  contracts: Record<string, PlayerContract>
): { updatedFranchise: Franchise; updatedContracts: Record<string, PlayerContract>; releasedPlayer: Player | null } {
  const playerIndex = franchise.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { updatedFranchise: franchise, updatedContracts: contracts, releasedPlayer: null };
  }

  const releasedPlayer = { ...franchise.players[playerIndex] };
  releasedPlayer.isRetained = false;
  releasedPlayer.isSold = false;
  releasedPlayer.isAvailableForAuction = true;
  releasedPlayer.currentFranchiseId = null;

  const newPlayers = franchise.players.filter((p) => p.id !== playerId);
  const contract = contracts[playerId];
  const salaryRefund = contract ? contract.salaryLakhs : releasedPlayer.soldPrice || 0;

  const updatedFranchise: Franchise = {
    ...franchise,
    players: newPlayers,
    releasedPlayers: [...franchise.releasedPlayers, releasedPlayer],
    remainingPurse: franchise.remainingPurse + salaryRefund,
  };

  const updatedContracts = { ...contracts };
  if (updatedContracts[playerId]) {
    updatedContracts[playerId] = {
      ...updatedContracts[playerId],
      status: 'Released',
      franchiseId: '',
    };
  }

  return { updatedFranchise, updatedContracts, releasedPlayer };
}

