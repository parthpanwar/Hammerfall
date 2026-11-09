// ============================================================
// IPL DYNASTY - CPU General Manager Engine
// Integrated with Data-Driven Player Intelligence Engine:
// 1. Data-Driven Dynamic Utility Model: U(p,t) = Q + N + S + F - C
// 2. Cricsheet & ML Projected Next-Season Performance
// 3. Tactical Role Coverage (11 cricket roles)
// 4. Dynamic Budget Discipline: spendingLimit = min(val, maxAffordable, budgetRatio * Z)
// 5. Opponent Modeling & Bayesian Need Tracking
// 6. Monte Carlo Simulation for High-Stakes Future Planning
// 7. Confidence & Risk Calibrated Bidding
// ============================================================

import type {
  Franchise,
  Player,
  AuctionSession,
  AuctionLot,
  SeededRandom,
  CPUDifficulty,
} from '@/lib/types/game';
import { canFranchiseBid, getMinimumBid } from '../auction-engine';
import {
  getPlayerTacticalRoles,
  evaluateTacticalNeed,
  TacticalRole,
  TARGET_ROLE_COVERAGE,
} from './tactical-roles';
import {
  FRANCHISE_STRATEGY_PROFILES,
  OpponentBidModel,
} from './opponent-model';
import { runMonteCarloForecasting } from './monte-carlo';
import {
  generatePlayerIntelligenceDossier,
  evaluateFranchiseFit,
} from '../../intelligence/valuation/player-intelligence';
import type { PlayerIntelligenceDossier } from '../../intelligence/types';
import {
  getFranchiseActivePersonality,
  evolveFranchisePersonality,
} from './personalities';
import {
  initializeDynamicShortlists,
  getFranchiseShortlist,
  updateShortlistsOnLotCompletion,
} from './shortlist-manager';
import {
  calculatePlayingXiImprovement,
  calculateSquadDepthImprovement,
  calculateAdvancedSpendingLimit,
  evaluateAlternativeOptions,
} from './advanced-valuation';
import {
  recordDecisionLog,
  getSessionDecisionLogs,
  clearSessionDecisionLogs,
  StructuredDecisionLog,
} from './decision-logger';

export { getSessionDecisionLogs as getDecisionLogs, clearSessionDecisionLogs as clearDecisionLogs };

export interface CpuGMDecision {
  bid: boolean;
  maxBid: number;
  reason: string;
  utilityScore?: number;
  tacticalRoles?: TacticalRole[];
  monteCarloEvaluated?: boolean;
  intelligenceDossier?: PlayerIntelligenceDossier;
}

export interface CpuTargetPlan {
  franchiseId: string;
  primaryTargets: string[]; // player IDs
  allocatedBudgets: Record<string, number>;
  rolePriorities: TacticalRole[];
}

// Global state for persistent auction opponent models and private plans
const activeOpponentModels: Map<string, OpponentBidModel> = new Map();
const activeFranchisePlans: Map<string, CpuTargetPlan> = new Map();

/** Initialize or get the opponent model for this auction session. */
export function getSessionOpponentModel(session: AuctionSession): OpponentBidModel {
  let model = activeOpponentModels.get(session.id);
  if (!model) {
    model = new OpponentBidModel(session.franchises.map((f) => f.id));
    activeOpponentModels.set(session.id, model);
  }
  return model;
}

/** Initialize private shortlists and budget plans for all CPU franchises at auction start. */
export function initializeFranchisePlans(session: AuctionSession, rng: SeededRandom) {
  // Initialize dynamic multi-tier shortlists and role budget plans
  initializeDynamicShortlists(session, rng);

  for (const franchise of session.franchises) {
    if (franchise.isHumanControlled) continue;
    const profile = FRANCHISE_STRATEGY_PROFILES[franchise.id];

    // Score all available players for this franchise's identity using Player Intelligence Dossiers
    const scoredPlayers = session.playerPool.map((p) => {
      const dossier = generatePlayerIntelligenceDossier(p);
      const roles = getPlayerTacticalRoles(p);
      let fitScore = dossier.projection.overallImpactScore;

      if (profile) {
        for (const r of roles) {
          fitScore *= (profile.roleAffinities[r] || 1.0);
        }
        if (p.nationality === 'Indian') {
          fitScore *= profile.domesticPremium;
        }
      }
      return { player: p, score: fitScore, dossier };
    });

    scoredPlayers.sort((a, b) => b.score - a.score);
    const topTargets = scoredPlayers.slice(0, 10).map((s) => s.player.id);

    const plan: CpuTargetPlan = {
      franchiseId: franchise.id,
      primaryTargets: topTargets,
      allocatedBudgets: {},
      rolePriorities: Object.keys(profile?.roleAffinities || {}) as TacticalRole[],
    };

    activeFranchisePlans.set(franchise.id, plan);
  }
}

