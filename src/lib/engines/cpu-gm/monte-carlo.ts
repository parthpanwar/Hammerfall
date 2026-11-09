// ============================================================
// IPL DYNASTY - CPU General Manager Engine: Monte Carlo Simulation
// Future auction forecasting: Buy vs Pass expected squad rating
// with positional deficiency risk modeling and fast LRU caching.
// ============================================================

import type { Franchise, Player, AuctionSession } from '@/lib/types/game';
import type { SeededRandom } from '@/lib/types/game';
import { getPlayerTacticalRoles } from './tactical-roles';

export interface MonteCarloEvaluation {
  shouldBid: boolean;
  expectedRatingBuy: number;
  expectedRatingPass: number;
  confidence: number;
  reason: string;
}

// Global cache for Monte Carlo decisions to avoid redundant expensive simulations
const mcCache = new Map<string, MonteCarloEvaluation>();

export function clearMonteCarloCache() {
  mcCache.clear();
}

/**
 * Fast Monte Carlo evaluation comparing future squad quality:
 * "If I spend currentBid on this player, will my final squad be better or worse than passing and saving my purse?"
 */
export function runMonteCarloForecasting(
  franchise: Franchise,
  candidatePlayer: Player,
  currentPrice: number,
  session: AuctionSession,
  rng: SeededRandom,
  simulations: number = 30
): MonteCarloEvaluation {
  const currentSquad = franchise.players;
  const currentSlotsFilled = currentSquad.length;
  const openSlots = Math.max(1, franchise.minSquadSize - currentSlotsFilled);

  // Check cache
  const cacheKey = `${session.id}-${franchise.id}-${candidatePlayer.id}-${Math.floor(currentPrice / 50)}-${openSlots}`;
  if (mcCache.has(cacheKey)) {
    return mcCache.get(cacheKey)!;
  }

  // If squad is almost full (1 slot left), this is the last player, no future planning needed
  if (openSlots <= 1) {
    const res: MonteCarloEvaluation = {
      shouldBid: true,
      expectedRatingBuy: candidatePlayer.ratings.overall,
      expectedRatingPass: 60,
      confidence: 1.0,
      reason: 'Final squad slot.',
    };
    mcCache.set(cacheKey, res);
    return res;
  }

  // Get remaining un-auctioned players in pool
  const remainingPool = session.playerPool.slice(session.currentPlayerIndex + 1);
  if (remainingPool.length === 0) {
    const res: MonteCarloEvaluation = {
      shouldBid: true,
      expectedRatingBuy: candidatePlayer.ratings.overall,
      expectedRatingPass: 50,
      confidence: 1.0,
      reason: 'No players left in pool.',
    };
    mcCache.set(cacheKey, res);
    return res;
  }

  // Positional Deficiency Risk: Check if passing on candidate risks missing essential role
  const candidateRoles = getPlayerTacticalRoles(candidatePlayer);
  const isEssentialRole = candidateRoles.includes('Wicketkeeper-batter') || candidateRoles.includes('Death-over specialist');
  const squadHasRole = currentSquad.some((p) => getPlayerTacticalRoles(p).some((r) => candidateRoles.includes(r)));

  let positionalRiskPenalty = 0;
  if (isEssentialRole && !squadHasRole) {
    const remainingAlternativesWithRole = remainingPool.filter((p) =>
      getPlayerTacticalRoles(p).some((r) => candidateRoles.includes(r))
    ).length;

    if (remainingAlternativesWithRole <= 1) {
      positionalRiskPenalty = 3.5; // High risk of ending auction without any player in this role
    } else if (remainingAlternativesWithRole <= 3) {
      positionalRiskPenalty = 1.8;
    }
  }

  // Current squad average rating
  const currentSquadTotalRating = currentSquad.reduce((sum, p) => sum + p.ratings.overall, 0);

  // Remaining budget scenarios
  const purseAfterBuy = franchise.remainingPurse - currentPrice;
  const purseAfterPass = franchise.remainingPurse;

  // Remaining slots needed after this lot
  const remainingSlotsAfterBuy = openSlots - 1;
  const remainingSlotsAfterPass = openSlots;

  // Average budget per slot remaining
  const budgetPerSlotBuy = remainingSlotsAfterBuy > 0 ? purseAfterBuy / remainingSlotsAfterBuy : 0;
  const budgetPerSlotPass = purseAfterPass / remainingSlotsAfterPass;

  let totalSimRatingBuy = 0;
  let totalSimRatingPass = 0;

  // Run Monte Carlo trials
  for (let s = 0; s < simulations; s++) {
    // --- TRIAL A: BUY CANDIDATE ---
    let simRatingBuy = currentSquadTotalRating + candidatePlayer.ratings.overall;
    let poolCopyA = [...remainingPool];

    // Pick simulated future buys respecting budgetPerSlotBuy
    for (let slot = 0; slot < remainingSlotsAfterBuy; slot++) {
      const eligible = poolCopyA.filter((p) => p.basePrice <= budgetPerSlotBuy * 1.5);
      const chosen = eligible.length > 0 ? rng.pick(eligible) : poolCopyA[0];
      if (chosen) {
        simRatingBuy += chosen.ratings.overall;
        poolCopyA = poolCopyA.filter((p) => p.id !== chosen.id);
      } else {
        simRatingBuy += 55; // baseline replacement player
      }
    }

    // --- TRIAL B: PASS CANDIDATE ---
    let simRatingPass = currentSquadTotalRating;
    let poolCopyB = [...remainingPool];

    for (let slot = 0; slot < remainingSlotsAfterPass; slot++) {
      const eligible = poolCopyB.filter((p) => p.basePrice <= budgetPerSlotPass * 1.5);
      const chosen = eligible.length > 0 ? rng.pick(eligible) : poolCopyB[0];
      if (chosen) {
        simRatingPass += chosen.ratings.overall;
        poolCopyB = poolCopyB.filter((p) => p.id !== chosen.id);
      } else {
        simRatingPass += 55;
      }
    }

    // Apply positional risk penalty to pass path
    simRatingPass -= positionalRiskPenalty * franchise.minSquadSize;

    totalSimRatingBuy += simRatingBuy / franchise.minSquadSize;
    totalSimRatingPass += simRatingPass / franchise.minSquadSize;
  }

  const expectedRatingBuy = Math.round((totalSimRatingBuy / simulations) * 10) / 10;
  const expectedRatingPass = Math.round((totalSimRatingPass / simulations) * 10) / 10;

  // Compare expected squad quality
  const shouldBid = expectedRatingBuy >= expectedRatingPass - 0.4;
  const confidence = Math.min(1.0, Math.abs(expectedRatingBuy - expectedRatingPass) / 5 + 0.5);

  let reason = '';
  if (shouldBid) {
    reason = `Projected squad strength higher with ${candidatePlayer.name} (${expectedRatingBuy} vs ${expectedRatingPass}).`;
  } else {
    reason = `Opportunity cost too high: saving budget projects better squad (${expectedRatingPass} vs ${expectedRatingBuy}).`;
  }

  const evaluation: MonteCarloEvaluation = {
    shouldBid,
    expectedRatingBuy,
    expectedRatingPass,
    confidence,
    reason,
  };

  mcCache.set(cacheKey, evaluation);
  return evaluation;
}

