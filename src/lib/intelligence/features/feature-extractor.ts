// ============================================================
// IPL DYNASTY - Player Feature Engineering & Bayesian Shrinkage
// Computes recency-weighted stats, phase effectiveness, rolling form,
// consistency/volatility, and Bayesian shrinkage for small samples.
// ============================================================

import type { Player } from '../../types/game';
import type {
  PlayerHistoricalRecord,
} from '../cricsheet/cricsheet-dataset';
import type {
  SeasonBattingStats,
  SeasonBowlingStats,
  FormRollingMetrics,
  BayesianShrinkageMetrics,
} from '../types';

// Global T20 Priors for Bayesian Shrinkage
export const T20_GLOBAL_PRIORS = {
  battingAverage: 24.5,
  battingStrikeRate: 130.0,
  bowlingEconomy: 8.45,
  bowlingStrikeRate: 20.5,
  // Pseudo-count thresholds (k)
  battingPseudoCountBalls: 120, // 20 overs equivalent
  bowlingPseudoCountBalls: 120, // 20 overs equivalent
};

/**
 * Applies Bayesian shrinkage formula:
 * estimate = (n / (n + k)) * sample_mean + (k / (n + k)) * prior_mean
 */
export function applyBayesianShrinkage(
  sampleValue: number,
  sampleSize: number,
  priorValue: number,
  pseudoCountK: number
): { shrunkValue: number; weight: number } {
  if (sampleSize <= 0) {
    return { shrunkValue: priorValue, weight: 0 };
  }
  const weight = sampleSize / (sampleSize + pseudoCountK);
  const shrunkValue = weight * sampleValue + (1 - weight) * priorValue;
  return { shrunkValue, weight };
}

/**
 * Computes rolling form metrics from sequential match ratings.
 */
export function computeRollingForm(matchRatings: number[]): FormRollingMetrics {
  if (!matchRatings || matchRatings.length === 0) {
    return {
      last5MatchesAvgRating: 70,
      last10MatchesAvgRating: 70,
      last20MatchesAvgRating: 70,
      momentumSlope: 0,
      consistencyScore: 70,
      volatilityIndex: 10,
    };
  }

  const n = matchRatings.length;
  const last5 = matchRatings.slice(-5);
  const last10 = matchRatings.slice(-10);
  const last20 = matchRatings.slice(-20);

  const avg5 = last5.reduce((a, b) => a + b, 0) / last5.length;
  const avg10 = last10.reduce((a, b) => a + b, 0) / last10.length;
  const avg20 = last20.reduce((a, b) => a + b, 0) / last20.length;

  // Linear regression slope for momentum over the last 5-10 matches
  const recentWindow = matchRatings.slice(-8);
  let slope = 0;
  if (recentWindow.length > 2) {
    const xMean = (recentWindow.length - 1) / 2;
    const yMean = recentWindow.reduce((a, b) => a + b, 0) / recentWindow.length;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < recentWindow.length; i++) {
      numerator += (i - xMean) * (recentWindow[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }
    slope = denominator !== 0 ? numerator / denominator : 0;
  }

  // Volatility = Standard Deviation of match ratings
  const mean = matchRatings.reduce((a, b) => a + b, 0) / n;
  const variance = matchRatings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n;
  const volatilityIndex = Math.sqrt(variance);

  // Consistency Score: higher is more dependable (low volatility)
  const consistencyScore = Math.max(10, Math.min(99, Math.round(100 - volatilityIndex * 2.5)));

  return {
    last5MatchesAvgRating: Math.round(avg5 * 10) / 10,
    last10MatchesAvgRating: Math.round(avg10 * 10) / 10,
    last20MatchesAvgRating: Math.round(avg20 * 10) / 10,
    momentumSlope: Math.round(slope * 100) / 100,
    consistencyScore,
    volatilityIndex: Math.round(volatilityIndex * 10) / 10,
  };
}

/**
 * Computes recency-weighted batting features across seasons.
 * Most recent season gets 55% weight, previous 30%, older 15%.
 */
export function computeRecencyWeightedBatting(
  seasons: SeasonBattingStats[]
): {
  weightedAvg: number;
  weightedSR: number;
  weightedPowerplaySR: number;
  weightedDeathSR: number;
  weightedBoundaryPct: number;
  totalBalls: number;
} {
  if (!seasons || seasons.length === 0) {
    return {
      weightedAvg: T20_GLOBAL_PRIORS.battingAverage,
      weightedSR: T20_GLOBAL_PRIORS.battingStrikeRate,
      weightedPowerplaySR: 130,
      weightedDeathSR: 165,
      weightedBoundaryPct: 18,
      totalBalls: 0,
    };
  }

  // Sort descending by season
  const sorted = [...seasons].sort((a, b) => b.season - a.season);
  const weights = [0.55, 0.30, 0.15];

  let sumWeight = 0;
  let wAvg = 0;
  let wSR = 0;
  let wPP = 0;
  let wDeath = 0;
  let wBound = 0;
  let totalBalls = 0;

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const weight = weights[Math.min(i, weights.length - 1)];
    sumWeight += weight;
    wAvg += s.average * weight;
    wSR += s.strikeRate * weight;
    wPP += s.powerplaySR * weight;
    wDeath += s.deathSR * weight;
    wBound += s.boundaryPct * weight;
    totalBalls += s.balls;
  }

  return {
    weightedAvg: sumWeight > 0 ? wAvg / sumWeight : T20_GLOBAL_PRIORS.battingAverage,
    weightedSR: sumWeight > 0 ? wSR / sumWeight : T20_GLOBAL_PRIORS.battingStrikeRate,
    weightedPowerplaySR: sumWeight > 0 ? wPP / sumWeight : 130,
    weightedDeathSR: sumWeight > 0 ? wDeath / sumWeight : 165,
    weightedBoundaryPct: sumWeight > 0 ? wBound / sumWeight : 18,
    totalBalls,
  };
}

