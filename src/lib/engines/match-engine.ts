// ============================================================
// IPL DYNASTY - ML-Powered Match Simulation Engine
// Realistic ball-by-ball T20 simulation, commentary, and scorecards
// Driven by Cricsheet ball-by-ball data, ML projections,
// tactical matchups, and venue-specific pitch environments.
// ============================================================

import type {
  Franchise,
  Player,
  PlayingXI,
  MatchResult,
  InningsScore,
  BatsmanInnings,
  BowlerSpell,
  BallEvent,
  DeliveryOutcome,
  DismissalType,
  MatchPhase,
  Fixture,
  SeededRandom,
} from '@/lib/types/game';
import { createSeededRandom } from '@/lib/utils/random';
import {
  StadiumProfile,
  PitchCondition,
  getStadiumProfile,
  generateMatchDayPitch,
  decideToss,
  TossResult,
} from './match/venues';
import {
  PlayerMatchAttributes,
  getPlayerMatchAttributes,
} from './match/ml-match-bridge';
import {
  BattingAggression,
  BowlingStrategy,
  BATTING_AGGRESSION_MODIFIERS,
  BOWLING_STRATEGY_MODIFIERS,
  getCpuBattingAggression,
} from './match/tactics';
import {
  WinProbabilityBreakdown,
  calculateLiveWinProbability,
} from './match/win-probability';

export interface FallOfWicket {
  wicket: number;
  score: number;
  overs: number;
  batsmanName: string;
}

export interface OverDeliveryBadge {
  text: string;
  isWicket: boolean;
  isBoundary: boolean;
  isExtra: boolean;
}

export interface DetailedInningsData {
  teamId: string;
  battingTeamName: string;
  bowlingTeamName: string;
  score: InningsScore;
  batsmen: BatsmanInnings[];
  bowlers: BowlerSpell[];
  balls: BallEvent[];
  fallOfWickets: FallOfWicket[];
  recentDeliveries: OverDeliveryBadge[];
  currentPartnership: { runs: number; balls: number };
  strikerIndex: number;
  nonStrikerIndex: number;
  currentBowlerIndex: number;
  currentOver: number;
  legalBallsInOver: number;
  isFreeHitActive: boolean;
  isCompleted: boolean;
  target: number | null;
}

export interface LiveMatchSession {
  matchId: string;
  fixture: Fixture;
  venue: string;
  stadium: StadiumProfile;
  pitchCondition: PitchCondition;
  team1: Franchise;
  team2: Franchise;
  team1XI: PlayingXI;
  team2XI: PlayingXI;
  toss: TossResult;
  battingFirstTeam: Franchise;
  bowlingFirstTeam: Franchise;
  bat1XI: PlayingXI;
  bowl1XI: PlayingXI;
  currentInningsIndex: 1 | 2;
  innings1: DetailedInningsData;
  innings2: DetailedInningsData;
  isMatchCompleted: boolean;
  result: MatchResult | null;
  winProbability: WinProbabilityBreakdown;
  activeBattingAggression: BattingAggression;
  activeBowlingStrategy: BowlingStrategy;
  rng: SeededRandom;
}

// Commentary Templates
const DOT_COMMENTARY = [
  'Good length delivery, defended solidly back to the bowler.',
  'Beaten! Beautiful seam movement past the outside edge.',
  'Pushed gently towards point, no run taken.',
  'Short of length on off stump, tapped into the off-side.',
  'Swing and a miss! Good change of pace from the bowler.',
  'Well bowled! Cramped for room, defends on the back foot.',
  'Darts it in on middle stump, blocked out safely.',
];

const SINGLE_COMMENTARY = [
  'Pushed into the gap at mid-wicket for a quick single.',
  'Drives smoothly towards sweeper cover for one.',
  'Tucked off the hips towards square leg for an easy single.',
  'Dabs it down to third man to rotate the strike.',
  'Straight down to long-on, easy jog for one run.',
  'Punched off the back foot through point for a single.',
];

const TWO_COMMENTARY = [
  'Driven through extra cover! Superb running turns one into two.',
  'Flicked into deep mid-wicket, hurried back for a comfortable brace.',
  'Steered through backward point, good call and they sprint back for the second.',
];

const FOUR_COMMENTARY = [
  'FOUR! Magnificent cover drive! Pierces the infield and races to the rope!',
  'FOUR! Pulled away with authority behind square! No chance for deep fine leg!',
  'FOUR! Edged and past slip! Flies away to the third man boundary!',
  'FOUR! Pure timing! Leans into a full delivery and caresses it through extra cover!',
  'FOUR! Smashed down the ground like a rocket! Outfield is lightning fast!',
  'FOUR! Upper cut over backward point! Deft touch and four runs!',
];

