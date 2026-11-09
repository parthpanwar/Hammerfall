// ============================================================
// IPL DYNASTY - Role-Specific Rating Models
// Calibrated evaluation across Batters, Fast Bowlers, Spin Bowlers,
// All-Rounders, and Wicketkeepers on unified IPL usefulness bands.
// ============================================================

import type { PlayerRole } from '../../types/game';

export interface BatterRatingInputs {
  runs: number;
  balls: number;
  matches: number;
  fours: number;
  sixes: number;
  preferredBattingPosition?: number;
  averageContextDifficulty: number; // e.g. 1.15 for IPL, 0.70 for Associate
  powerplayStrikeRate?: number;
  deathStrikeRate?: number;
  consistencyScore?: number;
}

export interface BowlerRatingInputs {
  overs: number;
  wickets: number;
  runsConceded: number;
  matches: number;
  isSpinner: boolean;
  averageContextDifficulty: number;
  powerplayEconomy?: number;
  deathEconomy?: number;
  middleEconomy?: number;
  dotBallPct?: number;
}

export interface AllRounderRatingInputs {
  battingInputs: BatterRatingInputs;
  bowlingInputs: BowlerRatingInputs;
}

export interface WicketkeeperRatingInputs {
  battingInputs: BatterRatingInputs;
  dismissals?: number; // catches + stumpings
  matches: number;
}

/**
 * Calibrated Batting Rating (0-100).
 * Combines adjusted strike rate, context-weighted average, boundary %, and volume mastery.
 */
export function calculateBatterOppositionRating(inputs: BatterRatingInputs): number {
  const { runs, balls, matches, fours, sixes, averageContextDifficulty } = inputs;
  const rawSr = balls > 0 ? (runs / balls) * 100 : 125;
  const rawAvg = runs / Math.max(1, matches * 0.85);

  // Context adjusted metrics
  // Elite opposition increases effective value of runs and strike rate
  const adjSr = rawSr * Math.pow(averageContextDifficulty, 0.85);
  const adjAvg = rawAvg * Math.pow(averageContextDifficulty, 0.80);

  // Boundary rate: percentage of runs from 4s & 6s
  const boundaryRuns = fours * 4 + sixes * 6;
  const boundaryPct = runs > 0 ? (boundaryRuns / runs) * 100 : 50;

  // Rating synthesis calibrated to IPL usefulness:
  // SR component: baseline 128 = 70, 140 = 78, 155 = 88, 170+ = 96
  const srScore = Math.min(99, Math.max(35, 70 + (adjSr - 128) * 0.65));
  // Average component: baseline 24 = 70, 32 = 80, 40 = 90, 48+ = 98
  const avgScore = Math.min(99, Math.max(35, 70 + (adjAvg - 24) * 1.25));
  // Boundary punch: 50% = 70, 62% = 82, 75%+ = 95
  const boundaryScore = Math.min(99, Math.max(35, 70 + (boundaryPct - 50) * 0.9));

  // Volume mastery bonus: proven across high run volume against quality bowling
  const volumeBonus = Math.min(6, Math.max(0, (runs - 800) * 0.0015));

  // Weighted blend: 45% SR, 35% Avg, 20% Boundaries + volume bonus
  const rating = (srScore * 0.45 + avgScore * 0.35 + boundaryScore * 0.20) + volumeBonus;

  return Math.min(99, Math.max(30, Math.round(rating)));
}

/**
 * Calibrated Fast Bowler & Spin Bowler Rating (0-100).
 * Combines adjusted economy, wicket-taking strike rate, and volume mastery.
 */
export function calculateBowlerOppositionRating(inputs: BowlerRatingInputs): number {
  const { overs, wickets, runsConceded, isSpinner, averageContextDifficulty } = inputs;
  const rawEcon = overs > 0 ? runsConceded / overs : 8.5;
  const ballsBowled = overs * 6;
  const rawBowlSr = wickets > 0 ? ballsBowled / wickets : 24.0;

  // Context adjustment: Bowling against elite batting with 8.0 economy is worth more
  // than 7.5 against associate tailenders
  const adjEcon = rawEcon / Math.pow(averageContextDifficulty, 0.85);
  const adjBowlSr = rawBowlSr / Math.pow(averageContextDifficulty, 0.75);

  // Economy score (lower is better):
  // Baseline T20 average economy is 8.5.
  // 6.5 -> 96, 7.0 -> 90, 7.5 -> 83, 8.0 -> 76, 8.5 -> 70, 9.2 -> 60
  const econScore = Math.min(99, Math.max(35, 70 + (8.5 - adjEcon) * 13.0));

  // Strike rate score (lower is better):
  // Baseline T20 bowling strike rate is 22 balls/wicket.
  // 12 balls/wkt -> 95, 15 -> 88, 18 -> 80, 22 -> 70, 26 -> 60
  const srScore = Math.min(99, Math.max(35, 70 + (22.0 - adjBowlSr) * 2.5));

  // Volume mastery bonus: proven across large number of wickets against quality opposition
  const volumeBonus = Math.min(6, Math.max(0, (wickets - 40) * 0.05));

  // Role nuance: Spinners prioritized on economy & control; Fast bowlers on death & wickets
  const econWeight = isSpinner ? 0.55 : 0.45;
  const srWeight = isSpinner ? 0.45 : 0.55;

  const rating = (econScore * econWeight + srScore * srWeight) + volumeBonus;
  return Math.min(99, Math.max(30, Math.round(rating)));
}

/**
 * Calibrated All-Rounder Rating (0-100).
 * Blends batting, bowling, and a dual-discipline versatility premium.
 */
export function calculateAllRounderOppositionRating(inputs: AllRounderRatingInputs): number {
  const batRating = calculateBatterOppositionRating(inputs.battingInputs);
  const bowlRating = calculateBowlerOppositionRating(inputs.bowlingInputs);

  // Dual usage check: Requires meaningful volume in both disciplines
  const hasBatVolume = inputs.battingInputs.balls >= 60;
  const hasBowlVolume = inputs.bowlingInputs.overs >= 15;

  let versatilityBonus = 0;
  if (hasBatVolume && hasBowlVolume) {
    // Both skills above average
    if (batRating >= 70 && bowlRating >= 70) versatilityBonus = 6;
    else if (batRating >= 65 && bowlRating >= 65) versatilityBonus = 4;
    else versatilityBonus = 2;
  }

  // Balanced combination: 48% bat + 48% bowl + versatility bonus
  const composite = (batRating * 0.48 + bowlRating * 0.48) + versatilityBonus;
  return Math.min(98, Math.max(35, Math.round(composite)));
}

/**
 * Calibrated Wicketkeeper-Batter Rating (0-100).
 * 85% batting ability + 15% keeping reliability & dismissal volume.
 */
export function calculateWicketkeeperOppositionRating(inputs: WicketkeeperRatingInputs): number {
  const batRating = calculateBatterOppositionRating(inputs.battingInputs);
  const dismissals = inputs.dismissals ?? inputs.matches * 0.8;
  const dismissalsPerMatch = inputs.matches > 0 ? dismissals / inputs.matches : 0.8;

  // Keeping score based on dismissal rate (0.7/m is standard, 1.2+/m is elite)
  const keepingScore = Math.min(95, Math.max(68, Math.round(70 + (dismissalsPerMatch - 0.5) * 25)));

  const composite = batRating * 0.85 + keepingScore * 0.15;
  return Math.min(98, Math.max(35, Math.round(composite)));
}
