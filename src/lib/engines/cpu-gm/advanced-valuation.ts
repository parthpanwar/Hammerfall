// ============================================================
// IPL DYNASTY - Advanced CPU Valuation & Playing XI Optimization
// Evaluates incremental Playing XI improvement, squad depth,
// alternative remaining scarcity, and difficulty scaling.
// ============================================================

import type { Franchise, Player, AuctionSession, CPUDifficulty } from '@/lib/types/game';
import {
  TacticalRole,
  getPlayerTacticalRoles,
  ALL_TACTICAL_ROLES,
  TARGET_ROLE_COVERAGE,
  evaluateTacticalNeed,
} from './tactical-roles';
import {
  getFranchiseActivePersonality,
  GM_PERSONALITY_ARCHETYPES,
} from './personalities';
import type { PlayerIntelligenceDossier } from '../../intelligence/types';
import { generatePlayerIntelligenceDossier } from '../../intelligence/valuation/player-intelligence';
import { analyzeUpcomingPool } from '../auction/dynamic-set-engine';

/**
 * Calculates how much adding candidate player improves the franchise's best starting XI.
 * A starting XI consists of:
 * - 2 Openers
 * - 3-4 Middle Order / Anchors
 * - 1 Wicketkeeper
 * - 2 All-Rounders
 * - 3 Specialists Bowlers (at least 1 spinner, 1 death bowler)
 * Respects overseas quota (max 4 overseas in XI).
 */
export function calculatePlayingXiImprovement(
  franchise: Franchise,
  candidate: Player
): number {
  const squad = franchise.players;
  if (squad.length === 0) {
    // First player always directly anchors the starting XI
    return Math.round(candidate.ratings.overall * 0.45);
  }

  const isCandidateOverseas = candidate.nationality === 'Overseas';
  const overseasInSquad = squad.filter((p) => p.nationality === 'Overseas');

  // If squad already has >= 4 overseas players better than candidate, candidate cannot improve overseas XI
  if (isCandidateOverseas && overseasInSquad.length >= 4) {
    const sortedOverseas = [...overseasInSquad].sort((a, b) => b.ratings.overall - a.ratings.overall);
    if (candidate.ratings.overall <= sortedOverseas[3].ratings.overall) {
      return 0; // Does not make top 4 overseas in starting XI
    }
  }

  // Find players in squad who share candidate's tactical roles
  const candidateRoles = getPlayerTacticalRoles(candidate);
  const matchingSquad = squad.filter((p) => {
    const pRoles = getPlayerTacticalRoles(p);
    return pRoles.some((r) => candidateRoles.includes(r));
  });

  if (matchingSquad.length === 0) {
    // Fills a completely vacant starting XI tactical role
    return Math.round(candidate.ratings.overall * 0.38);
  }

  // Find lowest rated starter among matching role players
  matchingSquad.sort((a, b) => a.ratings.overall - b.ratings.overall);
  const weakestMatching = matchingSquad[0];

  if (candidate.ratings.overall > weakestMatching.ratings.overall) {
    const delta = candidate.ratings.overall - weakestMatching.ratings.overall;
    return Math.min(35, Math.round(delta * 2.2));
  }

  // Candidate is equal or worse than current starters for this role
  return 0;
}

/**
 * Calculates squad depth value (insurance against injuries, rotations, tactical flexibility).
 * Diminishing returns apply heavily as squad depth increases.
 */