/**
 * 1. Player Quality Q (0 to 100)
 * Evaluates raw skill, Cricsheet ball-by-ball form, ML next-season projection, and sample confidence.
 */
export function calculatePlayerQuality(player: Player, dossier?: PlayerIntelligenceDossier): number {
  const pDossier = dossier || generatePlayerIntelligenceDossier(player);
  const proj = pDossier.projection;
  const form = pDossier.form;
  const conf = pDossier.confidenceLevel / 100;

  // Calibrate between empirical baseline rating and ML projected impact
  const quality =
    proj.overallImpactScore * 0.50 +
    form.last5MatchesAvgRating * 0.20 +
    player.ratings.overall * 0.20 +
    (pDossier.ageProfile.careerPhase === 'Emerging' ? 5 : 0) -
    (pDossier.availabilityRisk > 50 ? (pDossier.availabilityRisk - 50) * 0.15 : 0);

  return Math.min(100, Math.max(20, Math.round(quality)));
}

/**
 * 2. Scarcity S (0 to 100)
 * Counts remaining players in the auction pool that match the tactical roles.
 */
export function calculateRoleScarcity(
  player: Player,
  session: AuctionSession
): number {
  const remaining = session.playerPool.slice(session.currentPlayerIndex + 1);
  if (remaining.length === 0) return 100;

  const playerRoles = getPlayerTacticalRoles(player);
  let minOptionsLeft = 999;

  for (const role of playerRoles) {
    const optionsLeft = remaining.filter((p) => getPlayerTacticalRoles(p).includes(role)).length;
    if (optionsLeft < minOptionsLeft) minOptionsLeft = optionsLeft;
  }

  if (minOptionsLeft <= 1) return 100;
  if (minOptionsLeft <= 3) return 85;
  if (minOptionsLeft <= 5) return 70;
  if (minOptionsLeft <= 8) return 50;
  return 30;
}

/**
 * 3. Strategic Fit F (0 to 100)
 * Evaluates franchise identity, youth/experience balance, overseas quota, and tactical role synergy.
 */
export function calculateStrategicFit(
  franchise: Franchise,
  player: Player,
  dossier?: PlayerIntelligenceDossier
): number {
  const pDossier = dossier || generatePlayerIntelligenceDossier(player);
  const fitReport = evaluateFranchiseFit(player, franchise, pDossier);
  const profile = FRANCHISE_STRATEGY_PROFILES[franchise.id];

  let fit = fitReport.fitScore;

  if (profile) {
    const roles = getPlayerTacticalRoles(player);
    for (const role of roles) {
      const affinity = profile.roleAffinities[role] || 1.0;
      fit += (affinity - 1.0) * 20;
    }

    if (player.nationality === 'Indian') {
      fit += (profile.domesticPremium - 1.0) * 25;
    }

    if (profile.starAggression > 0 && pDossier.projection.overallImpactScore >= 85) {
      fit += profile.starAggression * 15;
    }
  }

  return Math.min(100, Math.max(10, Math.round(fit)));
}

/**
 * 4. Opportunity Cost C (0 to 100)
 * Based on price relative to remaining purse and remaining open slots.
 */
export function calculateOpportunityCost(
  franchise: Franchise,
  price: number
): number {
  const openSlots = Math.max(1, franchise.minSquadSize - franchise.players.length);
  const budgetRatio = franchise.remainingPurse / openSlots;
  const costRatio = price / Math.max(1, budgetRatio);

  const cost = Math.min(100, Math.round(costRatio * 25));
  return cost;
}

