// ============================================================
// IPL DYNASTY - CPU General Manager Personalities & Dynamic Strategy
// Defines 9 distinct strategic archetypes, franchise assignments,
// and adaptive strategy evolution as auction dynamics shift.
// ============================================================

import type { Franchise, AuctionSession } from '@/lib/types/game';
import { TacticalRole } from './tactical-roles';

export type GMPersonalityArchetype =
  | 'Aggressive spender'
  | 'Value-focused analyst'
  | 'Youth development specialist'
  | 'Experienced-player specialist'
  | 'Bowling-focused strategist'
  | 'Batting-focused strategist'
  | 'Balanced squad builder'
  | 'Risk-averse general manager'
  | 'Opportunistic bidder';

export interface PersonalityTraits {
  archetype: GMPersonalityArchetype;
  description: string;
  riskTolerance: number;         // 0.0 (very cautious) to 1.0 (daredevil)
  starPremiumMultiplier: number; // 1.0 (fair value only) to 1.45 (willing to overbid for marquee)
  youthBias: number;             // -1.0 (prefers veterans) to +1.0 (loves U-24 prodigies)
  patienceFactor: number;        // 0.0 (buys early) to 1.0 (holds purse for late auction bargains)
  preferredRoleFocus: 'Batting' | 'Bowling' | 'All-Rounder' | 'Balanced';
  budgetDisciplineSensitivity: number; // How strictly purse conservation is enforced
}

export const GM_PERSONALITY_ARCHETYPES: Record<GMPersonalityArchetype, PersonalityTraits> = {
  'Aggressive spender': {
    archetype: 'Aggressive spender',
    description: 'High aggression, bids aggressively for marquee match-winners, accepts price premiums.',
    riskTolerance: 0.85,
    starPremiumMultiplier: 1.35,
    youthBias: 0.0,
    patienceFactor: 0.25,
    preferredRoleFocus: 'Balanced',
    budgetDisciplineSensitivity: 0.35,
  },
  'Value-focused analyst': {
    archetype: 'Value-focused analyst',
    description: 'Data-driven, strictly respects fair market boundaries, avoids emotional bidding wars.',
    riskTolerance: 0.35,
    starPremiumMultiplier: 1.05,
    youthBias: 0.1,
    patienceFactor: 0.85,
    preferredRoleFocus: 'Balanced',
    budgetDisciplineSensitivity: 0.85,
  },
  'Youth development specialist': {
    archetype: 'Youth development specialist',
    description: 'Targets high-ceiling young prodigies with long longevity projections.',
    riskTolerance: 0.65,
    starPremiumMultiplier: 1.15,
    youthBias: 0.85,
    patienceFactor: 0.55,
    preferredRoleFocus: 'Balanced',
    budgetDisciplineSensitivity: 0.65,
  },
  'Experienced-player specialist': {
    archetype: 'Experienced-player specialist',
    description: 'Prioritizes battle-tested veteran masters, leaders, and spin/middle-order composure.',
    riskTolerance: 0.45,
    starPremiumMultiplier: 1.20,
    youthBias: -0.75,
    patienceFactor: 0.60,
    preferredRoleFocus: 'Balanced',
    budgetDisciplineSensitivity: 0.70,
  },
  'Bowling-focused strategist': {
    archetype: 'Bowling-focused strategist',
    description: 'Builds from the bowling attack up: prioritizes express pace, death specialists, and mystery spin.',
    riskTolerance: 0.60,
    starPremiumMultiplier: 1.25,
    youthBias: 0.0,
    patienceFactor: 0.40,
    preferredRoleFocus: 'Bowling',
    budgetDisciplineSensitivity: 0.55,
  },
  'Batting-focused strategist': {
    archetype: 'Batting-focused strategist',
    description: 'Prioritizes explosive openers, power hitters, and high boundary percentages.',
    riskTolerance: 0.75,
    starPremiumMultiplier: 1.30,
    youthBias: 0.1,
    patienceFactor: 0.35,
    preferredRoleFocus: 'Batting',
    budgetDisciplineSensitivity: 0.50,
  },
  'Balanced squad builder': {
    archetype: 'Balanced squad builder',
    description: 'Even distribution across all 11 tactical roles, avoids extremes, emphasizes roster depth.',
    riskTolerance: 0.50,
    starPremiumMultiplier: 1.12,
    youthBias: 0.1,
    patienceFactor: 0.50,
    preferredRoleFocus: 'Balanced',
    budgetDisciplineSensitivity: 0.75,
  },
  'Risk-averse general manager': {
    archetype: 'Risk-averse general manager',
    description: 'Preserves massive purse reserves, penalizes injury/availability risks, passes easily on high bids.',
    riskTolerance: 0.20,
    starPremiumMultiplier: 1.02,
    youthBias: 0.0,
    patienceFactor: 0.75,
    preferredRoleFocus: 'Balanced',
    budgetDisciplineSensitivity: 0.95,
  },
  'Opportunistic bidder': {
    archetype: 'Opportunistic bidder',
    description: 'Waits for market inefficiencies, steals un-bid lots near base price, pivots quickly.',
    riskTolerance: 0.55,
    starPremiumMultiplier: 1.08,
    youthBias: 0.2,
    patienceFactor: 0.95,
    preferredRoleFocus: 'All-Rounder',
    budgetDisciplineSensitivity: 0.80,
  },
};

