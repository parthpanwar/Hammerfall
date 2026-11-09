// ============================================================
// IPL DYNASTY - Player Intelligence Service
// Unified valuation engine producing complete intelligence dossiers,
// tactical role breakdowns, market distribution, and franchise fit.
// ============================================================

import type { Player, Franchise } from '../../types/game';
import {
  TacticalRole,
  getPlayerTacticalRoles,
  ALL_TACTICAL_ROLES,
} from '../../engines/cpu-gm/tactical-roles';
import {
  CRICSHEET_PROVENANCE,
  getPlayerHistoricalRecord,
} from '../cricsheet/cricsheet-dataset';
import {
  computeRollingForm,
  extractBayesianMetrics,
  computeRecencyWeightedBatting,
  computeRecencyWeightedBowling,
} from '../features/feature-extractor';
import { calculateAgeTrajectory } from '../models/age-curve';
import { predictNextSeasonPerformance } from '../models/ml-predictor';
import mlPredictionsPayload from '../data/ml-predictions-2026.json';
import type {
  PlayerIntelligenceDossier,
  FranchiseFitReport,
  LongevitySeasonProjection,
} from '../types';

/**
 * Computes calibrated 0-100 scores across all 11 tactical cricket roles.
 */
export function calculateTacticalRoleScores(
  player: Player,
  powerplayEff: number,
  middleEff: number,
  deathEff: number
): Record<TacticalRole, number> {
  const ratings = player.ratings;
  const isPacer = player.bowlingStyle.includes('Fast') || player.bowlingStyle.includes('Medium');
  const isWristSpinner = player.bowlingStyle.includes('Leg Break') || player.bowlingStyle.includes('Chinaman');
  const isFingerSpinner = player.bowlingStyle.includes('Off Break') || player.bowlingStyle.includes('Orthodox');

  return {
    'Opening batter': Math.min(99, Math.round(
      ratings.batting * 0.5 +
      ratings.t20Adaptability * 0.25 +
      powerplayEff * 0.25 +
      (player.isOpener ? 8 : 0)
    )),
    'Middle-order anchor': Math.min(99, Math.round(
      ratings.batting * 0.55 +
      ratings.consistency * 0.3 +
      middleEff * 0.15
    )),
    'Power hitter': Math.min(99, Math.round(
      ratings.powerHitting * 0.6 +
      ratings.batting * 0.25 +
      middleEff * 0.15
    )),
    'Finisher': Math.min(99, Math.round(
      ratings.powerHitting * 0.45 +
      ratings.t20Adaptability * 0.25 +
      deathEff * 0.3
    )),
    'Wicketkeeper-batter': Math.min(99, Math.round(
      (player.role === 'Wicketkeeper' ? 30 : 0) +
      ratings.batting * 0.45 +
      ratings.fielding * 0.25
    )),
    'Pace-bowling all-rounder': Math.min(99, Math.round(
      isPacer ? (ratings.batting * 0.45 + ratings.bowling * 0.45 + ratings.fielding * 0.1) : 15
    )),
    'Spin-bowling all-rounder': Math.min(99, Math.round(
      (isWristSpinner || isFingerSpinner)
        ? (ratings.batting * 0.45 + ratings.bowling * 0.45 + ratings.fielding * 0.1)
        : 15
    )),
    'Powerplay seamer': Math.min(99, Math.round(
      isPacer ? (ratings.bowling * 0.6 + powerplayEff * 0.3 + (player.isPowerplayBowler ? 10 : 0)) : 10
    )),
    'Death-over specialist': Math.min(99, Math.round(
      (ratings.bowling >= 45 && (player.role === 'Bowler' || player.role === 'All-Rounder'))
        ? ratings.bowling * 0.45 + deathEff * 0.45 + (player.isDeathBowler ? 15 : 0)
        : 10
    )),
    'Wrist spinner': Math.min(99, Math.round(
      isWristSpinner ? (ratings.bowling * 0.75 + middleEff * 0.25 + 10) : 10
    )),
    'Finger spinner': Math.min(99, Math.round(
      isFingerSpinner ? (ratings.bowling * 0.75 + middleEff * 0.25 + 5) : 10
    )),
  };
}

/**
 * Calculates calibrated auction market valuation distribution (fair, floor, ceiling).
 */
