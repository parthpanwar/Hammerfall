// ============================================================
// IPL DYNASTY - Stadium & Pitch Engine
// Real-world IPL venue characteristics, pitch profiles, and toss AI
// ============================================================

import type { Franchise, SeededRandom } from '@/lib/types/game';

export type PitchCondition = 'Flat Track' | 'Green Seamer' | 'Turning Dustbowl' | 'Two-Paced' | 'Slow & Low';
export type BoundaryDimension = 'Small' | 'Medium' | 'Large';

export interface StadiumProfile {
  name: string;
  city: string;
  parScore: number;            // Expected 1st innings total on standard day
  paceAssistance: number;      // -0.20 to +0.30 modifier to pace bowlers
  spinAssistance: number;      // -0.20 to +0.35 modifier to spin bowlers
  boundarySize: BoundaryDimension;
  sixMultiplier: number;       // Multiplier on six hitting (e.g. 1.25 for Chinnaswamy)
  fourMultiplier: number;      // Multiplier on four hitting
  dewFactor: number;           // 0.0 to 0.40 (higher = heavy dew in 2nd innings aiding batters)
  chasingAdvantage: number;    // Historical chasing win probability (e.g. 0.58 at Wankhede)
  description: string;
}

export const IPL_STADIUMS: Record<string, StadiumProfile> = {
  'Wankhede Stadium, Mumbai': {
    name: 'Wankhede Stadium',
    city: 'Mumbai',
    parScore: 186,
    paceAssistance: 0.10,
    spinAssistance: -0.05,
    boundarySize: 'Small',
    sixMultiplier: 1.22,
    fourMultiplier: 1.15,
    dewFactor: 0.35,
    chasingAdvantage: 0.58,
    description: 'Red soil pitch with true bounce, short boundaries, and heavy evening dew favoring chasers.',
  },
  'MA Chidambaram Stadium, Chennai': {
    name: 'MA Chidambaram Stadium',
    city: 'Chennai',
    parScore: 162,
    paceAssistance: -0.05,
    spinAssistance: 0.32,
    boundarySize: 'Medium',
    sixMultiplier: 0.82,
    fourMultiplier: 0.90,
    dewFactor: 0.08,
    chasingAdvantage: 0.46,
    description: 'Famous Chepauk spin haven with low bounce, gripping surface, and high value for batting first.',
  },
  'M. Chinnaswamy Stadium, Bengaluru': {
    name: 'M. Chinnaswamy Stadium',
    city: 'Bengaluru',
    parScore: 198,
    paceAssistance: -0.10,
    spinAssistance: -0.10,
    boundarySize: 'Small',
    sixMultiplier: 1.40,
    fourMultiplier: 1.25,
    dewFactor: 0.28,
    chasingAdvantage: 0.56,
    description: 'Batter paradise at high altitude with tiny boundaries and lightning-fast outfield.',
  },
  'Eden Gardens, Kolkata': {
    name: 'Eden Gardens',
    city: 'Kolkata',
    parScore: 182,
    paceAssistance: 0.12,
    spinAssistance: 0.08,
    boundarySize: 'Medium',
    sixMultiplier: 1.10,
    fourMultiplier: 1.12,
    dewFactor: 0.25,
    chasingAdvantage: 0.53,
    description: 'Sporting wicket with pace carry, even bounce, and electric outfield.',
  },
  'Rajiv Gandhi Stadium, Hyderabad': {
    name: 'Rajiv Gandhi Stadium',
    city: 'Hyderabad',
    parScore: 180,
    paceAssistance: 0.05,
    spinAssistance: 0.15,
    boundarySize: 'Medium',
    sixMultiplier: 1.05,
    fourMultiplier: 1.05,
    dewFactor: 0.18,
    chasingAdvantage: 0.51,
    description: 'Balanced track that offers good batting early and variable spin as the match progresses.',
  },
  'Sawai Mansingh Stadium, Jaipur': {
    name: 'Sawai Mansingh Stadium',
    city: 'Jaipur',
    parScore: 172,
    paceAssistance: 0.08,
    spinAssistance: 0.05,
    boundarySize: 'Large',
    sixMultiplier: 0.85,
    fourMultiplier: 1.05,
    dewFactor: 0.20,
    chasingAdvantage: 0.52,
    description: 'Spacious ground with big square boundaries requiring supreme running between the wickets.',
  },
  'Arun Jaitley Stadium, Delhi': {
    name: 'Arun Jaitley Stadium',
    city: 'Delhi',
    parScore: 188,
    paceAssistance: -0.05,
    spinAssistance: 0.05,
    boundarySize: 'Small',
    sixMultiplier: 1.25,
    fourMultiplier: 1.18,
    dewFactor: 0.22,
    chasingAdvantage: 0.54,
    description: 'Compact ground with short straight boundaries; high scoring with heavy boundary reliance.',
  },
  'PCA Stadium, New Chandigarh / Mohali': {
    name: 'PCA Stadium',
    city: 'Mullanpur',
    parScore: 178,
    paceAssistance: 0.20,
    spinAssistance: -0.08,
    boundarySize: 'Medium',
    sixMultiplier: 1.02,
    fourMultiplier: 1.08,
    dewFactor: 0.30,
    chasingAdvantage: 0.55,
    description: 'Lively green pitch offering pronounced early seam and swing under lights.',
  },
  'Narendra Modi Stadium, Ahmedabad': {
    name: 'Narendra Modi Stadium',
    city: 'Ahmedabad',
    parScore: 184,
    paceAssistance: 0.12,
    spinAssistance: 0.06,
    boundarySize: 'Large',
    sixMultiplier: 0.95,
    fourMultiplier: 1.08,
    dewFactor: 0.26,
    chasingAdvantage: 0.53,
    description: 'Colossal amphitheater with long boundaries, high-quality true bounce, and fast outfield.',
  },
  'BRSABV Ekana Stadium, Lucknow': {
    name: 'Ekana Stadium',
    city: 'Lucknow',
    parScore: 158,
    paceAssistance: -0.08,
    spinAssistance: 0.28,
    boundarySize: 'Large',
    sixMultiplier: 0.78,
    fourMultiplier: 0.88,
    dewFactor: 0.12,
    chasingAdvantage: 0.47,
    description: 'Black and red soil pitches providing gripping turn, two-paced bounce, and low scoring thrillers.',
  },
};