export function calculateSquadDepthImprovement(
  franchise: Franchise,
  candidate: Player
): number {
  const squad = franchise.players;
  const candidateRoles = getPlayerTacticalRoles(candidate);

  let totalDepthScore = 0;
  for (const role of candidateRoles) {
    const existingCount = squad.filter((p) => getPlayerTacticalRoles(p).includes(role)).length;
    const target = TARGET_ROLE_COVERAGE[role]?.idealSquad || 3;

    if (existingCount < target) {
      const deficit = target - existingCount;
      // 1st backup = 14pts, 2nd backup = 8pts, 3rd backup = 4pts
      if (deficit >= 3) totalDepthScore += 14;
      else if (deficit === 2) totalDepthScore += 8;
      else if (deficit === 1) totalDepthScore += 4;
    } else if (existingCount === target) {
      // Rotation & injury insurance
      totalDepthScore += 3;
    }
  }

  return Math.min(25, Math.round(totalDepthScore / candidateRoles.length));
}

/**
 * Counts and scores alternative un-auctioned players remaining in the pool
 * that can fulfill the same primary tactical roles.
 */
export function evaluateAlternativeOptions(
  candidate: Player,
  session: AuctionSession
): {
  count: number;
  averageRating: number;
  qualityTier: 'Abundant' | 'Moderate' | 'Scarce' | 'Last-Option';
} {
  const remaining = session.playerPool.slice(session.currentPlayerIndex + 1);
  const candidateRoles = getPlayerTacticalRoles(candidate);

  const alternatives = remaining.filter((p) => {
    if (p.id === candidate.id) return false;
    const pRoles = getPlayerTacticalRoles(p);
    return pRoles.some((r) => candidateRoles.includes(r));
  });

  if (alternatives.length === 0) {
    return { count: 0, averageRating: 0, qualityTier: 'Last-Option' };
  }

  const avgRating = Math.round(
    alternatives.reduce((sum, p) => sum + p.ratings.overall, 0) / alternatives.length
  );

  let qualityTier: 'Abundant' | 'Moderate' | 'Scarce' | 'Last-Option' = 'Moderate';
  if (alternatives.length <= 1) qualityTier = 'Last-Option';
  else if (alternatives.length <= 3) qualityTier = 'Scarce';
  else if (alternatives.length <= 6) qualityTier = 'Moderate';
  else qualityTier = 'Abundant';

  return { count: alternatives.length, averageRating: avgRating, qualityTier };
}

/**
 * Advanced Spending Limit Calculator integrating all 4 ML models,
 * Playing XI vs Depth optimization, scarcity, and personality traits.
 */