const SIX_COMMENTARY = [
  'SIX! Dispatched into the top tier! Massive hit into the night sky!',
  'SIX! In the slot and launched high and handsome over long-on!',
  'SIX! Sweet sound off the bat! Picked up effortlessly over deep mid-wicket!',
  'SIX! Slog sweep executed to perfection! Clears the rope with plenty to spare!',
  'SIX! That is colossal! Stood tall and deposited into the stadium roof!',
  'SIX! Clean strike over extra cover! The crowd is on its feet!',
];

const WICKET_COMMENTARY: Record<DismissalType, string[]> = {
  Bowled: [
    'OUT! Clean bowled! Timber disturbed! Stumps cartwheeling out of the ground!',
    'OUT! Bowled him! Knocked him over with a lethal inswinging yorker!',
    'OUT! Inside edge onto the stumps! The bails go flying!',
  ],
  Caught: [
    'OUT! Caught! Skyed high in the air... and taken cleanly in the deep!',
    'OUT! Sliced towards cover! Fielder takes a spectacular diving catch!',
    'OUT! Mistimed lofted drive, settles comfortably into the hands of long-off!',
  ],
  CaughtBehind: [
    'OUT! Edged and taken! Feather through to the wicketkeeper!',
    'OUT! Faint tickle behind! Keeper takes an easy regulation catch!',
  ],
  CaughtAndBowled: [
    'OUT! Caught and bowled! Snatched back by the bowler on the follow-through!',
    'OUT! Leading edge popped straight back into the bowler\'s waiting hands!',
  ],
  LBW: [
    'OUT! Loud appeal... GIVEN! Trapped plumb in front of middle stump!',
    'OUT! Struck on the pads! Searing yorker, umpire raises the finger without hesitation!',
  ],
  RunOut: [
    'OUT! RUN OUT! Direct hit at the striker\'s end! Batsman was inches short!',
    'OUT! Fatal mix-up between the wickets! Both at the same end, easy run out!',
  ],
  Stumped: [
    'OUT! STUMPED! Dragged his foot out, lightning fast work by the keeper!',
    'OUT! Beaten by the flight and sharp turn! Bails whipped off in a flash!',
  ],
  HitWicket: [
    'OUT! HIT WICKET! Stepped back too deep and dislodged his own bails!',
  ],
  RetiredHurt: [
    'Batsman retires hurt and heads to the pavilion.',
  ],
  NotOut: [
    'Not out.',
  ],
};

export interface DeliverySimulationResult {
  outcome: DeliveryOutcome;
  runs: number;
  extraRuns: number;
  isLegal: boolean;
  dismissalType?: DismissalType;
  commentary: string;
}

/**
 * Simulates a single delivery using ML player features, stadium profiles, pitch, and tactics.
 */