export function calculateMarketDistribution(
  player: Player,
  overallImpact: number,
  confidence: number
): PlayerIntelligenceDossier['marketValuation'] {
  // Base anchor derived from IPL market economics (in Lakhs)
  let fair = player.basePrice;

  if (overallImpact >= 90) {
    fair = Math.max(1200, Math.round((overallImpact - 88) * 120 + 1100));
  } else if (overallImpact >= 82) {
    fair = Math.max(700, Math.round((overallImpact - 81) * 60 + 600));
  } else if (overallImpact >= 75) {
    fair = Math.max(300, Math.round((overallImpact - 74) * 45 + 250));
  } else {
    fair = Math.max(player.basePrice, Math.round((overallImpact - 60) * 15 + player.basePrice));
  }

  // Premium for domestic Indian superstars
  if (player.nationality === 'Indian' && overallImpact >= 80) {
    fair = Math.round(fair * 1.25);
  }

  // Demand Tier
  let expectedDemandTier: PlayerIntelligenceDossier['marketValuation']['expectedDemandTier'] = 'Solid Starter';
  if (overallImpact >= 90) expectedDemandTier = 'Elite Marquee';
  else if (overallImpact >= 83) expectedDemandTier = 'High Impact';
  else if (overallImpact >= 75) expectedDemandTier = 'Solid Starter';
  else if (overallImpact >= 68) expectedDemandTier = 'Value Rotation';
  else expectedDemandTier = 'Speculative Buy';

  const margin = Math.round(fair * (0.2 + (1 - confidence / 100) * 0.25));
  const priceFloor = Math.max(player.basePrice, fair - margin);
  const priceCeiling = Math.round(fair + margin * 1.5);

  return {
    fairValue: fair,
    priceFloor,
    priceCeiling,
    expectedDemandTier,
  };
}

// Global cache to prevent redundant recalculation
const dossierCache = new Map<string, PlayerIntelligenceDossier>();

/**
 * Generates the unified, authentic Player Intelligence Dossier.
 */