export function calculateAdvancedSpendingLimit(
  franchise: Franchise,
  player: Player,
  session: AuctionSession,
  dossier: PlayerIntelligenceDossier,
  difficulty: CPUDifficulty = franchise.cpuDifficulty || 'Normal'
): number {
  const targetSquadSize = Math.max(18, franchise.minSquadSize);
  const openSlots = Math.max(1, targetSquadSize - franchise.players.length);
  // Strict legal safety reserve: 20L min per remaining unfilled slot towards legal minimum of 18
  const legalMinSquad = franchise.minSquadSize ?? 18;
  const legalSlotsNeeded = Math.max(0, legalMinSquad - franchise.players.length - 1);
  const reserveNeeded = legalSlotsNeeded * 20;
  const maxAffordable = Math.max(0, franchise.remainingPurse - reserveNeeded);

  // Analyze upcoming auction pool & sets to prevent early overbidding
  const upcomingAnalysis = analyzeUpcomingPool(player, session);
  const earlyAuctionDiscount = upcomingAnalysis.earlyDiscountMultiplier;

  // -------------------------------------------------------------
  // DIFFICULTY: EASY (Simple baseline heuristic, no deep optimization)
  // -------------------------------------------------------------
  if (difficulty === 'Easy') {
    const simpleValuation = player.basePrice + Math.max(0, (player.ratings.overall - 65) * 45);
    const budgetRatio = franchise.remainingPurse / openSlots;
    const easyLimit = Math.min(simpleValuation * earlyAuctionDiscount, maxAffordable, budgetRatio * 2.0);
    return Math.max(player.basePrice, Math.round(easyLimit / 5) * 5);
  }

  // -------------------------------------------------------------
  // DIFFICULTY: NORMAL / HARD / EXPERT
  // -------------------------------------------------------------
  const personalityType = getFranchiseActivePersonality(session.id, franchise.id);
  const personality = GM_PERSONALITY_ARCHETYPES[personalityType];

  // 1. Incremental Value: Playing XI vs Squad Depth
  const xiGain = calculatePlayingXiImprovement(franchise, player);
  const depthGain = calculateSquadDepthImprovement(franchise, player);
  const alternatives = evaluateAlternativeOptions(player, session);

  // 2. Scarcity Multiplier based on remaining alternatives & upcoming sets
  let scarcityMult = upcomingAnalysis.scarcityFactor;
  if (alternatives.qualityTier === 'Last-Option') scarcityMult = Math.max(scarcityMult, 1.35);
  else if (alternatives.qualityTier === 'Scarce') scarcityMult = Math.max(scarcityMult, 1.20);
  else if (alternatives.qualityTier === 'Abundant') scarcityMult = Math.min(scarcityMult, 0.88);

  // 3. Multi-Season Longevity (Model 2)
  let multiSeasonBonus = 1.0;
  if (dossier.longevityProjections && dossier.longevityProjections.length >= 2) {
    const avgFuture = (dossier.longevityProjections[0].projectedRating + dossier.longevityProjections[1].projectedRating) / 2;
    if (avgFuture >= dossier.projection.overallImpactScore) {
      multiSeasonBonus = 1.08;
    } else if (avgFuture < dossier.projection.overallImpactScore - 6) {
      multiSeasonBonus = 0.94;
    }
  }

  // 4. Model 3 Market Bounds & Model 4 Franchise Valuation
  const fairVal = dossier.marketValuation.fairValue;
  const teamVal = dossier.teamValuations?.[franchise.id]?.maxBidLakhs || fairVal;

  // 5. Dynamic Budget Ratio & Z Multiplier
  const budgetRatio = franchise.remainingPurse / openSlots;
  const impact = dossier.projection.overallImpactScore;
  let Z = 1.6;
  if (impact >= 90) Z = 4.2;
  else if (impact >= 85) Z = 3.4;
  else if (impact >= 80) Z = 2.6;
  else if (impact >= 75) Z = 2.0;

  // Personality adjustments to Z
  Z *= personality.starPremiumMultiplier;

  // If player doesn't make Starting XI, cap aggressively at squad depth tier
  let compositeValuation: number;
  if (xiGain > 0) {
    // Starter caliber
    let rawVal = ((fairVal * 0.40) + (teamVal * 0.40) + (xiGain * 35)) * scarcityMult * multiSeasonBonus * earlyAuctionDiscount;
    if (player.ratings.overall < 78 && upcomingAnalysis.betterPlayersRemainingInRole >= 2) {
      // Prevent overpaying on average early player when better options exist in future sets
      rawVal = Math.min(rawVal, fairVal * 1.15);
    }
    compositeValuation = Math.round(rawVal);
  } else {
    // Pure squad depth: strictly bounded to avoid overpaying for backups
    const depthMax = Math.min(fairVal * 0.65, budgetRatio * 1.4) * earlyAuctionDiscount;
    compositeValuation = Math.max(player.basePrice, Math.round(depthMax + depthGain * 10));
  }

  // Expert level: dynamic price smoothing
  if (difficulty === 'Expert') {
    // If abundant alternatives exist with comparable ratings, don't overbid
    if (alternatives.count >= 3 && alternatives.averageRating >= player.ratings.overall - 3) {
      compositeValuation = Math.min(compositeValuation, fairVal * 1.05);
    }
  }

  const spendingLimit = Math.min(
    compositeValuation,
    maxAffordable,
    Math.max(player.basePrice, Math.round(budgetRatio * Z))
  );

  // If squad still has fewer than 18 players, prioritize legal roster filling at base price
  let effectiveLimit = spendingLimit;
  if (franchise.players.length < 18 && maxAffordable >= player.basePrice) {
    effectiveLimit = Math.max(effectiveLimit, player.basePrice);
  }

  return Math.min(maxAffordable, Math.max(player.basePrice, Math.round(effectiveLimit / 5) * 5));
}

