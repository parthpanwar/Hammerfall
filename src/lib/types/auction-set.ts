// ============================================================
// IPL DYNASTY - Dynamic Auction Set & Sequencing Types
// Supports role segregation, rating-based tiers, marquee pools,
// deterministic scheduling, and per-set randomized order.
// ============================================================

import type { Player } from './game';

export type AuctionSetCategory =
  | 'Marquee'
  | 'Batsmen'
  | 'All-Rounders'
  | 'Wicketkeepers'
  | 'Fast Bowlers'
  | 'Spin Bowlers'
  | 'Uncapped Batsmen'
  | 'Uncapped All-Rounders'
  | 'Uncapped Wicketkeepers'
  | 'Uncapped Fast Bowlers'
  | 'Uncapped Spin Bowlers'
  | 'Accelerated';

export interface RatingTierThresholds {
  eliteMin: number;       // 90+
  premiumMin: number;     // 85-89
  highQualityMin: number; // 75-84
  establishedMin: number; // 65-74
  developingMin: number;  // 50-64
}

export const DEFAULT_RATING_THRESHOLDS: RatingTierThresholds = {
  eliteMin: 90,
  premiumMin: 85,
  highQualityMin: 75,
  establishedMin: 65,
  developingMin: 50,
};

/**
 * Auction-specific player assignment record (prevents permanent player mutation).
 */
export interface AuctionPlayerAssignment {
  playerId: string;
  playerName: string;
  auctionSetId: string;
  auctionSetCode: string;
  auctionSetName: string;
  auctionSetCategory: AuctionSetCategory;
  auctionSetTier: number;
  auctionSetOrder: number;
  playerOrderWithinSet: number;
  globalAuctionOrder: number;
  playerRatingAtAuctionCreation: number;
}

/**
 * Complete state and metadata for an auction set in the schedule.
 */
export interface AuctionSet {
  id: string; // e.g. 'set-m1', 'set-bat1'
  code: string; // e.g. 'M1', 'BAT1', 'UFB1'
  name: string; // e.g. 'Marquee Players 1', 'Batsmen 1'
  category: AuctionSetCategory;
  tier: number; // 1, 2, 3...
  order: number; // 1, 2, 3... position in schedule
  isUncapped: boolean;
  playerIds: string[]; // Randomized nomination order within set
  totalCount: number;
}

/**
 * Complete immutable schedule for an auction run.
 */
export interface DynamicAuctionSequence {
  auctionSeed: number;
  sets: AuctionSet[];
  assignments: Record<string, AuctionPlayerAssignment>;
  orderedPlayerIds: string[];
  totalPlayers: number;
  totalSets: number;
}