export function simulateDelivery(
  over: number, // 0 to 19
  ballInOver: number, // 1 to 6
  striker: Player,
  bowler: Player,
  targetScore: number | null,
  currentScore: InningsScore,
  stadium: StadiumProfile,
  pitch: PitchCondition,
  battingAggression: BattingAggression,
  bowlingStrategy: BowlingStrategy,
  isFreeHit: boolean,
  rng: SeededRandom
): DeliverySimulationResult {
  // 1. Fetch ML-Calibrated Attributes
  const strikerAttrs = getPlayerMatchAttributes(striker);
  const bowlerAttrs = getPlayerMatchAttributes(bowler);

  // Determine Match Phase
  const phase: MatchPhase = over < 6 ? 'Powerplay' : over < 15 ? 'Middle' : 'Death';

  // 2. Tactical & Pressure Multipliers
  const batTactics = BATTING_AGGRESSION_MODIFIERS[battingAggression];
  const bowlTactics = BOWLING_STRATEGY_MODIFIERS[bowlingStrategy];

  let pressureMultiplier = 1.0;
  if (targetScore !== null) {
    const runsNeeded = targetScore - currentScore.runs;
    const ballsRemaining = Math.max(1, 120 - (over * 6 + ballInOver));
    const reqRunRate = (runsNeeded / ballsRemaining) * 6;

    if (reqRunRate > 12) pressureMultiplier = 1.30;
    else if (reqRunRate > 9) pressureMultiplier = 1.15;
    else if (reqRunRate < 6) pressureMultiplier = 0.85;
  }

  // 3. Phase-Specific Effective Ratings
  let effectiveBatting = strikerAttrs.expectedStrikeRate;
  let effectiveBowling = 100 - (bowlerAttrs.expectedEconomy * 7.5);

  if (phase === 'Powerplay') {
    effectiveBatting += (strikerAttrs.powerplayBattingRating - 75) * 0.4;
    effectiveBowling += (bowlerAttrs.powerplayBowlingRating - 75) * 0.4;
  } else if (phase === 'Middle') {
    effectiveBatting += (strikerAttrs.middleBattingRating - 75) * 0.3;
    effectiveBowling += (bowlerAttrs.middleBowlingRating - 75) * 0.3;
  } else if (phase === 'Death') {
    effectiveBatting += (strikerAttrs.deathBattingRating - 75) * 0.5 + (strikerAttrs.powerHittingSkill - 70) * 0.4;
    effectiveBowling += (bowlerAttrs.deathBowlingRating - 75) * 0.5;
  }

  // 4. Matchup Affinities (Pace vs Spin)
  if (bowlerAttrs.isSpinner) {
    effectiveBatting += (strikerAttrs.vsSpinRating - 75) * 0.35;
    // Pitch spin assistance
    effectiveBowling += stadium.spinAssistance * 30;
    if (pitch === 'Turning Dustbowl') effectiveBowling += 14;
    if (pitch === 'Slow & Low') effectiveBowling += 8;
  } else if (bowlerAttrs.isPacer) {
    effectiveBatting += (strikerAttrs.vsPaceRating - 75) * 0.35;
    // Pitch pace assistance
    effectiveBowling += stadium.paceAssistance * 30;
    if (pitch === 'Green Seamer') effectiveBowling += 12;
    if (pitch === 'Flat Track') effectiveBatting += 10;
  }

  // Relative Skill Advantage (-40 to +40)
  const advantage = (effectiveBatting - effectiveBowling) / 2.5;

  // 5. Extras Check (Wides & No-Balls)
  const extraChance = 0.032 * bowlTactics.extraChanceMultiplier * (1.1 - (bowlerAttrs.controlConsistency / 100) * 0.2);
  const extraRoll = rng.next();

  if (extraRoll < extraChance * 0.70) {
    return {
      outcome: 'Wide',
      runs: 0,
      extraRuns: 1,
      isLegal: false,
      commentary: 'Wide ball! Fired well outside the tramline, keeper collects.',
    };
  } else if (extraRoll < extraChance) {
    return {
      outcome: 'NoBall',
      runs: 0,
      extraRuns: 1,
      isLegal: false,
      commentary: 'No ball! Overstepping the popping crease! Free hit coming up next!',
    };
  }

  // 6. Wicket Probability Calculation
  // Base wicket probability in T20 is ~0.045 to 0.055 per ball
  let baseWicketProb = 0.045;
  if (phase === 'Powerplay') baseWicketProb = 0.036;
  else if (phase === 'Middle') baseWicketProb = 0.038;
  else if (phase === 'Death') baseWicketProb = 0.065;

  let wicketChance = baseWicketProb *
    batTactics.dismissalProbMultiplier *
    bowlTactics.dismissalProbMultiplier *
    pressureMultiplier *
    (1.0 - (advantage * 0.004));

  // Bowler wicket-taking bonus
  wicketChance *= (bowlerAttrs.wicketTakingAbility / 75);
  // Dismissal resistance of batter
  wicketChance *= (1.25 - (strikerAttrs.dismissalResistance / 100) * 0.4);

  // Boundary condition
  wicketChance = Math.max(0.015, Math.min(0.24, wicketChance));

  // If Free Hit is active, batsman CANNOT be out (except Run Out)
  if (isFreeHit) {
    // Only 2% chance of run-out on free hit scramble
    if (rng.next() < 0.02) {
      return {
        outcome: 'Wicket',
        runs: 1,
        extraRuns: 0,
        isLegal: true,
        dismissalType: 'RunOut',
        commentary: `RUN OUT on the Free Hit! Scrambled for a second run and caught short!`,
      };
    }
    wicketChance = 0.0;
  }

  // Roll for Wicket
  if (rng.next() < wicketChance) {
    const dismissalRoll = rng.next();
    let dismissalType: DismissalType = 'Caught';

    if (bowlingStrategy === 'Yorker' && dismissalRoll < 0.50) {
      dismissalType = dismissalRoll < 0.25 ? 'Bowled' : 'LBW';
    } else if (bowlerAttrs.isSpinner && dismissalRoll < 0.22) {
      dismissalType = 'Stumped';
    } else if (dismissalRoll < 0.22) {
      dismissalType = 'Bowled';
    } else if (dismissalRoll < 0.38) {
      dismissalType = 'LBW';
    } else if (dismissalRoll < 0.48) {
      dismissalType = 'CaughtBehind';
    } else if (dismissalRoll < 0.53) {
      dismissalType = 'RunOut';
    } else if (dismissalRoll < 0.55 && bowlingStrategy === 'Yorker') {
      dismissalType = 'HitWicket';
    } else {
      dismissalType = 'Caught';
    }

    const comments = WICKET_COMMENTARY[dismissalType];
    const comm = comments && comments.length > 0 ? rng.pick(comments) : 'OUT! Batsman has to depart.';

    return {
      outcome: 'Wicket',
      runs: 0,
      extraRuns: 0,
      isLegal: true,
      dismissalType,
      commentary: `${comm} (${striker.name} departs)`,
    };
  }

  // 7. Shot Outcome Distribution (Dot, 1, 2, 4, 6)
  // Calibrated boundary probabilities
  let boundaryProb = strikerAttrs.boundaryTendency *
    batTactics.boundaryProbMultiplier *
    bowlTactics.boundaryProbMultiplier *
    (1.0 + (advantage * 0.003));

  if (phase === 'Death') boundaryProb += 0.060;
  if (phase === 'Powerplay') boundaryProb += 0.015;
  if (pitch === 'Flat Track') boundaryProb += 0.02;
  if (pitch === 'Slow & Low') boundaryProb -= 0.025;

  boundaryProb = Math.max(0.06, Math.min(0.26, boundaryProb));

  // Split into Four vs Six (real IPL ratio is ~68% Fours, ~32% Sixes)
  const fourWeight = 0.68 * stadium.fourMultiplier;
  const sixWeight = 0.32 * stadium.sixMultiplier * batTactics.sixBiasMultiplier * bowlTactics.sixBiasMultiplier * (strikerAttrs.powerHittingSkill / 75);
  const totalWeight = fourWeight + sixWeight;
  const fourProb = boundaryProb * (fourWeight / totalWeight);
  const sixProb = boundaryProb * (sixWeight / totalWeight);

  // Dot ball probability
  let dotProb = strikerAttrs.dotBallTendency *
    batTactics.dotProbMultiplier *
    bowlTactics.dotProbMultiplier *
    (1.0 - (advantage * 0.003));

  if (phase === 'Powerplay') dotProb += 0.06; // New ball play-and-miss
  if (phase === 'Middle') dotProb += 0.03;
  if (bowlerAttrs.isSpinner && pitch === 'Turning Dustbowl') dotProb += 0.05;
  dotProb = Math.max(0.28, Math.min(0.48, dotProb));

  // Running between wickets: singles and twos
  const remainder = Math.max(0.08, 1.0 - dotProb - fourProb - sixProb);
  const singleProb = remainder * 0.78;
  const twoProb = remainder * 0.22;

  const roll = rng.next();
  let cum = 0;

  cum += dotProb;
  if (roll < cum) {
    return {
      outcome: 'Dot',
      runs: 0,
      extraRuns: 0,
      isLegal: true,
      commentary: rng.pick(DOT_COMMENTARY),
    };
  }

  cum += singleProb;
  if (roll < cum) {
    return {
      outcome: 'Single',
      runs: 1,
      extraRuns: 0,
      isLegal: true,
      commentary: rng.pick(SINGLE_COMMENTARY),
    };
  }

  cum += twoProb;
  if (roll < cum) {
    return {
      outcome: 'Double',
      runs: 2,
      extraRuns: 0,
      isLegal: true,
      commentary: rng.pick(TWO_COMMENTARY),
    };
  }

  cum += fourProb;
  if (roll < cum) {
    return {
      outcome: 'Four',
      runs: 4,
      extraRuns: 0,
      isLegal: true,
      commentary: rng.pick(FOUR_COMMENTARY),
    };
  }

  return {
    outcome: 'Six',
    runs: 6,
    extraRuns: 0,
    isLegal: true,
    commentary: rng.pick(SIX_COMMENTARY),
  };
}