export interface FranchiseGMProfile {
  franchiseId: string;
  name: string;
  initialArchetype: GMPersonalityArchetype;
  currentArchetype: GMPersonalityArchetype;
  domesticPremium: number;
  roleAffinities: Partial<Record<TacticalRole, number>>;
  starAggression: number;
}

export const FRANCHISE_GM_PROFILES: Record<string, FranchiseGMProfile> = {
  mi: {
    franchiseId: 'mi',
    name: 'Mumbai Indians',
    initialArchetype: 'Aggressive spender',
    currentArchetype: 'Aggressive spender',
    domesticPremium: 1.30,
    starAggression: 0.95,
    roleAffinities: {
      'Powerplay seamer': 1.45,
      'Death-over specialist': 1.50,
      'Power hitter': 1.35,
      'Opening batter': 1.25,
    },
  },
  csk: {
    franchiseId: 'csk',
    name: 'Chennai Super Kings',
    initialArchetype: 'Experienced-player specialist',
    currentArchetype: 'Experienced-player specialist',
    domesticPremium: 1.20,
    starAggression: 0.70,
    roleAffinities: {
      'Finger spinner': 1.50,
      'Wrist spinner': 1.35,
      'Spin-bowling all-rounder': 1.50,
      'Middle-order anchor': 1.40,
      'Finisher': 1.30,
    },
  },
  rcb: {
    franchiseId: 'rcb',
    name: 'Royal Challengers Bengaluru',
    initialArchetype: 'Batting-focused strategist',
    currentArchetype: 'Batting-focused strategist',
    domesticPremium: 1.05,
    starAggression: 0.96,
    roleAffinities: {
      'Opening batter': 1.45,
      'Power hitter': 1.50,
      'Finisher': 1.40,
      'Wicketkeeper-batter': 1.30,
    },
  },
  kkr: {
    franchiseId: 'kkr',
    name: 'Kolkata Knight Riders',
    initialArchetype: 'Opportunistic bidder',
    currentArchetype: 'Opportunistic bidder',
    domesticPremium: 1.10,
    starAggression: 0.80,
    roleAffinities: {
      'Pace-bowling all-rounder': 1.60,
      'Spin-bowling all-rounder': 1.50,
      'Wrist spinner': 1.45,
      'Power hitter': 1.40,
    },
  },
  srh: {
    franchiseId: 'srh',
    name: 'Sunrisers Hyderabad',
    initialArchetype: 'Aggressive spender',
    currentArchetype: 'Aggressive spender',
    domesticPremium: 1.15,
    starAggression: 0.92,
    roleAffinities: {
      'Power hitter': 1.60,
      'Opening batter': 1.45,
      'Death-over specialist': 1.50,
      'Pace-bowling all-rounder': 1.30,
    },
  },
  rr: {
    franchiseId: 'rr',
    name: 'Rajasthan Royals',
    initialArchetype: 'Youth development specialist',
    currentArchetype: 'Youth development specialist',
    domesticPremium: 1.25,
    starAggression: 0.65,
    roleAffinities: {
      'Opening batter': 1.35,
      'Wicketkeeper-batter': 1.30,
      'Wrist spinner': 1.45,
      'Middle-order anchor': 1.20,
    },
  },
  dc: {
    franchiseId: 'dc',
    name: 'Delhi Capitals',
    initialArchetype: 'Balanced squad builder',
    currentArchetype: 'Balanced squad builder',
    domesticPremium: 1.25,
    starAggression: 0.80,
    roleAffinities: {
      'Opening batter': 1.30,
      'Wicketkeeper-batter': 1.40,
      'Powerplay seamer': 1.35,
      'Spin-bowling all-rounder': 1.30,
    },
  },
  pbks: {
    franchiseId: 'pbks',
    name: 'Punjab Kings',
    initialArchetype: 'Aggressive spender',
    currentArchetype: 'Aggressive spender',
    domesticPremium: 1.15,
    starAggression: 0.95,
    roleAffinities: {
      'Pace-bowling all-rounder': 1.50,
      'Death-over specialist': 1.45,
      'Power hitter': 1.40,
      'Powerplay seamer': 1.35,
    },
  },
  gt: {
    franchiseId: 'gt',
    name: 'Gujarat Titans',
    initialArchetype: 'Value-focused analyst',
    currentArchetype: 'Value-focused analyst',
    domesticPremium: 1.15,
    starAggression: 0.65,
    roleAffinities: {
      'Middle-order anchor': 1.35,
      'Wrist spinner': 1.50,
      'Death-over specialist': 1.35,
      'Finisher': 1.30,
    },
  },
  lsg: {
    franchiseId: 'lsg',
    name: 'Lucknow Super Giants',
    initialArchetype: 'Risk-averse general manager',
    currentArchetype: 'Risk-averse general manager',
    domesticPremium: 1.20,
    starAggression: 0.80,
    roleAffinities: {
      'Wicketkeeper-batter': 1.50,
      'Middle-order anchor': 1.40,
      'Powerplay seamer': 1.40,
      'Death-over specialist': 1.30,
    },
  },
};

