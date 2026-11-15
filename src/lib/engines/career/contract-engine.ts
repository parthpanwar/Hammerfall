// ============================================================
// IPL DYNASTY - Multi-Season Contract & Auction Lifecycle Engine
// Tracks player contracts, salary commitments, releases, purse inflation,
// and governs the 3-year Mega / Mini auction cycle.
// ============================================================

import type { Franchise, Player, AuctionType, RetentionRule } from '@/lib/types/game';
import type { PlayerContract } from '@/lib/types/career';

/** Base purse in 2026 is 120 Cr (12,000 Lakhs), increasing by 5 Cr (500 Lakhs) each season */
export function getLeaguePurseForSeason(seasonYear: number): number {
  // IPL 2026 purse was ₹125 Cr; later seasons assume ₹5 Cr growth a year.
  const inflationYears = Math.max(0, seasonYear - 2026);
  return 12500 + inflationYears * 500;
}

/**
 * The REAL IPL auction calendar. Seasons are named by the year they are played; the
 * auction is held late in the previous year. Mega auctions: IPL 2025 (Nov 2024),
 * 2028, 2031…; every other season follows a mini auction.
 * (Campaign-specific cycles live in auctionTypeFor in lib/flow/season-flow.)
 */
export function getAuctionTypeForSeason(seasonYear: number): AuctionType {
  return (((seasonYear - 2025) % 3) + 3) % 3 === 0 ? 'Mega' : 'Mini';
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


/**
 * Bring contracts in line with actual rosters (after retentions / the auction).
 * Previously contracts were only built from pre-retention rosters at game start,
 * so auction buys had no contract and retained players kept stale salaries.
 */
export function syncRosterContracts(
  franchises: Franchise[],
  contracts: Record<string, PlayerContract>,
  retentionDecisions: { playerId: string; franchiseId: string; cost: number }[],
  seasonYear: number,
  auctionType: AuctionType
): Record<string, PlayerContract> {
  const next = { ...contracts };
  const duration = auctionType === 'Mega' ? 3 : 1;
  const retained = new Map(retentionDecisions.map((d) => [d.playerId, d]));
  for (const f of franchises) {
    for (const p of f.players) {
      const existing = next[p.id];
      const r = retained.get(p.id);
      const keep = existing && existing.franchiseId === f.id && existing.status === 'Active' && !r && !(p.soldPrice > 0 && existing.signingSeason !== seasonYear);
      if (keep) continue;
      const salary = r && r.franchiseId === f.id ? r.cost : p.soldPrice > 0 ? p.soldPrice : p.currentContractValue > 0 ? p.currentContractValue : p.basePrice;
      next[p.id] = {
        playerId: p.id,
        playerName: p.name,
        franchiseId: f.id,
        salaryLakhs: salary,
        yearsRemaining: existing?.franchiseId === f.id && existing.originalAcquisition === 'Trade' ? existing.yearsRemaining : duration,
        signingSeason: seasonYear,
        status: 'Active',
        originalAcquisition: existing?.franchiseId === f.id && existing.originalAcquisition === 'Trade' ? 'Trade' : r ? 'Retention' : 'Auction',
        isRetained: !!r,
        retentionSlot: r ? undefined : existing?.retentionSlot,
      };
    }
  }
  // Players no longer on any roster keep their record but lose the franchise link.
  const rostered = new Set(franchises.flatMap((f) => f.players.map((p) => p.id)));
  for (const [id, c] of Object.entries(next)) {
    if (!rostered.has(id) && c.status === 'Active' && c.franchiseId) next[id] = { ...c, status: 'Released', franchiseId: '' };
  }
  return next;
}