/**
 * Creates a brand new live match session ready for interactive or instant play.
 */
export function createLiveMatchSession(
  fixture: Fixture,
  team1: Franchise,
  team2: Franchise,
  team1XI: PlayingXI,
  team2XI: PlayingXI,
  seed: number = Date.now()
): LiveMatchSession {
  const rng = createSeededRandom(seed);
  const stadium = getStadiumProfile(fixture.venue);
  const pitchCondition = generateMatchDayPitch(stadium, rng);

  // Conduct toss
  const tossWinner = rng.nextBool() ? team1 : team2;
  const opponent = tossWinner.id === team1.id ? team2 : team1;
  const toss = decideToss(tossWinner, opponent, stadium, pitchCondition, rng);

  let battingFirstTeam: Franchise;
  let bowlingFirstTeam: Franchise;
  let bat1XI: PlayingXI;
  let bowl1XI: PlayingXI;

  if (toss.winnerId === team1.id) {
    if (toss.decision === 'Bat') {
      battingFirstTeam = team1;
      bowlingFirstTeam = team2;
      bat1XI = team1XI;
      bowl1XI = team2XI;
    } else {
      battingFirstTeam = team2;
      bowlingFirstTeam = team1;
      bat1XI = team2XI;
      bowl1XI = team1XI;
    }
  } else {
    if (toss.decision === 'Bat') {
      battingFirstTeam = team2;
      bowlingFirstTeam = team1;
      bat1XI = team2XI;
      bowl1XI = team1XI;
    } else {
      battingFirstTeam = team1;
      bowlingFirstTeam = team2;
      bat1XI = team1XI;
      bowl1XI = team2XI;
    }
  }

  const createInitialInnings = (
    batting: Franchise,
    bowling: Franchise,
    batXI: PlayingXI,
    bowlXI: PlayingXI,
    target: number | null
  ): DetailedInningsData => {
    const batSquadMap = new Map(batting.players.map((p) => [p.id, p]));
    const bowlSquadMap = new Map(bowling.players.map((p) => [p.id, p]));

    const batsmen: BatsmanInnings[] = batXI.players
      .map((id) => batSquadMap.get(id))
      .filter((p): p is Player => !!p)
      .map((p, idx) => ({
        playerId: p.id,
        playerName: p.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        dismissalType: 'NotOut',
        dismissalText: 'not out',
        isOnStrike: idx === 0,
      }));

    // Find bowlers (all players who can bowl)
    let bowlingCandidates = bowlXI.players
      .map((id) => bowlSquadMap.get(id))
      .filter((p): p is Player => !!p)
      .filter((p) => p.role === 'Bowler' || p.role === 'All-Rounder' || p.ratings.bowling >= 50)
      .sort((a, b) => b.ratings.bowling - a.ratings.bowling);

    // Ensure at least 5 bowling options from the Playing XI
    if (bowlingCandidates.length < 5) {
      const remainingXI = bowlXI.players
        .map((id) => bowlSquadMap.get(id))
        .filter((p): p is Player => !!p && !bowlingCandidates.some((bc) => bc.id === p.id))
        .sort((a, b) => b.ratings.bowling - a.ratings.bowling);
      bowlingCandidates = [...bowlingCandidates, ...remainingXI];
    }

    const bowlers: BowlerSpell[] = bowlingCandidates.slice(0, 7).map((p) => ({
      playerId: p.id,
      playerName: p.name,
      overs: 0,
      balls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      economy: 0,
      wides: 0,
      noBalls: 0,
    }));

    return {
      teamId: batting.id,
      battingTeamName: batting.name,
      bowlingTeamName: bowling.name,
      score: { runs: 0, wickets: 0, overs: 0, balls: 0, extras: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      batsmen,
      bowlers,
      balls: [],
      fallOfWickets: [],
      recentDeliveries: [],
      currentPartnership: { runs: 0, balls: 0 },
      strikerIndex: 0,
      nonStrikerIndex: 1,
      currentBowlerIndex: 0,
      currentOver: 0,
      legalBallsInOver: 0,
      isFreeHitActive: false,
      isCompleted: false,
      target,
    };
  };

  const innings1 = createInitialInnings(battingFirstTeam, bowlingFirstTeam, bat1XI, bowl1XI, null);
  const innings2 = createInitialInnings(bowlingFirstTeam, battingFirstTeam, bowl1XI, bat1XI, null);

  const winProb = calculateLiveWinProbability(1, 0, 0, 0, 0, null, stadium);

  return {
    matchId: fixture.id,
    fixture,
    venue: fixture.venue,
    stadium,
    pitchCondition,
    team1,
    team2,
    team1XI,
    team2XI,
    toss,
    battingFirstTeam,
    bowlingFirstTeam,
    bat1XI,
    bowl1XI,
    currentInningsIndex: 1,
    innings1,
    innings2,
    isMatchCompleted: false,
    result: null,
    winProbability: winProb,
    activeBattingAggression: 'Balanced',
    activeBowlingStrategy: 'Stock',
    rng,
  };
}

/**
 * Step forward by exactly one delivery in the live match session.
 */
export function simulateLiveDelivery(
  session: LiveMatchSession,
  tacticsOverride?: {
    battingAggression?: BattingAggression;
    bowlingStrategy?: BowlingStrategy;
    bowlerIndex?: number;
  }
): { isMatchOver: boolean; ballEvent: BallEvent | null } {
  if (session.isMatchCompleted) return { isMatchOver: true, ballEvent: null };

  const currentInnings = session.currentInningsIndex === 1 ? session.innings1 : session.innings2;
  const battingTeam = session.currentInningsIndex === 1 ? session.battingFirstTeam : session.bowlingFirstTeam;
  const bowlingTeam = session.currentInningsIndex === 1 ? session.bowlingFirstTeam : session.battingFirstTeam;

  // Check innings termination
  if (currentInnings.score.wickets >= 10 || currentInnings.currentOver >= 20 || (currentInnings.target !== null && currentInnings.score.runs >= currentInnings.target)) {
    currentInnings.isCompleted = true;
    if (session.currentInningsIndex === 1) {
      session.currentInningsIndex = 2;
      session.innings2.target = session.innings1.score.runs + 1;
      return simulateLiveDelivery(session, tacticsOverride);
    } else {
      finalizeMatchResult(session);
      return { isMatchOver: true, ballEvent: null };
    }
  }

  // Active Players
  const strikerCard = currentInnings.batsmen[currentInnings.strikerIndex];
  const striker = battingTeam.players.find((p) => p.id === strikerCard?.playerId);

  // Bowler selection (CPU auto-selects if not overridden)
  if (tacticsOverride?.bowlerIndex !== undefined && tacticsOverride.bowlerIndex >= 0 && tacticsOverride.bowlerIndex < currentInnings.bowlers.length) {
    currentInnings.currentBowlerIndex = tacticsOverride.bowlerIndex;
  } else if (currentInnings.legalBallsInOver === 0) {
    // Pick suitable bowler for new over
    const eligible = currentInnings.bowlers
      .map((b, idx) => ({ idx, spell: b }))
      .filter((b) => b.spell.overs < 4 && b.idx !== currentInnings.currentBowlerIndex);

    if (eligible.length > 0) {
      // Pick best bowler for phase
      const chosen = eligible.sort((a, b) => {
        const pA = bowlingTeam.players.find((p) => p.id === a.spell.playerId);
        const pB = bowlingTeam.players.find((p) => p.id === b.spell.playerId);
        const ratA = pA?.ratings.bowling || 50;
        const ratB = pB?.ratings.bowling || 50;
        if (currentInnings.currentOver >= 16) {
          const deathA = pA?.isDeathBowler ? 20 : 0;
          const deathB = pB?.isDeathBowler ? 20 : 0;
          return (ratB + deathB) - (ratA + deathA);
        }
        return ratB - ratA;
      })[0] || eligible[0];
      currentInnings.currentBowlerIndex = chosen.idx;
    }
  }

  const currentBowlerSpell = currentInnings.bowlers[currentInnings.currentBowlerIndex];
  const currentBowler = bowlingTeam.players.find((p) => p.id === currentBowlerSpell?.playerId);

  if (!striker || !currentBowler) {
    currentInnings.isCompleted = true;
    if (session.currentInningsIndex === 1) {
      session.currentInningsIndex = 2;
      session.innings2.target = session.innings1.score.runs + 1;
    } else {
      finalizeMatchResult(session);
      return { isMatchOver: true, ballEvent: null };
    }
    return { isMatchOver: false, ballEvent: null };
  }

  // Apply tactics
  const batAgg = tacticsOverride?.battingAggression ||
    (battingTeam.isHumanControlled ? session.activeBattingAggression : getCpuBattingAggression(currentInnings.currentOver, currentInnings.score.wickets, currentInnings.target, currentInnings.score.runs));

  const bowlStrat = tacticsOverride?.bowlingStrategy ||
    (bowlingTeam.isHumanControlled ? session.activeBowlingStrategy : (currentInnings.currentOver >= 16 ? 'Yorker' : 'Stock'));

  session.activeBattingAggression = batAgg;
  session.activeBowlingStrategy = bowlStrat;

  // Simulate delivery
  const sim = simulateDelivery(
    currentInnings.currentOver,
    currentInnings.legalBallsInOver + 1,
    striker,
    currentBowler,
    currentInnings.target,
    currentInnings.score,
    session.stadium,
    session.pitchCondition,
    batAgg,
    bowlStrat,
    currentInnings.isFreeHitActive,
    session.rng
  );

  // Update Free Hit state: active free hit expires after delivery
  if (sim.isLegal) {
    currentInnings.isFreeHitActive = false;
  } else if (sim.outcome === 'NoBall') {
    currentInnings.isFreeHitActive = true;
  }

  // Construct ball event
  const ballEvent: BallEvent = {
    over: currentInnings.currentOver + 1,
    ball: currentInnings.legalBallsInOver + (sim.isLegal ? 1 : 0),
    batsmanId: striker.id,
    bowlerId: currentBowler.id,
    outcome: sim.outcome,
    runs: sim.runs,
    extraRuns: sim.extraRuns,
    isLegal: sim.isLegal,
    dismissalType: sim.dismissalType,
    commentary: sim.commentary,
  };

  currentInnings.balls.push(ballEvent);

  // Update recent delivery badge
  let badgeText = `${sim.runs}`;
  if (sim.outcome === 'Wicket') badgeText = 'W';
  else if (sim.outcome === 'Wide') badgeText = 'Wd';
  else if (sim.outcome === 'NoBall') badgeText = 'Nb';
  else if (sim.runs === 0) badgeText = '0';

  currentInnings.recentDeliveries.push({
    text: badgeText,
    isWicket: sim.outcome === 'Wicket',
    isBoundary: sim.runs === 4 || sim.runs === 6,
    isExtra: !sim.isLegal,
  });
  if (currentInnings.recentDeliveries.length > 18) {
    currentInnings.recentDeliveries.shift();
  }

  // Score bookkeeping
  const totalRunsThisBall = sim.runs + sim.extraRuns;
  currentInnings.score.runs += totalRunsThisBall;
  currentInnings.currentPartnership.runs += totalRunsThisBall;
  currentBowlerSpell.runs += totalRunsThisBall;

  if (!sim.isLegal) {
    currentInnings.score.extras += sim.extraRuns;
    if (sim.outcome === 'Wide') {
      currentInnings.score.wides += sim.extraRuns;
      currentBowlerSpell.wides += sim.extraRuns;
    } else if (sim.outcome === 'NoBall') {
      currentInnings.score.noBalls += sim.extraRuns;
      currentBowlerSpell.noBalls += sim.extraRuns;
    }
  } else {
    currentInnings.legalBallsInOver++;
    currentInnings.currentPartnership.balls++;
    strikerCard.balls++;
    strikerCard.runs += sim.runs;
    if (sim.runs === 4) strikerCard.fours++;
    if (sim.runs === 6) strikerCard.sixes++;
    strikerCard.strikeRate = Math.round((strikerCard.runs / strikerCard.balls) * 1000) / 10;

    if (sim.outcome === 'Wicket') {
      currentInnings.score.wickets++;
      currentBowlerSpell.wickets++;
      strikerCard.dismissalType = sim.dismissalType || 'Caught';
      strikerCard.dismissalText = `${sim.dismissalType} b ${currentBowler.name}`;
      strikerCard.isOnStrike = false;

      // Record Fall of Wicket
      currentInnings.fallOfWickets.push({
        wicket: currentInnings.score.wickets,
        score: currentInnings.score.runs,
        overs: Math.round((currentInnings.currentOver + currentInnings.legalBallsInOver / 6) * 10) / 10,
        batsmanName: striker.name,
      });

      // Reset partnership
      currentInnings.currentPartnership = { runs: 0, balls: 0 };

      // Bring in next batsman
      const nextIdx = Math.max(currentInnings.strikerIndex, currentInnings.nonStrikerIndex) + 1;
      if (nextIdx < currentInnings.batsmen.length) {
        currentInnings.strikerIndex = nextIdx;
        currentInnings.batsmen[currentInnings.strikerIndex].isOnStrike = true;
      }
    } else {
      // Strike rotation on odd runs
      if (sim.runs % 2 === 1) {
        const temp = currentInnings.strikerIndex;
        currentInnings.strikerIndex = currentInnings.nonStrikerIndex;
        currentInnings.nonStrikerIndex = temp;
      }
    }
  }

  // Check end of over
  if (currentInnings.legalBallsInOver >= 6) {
    currentInnings.currentOver++;
    currentInnings.legalBallsInOver = 0;
    currentBowlerSpell.overs++;
    currentBowlerSpell.balls = currentBowlerSpell.overs * 6;
    currentBowlerSpell.economy = Math.round((currentBowlerSpell.runs / currentBowlerSpell.overs) * 100) / 100;

    // Switch ends at over completion
    const temp = currentInnings.strikerIndex;
    currentInnings.strikerIndex = currentInnings.nonStrikerIndex;
    currentInnings.nonStrikerIndex = temp;
  }

  currentInnings.score.overs = currentInnings.currentOver;
  currentInnings.score.balls = currentInnings.legalBallsInOver;

  // Update win probability
  session.winProbability = calculateLiveWinProbability(
    session.currentInningsIndex,
    currentInnings.currentOver,
    currentInnings.legalBallsInOver,
    currentInnings.score.runs,
    currentInnings.score.wickets,
    currentInnings.target,
    session.stadium
  );

  // Check if target reached or innings completed
  if (currentInnings.score.wickets >= 10 || currentInnings.currentOver >= 20 || (currentInnings.target !== null && currentInnings.score.runs >= currentInnings.target)) {
    currentInnings.isCompleted = true;
    if (session.currentInningsIndex === 1) {
      session.currentInningsIndex = 2;
      session.innings2.target = session.innings1.score.runs + 1;
    } else {
      finalizeMatchResult(session);
      return { isMatchOver: true, ballEvent };
    }
  }

  return { isMatchOver: false, ballEvent };
}

/**
 * Step forward by a full over.
 */
export function simulateLiveOver(
  session: LiveMatchSession,
  tacticsOverride?: {
    battingAggression?: BattingAggression;
    bowlingStrategy?: BowlingStrategy;
    bowlerIndex?: number;
  }
): boolean {
  if (session.isMatchCompleted) return true;
  const currentInnings = session.currentInningsIndex === 1 ? session.innings1 : session.innings2;
  const startOver = currentInnings.currentOver;

  while (!session.isMatchCompleted && currentInnings.currentOver === startOver && !currentInnings.isCompleted) {
    const { isMatchOver } = simulateLiveDelivery(session, tacticsOverride);
    if (isMatchOver) return true;
  }
  return session.isMatchCompleted;
}

/**
 * Fast-forward an entire innings.
 */
export function simulateLiveInnings(session: LiveMatchSession): boolean {
  if (session.isMatchCompleted) return true;
  const currentIdx = session.currentInningsIndex;

  while (!session.isMatchCompleted && session.currentInningsIndex === currentIdx) {
    const { isMatchOver } = simulateLiveDelivery(session);
    if (isMatchOver) return true;
  }
  return session.isMatchCompleted;
}

/**
 * Finalizes match result, margins, Player of the Match, and super overs.
 */
function finalizeMatchResult(session: LiveMatchSession) {
  session.isMatchCompleted = true;
  const inn1 = session.innings1;
  const inn2 = session.innings2;

  let winnerId: string | null = null;
  let winMargin = '';
  let isSuperOver = false;

  if (inn2.score.runs >= (inn2.target || 0)) {
    winnerId = session.bowlingFirstTeam.id;
    const wicketsInHand = 10 - inn2.score.wickets;
    winMargin = `won by ${wicketsInHand} wicket${wicketsInHand > 1 ? 's' : ''}`;
  } else if (inn2.score.runs === inn1.score.runs) {
    isSuperOver = true;
    winnerId = session.rng.nextBool() ? session.battingFirstTeam.id : session.bowlingFirstTeam.id;
    winMargin = `won via Super Over`;
  } else {
    winnerId = session.battingFirstTeam.id;
    const runDiff = inn1.score.runs - inn2.score.runs;
    winMargin = `won by ${runDiff} run${runDiff > 1 ? 's' : ''}`;
  }

  // Determine Player of the Match
  const candidateScores: { name: string; score: number }[] = [];
  for (const b of [...inn1.batsmen, ...inn2.batsmen]) {
    candidateScores.push({
      name: b.playerName,
      score: b.runs * 1.0 + (b.runs >= 50 ? 25 : 0) + (b.runs >= 100 ? 60 : 0) + (b.strikeRate > 175 ? 15 : 0),
    });
  }
  for (const b of [...inn1.bowlers, ...inn2.bowlers]) {
    const existing = candidateScores.find((c) => c.name === b.playerName);
    const bowlImpact = b.wickets * 28 + (b.economy <= 6.5 ? 20 : 0) + (b.wickets >= 3 ? 30 : 0);
    if (existing) {
      existing.score += bowlImpact;
    } else {
      candidateScores.push({ name: b.playerName, score: bowlImpact });
    }
  }

  candidateScores.sort((a, b) => b.score - a.score);
  const potm = candidateScores[0]?.name || 'Captain';

  const winningTeam = winnerId === session.team1.id ? session.team1 : session.team2;

  session.result = {
    matchId: session.fixture.id,
    team1Id: session.team1.id,
    team2Id: session.team2.id,
    team1Score: session.battingFirstTeam.id === session.team1.id ? inn1.score : inn2.score,
    team2Score: session.battingFirstTeam.id === session.team2.id ? inn1.score : inn2.score,
    winnerId,
    winMargin: `${winningTeam.shortName} ${winMargin}`,
    playerOfMatch: potm,
    tossWinnerId: session.toss.winnerId,
    tossDecision: session.toss.decision,
    venue: session.venue,
    matchNumber: session.fixture.matchNumber,
    isSuperOver,
    isNoResult: false,
  };
}

/**
 * Headless full match simulator for tournament automation and calibration tests.
 */
export function simulateFullMatch(
  fixture: Fixture,
  team1: Franchise,
  team2: Franchise,
  team1XI: PlayingXI,
  team2XI: PlayingXI,
  seed: number = Date.now()
): { matchResult: MatchResult; innings1: DetailedInningsData; innings2: DetailedInningsData } {
  const session = createLiveMatchSession(fixture, team1, team2, team1XI, team2XI, seed);

  // Run full match to completion
  while (!session.isMatchCompleted) {
    simulateLiveDelivery(session);
  }

  return {
    matchResult: session.result!,
    innings1: session.innings1,
    innings2: session.innings2,
  };
}