/** Active state storage for dynamic personality shifts per auction session. */
const activeSessionPersonalities: Map<string, Map<string, GMPersonalityArchetype>> = new Map();

/**
 * Returns the active GM personality for a given franchise in a specific auction session.
 */
export function getFranchiseActivePersonality(sessionId: string, franchiseId: string): GMPersonalityArchetype {
  const sessionMap = activeSessionPersonalities.get(sessionId);
  if (sessionMap && sessionMap.has(franchiseId)) {
    return sessionMap.get(franchiseId)!;
  }
  const baseProfile = FRANCHISE_GM_PROFILES[franchiseId];
  return baseProfile ? baseProfile.initialArchetype : 'Balanced squad builder';
}

/**
 * Dynamically evolves a franchise's GM personality based on changing auction conditions:
 * - Budget depletion forces defensive/value strategy
 * - Late-auction surplus triggers opportunistic or aggressive bids
 * - Positional saturation redirects tactical focus
 */
export function evolveFranchisePersonality(
  franchise: Franchise,
  session: AuctionSession
): GMPersonalityArchetype {
  const currentSlotsFilled = franchise.players.length;
  const slotsRemaining = Math.max(1, franchise.minSquadSize - currentSlotsFilled);
  const budgetPerSlot = franchise.remainingPurse / slotsRemaining;
  const progressRatio = session.playerPool.length > 0
    ? Math.min(1.0, (session.currentPlayerIndex + 1) / session.playerPool.length)
    : 0;

  let activeArchetype = FRANCHISE_GM_PROFILES[franchise.id]?.initialArchetype || 'Balanced squad builder';

  // 1. Critical Budget Pressure (< 80L per remaining slot)
  // Forces team into strict value-focused or risk-averse mode regardless of initial aggression
  if (budgetPerSlot < 80) {
    activeArchetype = 'Risk-averse general manager';
  } else if (budgetPerSlot < 160) {
    activeArchetype = 'Value-focused analyst';
  }
  // 2. Late Auction Cash Surplus (Progress > 60% and > 400L per remaining slot)
  // Teams that held back now flex their financial muscle to sweep remaining marquee players
  else if (progressRatio > 0.60 && budgetPerSlot >= 400) {
    activeArchetype = 'Aggressive spender';
  }
  // 3. Late Auction Value Hunting (Progress > 75% and comfortable squad size >= 14)
  else if (progressRatio > 0.75 && currentSlotsFilled >= 14) {
    activeArchetype = 'Opportunistic bidder';
  }
  // 4. Role Imbalance Check
  else {
    const bowlersCount = franchise.players.filter(
      (p) => p.role === 'Bowler' || p.role === 'All-Rounder'
    ).length;
    const battersCount = franchise.players.filter(
      (p) => p.role === 'Batter' || p.role === 'Wicketkeeper' || p.role === 'All-Rounder'
    ).length;

    if (currentSlotsFilled >= 8) {
      if (bowlersCount < 3 && battersCount >= 5) {
        activeArchetype = 'Bowling-focused strategist';
      } else if (battersCount < 3 && bowlersCount >= 5) {
        activeArchetype = 'Batting-focused strategist';
      }
    }
  }

  // Update session cache
  let sessionMap = activeSessionPersonalities.get(session.id);
  if (!sessionMap) {
    sessionMap = new Map();
    activeSessionPersonalities.set(session.id, sessionMap);
  }
  sessionMap.set(franchise.id, activeArchetype);

  return activeArchetype;
}

