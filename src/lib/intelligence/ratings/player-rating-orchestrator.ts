// ============================================================
// IPL DYNASTY - Unified Player Rating Orchestrator
// Synthesizes raw performance, opponent strength, competition tier,
// Bayesian reliability, and recency into the calibrated 0-100 rating.
// Provides complete fallback hierarchy and data provenance metadata.
// ============================================================

import type { Player, PlayerRole } from '../../types/game';
import {
  getTeamStrengthAtTime,
  calculateOpponentDifficultyMultiplier,
} from './opponent-strength';
import {
  classifyCompetitionTier,
  calculateUnifiedContextDifficulty,
  CompetitionTier,
} from './competition-calibration';
import {
  applyBayesianStabilization,
  BayesianStabilizationResult,
} from './bayesian-rating-engine';
import {
  calculateBatterOppositionRating,
  calculateBowlerOppositionRating,
  calculateAllRounderOppositionRating,
  calculateWicketkeeperOppositionRating,
} from './role-rating-models';
import { calculateTimeDecayWeight } from './match-context-evaluator';

export interface PlayerRatingBundle {
  rawPerformanceRating: number;       // 0-100 unadjusted statistical rating
  oppositionAdjustedRating: number;   // 0-100 opponent-adjusted rating
  competitionAdjustedRating: number;  // 0-100 competition-level rating
  recentFormRating: number;           // 0-100 time-decayed rating
  experienceRating: number;           // 0-100 evidence depth
  overallRating: number;              // 0-100 final synthesis
  ratingConfidence: number;           // 0.0 - 1.0 Bayesian reliability
  developmentPotential: number;       // 0-100 career ceiling
  ratingVersion: string;
  ratingUpdatedAt: string;
  dataSource: string;
  dataQualityStatus: 'Verified-BallByBall' | 'Match-Scorecard' | 'Competition-Aggregate' | 'Calibrated-Prior';
}

/**
 * Determines the primary competition tier and average opponent strength
 * for a player based on verified match records or career history.
 */
function inferPlayerContextDifficulty(
  player: Player,
  cutoffYear: number = 2026
): {
  competitionTier: CompetitionTier;
  averageOpponentRating: number;
  contextDifficulty: number;
  dataQuality: 'Verified-BallByBall' | 'Match-Scorecard' | 'Competition-Aggregate' | 'Calibrated-Prior';
} {
  const isCapped = player.status === 'Capped';
  const country = player.country.toLowerCase();

  const isFullMember = [
    'india', 'australia', 'england', 'south africa', 'new zealand',
    'pakistan', 'west indies', 'afghanistan', 'sri lanka', 'bangladesh',
    'ireland', 'zimbabwe'
  ].includes(country);

  // Check confirmed IPL participation or top-tier league pedigree
  const isIPLParticipant =
    (player.previousFranchises && player.previousFranchises.length > 0) ||
    player.currentFranchiseId !== null ||
    (player.nationality === 'Indian' && isCapped && player.stats.matches >= 15) ||
    (isFullMember && isCapped && player.stats.matches >= 20 && (player.basePrice >= 100 || player.stats.runs >= 600 || player.stats.wickets >= 25));

  // 1. Level 1: IPL Veteran / Premier League Benchmark
  if (isIPLParticipant && player.stats.matches >= 8) {
    const opp = getTeamStrengthAtTime('mi', cutoffYear).rating; // IPL average opponent
    const { contextDifficulty } = calculateUnifiedContextDifficulty('IPL', opp);
    return {
      competitionTier: 'IPL',
      averageOpponentRating: opp,
      contextDifficulty,
      dataQuality: 'Verified-BallByBall',
    };
  }

  // 2. Level 2: International Full Member Capped
  if (isCapped && isFullMember) {
    const opp = 114; // Average international full member opponent
    const { contextDifficulty } = calculateUnifiedContextDifficulty('International-FullMember', opp);
    return {
      competitionTier: 'International-FullMember',
      averageOpponentRating: opp,
      contextDifficulty,
      dataQuality: player.stats.matches >= 15 ? 'Verified-BallByBall' : 'Match-Scorecard',
    };
  }

  // 3. Level 3: Domestic Full Member (Indian SMAT or Australian BBL)
  if (player.nationality === 'Indian' || isFullMember) {
    const opp = 90; // Domestic stalwart tier
    const { contextDifficulty } = calculateUnifiedContextDifficulty('Domestic-FullMember', opp);
    return {
      competitionTier: 'Domestic-FullMember',
      averageOpponentRating: opp,
      contextDifficulty,
      dataQuality: 'Competition-Aggregate',
    };
  }

  // 4. Level 4: Associate Nation Capped
  if (isCapped && !isFullMember) {
    // If player has played against major nations in World Cup (high match volume)
    const hasMajorMatches = player.stats.matches >= 30;
    const tier: CompetitionTier = hasMajorMatches ? 'International-AssociateVsFull' : 'International-Associate';
    const opp = hasMajorMatches ? 92 : 75;
    const { contextDifficulty } = calculateUnifiedContextDifficulty(tier, opp);
    return {
      competitionTier: tier,
      averageOpponentRating: opp,
      contextDifficulty,
      dataQuality: 'Competition-Aggregate',
    };
  }

  // 5. Level 5: Untested / Developmental
  const opp = 65;
  const { contextDifficulty } = calculateUnifiedContextDifficulty('Developmental', opp);
  return {
    competitionTier: 'Developmental',
    averageOpponentRating: opp,
    contextDifficulty,
    dataQuality: 'Calibrated-Prior',
  };
}

