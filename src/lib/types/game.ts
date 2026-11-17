// ============================================================
// IPL DYNASTY - Core Game Types
// ============================================================

// --- Enums ---

export type PlayerRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper';
import type {
  ActivityStatus,
  RetirementScope,
  AuctionRegistrationStatus,
  LastVerifiedMatch,
} from './retirement';

export type BattingHand = 'Right' | 'Left';
export type BowlingStyle =
  | 'Right-arm Fast'
  | 'Right-arm Medium Fast'
  | 'Right-arm Fast Medium'
  | 'Right-arm Medium'
  | 'Left-arm Fast'
  | 'Left-arm Medium Fast'
  | 'Left-arm Fast Medium'
  | 'Left-arm Medium'
  | 'Right-arm Off Break'
  | 'Right-arm Leg Break'
  | 'Left-arm Orthodox'
  | 'Left-arm Chinaman'
  | 'None';

export type PlayerNationality = 'Indian' | 'Overseas';
export type PlayerStatus = 'Capped' | 'Uncapped';

export type AuctionState = 'NOMINATION' | 'OPEN_BIDDING' | 'FINAL_CALL' | 'SOLD' | 'UNSOLD' | 'NEXT_PLAYER' | 'COMPLETED' | 'PAUSED';
export type AuctionPace = 'Normal' | 'Fast' | 'Instant';
export type AuctionType = 'Mega' | 'Mini';

export type MatchSimMode = 'Quick' | 'Detailed' | 'BallByBall';
export type CPUDifficulty = 'Easy' | 'Normal' | 'Hard' | 'Expert';

export type MatchPhase = 'Powerplay' | 'Middle' | 'Death';
export type InningsState = 'NotStarted' | 'InProgress' | 'AllOut' | 'Completed' | 'TargetChased';

export type DismissalType = 'Bowled' | 'Caught' | 'LBW' | 'RunOut' | 'Stumped' | 'HitWicket' | 'CaughtBehind' | 'CaughtAndBowled' | 'NotOut' | 'RetiredHurt';
export type DeliveryOutcome = 'Dot' | 'Single' | 'Double' | 'Triple' | 'Four' | 'Six' | 'Wide' | 'NoBall' | 'Bye' | 'LegBye' | 'Wicket' | 'WicketAndRuns';

export type GamePhase =
  | 'MainMenu'
  | 'NewGame'
  | 'FranchiseSelect'
  | 'Retention'
  | 'RetentionResults'
  | 'Registration'
  | 'Scouting'
  | 'ShortlistReveal'
  | 'Auction'
  | 'AuctionResults'
  | 'SquadManagement'
  | 'Tournament'
  | 'Match'
  | 'Standings'
  | 'Playoffs'
  | 'SeasonReview'
  | 'CareerHistory'
  | 'CareerDashboard'
  | 'TradeCenter'
  | 'Transactions';

export type GMPersonality = 'Aggressive' | 'YouthFocused' | 'AnalyticsDriven' | 'SuperstarHunter' | 'BalancedBuilder' | 'BowlingFirst' | 'ValueHunter' | 'DomesticFirst' | 'BigSpender' | 'PatientBuilder';

// --- Interfaces ---

export interface PlayerRatings {
  batting: number;       // 0-100
  bowling: number;       // 0-100
  fielding: number;      // 0-100
  powerHitting: number;  // 0-100
  consistency: number;   // 0-100
  t20Adaptability: number; // 0-100
  potential: number;     // 0-100
  overall: number;       // 0-100

  // Advanced Opposition-Adjusted Rating Metrics
  rawPerformanceRating?: number;       // 0-100 unadjusted statistical rating
  oppositionAdjustedRating?: number;   // 0-100 opponent difficulty adjusted
  competitionAdjustedRating?: number;  // 0-100 league/competition tier calibrated
  recentFormRating?: number;           // 0-100 time-decayed recent performance
  experienceRating?: number;           // 0-100 match evidence and reliability
  ratingConfidence?: number;           // 0.0 - 1.0 Bayesian sample reliability
  ratingVersion?: string;              // e.g. '2026.5.0-opposition-adjusted'
  ratingUpdatedAt?: string;            // ISO 8601 timestamp
  dataSource?: string;                 // Data provenance source
  dataQualityStatus?: 'Verified-BallByBall' | 'Match-Scorecard' | 'Competition-Aggregate' | 'Calibrated-Prior';
  /** Raw model output before the starting-spread remap (see data/rating-distribution). */
  modelOverall?: number;
  /** Overall as shipped in the database, before the starting-spread remap. */
  preRemapOverall?: number;
  /** RATING_REMAP_VERSION applied to this player (absent = never remapped). */
  remapVersion?: number;
}

