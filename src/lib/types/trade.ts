// ============================================================
// IPL DYNASTY - Player Trading System Types
// Player-for-player and multi-player trades with optional cash
// balancing. There are deliberately NO draft picks or future
// rights of any kind — only players under contract and cash.
//
// Four money concepts are tracked independently:
//  1. Player contract salary   -> careerState.contracts[playerId].salaryLakhs
//  2. Franchise auction purse  -> franchise.remainingPurse
//  3. Salary-cap commitment    -> sum of rostered contract salaries (derived)
//  4. Trade cash payment       -> TradeState.settlement (per-franchise cash account)
// ============================================================

import type { GamePhase } from './game';

/** How the two sides' outgoing contract totals must relate. */
export type SalaryMatchingMode = 'Exact' | 'Tolerance' | 'CashBalanced' | 'OfficialIPL';

/** Where balancing cash payments are drawn from. */
export type CashSettlementSource = 'SettlementAccount' | 'AuctionPurse';

/** When completed-squad minimums (18) apply. */
export type SquadMinimumPolicy = 'ByPhase' | 'Always' | 'Never';

export interface TradeRules {
  matchingMode: SalaryMatchingMode;
  /** Tolerance mode: max allowed |difference| as a share of the larger side (0.15 = 15%). */
  tolerancePct: number;
  /** Tolerance mode: or a fixed allowance in lakhs, whichever is larger. */
  toleranceFixedLakhs: number;
  /** Max balancing cash in a single trade (lakhs). */
  maxCashPerTradeLakhs: number;
  cashSource: CashSettlementSource;
  /** Opening balance of every franchise's settlement account (lakhs). Seeded once; never topped up. */
  settlementOpeningBalanceLakhs: number;
  maxPlayersPerSide: number;
  maxPlayersTotal: number;
  squadMinimumPolicy: SquadMinimumPolicy;
  requirePlayerConsent: boolean;
  /** A player can be traded at most this many times per season. */
  maxTradesPerPlayerPerSeason: number;
  /** Phases in which the trade window is open. */
  windowPhases: GamePhase[];
  /** CPU-initiated offers: max open offers to the user at once. */
  maxOpenCpuOffers: number;
  /** Market ticks a CPU franchise waits between offers to the user. */
  cpuOfferCooldownTicks: number;
  /** Probability per market tick that CPU franchises look for CPU↔CPU deals. */
  cpuToCpuTradeChance: number;
  /** Proposals expire after this many market ticks without action. */
  proposalExpiryTicks: number;
}

export type TradeStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'COUNTEROFFERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'COMPLETED';

/** One side of a trade: what that franchise SENDS. */
export interface TradeSide {
  franchiseId: string;
  playerIds: string[];
  /** Cash this side pays to the other side (lakhs, ≥ 0). */
  cashLakhs: number;
}

export interface TradeProposal {
  id: string;
  /** Initiating franchise is always sides[0]. */
  sides: [TradeSide, TradeSide];
  status: TradeStatus;
  initiatedBy: 'human' | 'cpu';
  createdTick: number;
  updatedTick: number;
  season: number;
  /** Proposal this one counters (negotiation chain). */
  parentId?: string;
  /** Explanation shown with the latest CPU decision / counteroffer. */
  messages: string[];
  /**
   * Renegotiated trade fees (lakhs) keyed by playerId. A traded player can move at a
   * new fee, like Jadeja (₹18 Cr → ₹14 Cr) or a big-ticket star moving at half price.
   * The selling team frees the old salary; the buying team commits the new fee.
   */
  fees?: Record<string, number>;
}

export type TradeBlockStatus = 'Untouchable' | 'Available' | 'Shopping' | 'Listening';

export type CpuDecision = 'ACCEPT' | 'REJECT' | 'COUNTER';

/** Qualitative interest band shown to the user instead of private valuations. */
export type InterestBand = 'None' | 'Low' | 'Moderate' | 'Strong' | 'Very Strong';

