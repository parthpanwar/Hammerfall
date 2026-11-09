// ============================================================
// IPL DYNASTY - CPU General Manager Engine: Opponent Modeling
// Belief tracking and Bayesian updates of rival bidding behaviors
// ============================================================

import type { Franchise, Player } from '@/lib/types/game';
import { getPlayerTacticalRoles, TacticalRole } from './tactical-roles';

export interface FranchiseProfile {
  franchiseId: string;
  name: string;
  behaviorDescription: string;
  primaryTendencies: string[];
  roleAffinities: Partial<Record<TacticalRole, number>>; // multiplier 0.5 - 2.0
  domesticPremium: number; // multiplier for Indian players
  experiencePreference: number; // -1 (youth) to +1 (veterans)
  starAggression: number; // 0 to 1
  priceDiscipline: number; // 0 to 1
}

export const FRANCHISE_STRATEGY_PROFILES: Record<string, FranchiseProfile> = {
  mi: {
    franchiseId: 'mi',
    name: 'Mumbai Indians',
    behaviorDescription: 'Aggressive for premier Indian talent & power pacers',
    primaryTendencies: ['Indian Core', 'Pace Bowling', 'Power Hitting'],
    roleAffinities: {
      'Powerplay seamer': 1.4,
      'Death-over specialist': 1.5,
      'Power hitter': 1.3,
      'Opening batter': 1.2,
    },
    domesticPremium: 1.35,
    experiencePreference: 0.1,
    starAggression: 0.95,
    priceDiscipline: 0.4,
  },
  csk: {
    franchiseId: 'csk',
    name: 'Chennai Super Kings',
    behaviorDescription: 'Values proven experience, tactical role fit & spinners',
    primaryTendencies: ['Experienced Leaders', 'Finger & Wrist Spinners', 'All-Rounders'],
    roleAffinities: {
      'Finger spinner': 1.5,
      'Wrist spinner': 1.3,
      'Spin-bowling all-rounder': 1.5,
      'Middle-order anchor': 1.4,
      'Finisher': 1.3,
    },
    domesticPremium: 1.2,
    experiencePreference: 0.7,
    starAggression: 0.7,
    priceDiscipline: 0.85,
  },
  rcb: {
    franchiseId: 'rcb',
    name: 'Royal Challengers Bengaluru',
    behaviorDescription: 'Pursues elite batting firepower, superstar icons & finishers',
    primaryTendencies: ['Superstar Batting', 'Opening Power', 'Overseas Icons'],
    roleAffinities: {
      'Opening batter': 1.4,
      'Power hitter': 1.5,
      'Finisher': 1.4,
      'Wicketkeeper-batter': 1.3,
    },
    domesticPremium: 1.0,
    experiencePreference: 0.0,
    starAggression: 0.98,
    priceDiscipline: 0.35,
  },
  kkr: {
    franchiseId: 'kkr',
    name: 'Kolkata Knight Riders',
    behaviorDescription: 'Prioritizes all-round versatility, mystery spin & power hitters',
    primaryTendencies: ['Pace & Spin All-Rounders', 'Mystery Spin', 'High Strike Rates'],
    roleAffinities: {
      'Pace-bowling all-rounder': 1.6,
      'Spin-bowling all-rounder': 1.5,
      'Wrist spinner': 1.4,
      'Power hitter': 1.4,
    },
    domesticPremium: 1.05,
    experiencePreference: 0.1,
    starAggression: 0.85,
    priceDiscipline: 0.5,
  },
  srh: {
    franchiseId: 'srh',
    name: 'Sunrisers Hyderabad',
    behaviorDescription: 'Invests heavily in explosive batting firepower & death bowling',
    primaryTendencies: ['Destructive Batters', 'Death-over Specialists', 'Aggressive Top Order'],
    roleAffinities: {
      'Power hitter': 1.6,
      'Opening batter': 1.4,
      'Death-over specialist': 1.5,
      'Pace-bowling all-rounder': 1.3,
    },
    domesticPremium: 1.1,
    experiencePreference: 0.2,
    starAggression: 0.92,
    priceDiscipline: 0.45,
  },
  rr: {
    franchiseId: 'rr',
    name: 'Rajasthan Royals',
    behaviorDescription: 'Finds undervalued younger players, high potential & spin depth',
    primaryTendencies: ['Young Domestic Talent', 'High Potential', 'Value Hunting'],
    roleAffinities: {
      'Opening batter': 1.3,
      'Wicketkeeper-batter': 1.3,
      'Wrist spinner': 1.4,
      'Middle-order anchor': 1.2,
    },
    domesticPremium: 1.2,
    experiencePreference: -0.6,
    starAggression: 0.65,
    priceDiscipline: 0.8,
  },
  dc: {
    franchiseId: 'dc',
    name: 'Delhi Capitals',
    behaviorDescription: 'Aggressive top order, athletic all-rounders & Indian core',
    primaryTendencies: ['Dynamic Batters', 'Spin All-Rounders', 'Pace Attack'],
    roleAffinities: {
      'Opening batter': 1.3,
      'Wicketkeeper-batter': 1.4,
      'Powerplay seamer': 1.3,
      'Spin-bowling all-rounder': 1.3,
    },
    domesticPremium: 1.25,
    experiencePreference: -0.2,
    starAggression: 0.8,
    priceDiscipline: 0.6,
  },
  pbks: {
    franchiseId: 'pbks',
    name: 'Punjab Kings',
    behaviorDescription: 'Big spenders on marquee match-winners & explosive pace',
    primaryTendencies: ['Marquee Buys', 'Fast Bowling', 'Big Hitters'],
    roleAffinities: {
      'Pace-bowling all-rounder': 1.5,
      'Death-over specialist': 1.4,
      'Power hitter': 1.4,
      'Powerplay seamer': 1.3,
    },
    domesticPremium: 1.15,
    experiencePreference: -0.1,
    starAggression: 0.95,
    priceDiscipline: 0.3,
  },
  gt: {
    franchiseId: 'gt',
    name: 'Gujarat Titans',
    behaviorDescription: 'Balanced team builders, disciplined utility & spin anchors',
    primaryTendencies: ['Balanced Roles', 'Wrist Spinners', 'Disciplined Budget'],
    roleAffinities: {
      'Middle-order anchor': 1.3,
      'Wrist spinner': 1.5,
      'Death-over specialist': 1.3,
      'Finisher': 1.3,
    },
    domesticPremium: 1.1,
    experiencePreference: 0.2,
    starAggression: 0.7,
    priceDiscipline: 0.85,
  },
  lsg: {
    franchiseId: 'lsg',
    name: 'Lucknow Super Giants',
    behaviorDescription: 'Prioritizes elite wicketkeepers, anchors & express pace',
    primaryTendencies: ['Wicketkeeper Batters', 'Express Pace', 'Middle-Order Depth'],
    roleAffinities: {
      'Wicketkeeper-batter': 1.5,
      'Middle-order anchor': 1.4,
      'Powerplay seamer': 1.4,
      'Death-over specialist': 1.3,
    },
    domesticPremium: 1.2,
    experiencePreference: 0.1,
    starAggression: 0.85,
    priceDiscipline: 0.6,
  },
};

