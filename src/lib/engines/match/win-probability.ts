// ============================================================
// IPL DYNASTY - Live T20 Win Probability Meter
// Real-time probabilistic win model based on match state,
// venue par score, wickets in hand, and required run rate.
// ============================================================

import type { StadiumProfile } from './venues';

export interface WinProbabilityBreakdown {
  battingTeamWinPct: number; // 0 to 100
  bowlingTeamWinPct: number; // 0 to 100
  currentRunRate: number;
  requiredRunRate: number | null;
  projectedScore: number;
  target: number | null;
}

/** Sigmoid activation function */
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Calculates real-time win probability for both teams during a match.
 */
export function calculateLiveWinProbability(
  inningsIndex: 1 | 2,
  over: number,               // 0 to 19
  ball: number,               // 0 to 6
  runsScored: number,
  wicketsLost: number,
  targetScore: number | null, // null in 1st innings, number in 2nd innings
  stadium: StadiumProfile
): WinProbabilityBreakdown {
  const legalBallsBowled = Math.max(1, over * 6 + ball);
  const currentRunRate = Math.round((runsScored / legalBallsBowled) * 60) / 10;
  const ballsRemaining = Math.max(0, 120 - legalBallsBowled);
  const wicketsInHand = Math.max(0, 10 - wicketsLost);

  // -------------------------------------------------------------
  // INNINGS 1 WIN PROBABILITY
  // -------------------------------------------------------------
  if (inningsIndex === 1 || targetScore === null) {
    // Project final 1st innings total
    // Blend current run rate with venue par score
    const parRate = stadium.parScore / 20;
    const projectedRemaining = (ballsRemaining / 6) * ((currentRunRate * 0.60) + (parRate * 0.40)) * (wicketsInHand / 10);
    const projectedScore = Math.round(runsScored + projectedRemaining);

    // Score relative to venue par
    const scoreDelta = projectedScore - stadium.parScore;
    // Logistic curve: each 10 runs above par increases win prob
    const z = (scoreDelta / 14) + ((wicketsInHand - 6) * 0.15) - ((stadium.chasingAdvantage - 0.50) * 2.0);
    const rawBatWin = sigmoid(z);
    const battingWinPct = Math.round(Math.max(5, Math.min(95, rawBatWin * 100)));

    return {
      battingTeamWinPct: battingWinPct,
      bowlingTeamWinPct: 100 - battingWinPct,
      currentRunRate,
      requiredRunRate: null,
      projectedScore,
      target: null,
    };
  }

  // -------------------------------------------------------------
  // INNINGS 2 (CHASE) WIN PROBABILITY
  // -------------------------------------------------------------
  const runsNeeded = Math.max(0, targetScore - runsScored);

  // If match already won or all out
  if (runsNeeded === 0) {
    return {
      battingTeamWinPct: 100,
      bowlingTeamWinPct: 0,
      currentRunRate,
      requiredRunRate: 0,
      projectedScore: runsScored,
      target: targetScore,
    };
  }
  if (wicketsInHand === 0 || ballsRemaining === 0) {
    return {
      battingTeamWinPct: 0,
      bowlingTeamWinPct: 100,
      currentRunRate,
      requiredRunRate: 99.9,
      projectedScore: runsScored,
      target: targetScore,
    };
  }

  const requiredRunRate = Math.round((runsNeeded / ballsRemaining) * 60) / 10;

  // Chase equation:
  // Favorable if: RRR <= 8.5, wicketsInHand >= 6
  // Desperate if: RRR >= 13.0, wicketsInHand <= 4
  const rrrDifferential = (stadium.parScore / 20) - requiredRunRate; // positive = ahead of par
  const wicketWeight = (wicketsInHand - 5) * 0.45;
  const dewBonus = stadium.dewFactor * 0.6; // Dew makes ball wet, aiding chaser

  const zChase = (rrrDifferential * 0.40) + wicketWeight + dewBonus;
  const rawChaseWin = sigmoid(zChase);
  const chasingWinPct = Math.round(Math.max(1, Math.min(99, rawChaseWin * 100)));

  return {
    battingTeamWinPct: chasingWinPct,
    bowlingTeamWinPct: 100 - chasingWinPct,
    currentRunRate,
    requiredRunRate,
    projectedScore: Math.round(runsScored + (currentRunRate * (ballsRemaining / 6))),
    target: targetScore,
  };
}