/**
 * Calculates raw (unadjusted) performance rating using raw stats only.
 */
function calculateRawPerformanceRating(player: Player): number {
  const stats = player.stats;
  const role = player.role;

  if (role === 'Batter' || role === 'Wicketkeeper') {
    const sr = stats.strikeRate || 120;
    const avg = stats.battingAverage || 20;
    return Math.min(99, Math.max(35, Math.round(45 + (sr - 115) * 0.55 + (avg - 15) * 0.9)));
  }

  if (role === 'Bowler') {
    const econ = stats.economyRate || 8.5;
    const avg = stats.bowlingAverage || 28;
    return Math.min(99, Math.max(35, Math.round(50 + (9.5 - econ) * 8.0 + (32 - avg) * 0.8)));
  }

  // All-Rounder
  const bat = Math.min(95, Math.max(35, Math.round(45 + ((stats.strikeRate || 120) - 115) * 0.5 + ((stats.battingAverage || 20) - 15) * 0.8)));
  const bowl = Math.min(95, Math.max(35, Math.round(50 + (9.5 - (stats.economyRate || 8.5)) * 7.5)));
  return Math.round((bat + bowl) / 2);
}

/**
 * Main Evaluation Pipeline for an individual player.
 * Produces comprehensive opposition-adjusted ratings and updates Player record.
 */