/**
 * Computes recency-weighted bowling features across seasons.
 */
export function computeRecencyWeightedBowling(
  seasons: SeasonBowlingStats[]
): {
  weightedEconomy: number;
  weightedSR: number;
  weightedDeathEconomy: number;
  weightedDotPct: number;
  totalBalls: number;
} {
  if (!seasons || seasons.length === 0) {
    return {
      weightedEconomy: T20_GLOBAL_PRIORS.bowlingEconomy,
      weightedSR: T20_GLOBAL_PRIORS.bowlingStrikeRate,
      weightedDeathEconomy: 10.5,
      weightedDotPct: 38,
      totalBalls: 0,
    };
  }

  const sorted = [...seasons].sort((a, b) => b.season - a.season);
  const weights = [0.55, 0.30, 0.15];

  let sumWeight = 0;
  let wEcon = 0;
  let wSR = 0;
  let wDeathEcon = 0;
  let wDot = 0;
  let totalBalls = 0;

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const weight = weights[Math.min(i, weights.length - 1)];
    sumWeight += weight;
    wEcon += s.economy * weight;
    wSR += s.strikeRate * weight;
    wDeathEcon += s.deathEconomy * weight;
    wDot += s.dotBallPct * weight;
    totalBalls += s.balls;
  }

  return {
    weightedEconomy: sumWeight > 0 ? wEcon / sumWeight : T20_GLOBAL_PRIORS.bowlingEconomy,
    weightedSR: sumWeight > 0 ? wSR / sumWeight : T20_GLOBAL_PRIORS.bowlingStrikeRate,
    weightedDeathEconomy: sumWeight > 0 ? wDeathEcon / sumWeight : 10.5,
    weightedDotPct: sumWeight > 0 ? wDot / sumWeight : 38,
    totalBalls,
  };
}

/**
 * Produces complete Bayesian-shrunk stats for a player record.
 */
export function extractBayesianMetrics(
  player: Player,
  record: PlayerHistoricalRecord
): BayesianShrinkageMetrics {
  const isBatter = player.role === 'Batter' || player.role === 'Wicketkeeper' || player.role === 'All-Rounder';
  const isBowler = player.role === 'Bowler' || player.role === 'All-Rounder';

  const batting = computeRecencyWeightedBatting(record.battingSeasons);
  const bowling = computeRecencyWeightedBowling(record.bowlingSeasons);

  // Shrink batting
  const shrunkAvg = applyBayesianShrinkage(
    batting.weightedAvg,
    batting.totalBalls,
    T20_GLOBAL_PRIORS.battingAverage,
    T20_GLOBAL_PRIORS.battingPseudoCountBalls
  );

  const shrunkSR = applyBayesianShrinkage(
    batting.weightedSR,
    batting.totalBalls,
    T20_GLOBAL_PRIORS.battingStrikeRate,
    T20_GLOBAL_PRIORS.battingPseudoCountBalls
  );

  // Shrink bowling
  const shrunkEcon = applyBayesianShrinkage(
    bowling.weightedEconomy,
    bowling.totalBalls,
    T20_GLOBAL_PRIORS.bowlingEconomy,
    T20_GLOBAL_PRIORS.bowlingPseudoCountBalls
  );

  const totalEffectiveBalls = isBatter ? batting.totalBalls : bowling.totalBalls;
  const sampleWeight = totalEffectiveBalls / (totalEffectiveBalls + 120);

  return {
    rawBattingAverage: Math.round(batting.weightedAvg * 10) / 10,
    shrunkBattingAverage: Math.round(shrunkAvg.shrunkValue * 10) / 10,
    rawStrikeRate: Math.round(batting.weightedSR * 10) / 10,
    shrunkStrikeRate: Math.round(shrunkSR.shrunkValue * 10) / 10,
    rawBowlingEconomy: Math.round(bowling.weightedEconomy * 10) / 10,
    shrunkBowlingEconomy: Math.round(shrunkEcon.shrunkValue * 10) / 10,
    sampleWeight: Math.round(sampleWeight * 100) / 100,
    shrinkageFactor: Math.round((1 - sampleWeight) * 100) / 100,
  };
}