export function generatePlayerIntelligenceDossier(
  player: Player,
  cutoffYear: number = 2026
): PlayerIntelligenceDossier {
  const cacheKey = `${player.id}-${cutoffYear}`;
  if (dossierCache.has(cacheKey)) {
    return dossierCache.get(cacheKey)!;
  }

  // 1. Retrieve Historical Data (Leak-free)
  const record = getPlayerHistoricalRecord(player, cutoffYear);

  // 2. Extract Features
  const form = computeRollingForm(record.matchLogRatings);
  const bayesian = extractBayesianMetrics(player, record);
  const ageProfile = calculateAgeTrajectory(player, form.last5MatchesAvgRating);

  // Phase Strengths (Powerplay, Middle, Death)
  const isBatter = player.role === 'Batter' || player.role === 'Wicketkeeper' || player.role === 'All-Rounder';
  const isBowler = player.role === 'Bowler' || player.role === 'All-Rounder';

  let ppStrength = 70;
  let midStrength = 70;
  let deathStrength = 70;

  if (isBatter) {
    const wBat = computeRecencyWeightedBatting(record.battingSeasons);
    ppStrength = Math.min(99, Math.round((wBat.weightedPowerplaySR / 150) * 75));
    midStrength = Math.min(99, Math.round((wBat.weightedSR / 140) * 75));
    deathStrength = Math.min(99, Math.round((wBat.weightedDeathSR / 180) * 80));
  } else if (isBowler) {
    const wBowl = computeRecencyWeightedBowling(record.bowlingSeasons);
    ppStrength = Math.min(99, Math.round((9.0 / Math.max(6, wBowl.weightedEconomy)) * 75));
    midStrength = Math.min(99, Math.round((8.5 / Math.max(6, wBowl.weightedEconomy)) * 75));
    deathStrength = Math.min(99, Math.round((11.0 / Math.max(7, wBowl.weightedDeathEconomy)) * 80));
  }

  // Bowling Type Affinities
  const vsPaceRating = Math.min(99, Math.max(40, Math.round(player.ratings.batting * 0.95 + (player.ratings.powerHitting * 0.1))));
  const vsSpinRating = Math.min(99, Math.max(40, Math.round(player.ratings.batting * 0.9 + (player.ratings.t20Adaptability * 0.15))));

  // 3. Calibrated ML Projections
  const latestBatting = record.battingSeasons[record.battingSeasons.length - 1];
  const latestBowling = record.bowlingSeasons[record.bowlingSeasons.length - 1];
  const projection = predictNextSeasonPerformance(
    player,
    bayesian,
    form,
    ageProfile,
    latestBatting,
    latestBowling
  );

  // Confidence level (0 to 100%)
  const confidenceLevel = Math.round(
    bayesian.sampleWeight * 70 + (form.consistencyScore / 100) * 30
  );

  // Availability / workload risk
  const availabilityRisk = Math.min(95, Math.max(5, Math.round(
    player.injuryRisk * 0.5 +
    (player.age > 33 ? (player.age - 33) * 3 : 0) +
    (player.nationality === 'Overseas' ? 12 : 0)
  )));

  // Tactical Role Ratings
  const tacticalRoleScores = calculateTacticalRoleScores(player, ppStrength, midStrength, deathStrength);
  const tacticalRoles = getPlayerTacticalRoles(player);
  const primaryTacticalRole = tacticalRoles[0] || 'Middle-order Anchor';
  const secondaryTacticalRole = tacticalRoles[1];

  // Market Valuation Distribution
  const marketValuation = calculateMarketDistribution(player, projection.overallImpactScore, confidenceLevel);

  // Check for precomputed verified LightGBM ML predictions
  const mlPredictions = (mlPredictionsPayload as any)?.predictions;
  const mlData = mlPredictions ? mlPredictions[player.id] : undefined;

  let longevityProjections: LongevitySeasonProjection[] | undefined = undefined;
  let teamValuations: PlayerIntelligenceDossier['teamValuations'] = undefined;
  let explainability: PlayerIntelligenceDossier['explainability'] = undefined;

  if (mlData) {
    // Model 1: Gradient-Boosted Tabular Regression
    projection.modelType = 'LightGBM Multi-Stage Gradient Boosted Decision Ensemble';
    projection.projectedBattingRuns = mlData.model1_performance.projectedBattingRuns;
    projection.projectedBattingStrikeRate = mlData.model1_performance.projectedBattingStrikeRate;
    projection.projectedWickets = mlData.model1_performance.projectedWickets;
    projection.projectedEconomyRate = mlData.model1_performance.projectedEconomyRate;
    projection.overallImpactScore = mlData.model1_performance.overallImpactScore;
    projection.uncertaintyStdDev = mlData.model1_performance.uncertainty;

    // Model 2: Multi-Season Forward Projections (1, 2, 3 seasons ahead)
    longevityProjections = mlData.model2_development.longevityProjections;

    // Model 3: Auction Market Valuation (Sold Prob + Regressed Price Bounds)
    marketValuation.fairValue = mlData.model3_auction_valuation.fairValueLakhs;
    marketValuation.priceFloor = mlData.model3_auction_valuation.priceFloorLakhs;
    marketValuation.priceCeiling = mlData.model3_auction_valuation.priceCeilingLakhs;
    marketValuation.expectedDemandTier = mlData.model3_auction_valuation.demandTier;
    marketValuation.soldProbability = mlData.model3_auction_valuation.soldProbability;

    // Model 4: Franchise-Specific Valuations
    teamValuations = mlData.model4_team_valuations;

    // Diagnostics & Explainability
    explainability = mlData.explainability;
  }

  const dossier: PlayerIntelligenceDossier = {
    playerId: player.id,
    playerName: player.name,
    provenance: CRICSHEET_PROVENANCE,
    lastUpdated: CRICSHEET_PROVENANCE.lastUpdated,
    seasons: {
      batting: record.battingSeasons,
      bowling: record.bowlingSeasons,
    },
    form,
    bayesian,
    ageProfile,
    phaseStrengths: {
      powerplay: ppStrength,
      middle: midStrength,
      death: deathStrength,
    },
    bowlingTypeAffinities: {
      vsPaceRating,
      vsSpinRating,
    },
    projection,
    confidenceLevel,
    availabilityRisk,
    longevityProjections,
    tacticalRoleScores,
    primaryTacticalRole,
    secondaryTacticalRole,
    marketValuation,
    teamValuations,
    explainability,
  };

  dossierCache.set(cacheKey, dossier);
  return dossier;
}

/**
 * Evaluates whether and why a player fits a franchise's current squad composition,
 * budget discipline, and strategic philosophy.
 */