/** Get stadium profile or fallback to default balanced ground */
export function getStadiumProfile(venueName: string): StadiumProfile {
  if (IPL_STADIUMS[venueName]) {
    return IPL_STADIUMS[venueName];
  }
  for (const key of Object.keys(IPL_STADIUMS)) {
    if (venueName.includes(key) || key.includes(venueName)) {
      return IPL_STADIUMS[key];
    }
  }
  // Default balanced profile
  return {
    name: venueName,
    city: 'India',
    parScore: 175,
    paceAssistance: 0.0,
    spinAssistance: 0.0,
    boundarySize: 'Medium',
    sixMultiplier: 1.0,
    fourMultiplier: 1.0,
    dewFactor: 0.20,
    chasingAdvantage: 0.52,
    description: 'Standard sporting T20 surface offering fair contest between bat and ball.',
  };
}

/** Generate randomized match-day pitch condition based on stadium tendency */
export function generateMatchDayPitch(stadium: StadiumProfile, rng: SeededRandom): PitchCondition {
  const roll = rng.next();
  if (stadium.spinAssistance >= 0.25) {
    return roll < 0.65 ? 'Turning Dustbowl' : roll < 0.85 ? 'Slow & Low' : 'Two-Paced';
  }
  if (stadium.paceAssistance >= 0.15) {
    return roll < 0.60 ? 'Green Seamer' : roll < 0.85 ? 'Two-Paced' : 'Flat Track';
  }
  if (stadium.parScore >= 190) {
    return roll < 0.75 ? 'Flat Track' : 'Two-Paced';
  }
  return roll < 0.45 ? 'Flat Track' : roll < 0.70 ? 'Two-Paced' : roll < 0.85 ? 'Slow & Low' : 'Green Seamer';
}

export interface TossResult {
  winnerId: string;
  winnerName: string;
  decision: 'Bat' | 'Bowl';
  reason: string;
}

/**
 * Intelligent CPU Captain Toss Decision
 * Evaluates stadium dew, chasing statistics, pitch condition, and team strengths.
 */
export function decideToss(
  tossWinner: Franchise,
  opponent: Franchise,
  stadium: StadiumProfile,
  pitch: PitchCondition,
  rng: SeededRandom
): TossResult {
  // Base chasing tendency in modern T20 is ~60%
  let chaseWillingness = 0.60;

  // Stadium chase advantage modifier
  chaseWillingness += (stadium.chasingAdvantage - 0.50) * 1.5;

  // Dew factor: heavy dew makes defending almost impossible
  chaseWillingness += stadium.dewFactor * 0.4;

  // Pitch Condition adjustments
  if (pitch === 'Turning Dustbowl' || pitch === 'Slow & Low') {
    // Spin tracks deteriorate in the 2nd innings; batting first is heavily favored
    chaseWillingness -= 0.35;
  } else if (pitch === 'Green Seamer') {
    // Early swing makes bowling first favorable
    chaseWillingness += 0.20;
  } else if (pitch === 'Flat Track') {
    // High-scoring flat road; chasers know target
    chaseWillingness += 0.15;
  }

  // Captain personality adjustments
  if (tossWinner.gmPersonality === 'BowlingFirst') {
    chaseWillingness += 0.15;
  } else if (tossWinner.gmPersonality === 'Aggressive') {
    chaseWillingness -= 0.10; // Back themselves to post monster total
  }

  const roll = rng.next();
  const decision: 'Bat' | 'Bowl' = roll < chaseWillingness ? 'Bowl' : 'Bat';

  let reason = '';
  if (decision === 'Bowl') {
    if (stadium.dewFactor >= 0.25) {
      reason = `Chose to bowl first citing anticipated evening dew at ${stadium.name}.`;
    } else if (pitch === 'Green Seamer') {
      reason = `Chose to bowl first to exploit early moisture and seam movement on a green pitch.`;
    } else {
      reason = `Chose to bowl first backing their batting depth to chase under lights.`;
    }
  } else {
    if (pitch === 'Turning Dustbowl' || pitch === 'Slow & Low') {
      reason = `Chose to bat first knowing the pitch will grip and deteriorate for spinners in the second innings.`;
    } else {
      reason = `Chose to bat first aiming to put scoreboard pressure on ${opponent.shortName}.`;
    }
  }

  return {
    winnerId: tossWinner.id,
    winnerName: tossWinner.name,
    decision,
    reason,
  };
}