/**
 * Dynamic Utility Formula:
 * U(p,t) = Q + N + S + F - C
 */
export function calculateDynamicUtility(
  franchise: Franchise,
  player: Player,
  currentPrice: number,
  session: AuctionSession,
  dossier?: PlayerIntelligenceDossier
): number {
  const pDossier = dossier || generatePlayerIntelligenceDossier(player);
  const Q = calculatePlayerQuality(player, pDossier);
  const N = evaluateTacticalNeed(franchise, player);
  const S = calculateRoleScarcity(player, session);
  const F = calculateStrategicFit(franchise, player, pDossier);
  const C = calculateOpportunityCost(franchise, currentPrice);

  const rawUtility = Q * 0.35 + N * 0.30 + S * 0.15 + F * 0.20 - C * 0.35;
  return Math.round(rawUtility);
}

/**
 * Calculate the maximum spending limit for this player:
 * spendingLimit = min(valuation, maxAffordable, budgetRatio * Z)
 */
export function calculateSpendingLimit(
  franchise: Franchise,
  player: Player,
  session: AuctionSession,
  dossier?: PlayerIntelligenceDossier
): number {
  const pDossier = dossier || generatePlayerIntelligenceDossier(player);
  const profile = FRANCHISE_STRATEGY_PROFILES[franchise.id];
  const openSlots = Math.max(1, franchise.minSquadSize - franchise.players.length);

  // Reserve 20L per remaining slot for legal compliance
  const reserveNeeded = (openSlots - 1) * 20;
  const maxAffordable = Math.max(player.basePrice, franchise.remainingPurse - reserveNeeded);

  // Dynamic budget ratio
  const budgetRatio = franchise.remainingPurse / openSlots;

  // Z factor: Multiplier on average slot budget based on projected impact
  const impact = pDossier.projection.overallImpactScore;
  let Z = 1.5;
  if (impact >= 90) Z = 4.2;
  else if (impact >= 85) Z = 3.5;
  else if (impact >= 80) Z = 2.8;
  else if (impact >= 75) Z = 2.1;

  if (profile) {
    Z *= (0.8 + profile.starAggression * 0.4);
  }

  const budgetDisciplineLimit = Math.round(budgetRatio * Z);

  // Data-Driven Valuation combining market distribution and tactical utility
  const Q = calculatePlayerQuality(player, pDossier);
  const N = evaluateTacticalNeed(franchise, player);
  const S = calculateRoleScarcity(player, session);
  const F = calculateStrategicFit(franchise, player, pDossier);

  const compositeIndex = (Q * 0.4 + N * 0.3 + S * 0.15 + F * 0.15) / 100;

  // Model 2: Multi-season development factor (1, 2, 3 seasons ahead)
  let multiSeasonBonus = 1.0;
  if (pDossier.longevityProjections && pDossier.longevityProjections.length >= 2) {
    const avgFutureRating = (pDossier.longevityProjections[0].projectedRating + pDossier.longevityProjections[1].projectedRating) / 2;
    if (avgFutureRating >= pDossier.projection.overallImpactScore) {
      multiSeasonBonus = 1.08; // Young asset with rising trajectory
    } else if (avgFutureRating < pDossier.projection.overallImpactScore - 6) {
      multiSeasonBonus = 0.94; // Aging decline discount
    }
  }
  
  // Blend formula valuation with Model 3 empirical market fair value and Model 4 franchise-specific acquisition value
  const formulaValuation = Math.round(
    (player.basePrice + Math.pow(compositeIndex, 2.6) * 2200) * multiSeasonBonus
  );
  const marketFairVal = pDossier.marketValuation.fairValue;
  const teamVal = pDossier.teamValuations?.[franchise.id]?.maxBidLakhs;

  const blendedValuation = Math.round(
    teamVal
      ? (formulaValuation * 0.35 + marketFairVal * 0.35 + teamVal * 0.30)
      : (formulaValuation * 0.45 + marketFairVal * 0.55)
  );

  // Spending limit is bounded by valuation, maximum cash, and budget discipline
  const limit = Math.min(blendedValuation, maxAffordable, Math.max(player.basePrice, budgetDisciplineLimit));

  // Round to nearest 5L
  return Math.max(player.basePrice, Math.round(limit / 5) * 5);
}

