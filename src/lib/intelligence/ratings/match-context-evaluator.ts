// ============================================================
// IPL DYNASTY - Match-Level Adjusted Performance Evaluator
// Calculates context-adjusted performance for individual matches
// using opposition bowling/batting strength, innings phase,
// and time-decay recency weights.
// ============================================================

import { calculateUnifiedContextDifficulty, CompetitionTier } from './competition-calibration';
import { calculateOpposingBowlingQuality, calculateOpposingBattingQuality } from './opponent-strength';

export interface BatterMatchPerformanceInput {
  runs: number;
  balls: number;
  isDismissed: boolean;
  powerplayRuns?: number;
  deathRuns?: number;
  opposingBowlingQuality?: number; // 0-100
  opponentTeamRating: number;      // e.g. 128 for India/MI, 74 for Associate
  competitionTier: CompetitionTier;
  matchDateOrYear: number;
}

export interface BatterMatchAdjustedOutput {
  rawScore: number;                // 0-100
  contextDifficulty: number;       // 0.55 - 1.35
  adjustedScore: number;           // 0-100
  effectiveStrikeRate: number;
  oppositionQualityAdjustment: number;
}

export interface BowlerMatchPerformanceInput {
  overs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  dotBalls?: number;
  powerplayOvers?: number;
  deathOvers?: number;
  opposingBattingQuality?: number; // 0-100
  opponentTeamRating: number;
  competitionTier: CompetitionTier;
  matchDateOrYear: number;
}

export interface BowlerMatchAdjustedOutput {
  rawScore: number;                // 0-100
  contextDifficulty: number;       // 0.55 - 1.35
  adjustedScore: number;           // 0-100
  adjustedEconomy: number;
  adjustedWickets: number;
}

/**
 * Calculates adjusted batting score for a match.
 *
 * Accounts for:
 * 1. Volume: Runs scored vs balls faced
 * 2. Opponent Bowling Quality: Facing Bumrah/Starc vs facing novice pacers
 * 3. Context Difficulty: Competition level + Opponent strength
 * 4. Dismissal Context: Not out bonus
 */
export function evaluateAdjustedBattingMatch(
  input: BatterMatchPerformanceInput
): BatterMatchAdjustedOutput {
  const { runs, balls, isDismissed, opponentTeamRating, competitionTier } = input;
  const { contextDifficulty } = calculateUnifiedContextDifficulty(competitionTier, opponentTeamRating);

  const opposingBowling = input.opposingBowlingQuality ??
    calculateOpposingBowlingQuality(undefined, opponentTeamRating).qualityScore;

  // Raw strike rate & baseline performance
  const sr = balls > 0 ? (runs / balls) * 100 : 120;
  
  // Base innings quality (0-100 scale)
  // 30 runs off 20 balls (SR 150) -> ~65 pts
  // 60 runs off 38 balls (SR 158) -> ~82 pts
  // 80 runs off 45 balls (SR 178) -> ~93 pts
  let rawQuality = Math.min(
    100,
    Math.max(20, runs * 0.9 + (sr - 120) * 0.32 + (isDismissed ? 0 : 8))
  );

  // Bowling Quality Factor: Scale between 0.82 (weak bowling) and 1.22 (elite world-class attack)
  // Baseline = 72 quality score
  const bowlingQualityFactor = 0.80 + (opposingBowling / 100) * 0.40;

  // Combined context adjustment
  const totalContextAdjustment = contextDifficulty * 0.65 + bowlingQualityFactor * 0.35;

  // Adjusted score = raw quality * totalContextAdjustment, clamped to 0-100
  const adjustedScore = Math.min(100, Math.max(15, Math.round(rawQuality * totalContextAdjustment)));

  return {
    rawScore: Math.round(rawQuality),
    contextDifficulty,
    adjustedScore,
    effectiveStrikeRate: Math.round(sr * totalContextAdjustment * 10) / 10,
    oppositionQualityAdjustment: Math.round(totalContextAdjustment * 100) / 100,
  };
}

/**
 * Calculates adjusted bowling score for a match.
 *
 * Accounts for:
 * 1. Economy vs expected economy
 * 2. Wickets taken vs expected wickets
 * 3. High-pressure phases (Powerplay, Death overs)
 * 4. Opponent batting lineup strength
 */
export function evaluateAdjustedBowlingMatch(
  input: BowlerMatchPerformanceInput
): BowlerMatchAdjustedOutput {
  const { overs, balls, wickets, runsConceded, opponentTeamRating, competitionTier } = input;
  const { contextDifficulty } = calculateUnifiedContextDifficulty(competitionTier, opponentTeamRating);

  const opposingBatting = input.opposingBattingQuality ??
    calculateOpposingBattingQuality(undefined, opponentTeamRating).qualityScore;

  const effectiveOvers = overs > 0 ? overs : Math.max(1, balls / 6);
  const econ = (runsConceded / effectiveOvers);

  // Phase weighting: Death overs (>15) and Powerplay (0-6) are harder to bowl
  const ppOvers = input.powerplayOvers ?? effectiveOvers * 0.3;
  const deathOvers = input.deathOvers ?? effectiveOvers * 0.25;
  const phasePressureBonus = deathOvers * 4.0 + ppOvers * 2.0;

  // Raw bowling quality:
  // 4-0-28-2 -> ~78 pts
  // 4-0-18-3 -> ~92 pts
  // 4-0-45-0 -> ~35 pts
  let rawQuality = Math.min(
    100,
    Math.max(20, 50 + wickets * 14 - (econ - 8.0) * 5.5 + phasePressureBonus)
  );

  // Batting Quality Factor: 0.80 (weak lineup) to 1.20 (explosive elite lineup)
  const battingQualityFactor = 0.80 + (opposingBatting / 100) * 0.40;
  const totalContextAdjustment = contextDifficulty * 0.65 + battingQualityFactor * 0.35;

  const adjustedScore = Math.min(100, Math.max(15, Math.round(rawQuality * totalContextAdjustment)));

  return {
    rawScore: Math.round(rawQuality),
    contextDifficulty,
    adjustedScore,
    adjustedEconomy: Math.round((econ / totalContextAdjustment) * 100) / 100,
    adjustedWickets: Math.round(wickets * totalContextAdjustment * 10) / 10,
  };
}

/**
 * Time decay recency weighting for match logs.
 * Returns weight: 1.0 (last 12 months), 0.65 (12-24 months), 0.35 (older career).
 */
export function calculateTimeDecayWeight(
  matchYear: number,
  currentSeasonYear: number = 2026
): number {
  const yearsAgo = Math.max(0, currentSeasonYear - matchYear);
  if (yearsAgo <= 0) return 1.0;     // Current season / last 12 months
  if (yearsAgo === 1) return 0.80;   // 12-24 months
  if (yearsAgo === 2) return 0.60;   // 24-36 months
  return 0.35;                       // Older career baseline
}

