// ============================================================
// IPL DYNASTY - Multi-Season Career & Dynasty Types
// Defines data structures for multi-year contracts, player development,
// retirements, franchise histories, storylines, and save slots.
// ============================================================

import type { Player, Franchise, SeasonAward, PlayerStats, PlayerSeasonStats } from './game';

/** Contract status across multi-season lifecycles */
export type ContractStatus = 'Active' | 'Expiring' | 'Released' | 'Retired';

/** Contract acquisition method */
export type ContractAcquisition = 'Auction' | 'Retention' | 'Draft' | 'Trade';

/** Multi-season player contract representation */
export interface PlayerContract {
  playerId: string;
  playerName: string;
  franchiseId: string;
  salaryLakhs: number; // e.g. 1400 = ₹14 Cr
  yearsRemaining: number; // 1, 2, or 3
  signingSeason: number; // e.g. 2026
  status: ContractStatus;
  originalAcquisition: ContractAcquisition;
  isRetained: boolean;
  retentionSlot?: number;
}

/** Player retirement record */
export interface RetirementRecord {
  playerId: string;
  playerName: string;
  lastFranchiseId: string;
  retirementSeason: number;
  age: number;
  careerMatches: number;
  careerRuns: number;
  careerWickets: number;
  highestScore: number;
  bestBowling: string;
  hallOfFame: boolean;
  reason: 'Age' | 'Performance' | 'Fitness' | 'Unsold';
}

/** Historical snapshot of a franchise's complete roster for a season */
export interface HistoricalSquadRoster {
  season: number;
  franchiseId: string;
  position: number;
  wins: number;
  losses: number;
  nrr: number;
  isChampion: boolean;
  isRunnerUp: boolean;
  captainPlayerId: string;
  playerIds: string[];
  playerSummaries: {
    playerId: string;
    name: string;
    role: string;
    salaryLakhs: number;
    seasonRuns: number;
    seasonWickets: number;
  }[];
}

/** All-time franchise history and achievements */
export interface FranchiseCareerRecord {
  franchiseId: string;
  championships: number;
  finalsAppearances: number;
  playoffAppearances: number;
  allTimeWins: number;
  allTimeLosses: number;
  allTimeTies: number;
  highestScore: { runs: number; wickets: number; againstFranchiseId: string; season: number };
  lowestScore: { runs: number; wickets: number; againstFranchiseId: string; season: number };
  recordPurchase: { playerId: string; playerName: string; priceLakhs: number; season: number };
  seasonHistory: HistoricalSquadRoster[];
  franchiseLegends: string[]; // Player IDs
}

/** Complete lifetime career record for an individual player */
export interface PlayerCareerRecord {
  playerId: string;
  playerName: string;
  isGenerated: boolean;
  debutSeason: number;
  careerMatches: number;
  careerRuns: number;
  careerWickets: number;
  careerFifties: number;
  careerHundreds: number;
  highScore: number;
  bestBowling: string;
  titlesWon: number[]; // Season years e.g. [2026, 2028]
  awardsWon: SeasonAward[];
  franchisesPlayedFor: string[];
  ratingsTimeline: {
    season: number;
    age: number;
    overall: number;
    batting: number;
    bowling: number;
    potential: number;
  }[];
  auctionHistory: {
    season: number;
    franchiseId: string;
    priceLakhs: number;
    auctionType: 'Mega' | 'Mini';
  }[];
  isRetired: boolean;
  retirementSeason?: number;
}

/** Procedural league narrative storylines derived strictly from game events */
export interface LeagueStoryline {
  id: string;
  season: number;
  headline: string;
  summary: string;
  category: 'Championship' | 'Breakout' | 'VeteranForm' | 'Rebuild' | 'Bust' | 'Transfer' | 'Retirement';
  involvedPlayerIds: string[];
  involvedFranchiseIds: string[];
  timestamp: number;
}

/** Multi-slot career save slot */
export interface CareerSaveSlot {
  slotId: string;
  slotNumber: number; // 0 for Autosave, 1-3 for manual slots
  name: string;
  seasonYear: number;
  humanFranchiseId: string;
  humanFranchiseName: string;
  championships: number;
  savedAt: number;
  version: string;
  stateData: string; // Serialized GameState & CareerData
}

/** Transition steps for guided season advance wizard */
export type SeasonTransitionStep =
  | 'SEASON_REVIEW'
  | 'PLAYER_DEVELOPMENT'
  | 'RETIREMENTS'
  | 'CONTRACT_ADVANCEMENT'
  | 'AUCTION_PREP'
  | 'READY_FOR_SEASON';

/** Year-over-year player rating progression delta */
export interface PlayerProgressionDelta {
  playerId: string;
  playerName: string;
  age: number;
  previousOverall: number;
  newOverall: number;
  overallDelta: number;
  previousBatting: number;
  newBatting: number;
  previousBowling: number;
  newBowling: number;
  potential: number;
  progressionNote: string;
}

/** Full multi-season career container state */
export interface CareerState {
  currentSeason: number;
  contracts: Record<string, PlayerContract>; // Keyed by playerId
  retirements: RetirementRecord[];
  franchiseHistory: Record<string, FranchiseCareerRecord>; // Keyed by franchiseId
  playerCareerRecords: Record<string, PlayerCareerRecord>; // Keyed by playerId
  storylines: LeagueStoryline[];
  recentProgressionDeltas: PlayerProgressionDelta[];
  activeSaveSlot: number;
}