export interface PlayerStats {
  matches: number;
  innings: number;
  runs: number;
  ballsFaced: number;
  battingAverage: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highScore: number;
  wickets: number;
  oversBowled: number;
  runsConceded: number;
  bowlingAverage: number;
  economyRate: number;
  bestBowling: string;
  catches: number;
  playerOfMatch: number;
}

export type DevelopmentTrend =
  | 'Breakout'
  | 'Domestic breakout'
  | 'Rising'
  | 'Steady'
  | 'Stalled'
  | 'Bust'
  | 'Declining';

/** What happened to a player's game over the last off-season. */
export interface PlayerDevelopment {
  /** The season these changes take effect for. */
  season: number;
  trend: DevelopmentTrend;
  overallDelta: number;
  potentialDelta: number;
  note: string;
  /** Earned a first India cap on the back of the season. */
  callUp?: boolean;
  /** IPL matches and output index (seasonPerformance) behind this verdict; null = too little cricket. */
  matches?: number;
  perf?: number | null;
}

/** Hidden development profile: why two similar prospects turn out differently. Never shown in the UI. */
export type DevProfile = 'EarlyBloomer' | 'Standard' | 'LateBloomer' | 'Plateau';

/** In-season selection state; reset every off-season. */
export interface SeasonForm {
  season: number;
  /** Matches played this season. */
  matches: number;
  /** Bitmask of the team's last 5 matches (bit 0 = most recent): 1 = played. */
  apps: number;
  /** Picked by the CPU blooding rule at least once this season. */
  blooded?: boolean;
}

/** A CPU front office's auction plan for the coming window; revised after every season. */
export interface FranchiseStrategy {
  /** Bidding archetype (see cpu-gm/personalities GM_PERSONALITY_ARCHETYPES). */
  archetype: string;
  /** Short label for the plan, e.g. "Rebuild around youth". */
  plan: string;
  rationale: string;
  /** Tactical-role multipliers (0.7 – 1.6) the scouts chase this window. */
  roleAffinities: Record<string, number>;
  /** Premium for Indian players (saves overseas slots). */
  domesticPremium: number;
  starAggression: number;
  /** Season this plan was drawn up for. */
  season: number;
  history: { season: number; archetype: string; plan: string; finish?: number }[];
}

/** A player's real IPL record (Cricsheet, 2008–2026), extended as career seasons are played. */
export interface IplRecord {
  seasons: number;
  matches: number;
  firstSeason: number;
  lastSeason: number;
  runs: number;
  strikeRate: number;
  battingAvg: number;
  wickets: number;
  economy: number;
  ballsBowled: number;
  /** Last season the player was in an IPL squad (played or not). */
  lastSquadSeason?: number;
}

export interface Player {
  id: string;
  name: string;
  cricsheetId?: string;
  alternateNames?: string[];
  age: number;
  nationality: PlayerNationality;
  country: string;
  status: PlayerStatus;
  currentFranchiseId: string | null;
  previousFranchises: string[];

  role: PlayerRole;
  secondaryRole?: PlayerRole;
  battingHand: BattingHand;
  bowlingStyle: BowlingStyle;
  preferredBattingPosition: number; // 1-11
  isOpener: boolean;
  isDeathBowler: boolean;
  isPowerplayBowler: boolean;
  isSpinner: boolean;

  stats: PlayerStats;
  ratings: PlayerRatings;
  /** IPL experience; undefined = has never played an IPL match. */
  ipl?: IplRecord;
  /** Last off-season's development verdict (breakout, bust, domestic breakout, call-up…). */
  development?: PlayerDevelopment;
  /** Hidden development profile; derived from the id when missing (old saves). */
  devProfile?: DevProfile;
  /** In-season form/selection state (recentForm is its moving average). */
  seasonForm?: SeasonForm;
  recentForm: number; // 0-100
  fitnessLevel: number; // 0-100
  injuryRisk: number; // 0-100

  // Opposition-Adjusted Rating Fields (Top-Level Convenience & Ingestion)
  rawPerformanceRating?: number;
  oppositionAdjustedRating?: number;
  competitionAdjustedRating?: number;
  recentFormRating?: number;
  overallRating?: number;
  ratingConfidence?: number;
  ratingVersion?: string;
  ratingUpdatedAt?: string;
  dataSource?: string;
  dataQualityStatus?: 'Verified-BallByBall' | 'Match-Scorecard' | 'Competition-Aggregate' | 'Calibrated-Prior';