export interface TradeValidationIssue {
  code:
    | 'WINDOW_CLOSED'
    | 'FRANCHISE_INELIGIBLE'
    | 'EMPTY_SIDE'
    | 'TOO_MANY_PLAYERS'
    | 'NOT_ON_ROSTER'
    | 'DUPLICATE_PLAYER'
    | 'PLAYER_LOCKED'
    | 'CONTRACT_INELIGIBLE'
    | 'CONSENT_DENIED'
    | 'SALARY_MISMATCH'
    | 'FEE_OUT_OF_RANGE'
    | 'CASH_LIMIT'
    | 'INSUFFICIENT_CASH'
    | 'PURSE_EXCEEDED'
    | 'SQUAD_MAX'
    | 'SQUAD_MIN'
    | 'OVERSEAS_MAX'
    | 'SAME_FRANCHISE';
  message: string;
  franchiseId?: string;
  playerId?: string;
}

export interface TradeFinancials {
  /** Contract totals each side sends (current salaries). */
  outgoingSalary: [number, number];
  /** What each side takes on: incoming players at their (possibly renegotiated) fees. */
  incomingSalary: [number, number];
  /** Incoming - outgoing salary from side 0's perspective. */
  salaryDifference: number;
  /** Net cash flowing from side 0 to side 1 (negative = side 1 pays side 0). */
  netCashToSide1: number;
  /** Purse after the trade (cap room). */
  purseAfter: [number, number];
  /** Settlement account balance after the trade. */
  settlementAfter: [number, number];
  /** Salary commitment (sum of contracts) after the trade. */
  commitmentAfter: [number, number];
  /** Auto-balance suggestion: cash side 0 should pay side 1 (negative = side 1 pays). */
  suggestedCashToSide1: number;
}

export interface SquadSnapshot {
  size: number;
  overseas: number;
  bestXiOvr: number;
  strength: number;
}

export interface TradeValidation {
  valid: boolean;
  issues: TradeValidationIssue[];
  financials: TradeFinancials;
  after: [SquadSnapshot, SquadSnapshot];
  before: [SquadSnapshot, SquadSnapshot];
}

export interface CpuTradeEvaluation {
  decision: CpuDecision;
  /** Calibrated acceptance probability (0-1). Private: UI shows only `interest`. */
  acceptanceProbability: number;
  interest: InterestBand;
  reasons: string[];
  counter?: TradeProposal;
  /** Private utility (debug / tests only — never rendered). */
  utility: number;
  threshold: number;
}

export interface CashLedgerEntry {
  id: string;
  tradeId: string;
  season: number;
  fromFranchiseId: string;
  toFranchiseId: string;
  amountLakhs: number;
  source: CashSettlementSource;
  timestamp: number;
}

export interface TradeRecordPlayer {
  playerId: string;
  playerName: string;
  fromFranchiseId: string;
  toFranchiseId: string;
  salaryLakhs: number;
  /** Salary before the move, when the fee was renegotiated. */
  previousSalaryLakhs?: number;
  overall: number;
  role: string;
}

export interface TradeRecord {
  id: string;
  season: number;
  phase: GamePhase;
  tick: number;
  timestamp: number;
  franchiseIds: [string, string];
  players: TradeRecordPlayer[];
  cash: { fromFranchiseId: string; toFranchiseId: string; amountLakhs: number } | null;
  status: 'COMPLETED';
  initiatedBy: 'human' | 'cpu';
  isCpuToCpu: boolean;
  preSquad: [SquadSnapshot, SquadSnapshot];
  postSquad: [SquadSnapshot, SquadSnapshot];
  matchingMode: SalaryMatchingMode;
}

export interface NegotiationMemory {
  /** Recent lopsided offers; raises the CPU's asking price (anti-exploit). */
  lowballs: number;
  lastTick: number;
}

export interface TradeState {
  rules: TradeRules;
  tick: number;
  settlement: Record<string, number>;
  ledger: CashLedgerEntry[];
  history: TradeRecord[];
  proposals: TradeProposal[];
  humanBlock: Record<string, TradeBlockStatus>;
  memory: Record<string, NegotiationMemory>;
  /** Last tick each CPU franchise sent the user an offer. */
  lastCpuOfferTick: Record<string, number>;
  /** playerId -> trades this season (consent / churn rule). */
  tradedThisSeason: Record<string, number>;
  season: number;
  /** Players who have asked to leave this season (playerId -> reason). Optional for older saves. */
  tradeRequests?: Record<string, TradeRequest>;
}

export interface TradeRequest {
  playerId: string;
  franchiseId: string;
  season: number;
  reason: string;
}

/** A franchise's competitive plan, which shapes how its GM values a deal. */
export type TeamDirection = 'Contending' | 'Balanced' | 'Rebuilding';