/**
 * Main General Manager Bidding Decision Engine.
 * Integrates Player Intelligence Dossiers, opponent beliefs, Monte Carlo,
 * Playing XI optimization, and structured explainability logging.
 */
export function decideCPUBid(
  franchise: Franchise,
  currentLot: AuctionLot,
  session: AuctionSession,
  rng: SeededRandom
): CpuGMDecision {
  const player = currentLot.player;
  const minBid = getMinimumBid(session);
  const difficulty = franchise.cpuDifficulty || 'Normal';
  const personalityType = getFranchiseActivePersonality(session.id, franchise.id);

  // 1. Legality check
  if (!canFranchiseBid(franchise, session)) {
    return { bid: false, maxBid: 0, reason: 'Cannot legally bid.' };
  }

  // 2. Already leading bidder
  if (currentLot.currentBidderId === franchise.id) {
    return { bid: false, maxBid: currentLot.currentBid, reason: 'Already highest bidder.' };
  }

  // 3. Player Intelligence Dossier & Advanced Valuation
  const dossier = generatePlayerIntelligenceDossier(player);
  const tacticalRoles = getPlayerTacticalRoles(player);
  const tacticalNeed = evaluateTacticalNeed(franchise, player);
  const xiImprovement = calculatePlayingXiImprovement(franchise, player);
  const depthImprovement = calculateSquadDepthImprovement(franchise, player);
  const alternatives = evaluateAlternativeOptions(player, session);
  const openSlots = Math.max(1, franchise.minSquadSize - franchise.players.length);

  // Base log metadata helper
  const logBase = {
    lotIndex: session.currentPlayerIndex,
    playerId: player.id,
    playerName: player.name,
    role: player.role,
    ratingsOverall: player.ratings.overall,
    basePriceLakhs: player.basePrice,
    franchiseId: franchise.id,
    franchiseName: franchise.name,
    currentPriceLakhs: currentLot.currentBid,
    minNextBidLakhs: minBid,
    squadNeedScore: tacticalNeed,
    xiImprovement,
    depthImprovement,
    predictedPerformance: {
      runs: dossier.projection.projectedBattingRuns,
      wickets: dossier.projection.projectedWickets,
      strikeRate: dossier.projection.projectedBattingStrikeRate,
      economy: dossier.projection.projectedEconomyRate,
      impact: dossier.projection.overallImpactScore,
    },
    marketValuation: {
      fairValue: dossier.marketValuation.fairValue,
      priceFloor: dossier.marketValuation.priceFloor,
      priceCeiling: dossier.marketValuation.priceCeiling,
      soldProbability: dossier.marketValuation.soldProbability,
    },
    alternativesRemaining: alternatives.count,
    budgetImpact: {
      remainingPurse: franchise.remainingPurse,
      openSlots,
      budgetPerSlot: Math.round(franchise.remainingPurse / openSlots),
    },
    personalityArchetype: personalityType,
    cpuDifficulty: difficulty,
  };

  // If team has zero tactical need and squad has fulfilled minimum squad size, pass
  if (tacticalNeed === 0 && franchise.players.length >= franchise.minSquadSize) {
    const reason = 'No tactical role deficit; squad depth satisfied.';
    recordDecisionLog(session.id, {
      ...logBase,
      maxValuationLakhs: 0,
      decision: 'PASS',
      reason,
    });

    return {
      bid: false,
      maxBid: 0,
      reason,
      tacticalRoles,
      intelligenceDossier: dossier,
    };
  }

  // 4. Calculate Advanced Spending Limit with Data-Driven Valuation
  let spendingLimit = calculateAdvancedSpendingLimit(franchise, player, session, dossier, difficulty);

  // Guarantee legal squad size: If at 14 players or in accelerated rounds (round >= 2) below 15 players,
  // ensure franchise bids whatever safe purse remains to reach the mandatory 15-player legal minimum.
  if (franchise.players.length === 14 || (session.round >= 2 && franchise.players.length < 15)) {
    const reserveForOthers = Math.max(0, 15 - franchise.players.length - 1) * 50;
    const maxSafeForLegalSquad = Math.max(player.basePrice, franchise.remainingPurse - reserveForOthers);
    spendingLimit = Math.max(spendingLimit, maxSafeForLegalSquad);
  }

  // Price exceeds spending limit
  if (minBid > spendingLimit) {
    const reason = `Bid ${minBid}L exceeds spending limit ${spendingLimit}L.`;
    recordDecisionLog(session.id, {
      ...logBase,
      maxValuationLakhs: spendingLimit,
      decision: 'PASS',
      reason,
    });

    return {
      bid: false,
      maxBid: spendingLimit,
      reason,
      tacticalRoles,
      intelligenceDossier: dossier,
    };
  }

  // 5. Dynamic Utility Score
  const utility = calculateDynamicUtility(franchise, player, minBid, session, dossier);

  // 6. Monte Carlo Future Forecasting (for high-stakes lots on Hard/Expert)
  const isHighStakes =
    minBid >= 600 ||
    dossier.projection.overallImpactScore >= 83 ||
    minBid > franchise.remainingPurse * 0.25;

  let mcResult: any = undefined;
  if (isHighStakes && (difficulty === 'Hard' || difficulty === 'Expert')) {
    const trials = difficulty === 'Expert' ? 40 : 20;
    mcResult = runMonteCarloForecasting(franchise, player, minBid, session, rng, trials);

    if (!mcResult.shouldBid) {
      const reason = `Monte Carlo forecast: ${mcResult.reason}`;
      recordDecisionLog(session.id, {
        ...logBase,
        maxValuationLakhs: spendingLimit,
        decision: 'PASS',
        reason,
        monteCarloForecast: {
          buyRating: mcResult.expectedRatingBuy,
          passRating: mcResult.expectedRatingPass,
          shouldBid: false,
        },
      });

      return {
        bid: false,
        maxBid: minBid - 20,
        reason,
        utilityScore: utility,
        tacticalRoles,
        monteCarloEvaluated: true,
        intelligenceDossier: dossier,
      };
    }
  }

  // 7. Track opponent belief model
  const opponentModel = getSessionOpponentModel(session);
  opponentModel.observeBid(franchise.id, player, minBid);

  const decisionReason = `Bidding ${minBid}L (Impact: ${dossier.projection.overallImpactScore} • Roles: ${tacticalRoles.join(', ')} • Utility: ${utility} • XI +${xiImprovement}).`;

  recordDecisionLog(session.id, {
    ...logBase,
    maxValuationLakhs: spendingLimit,
    decision: 'BID',
    reason: decisionReason,
    monteCarloForecast: mcResult ? {
      buyRating: mcResult.expectedRatingBuy,
      passRating: mcResult.expectedRatingPass,
      shouldBid: true,
    } : undefined,
  });

  return {
    bid: true,
    maxBid: spendingLimit,
    reason: decisionReason,
    utilityScore: utility,
    tacticalRoles,
    intelligenceDossier: dossier,
  };
}

/**
 * Hook invoked after an auction lot is finalized (Sold or Unsold).
 * Updates shortlists, observes winning bids, and evolves franchise strategies.
 */
export function onAuctionLotCompleted(session: AuctionSession, completedLot: AuctionLot) {
  // 1. Update dynamic shortlists
  updateShortlistsOnLotCompletion(session, completedLot);

  // 2. Observe winning purchase in opponent model
  if (completedLot.state === 'Sold' && completedLot.currentBidderId) {
    const opponentModel = getSessionOpponentModel(session);
    opponentModel.observeBid(completedLot.currentBidderId, completedLot.player, completedLot.currentBid);
  }

  // 3. Evolve personalities for all franchises based on new state
  for (const franchise of session.franchises) {
    evolveFranchisePersonality(franchise, session);
  }
}
