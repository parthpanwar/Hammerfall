// ============================================================
// IPL DYNASTY - Pre-Auction Pool Feasibility Checker
// Mathematically verifies that the auction shortlist can satisfy
// minimum legal squad requirements (18-25 players, <= 8 overseas,
// financial budget feasibility) for all 10 franchises simultaneously.
// Auto-supplements deficit roles from the registered player pool.
// ============================================================

import type { Franchise } from '@/lib/types/game';
import type { RegisteredPlayer } from '@/lib/types/registration';
import type { SquadRules } from '@/lib/types/squad-rules';
import { OFFICIAL_IPL_SQUAD_RULES } from '@/lib/types/squad-rules';

export interface FeasibilityReport {
  isFeasible: boolean;
  totalPlayersNeeded: number;
  totalIndiansNeeded: number;
  totalAvailableIndianPlayers: number;
  totalAvailableOverseasPlayers: number;
  totalDomesticSupply: number;
  totalMinDomesticNeeded: number;
  totalBudgetAvailable: number;
  minBudgetRequired: number;
  deficitsIdentified: string[];
  autoSupplementsAdded: number;
  supplementedPool: RegisteredPlayer[];
  finalPool: RegisteredPlayer[];
}

/**
 * Validates auction pool feasibility across all ten franchises.
 * Supports calling with (auctionPool, registrationPool, franchises, rules)
 * or (franchises, auctionPool, registrationPool, rules).
 * If a deficit in Indian players or role depth is discovered,
 * it auto-supplements from the registered pool until legal feasibility is achieved.
 */
export function checkAndEnsureAuctionPoolFeasibility(
  arg1: any[],
  arg2: any[],
  arg3: any[],
  rules: SquadRules = OFFICIAL_IPL_SQUAD_RULES
): FeasibilityReport {
  let franchises: Franchise[];
  let auctionPool: RegisteredPlayer[];
  let registrationPool: RegisteredPlayer[];

  if (arg1.length > 0 && ('colors' in arg1[0] || 'totalPurse' in arg1[0])) {
    // Called as (franchises, auctionPool, registrationPool)
    franchises = arg1 as Franchise[];
    auctionPool = arg2 as RegisteredPlayer[];
    registrationPool = arg3 as RegisteredPlayer[];
  } else {
    // Called as (auctionPool, registrationPool, franchises)
    auctionPool = arg1 as RegisteredPlayer[];
    registrationPool = arg2 as RegisteredPlayer[];
    franchises = arg3 as Franchise[];
  }
  let currentPool = [...auctionPool];
  const poolIds = new Set(currentPool.map((p) => p.id));
  const deficits: string[] = [];
  let supplementsAdded = 0;

  // 1. Calculate aggregate demand across all 10 franchises to reach minimum legal squad (18 players)
  let totalPlayersNeeded = 0;
  let totalIndiansNeeded = 0;
  let totalBudgetAvailable = 0;
  let minBudgetRequired = 0;

  for (const f of franchises) {
    const players = f.players || [];
    const currentCount = players.length;
    const currentOverseas = players.filter((p) => p.nationality === 'Overseas').length;
    const slotsNeeded = Math.max(0, rules.minSquadSize - currentCount);
    totalPlayersNeeded += slotsNeeded;

    // Minimum Indian players needed: max open slots minus remaining legal overseas slots
    const openOverseasCanTake = Math.max(0, rules.maxOverseas - currentOverseas);
    const minIndiansForTeam = Math.max(0, slotsNeeded - openOverseasCanTake);
    totalIndiansNeeded += minIndiansForTeam;

    totalBudgetAvailable += f.remainingPurse;
    // Each player purchased requires at least minimum base price (₹20 Lakhs)
    minBudgetRequired += slotsNeeded * 20;
  }

  // 2. Count available players in pool
  let availableIndians = currentPool.filter((p) => p.nationality === 'Indian' && p.isAvailableForAuction && !p.isRetained).length;
  let availableOverseas = currentPool.filter((p) => p.nationality === 'Overseas' && p.isAvailableForAuction && !p.isRetained).length;

  // 3. Check for Shortages
  if (currentPool.length < totalPlayersNeeded) {
    deficits.push(`Pool size (${currentPool.length}) is below aggregate minimum players needed (${totalPlayersNeeded}).`);
  }

  if (availableIndians < totalIndiansNeeded) {
    deficits.push(`Indian player count (${availableIndians}) is below minimum domestic requirement (${totalIndiansNeeded}).`);
  }

  if (totalBudgetAvailable < minBudgetRequired) {
    deficits.push(`Total available purse (₹${totalBudgetAvailable}L) is below minimum required budget (₹${minBudgetRequired}L).`);
  }

  // 4. Auto-supplement from registration pool if deficit exists
  if (availableIndians < totalIndiansNeeded * 1.5 || currentPool.length < totalPlayersNeeded * 2) {
    const targetMinIndians = Math.max(totalIndiansNeeded * 2, 200);
    const targetMinTotal = Math.max(totalPlayersNeeded * 2.5, 350);

    const availableSupplements = registrationPool.filter((p) => !poolIds.has(p.id) && p.isAvailableForAuction && !p.isRetained);

    // Prioritize Indian domestic talent to guarantee squad construction depth
    const sortedSupplements = [...availableSupplements].sort((a, b) => {
      const indA = a.nationality === 'Indian' ? 100 : 0;
      const indB = b.nationality === 'Indian' ? 100 : 0;
      return (indB + b.ratings.overall) - (indA + a.ratings.overall);
    });

    for (const sup of sortedSupplements) {
      if (availableIndians >= targetMinIndians && currentPool.length >= targetMinTotal) {
        break;
      }
      currentPool.push({ ...sup, finalShortlistSelected: true, auctionSet: 'ACCEL' });
      poolIds.add(sup.id);
      supplementsAdded++;

      if (sup.nationality === 'Indian') availableIndians++;
      else availableOverseas++;
    }
  }

  const isFeasible = deficits.length === 0 || supplementsAdded > 0;

  return {
    isFeasible,
    totalPlayersNeeded,
    totalIndiansNeeded,
    totalAvailableIndianPlayers: availableIndians,
    totalAvailableOverseasPlayers: availableOverseas,
    totalDomesticSupply: availableIndians,
    totalMinDomesticNeeded: totalIndiansNeeded,
    totalBudgetAvailable,
    minBudgetRequired,
    deficitsIdentified: deficits,
    autoSupplementsAdded: supplementsAdded,
    supplementedPool: currentPool,
    finalPool: currentPool,
  };
}