  // Retirement & Auction Eligibility Status Fields
  internationalStatus?: ActivityStatus;
  domesticStatus?: ActivityStatus;
  franchiseStatus?: ActivityStatus;
  iplStatus?: ActivityStatus;
  professionalStatus?: ActivityStatus;
  isRetired?: boolean; // Convenience flag for professional retirement
  dateOfRetirement?: string; // ISO date e.g. '2021-11-19'
  retirementScope?: RetirementScope;
  auctionRegistrationStatus?: AuctionRegistrationStatus;
  seasonEligibility?: Record<number, boolean>;
  lastVerifiedMatch?: LastVerifiedMatch;
  lastVerificationDate?: string;
  verificationSource?: string;
  verificationConfidence?: number;
  conflictingReports?: boolean;
  manualReviewRequired?: boolean;
  retirementNotes?: string;

  basePrice: number; // in lakhs
  currentContractValue: number; // in lakhs
  estimatedMarketValue: number; // in lakhs
  expectedDemand: number; // 0-100
  retentionCost: number; // in lakhs
  isAvailableForAuction: boolean;
  isRetained: boolean;
  isSold: boolean;
  soldPrice: number; // in lakhs
}

export interface FranchiseColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

export interface Franchise {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  colors: FranchiseColors;
  homeStadium: string;
  city: string;

  totalPurse: number; // in lakhs
  remainingPurse: number;
  players: Player[];
  retainedPlayers: Player[];
  releasedPlayers: Player[];
  auctionPurchases: AuctionPurchase[];

  maxSquadSize: number;
  minSquadSize: number;
  maxOverseas: number;
  currentOverseasCount: number;

  isHumanControlled: boolean;
  gmPersonality: GMPersonality;
  /** Dynamic front-office plan (CPU teams); absent = the franchise's IRL default. */
  strategy?: FranchiseStrategy;
  cpuDifficulty: CPUDifficulty;

  // Team strengths (calculated)
  powerplayBatting: number;
  middleOversBatting: number;
  deathBatting: number;
  powerplayBowling: number;
  middleOversBowling: number;
  deathBowling: number;
  spinAttack: number;
  paceAttack: number;
  fieldingRating: number;
  overallStrength: number;
}

export interface AuctionPurchase {
  playerId: string;
  playerName: string;
  franchiseId: string;
  price: number; // in lakhs
  basePrice: number;
  round: number;
  bidCount: number;
  timestamp: number;
}

export interface AuctionBid {
  franchiseId: string;
  amount: number; // in lakhs
  timestamp: number;
  isAutomatic: boolean;
}

export interface AuctionLot {
  player: Player;
  basePrice: number;
  currentBid: number;
  currentBidderId: string | null;
  bids: AuctionBid[];
  state: 'Active' | 'Sold' | 'Unsold';
  finalCallCount: number; // 0, 1 (going once), 2 (going twice), 3 (sold)
  round: number;

  // Dynamic set metadata
  auctionSetId?: string;
  auctionSetCode?: string;
  auctionSetName?: string;
  auctionSetCategory?: string;
  playerOrderWithinSet?: number;
  totalInSet?: number;
  nextSetName?: string;
  nextSetCode?: string;
}

export interface AuctionSession {
  id: string;
  seasonYear: number;
  auctionType: AuctionType;
  state: AuctionState;
  currentLot: AuctionLot | null;
  currentPlayerIndex: number;
  playerPool: Player[];
  soldPlayers: AuctionPurchase[];
  unsoldPlayers: Player[];
  round: number;
  totalRounds: number;
  franchises: Franchise[];
  pace: AuctionPace;
  isPaused: boolean;
  humanAutoBidMax: number; // 0 = disabled

  // Dynamic set sequencing
  auctionSeed?: number;
  currentSetIndex?: number;
  sets?: import('./auction-set').AuctionSet[];
  setAssignments?: Record<string, import('./auction-set').AuctionPlayerAssignment>;

  /** Market price index for this auction (league money vs. pool worth); 1 = neutral. */
  priceIndex?: number;
}

export interface RetentionRule {
  maxRetentions: number;
  maxCappedRetentions: number;
  maxUncappedRetentions: number;
  maxOverseasRetentions: number;
  retentionCosts: number[]; // cost for 1st, 2nd, 3rd... retention in lakhs
  uncappedRetentionCost: number;
  rtmAllowed: boolean;
  maxRTMs: number;
  totalPurse: number; // in lakhs
}

export interface RetentionDecision {
  franchiseId: string;
  playerId: string;
  playerName: string;
  retentionNumber: number;
  cost: number;
  isRTM: boolean;
}

export interface MatchResult {
  matchId: string;
  team1Id: string;
  team2Id: string;
  team1Score: InningsScore;
  team2Score: InningsScore;
  winnerId: string | null;
  winMargin: string;
  playerOfMatch: string;
  tossWinnerId: string;
  tossDecision: 'Bat' | 'Bowl';
  venue: string;
  matchNumber: number;
  isSuperOver: boolean;
  isNoResult: boolean;
}