export function evaluateFranchiseFit(
  player: Player,
  franchise: Franchise,
  dossier?: PlayerIntelligenceDossier
): FranchiseFitReport {
  const pDossier = dossier || generatePlayerIntelligenceDossier(player);
  const reasonsToBuy: string[] = [];
  const reasonsToPass: string[] = [];

  const roles = getPlayerTacticalRoles(player);
  const existingSquad = franchise.players;
  const isOverseas = player.nationality === 'Overseas';
  const overseasInSquad = existingSquad.filter((p) => p.nationality === 'Overseas').length;

  let fitScore = pDossier.projection.overallImpactScore;

  // 1. Overseas Quota Check
  if (isOverseas) {
    if (overseasInSquad >= franchise.maxOverseas) {
      reasonsToPass.push(`Overseas roster cap reached (${overseasInSquad}/${franchise.maxOverseas} slots filled).`);
      fitScore -= 40;
    } else if (overseasInSquad >= franchise.maxOverseas - 1) {
      reasonsToPass.push(`Only 1 overseas slot remaining in squad.`);
      fitScore -= 10;
    } else {
      reasonsToBuy.push(`Fits within overseas allocation (${overseasInSquad}/${franchise.maxOverseas} used).`);
    }
  } else {
    reasonsToBuy.push('Domestic Indian asset; preserves crucial overseas player slots.');
    fitScore += 6;
  }

  // 2. Tactical Role Coverage Synergy
  for (const role of roles) {
    const existingWithRole = existingSquad.filter((p) => getPlayerTacticalRoles(p).includes(role)).length;
    if (existingWithRole === 0) {
      reasonsToBuy.push(`Fills critical squad void: zero ${role}s currently in squad.`);
      fitScore += 18;
    } else if (existingWithRole === 1) {
      reasonsToBuy.push(`Strengthens squad depth for ${role}.`);
      fitScore += 8;
    } else if (existingWithRole >= 3) {
      reasonsToPass.push(`Franchise already holds ample depth at ${role} (${existingWithRole} players).`);
      fitScore -= 12;
    }
  }

  // 3. Phase-Specific Needs (Death Overs & Powerplay)
  if (pDossier.phaseStrengths.death >= 85) {
    reasonsToBuy.push(`Elite death-overs execution rating (${pDossier.phaseStrengths.death}/100).`);
    fitScore += 10;
  }
  if (pDossier.phaseStrengths.powerplay >= 85) {
    reasonsToBuy.push(`Explosive powerplay impact rating (${pDossier.phaseStrengths.powerplay}/100).`);
    fitScore += 8;
  }

  // 4. Budget & Financial Feasibility
  const fairVal = pDossier.marketValuation.fairValue;
  const maxAffordable = franchise.remainingPurse - (franchise.minSquadSize - existingSquad.length - 1) * 30;

  if (fairVal > maxAffordable) {
    reasonsToPass.push(`Fair valuation (${(fairVal / 100).toFixed(2)} Cr) exceeds safe squad budget.`);
    fitScore -= 20;
  } else if (fairVal <= franchise.remainingPurse * 0.2) {
    reasonsToBuy.push('Highly economical target relative to available purse.');
    fitScore += 8;
  }

  // 5. Age & Longevity Fit
  if (pDossier.ageProfile.careerPhase === 'Emerging') {
    reasonsToBuy.push(`High future ceiling: young talent with ${pDossier.ageProfile.expectedLongevitySeasons}+ projected years.`);
  } else if (pDossier.ageProfile.isOver35Exempt) {
    reasonsToBuy.push('Battle-tested veteran leadership with sustained high-level consistency.');
  }

  // 6. Model 4 Machine-Learned Franchise Synergy
  const teamVal = pDossier.teamValuations?.[franchise.id];
  if (teamVal) {
    for (const r of teamVal.reasons) {
      if (!reasonsToBuy.includes(r)) {
        reasonsToBuy.push(r);
      }
    }
    fitScore = (fitScore * 0.7) + (teamVal.fitScore * 0.3);
  }

  fitScore = Math.max(10, Math.min(99, Math.round(fitScore)));

  let verdict: FranchiseFitReport['verdict'] = 'Strong Addition';
  if (fitScore >= 88) verdict = 'Must-Target';
  else if (fitScore >= 75) verdict = 'Strong Addition';
  else if (fitScore >= 60) verdict = 'Conditional Value';
  else verdict = 'Avoid / Redundant';

  const maxRecommendedBid = Math.min(
    maxAffordable,
    Math.round(fairVal * (fitScore / 75))
  );

  return {
    franchiseId: franchise.id,
    franchiseName: franchise.name,
    fitScore,
    verdict,
    reasonsToBuy: reasonsToBuy.slice(0, 4),
    reasonsToPass: reasonsToPass.slice(0, 3),
    maxRecommendedBid: Math.max(player.basePrice, maxRecommendedBid),
    roleSynergyScore: Math.round((fitScore / 100) * 10) / 10,
  };
}