/**
 * Exact implementation of the reference architecture bidding rule snippet (Image 4):
 *
 * const scarcityMultiplier = 0.9 + 0.2 * scarcity;
 * const valuation = player.marketValue * qualityFactor * needMultiplier * scarcityMultiplier * cpu.aggression;
 * const budgetRatio = cpu.purse / Math.max(cpu.openSlots, 1);
 * const spendingLimit = Math.min(valuation, maxAffordable, budgetRatio * Z);
 * return nextBid <= spendingLimit;
 */
export function evaluateBiddingRuleSnippet(
  franchise: Franchise,
  player: Player,
  nextBid: number,
  session: AuctionSession,
  dossier?: PlayerIntelligenceDossier
): {
  shouldBid: boolean;
  spendingLimit: number;
  valuation: number;
  budgetRatio: number;
  scarcityMultiplier: number;
} {
  const pDossier = dossier || generatePlayerIntelligenceDossier(player);
  const personalityType = getFranchiseActivePersonality(session.id, franchise.id);
  const personality = GM_PERSONALITY_ARCHETYPES[personalityType];

  // 1. Scarcity Multiplier: 0.9 + 0.2 * scarcity
  const remaining = session.playerPool.slice(session.currentPlayerIndex + 1);
  const candidateRoles = getPlayerTacticalRoles(player);
  let minOptions = 999;
  for (const role of candidateRoles) {
    const left = remaining.filter((p) => getPlayerTacticalRoles(p).includes(role)).length;
    if (left < minOptions) minOptions = left;
  }
  const scarcity = minOptions <= 1 ? 1.0 : minOptions <= 3 ? 0.75 : minOptions <= 6 ? 0.45 : 0.15;
  const scarcityMultiplier = 0.9 + 0.2 * scarcity;

  // 2. Valuation Factors
  const marketValue = pDossier.marketValuation.fairValue;
  const qualityFactor = Math.min(1.4, Math.max(0.7, pDossier.projection.overallImpactScore / 75));
  const tacticalNeed = evaluateTacticalNeed(franchise, player);
  const needMultiplier = Math.min(1.5, Math.max(0.6, 0.7 + (tacticalNeed / 100) * 0.8));
  const aggression = personality.starPremiumMultiplier;

  const valuation = Math.round(
    marketValue * qualityFactor * needMultiplier * scarcityMultiplier * aggression
  );

  // 3. Dynamic Budget Discipline
  const targetSquadSize = Math.max(18, franchise.minSquadSize);
  const openSlots = Math.max(1, targetSquadSize - franchise.players.length);
  const reserveNeeded = Math.max(0, targetSquadSize - franchise.players.length - 1) * 20;
  const maxAffordable = Math.max(0, franchise.remainingPurse - reserveNeeded);
  const budgetRatio = franchise.remainingPurse / Math.max(openSlots, 1);

  const impact = pDossier.projection.overallImpactScore;
  let Z = 1.6;
  if (impact >= 90) Z = 4.2;
  else if (impact >= 85) Z = 3.4;
  else if (impact >= 80) Z = 2.6;
  else if (impact >= 75) Z = 2.0;
  Z *= personality.starPremiumMultiplier;

  const spendingLimit = Math.min(
    valuation,
    maxAffordable,
    Math.max(player.basePrice, Math.round(budgetRatio * Z))
  );

  return {
    shouldBid: nextBid <= spendingLimit,
    spendingLimit: Math.round(spendingLimit / 5) * 5,
    valuation,
    budgetRatio: Math.round(budgetRatio),
    scarcityMultiplier,
  };
}