export interface InningsScore {
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: number;
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface BallEvent {
  over: number;
  ball: number;
  batsmanId: string;
  bowlerId: string;
  outcome: DeliveryOutcome;
  runs: number;
  extraRuns: number;
  isLegal: boolean;
  dismissalType?: DismissalType;
  dismissedPlayerId?: string;
  fielderId?: string;
  commentary: string;
}

export interface BatsmanInnings {
  playerId: string;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissalType: DismissalType;
  dismissalText: string;
  isOnStrike: boolean;
}

export interface BowlerSpell {
  playerId: string;
  playerName: string;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
}

export interface Fixture {
  id: string;
  matchNumber: number;
  team1Id: string;
  team2Id: string;
  venue: string;
  isCompleted: boolean;
  result: MatchResult | null;
  isPlayoff: boolean;
  playoffType?: 'Qualifier1' | 'Eliminator' | 'Qualifier2' | 'Final';
}

export interface StandingsEntry {
  franchiseId: string;
  position: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  isQualified: boolean;
}

export interface SeasonAward {
  type: 'OrangeCap' | 'PurpleCap' | 'MVP' | 'EmergingPlayer' | 'BestAuctionBuy' | 'PlayerOfMatch' | 'PlayerOfTournament';
  playerId: string;
  playerName: string;
  franchiseId: string;
  value: number; // runs for orange cap, wickets for purple cap, etc.
}

export interface PlayerSeasonStats extends PlayerStats {
  playerId: string;
  seasonYear: number;
  franchiseId: string;
  dotBallPercentage: number;
  boundaryPercentage: number;
  powerplayRuns: number;
  deathOverRuns: number;
  powerplayWickets: number;
  deathOverWickets: number;
}

export interface PlayingXI {
  franchiseId: string;
  players: string[]; // player IDs, in batting order
  captain: string;
  wicketkeeper: string;
  impactPlayer?: string;
  impactSubstitute?: string;
  /** CPU only: a prospect picked by the blooding rule for this match. */
  bloodedId?: string;
}

export interface GameSettings {
  startingSeason: number;
  /** 'custom' = your own 3-season mega cycle; 'irl' = follow the real IPL auction calendar. */
  cycleMode?: 'custom' | 'irl';
  auctionType: AuctionType;
  rulesPreset: 'Official' | 'Custom';
  cpuDifficulty: CPUDifficulty;
  auctionPace: AuctionPace;
  matchSimMode: MatchSimMode;
  allowCustomPurse: boolean;
  enableInjuries: boolean;
  enablePlayerDevelopment: boolean;
  customPurse?: number;
  seed: number;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  settings: GameSettings;
  currentSeason: number;
  humanFranchiseId: string;
  franchises: Franchise[];
  allPlayers: Player[];

  // Retention
  retentionDecisions: RetentionDecision[];
  retentionComplete: boolean;

  // Registration & Scouting
  registrationPool: import('./registration').RegisteredPlayer[];
  registrationSummary: import('./registration').RegistrationSummary | null;
  franchiseShortlists: Record<string, import('./scouting').FranchiseShortlist>;
  finalAuctionPool: import('./registration').RegisteredPlayer[];
  auctionSets: Record<string, import('./registration').RegisteredPlayer[]>;
  squadRules: import('./squad-rules').SquadRules;

  // Auction
  auctionSession: AuctionSession | null;
  auctionComplete: boolean;

  // Tournament
  fixtures: Fixture[];
  standings: StandingsEntry[];
  currentFixtureIndex: number;
  currentMatch: MatchResult | null;
  playerSeasonStats: Record<string, PlayerSeasonStats>;

  // Playing XI per franchise
  playingXIs: Record<string, PlayingXI>;

  // Playoffs
  playoffFixtures: Fixture[];

  // Awards
  seasonAwards: SeasonAward[];

  // Career
  seasonHistory: SeasonSummary[];
  careerYear: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  savedAt: number;
}

export interface SeasonSummary {
  year: number;
  championId: string;
  runnerUpId: string;
  orangeCapPlayer: string;
  purpleCapPlayer: string;
  mvpPlayer: string;
  humanFranchisePosition: number;
  humanFranchiseWins: number;
  humanFranchiseLosses: number;
}

// --- Seeded Random ---
export interface SeededRandom {
  next(): number; // 0-1
  nextInt(min: number, max: number): number;
  nextBool(probability?: number): boolean;
  pick<T>(arr: T[]): T;
  shuffle<T>(arr: T[]): T[];
}