/** Observed rival bidding tracker across the auction. */
export class OpponentBidModel {
  // Track bidding frequency per role for each rival franchise
  private bidsByRole: Map<string, Record<TacticalRole, number>> = new Map();
  private maxBidsObserved: Map<string, number> = new Map();

  constructor(franchiseIds: string[]) {
    for (const id of franchiseIds) {
      this.bidsByRole.set(id, {
        'Opening batter': 0,
        'Middle-order anchor': 0,
        'Power hitter': 0,
        'Finisher': 0,
        'Wicketkeeper-batter': 0,
        'Pace-bowling all-rounder': 0,
        'Spin-bowling all-rounder': 0,
        'Powerplay seamer': 0,
        'Death-over specialist': 0,
        'Wrist spinner': 0,
        'Finger spinner': 0,
      });
      this.maxBidsObserved.set(id, 0);
    }
  }

  /** Update beliefs when a rival franchise places a bid. */
  public observeBid(franchiseId: string, player: Player, amount: number) {
    const roleMap = this.bidsByRole.get(franchiseId);
    if (roleMap) {
      const roles = getPlayerTacticalRoles(player);
      for (const r of roles) {
        roleMap[r] = (roleMap[r] || 0) + 1;
      }
    }
    const currentMax = this.maxBidsObserved.get(franchiseId) || 0;
    if (amount > currentMax) {
      this.maxBidsObserved.set(franchiseId, amount);
    }
  }

  /** Predict how fiercely other franchises will contest this player (multiplier 1.0 to 1.8). */
  public predictCompetitionMultiplier(player: Player, excludedFranchiseId: string): number {
    const roles = getPlayerTacticalRoles(player);
    let totalContestants = 0;

    for (const [id, roleMap] of this.bidsByRole.entries()) {
      if (id === excludedFranchiseId) continue;
      const profile = FRANCHISE_STRATEGY_PROFILES[id];
      if (!profile) continue;

      let interest = 0;
      for (const r of roles) {
        interest += (profile.roleAffinities[r] || 1.0);
        interest += (roleMap[r] || 0) * 0.15; // Bayesian history boost
      }

      if (interest > 1.3 * roles.length) {
        totalContestants++;
      }
    }

    // Return competition factor based on number of active rival suitors
    return 1.0 + Math.min(0.8, totalContestants * 0.12);
  }
}