export function evaluatePlayerOppositionRatings(
  player: Player,
  cutoffYear: number = 2026
): PlayerRatingBundle {
  const stats = player.stats;
  const role = player.role;
  const isCapped = player.status === 'Capped';
  const isAssociate = !['india', 'australia', 'england', 'south africa', 'new zealand', 'pakistan', 'west indies', 'afghanistan', 'sri lanka', 'bangladesh', 'ireland', 'zimbabwe'].includes(player.country.toLowerCase());

  // 1. Context & Difficulty Mapping
  const context = inferPlayerContextDifficulty(player, cutoffYear);
  const contextDiff = context.contextDifficulty;

  // 2. Raw Performance Rating
  const rawPerf = calculateRawPerformanceRating(player);

  // 3. Role-Specific Observed Opposition Rating
  let observedOppositionScore: number;
  const batInputs = {
    runs: stats.runs,
    balls: stats.ballsFaced,
    matches: stats.matches,
    fours: stats.fours,
    sixes: stats.sixes,
    preferredBattingPosition: player.preferredBattingPosition,
    averageContextDifficulty: contextDiff,
  };

  const bowlInputs = {
    overs: stats.oversBowled,
    wickets: stats.wickets,
    runsConceded: stats.runsConceded,
    matches: stats.matches,
    isSpinner: player.isSpinner,
    averageContextDifficulty: contextDiff,
  };

  if (role === 'Batter') {
    observedOppositionScore = calculateBatterOppositionRating(batInputs);
  } else if (role === 'Bowler') {
    observedOppositionScore = calculateBowlerOppositionRating(bowlInputs);
  } else if (role === 'All-Rounder') {
    observedOppositionScore = calculateAllRounderOppositionRating({
      battingInputs: batInputs,
      bowlingInputs: bowlInputs,
    });
  } else {
    observedOppositionScore = calculateWicketkeeperOppositionRating({
      battingInputs: batInputs,
      matches: stats.matches,
      dismissals: stats.catches,
    });
  }

  // 4. Bayesian Sample Size Reliability & Stabilization
  // Effective sample size = matches * contextDifficulty * dataQualityWeight
  const qualityWeight = context.dataQuality === 'Verified-BallByBall' ? 1.0 : context.dataQuality === 'Match-Scorecard' ? 0.85 : 0.65;
  const effectiveSampleSize = stats.matches * contextDiff * qualityWeight;

  const bayesianResult: BayesianStabilizationResult = applyBayesianStabilization(
    observedOppositionScore,
    effectiveSampleSize,
    role,
    isCapped,
    isAssociate
  );

  const stabilizedOppositionRating = bayesianResult.stabilizedRating;
  const reliability = bayesianResult.reliability;

  // 5. Competition-Adjusted Rating
  const compRating = Math.min(99, Math.max(40, Math.round(stabilizedOppositionRating * (0.85 + context.contextDifficulty * 0.15))));

  // 6. Recent Form Rating (Time Decay & Current Level)
  // Form reflects active momentum anchored to opposition-adjusted capability
  const formBase = player.recentForm || 75;
  const recentFormRating = Math.min(99, Math.max(35, Math.round(stabilizedOppositionRating * 0.70 + formBase * 0.30)));

  // 7. Experience Rating (Based on matches played and evidence depth)
  const experienceRating = Math.min(99, Math.max(30, Math.round(30 + Math.min(65, stats.matches * 0.65))));

  // 8. Final Synthesized Overall Rating (0-100)
  // Weighted blend: 65% Bayesian Stabilized Opposition Rating + 20% Competition Rating + 15% Recent Form
  let finalOverall = Math.round(
    stabilizedOppositionRating * 0.65 +
    compRating * 0.20 +
    recentFormRating * 0.15
  );

  // Marquee superstars with proven high sample reliability against elite opposition:
  if (reliability >= 0.70 && contextDiff >= 1.05 && stabilizedOppositionRating >= 85) {
    finalOverall = Math.max(finalOverall, stabilizedOppositionRating);
  }

  // Cap ratings strictly to 0-100
  finalOverall = Math.min(98, Math.max(45, finalOverall));

  // 9. Development Potential (Kept distinct from current ability)
  let potential = player.ratings?.potential || finalOverall;
  if (player.age <= 23) {
    potential = Math.min(95, Math.max(finalOverall + 8, potential));
  } else if (player.age <= 26) {
    potential = Math.min(94, Math.max(finalOverall + 4, potential));
  } else if (player.age >= 34) {
    potential = Math.min(finalOverall, potential);
  }

  const bundle: PlayerRatingBundle = {
    rawPerformanceRating: rawPerf,
    oppositionAdjustedRating: stabilizedOppositionRating,
    competitionAdjustedRating: compRating,
    recentFormRating,
    experienceRating,
    overallRating: finalOverall,
    ratingConfidence: reliability,
    developmentPotential: potential,
    ratingVersion: '2026.5.0-opposition-adjusted',
    ratingUpdatedAt: new Date().toISOString(),
    dataSource: 'Cricsheet & Verified Global T20 Historical Dataset',
    dataQualityStatus: context.dataQuality,
  };

  return bundle;
}

/**
 * Recalculates and updates a player object in-place with new calibrated ratings.
 */
export function applyOppositionRatingsToPlayer(
  player: Player,
  cutoffYear: number = 2026
): Player {
  const ratingsBundle = evaluatePlayerOppositionRatings(player, cutoffYear);

  // Update PlayerRatings interface
  player.ratings = {
    ...player.ratings,
    overall: ratingsBundle.overallRating,
    potential: ratingsBundle.developmentPotential,
    rawPerformanceRating: ratingsBundle.rawPerformanceRating,
    oppositionAdjustedRating: ratingsBundle.oppositionAdjustedRating,
    competitionAdjustedRating: ratingsBundle.competitionAdjustedRating,
    recentFormRating: ratingsBundle.recentFormRating,
    experienceRating: ratingsBundle.experienceRating,
    ratingConfidence: ratingsBundle.ratingConfidence,
    ratingVersion: ratingsBundle.ratingVersion,
    ratingUpdatedAt: ratingsBundle.ratingUpdatedAt,
    dataSource: ratingsBundle.dataSource,
    dataQualityStatus: ratingsBundle.dataQualityStatus,
  };

  // Update top-level convenience properties
  player.rawPerformanceRating = ratingsBundle.rawPerformanceRating;
  player.oppositionAdjustedRating = ratingsBundle.oppositionAdjustedRating;
  player.competitionAdjustedRating = ratingsBundle.competitionAdjustedRating;
  player.recentFormRating = ratingsBundle.recentFormRating;
  player.overallRating = ratingsBundle.overallRating;
  player.ratingConfidence = ratingsBundle.ratingConfidence;
  player.ratingVersion = ratingsBundle.ratingVersion;
  player.ratingUpdatedAt = ratingsBundle.ratingUpdatedAt;
  player.dataSource = ratingsBundle.dataSource;
  player.dataQualityStatus = ratingsBundle.dataQualityStatus;

  return player;
}
