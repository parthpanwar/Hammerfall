// ============================================================
// IPL DYNASTY - Match Tactics & Strategy Engine
// Batting aggression, bowling lines, Impact Player substitutions,
// and adaptive CPU tactical match management.
// ============================================================

import type { Franchise, Player, PlayingXI } from '@/lib/types/game';

export type BattingAggression = 'Anchor' | 'Balanced' | 'Attack' | 'Blitz';
export type BowlingStrategy = 'Stock' | 'Yorker' | 'Bouncer' | 'SlowerBall' | 'WideLine';

export interface TacticalModifiers {
  boundaryProbMultiplier: number;
  dismissalProbMultiplier: number;
  dotProbMultiplier: number;
  sixBiasMultiplier: number;
  extraChanceMultiplier: number;
}

export const BATTING_AGGRESSION_MODIFIERS: Record<BattingAggression, TacticalModifiers> = {
  Anchor: {
    boundaryProbMultiplier: 0.60,
    dismissalProbMultiplier: 0.40,
    dotProbMultiplier: 1.20,
    sixBiasMultiplier: 0.40,
    extraChanceMultiplier: 1.0,
  },
  Balanced: {
    boundaryProbMultiplier: 1.0,
    dismissalProbMultiplier: 1.0,
    dotProbMultiplier: 1.0,
    sixBiasMultiplier: 1.0,
    extraChanceMultiplier: 1.0,
  },
  Attack: {
    boundaryProbMultiplier: 1.35,
    dismissalProbMultiplier: 1.30,
    dotProbMultiplier: 0.82,
    sixBiasMultiplier: 1.30,
    extraChanceMultiplier: 1.0,
  },
  Blitz: {
    boundaryProbMultiplier: 1.70,
    dismissalProbMultiplier: 1.75,
    dotProbMultiplier: 0.65,
    sixBiasMultiplier: 1.65,
    extraChanceMultiplier: 1.0,
  },
};

export const BOWLING_STRATEGY_MODIFIERS: Record<BowlingStrategy, TacticalModifiers> = {
  Stock: {
    boundaryProbMultiplier: 1.0,
    dismissalProbMultiplier: 1.0,
    dotProbMultiplier: 1.0,
    sixBiasMultiplier: 1.0,
    extraChanceMultiplier: 1.0,
  },
  Yorker: {
    boundaryProbMultiplier: 0.85,
    dismissalProbMultiplier: 1.35,   // High bowled / lbw chance
    dotProbMultiplier: 1.25,
    sixBiasMultiplier: 0.70,
    extraChanceMultiplier: 1.40,     // Missed yorker = full toss / wide down leg
  },
  Bouncer: {
    boundaryProbMultiplier: 1.15,
    dismissalProbMultiplier: 1.25,   // Top edges caught in the deep
    dotProbMultiplier: 1.10,
    sixBiasMultiplier: 1.40,         // Hooked/pulled for six
    extraChanceMultiplier: 1.50,     // Wides over head
  },
  SlowerBall: {
    boundaryProbMultiplier: 0.90,
    dismissalProbMultiplier: 1.30,   // Deceived batsmen chipping to covers/long-on
    dotProbMultiplier: 1.15,
    sixBiasMultiplier: 0.85,
    extraChanceMultiplier: 1.10,
  },
  WideLine: {
    boundaryProbMultiplier: 0.80,    // Hard to hit boundaries through off-side tramline
    dismissalProbMultiplier: 0.90,
    dotProbMultiplier: 1.20,
    sixBiasMultiplier: 0.60,
    extraChanceMultiplier: 2.20,     // Higher risk of wide ball
  },
};

/**
 * Calculates adaptive CPU batting aggression based on match situation:
 * Current over, wickets in hand, target, and required run rate (RRR).
 */
export function getCpuBattingAggression(
  over: number,
  wicketsLost: number,
  targetScore: number | null,
  currentRuns: number
): BattingAggression {
  // If batting first:
  if (targetScore === null) {
    // Powerplay (Overs 0-5): Exploit fielding restrictions unless multiple wickets lost
    if (over < 6) {
      return wicketsLost >= 2 ? 'Balanced' : 'Attack';
    }
    // Middle overs (Overs 6-14): Consolidate and build partnerships
    if (over < 15) {
      if (wicketsLost >= 5) return 'Anchor';
      if (wicketsLost <= 2) return 'Attack';
      return 'Balanced';
    }
    // Death overs (Overs 15-19): Full launch mode based on wickets remaining
    if (wicketsLost >= 8) return 'Balanced';
    if (wicketsLost >= 6) return 'Attack';
    return 'Blitz';
  }

  // If chasing:
  const runsNeeded = targetScore - currentRuns;
  const ballsRemaining = Math.max(1, 120 - over * 6);
  const rrr = (runsNeeded / ballsRemaining) * 6;
  const wicketsInHand = 10 - wicketsLost;

  // Panic / Blitz if RRR is extreme
  if (rrr > 13.0 && wicketsInHand >= 2) return 'Blitz';
  if (rrr > 10.5) {
    return wicketsInHand >= 4 ? 'Blitz' : 'Attack';
  }
  if (rrr > 8.5) {
    return wicketsInHand <= 3 ? 'Balanced' : 'Attack';
  }
  if (rrr < 6.0) {
    // Cruising to victory: avoid reckless shots
    return 'Anchor';
  }
  return wicketsInHand <= 3 ? 'Anchor' : 'Balanced';
}

/**
 * Evaluates whether an Impact Player can be legally substituted in the current match state:
 * - Permitted before start of an innings
 * - Permitted at the fall of a wicket
 * - Permitted at the completion of an over
 * (Cannot substitute mid-over unless replacing an injured bowler/batter).
 */
export function canSubstituteImpactPlayer(
  hasUsedImpactPlayer: boolean,
  isLegalBreakPoint: boolean, // end of over, fall of wicket, or innings transition
  franchise: Franchise,
  currentOverseasInXI: number,
  substitutePlayer: Player
): { allowed: boolean; reason: string } {
  if (hasUsedImpactPlayer) {
    return { allowed: false, reason: 'Impact Player substitution has already been used in this match.' };
  }
  if (!isLegalBreakPoint) {
    return { allowed: false, reason: 'Impact Player can only be brought on at over completion, fall of wicket, or innings break.' };
  }
  // Overseas quota rule: If 4 overseas players already in playing XI, substitute MUST be Indian
  if (substitutePlayer.nationality === 'Overseas' && currentOverseasInXI >= 4) {
    return { allowed: false, reason: 'Cannot bring in an Overseas Impact Player when 4 overseas players are already playing.' };
  }

  return { allowed: true, reason: 'Legal Impact Player substitution.' };
}

