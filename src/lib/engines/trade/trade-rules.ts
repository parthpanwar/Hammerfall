// ============================================================
// IPL DYNASTY - Trade Rules Engine
// Rule presets, trade windows, contract-salary resolution, financial
// calculation (salary matching + cash balancing) and full validation.
// Pure functions: nothing here mutates game state.
// ============================================================

import type { Franchise, GamePhase, Player, RetentionDecision } from '@/lib/types/game';
import type { PlayerContract } from '@/lib/types/career';
import type {
  TradeFinancials,
  TradeProposal,
  TradeRules,
  TradeState,
  TradeValidation,
  TradeValidationIssue,
  SalaryMatchingMode,
} from '@/lib/types/trade';
import { formatPrice } from '@/lib/utils';
import { squadSnapshot } from './trade-value';

/** Offseason (post-season → before the final auction list) and post-auction pre-season. */
const OFFSEASON_WINDOW: GamePhase[] = [
  'SeasonReview',
  'CareerDashboard',
  'CareerHistory',
  'Retention',
  'Registration',
  'Scouting',
  'SquadManagement',
  'TradeCenter',
];

/**
 * Official IPL mode follows the published structure of the IPL trading window
 * (opens after the season, shuts before the auction, reopens after the auction
 * until the season starts). No calendar dates are invented: the window is
 * expressed in game phases. Player-for-player swaps settle the salary gap
 * through the auction purse; any transfer fee is a separate cash payment.
 */
export const OFFICIAL_IPL_RULES: TradeRules = {
  matchingMode: 'OfficialIPL',
  tolerancePct: 0,
  toleranceFixedLakhs: 0,
  maxCashPerTradeLakhs: 500,
  cashSource: 'SettlementAccount',
  settlementOpeningBalanceLakhs: 1000,
  maxPlayersPerSide: 3,
  maxPlayersTotal: 5,
  squadMinimumPolicy: 'ByPhase',
  requirePlayerConsent: true,
  maxTradesPerPlayerPerSeason: 1,
  windowPhases: OFFSEASON_WINDOW,
  maxOpenCpuOffers: 2,
  cpuOfferCooldownTicks: 2,
  cpuToCpuTradeChance: 0.35,
  proposalExpiryTicks: 3,
};

/** Default custom dynasty rules: contract matching with cash balancing. */
export const CUSTOM_CASH_BALANCED_RULES: TradeRules = {
  ...OFFICIAL_IPL_RULES,
  matchingMode: 'CashBalanced',
  tolerancePct: 0.1,
  toleranceFixedLakhs: 100,
  requirePlayerConsent: false,
  maxTradesPerPlayerPerSeason: 2,
};

export const RULE_PRESETS: Record<SalaryMatchingMode, TradeRules> = {
  Exact: { ...CUSTOM_CASH_BALANCED_RULES, matchingMode: 'Exact', tolerancePct: 0, toleranceFixedLakhs: 0 },
  Tolerance: { ...CUSTOM_CASH_BALANCED_RULES, matchingMode: 'Tolerance', tolerancePct: 0.15, toleranceFixedLakhs: 150 },
  CashBalanced: CUSTOM_CASH_BALANCED_RULES,
  OfficialIPL: OFFICIAL_IPL_RULES,
};

export const MATCHING_MODE_LABEL: Record<SalaryMatchingMode, string> = {
  Exact: 'Exact match',
  Tolerance: 'Tolerance match',
  CashBalanced: 'Cash balanced',
  OfficialIPL: 'Official IPL',
};

export function createTradeState(franchises: Franchise[], season: number, rules: TradeRules = CUSTOM_CASH_BALANCED_RULES): TradeState {
  return {
    rules,
    tick: 0,
    settlement: Object.fromEntries(franchises.map((f) => [f.id, rules.settlementOpeningBalanceLakhs])),
    ledger: [],
    history: [],
    proposals: [],
    humanBlock: {},
    memory: {},
    lastCpuOfferTick: {},
    tradedThisSeason: {},
    season,
  };
}

// ------------------------------------------------------------
// Context
// ------------------------------------------------------------

export interface TradeContext {
  franchises: Franchise[];
  contracts: Record<string, PlayerContract>;
  retentionDecisions: RetentionDecision[];
  phase: GamePhase;
  season: number;
  /** True once any league match of the season has been played. */
  seasonStarted: boolean;
  /** True once this season's auction is complete. */
  auctionComplete: boolean;
  humanFranchiseId: string;
  difficulty: import('@/lib/types/game').CPUDifficulty;
  trade: TradeState;
}

const PRE_AUCTION: GamePhase[] = ['Retention', 'Registration', 'Scouting', 'ShortlistReveal', 'Auction'];

/** Phase the trade engine treats as "current" (Trade Center inherits the phase you came from). */
export function effectivePhase(ctx: TradeContext, returnPhase?: GamePhase | null): GamePhase {
  return ctx.phase === 'TradeCenter' && returnPhase ? returnPhase : ctx.phase;
}

export function isWindowOpen(ctx: TradeContext): { open: boolean; reason: string; closesAt: string } {
  const p = ctx.phase;
  if (ctx.seasonStarted) {
    return { open: false, reason: 'The season is under way — the trade window reopens after the final.', closesAt: '' };
  }
  if (!ctx.trade.rules.windowPhases.includes(p)) {
    const why =
      p === 'ShortlistReveal' || p === 'Auction'
        ? 'Trading is frozen from the final auction list until the hammer falls.'
        : 'The trade window is closed in this phase.';
    return { open: false, reason: why, closesAt: '' };
  }
  const closesAt = PRE_AUCTION.includes(p) || !ctx.auctionComplete ? 'when the final auction list is published' : 'when the first league match starts';
  return { open: true, reason: '', closesAt };
}

/** Completed-squad minimum (18) applies only once rosters are complete. */
export function enforcesSquadMinimum(ctx: TradeContext): boolean {
  const policy = ctx.trade.rules.squadMinimumPolicy;
  if (policy === 'Always') return true;
  if (policy === 'Never') return false;
  return ctx.auctionComplete && !PRE_AUCTION.includes(ctx.phase);
}

// ------------------------------------------------------------
// Money
// ------------------------------------------------------------

/** A player's contract salary with this franchise (never the purse or cash). */
export function contractSalary(player: Player, franchiseId: string, ctx: Pick<TradeContext, 'contracts' | 'retentionDecisions'>): number {
  const c = ctx.contracts[player.id];
  if (c && c.franchiseId === franchiseId && (c.status === 'Active' || c.status === 'Expiring')) return c.salaryLakhs;
  const r = ctx.retentionDecisions.find((d) => d.playerId === player.id && d.franchiseId === franchiseId);
  if (r) return r.cost;
  if (player.soldPrice > 0) return player.soldPrice;
  if (player.currentContractValue > 0) return player.currentContractValue;
  return player.basePrice;
}

/** Renegotiated fees must stay within this band of the current salary. */
export const FEE_MIN_PCT = 0.5;
export const FEE_MAX_PCT = 1.25;

export function feeBounds(currentLakhs: number): [number, number] {
  const r5 = (v: number) => Math.round(v / 5) * 5;
  return [Math.max(20, r5(currentLakhs * FEE_MIN_PCT)), Math.max(20, r5(currentLakhs * FEE_MAX_PCT))];
}

/** Salary a player will be paid by his NEW franchise in this proposal. */
export function tradeFee(proposal: Pick<TradeProposal, 'fees'>, player: Player, fromFranchiseId: string, ctx: Pick<TradeContext, 'contracts' | 'retentionDecisions'>): number {
  const fee = proposal.fees?.[player.id];
  return typeof fee === 'number' && fee > 0 ? fee : contractSalary(player, fromFranchiseId, ctx);
}

export function findOwner(playerId: string, franchises: Franchise[]): Franchise[] {
  return franchises.filter((f) => f.players.some((p) => p.id === playerId));
}

function tolerance(rules: TradeRules, a: number, b: number): number {
  return Math.max(rules.tolerancePct * Math.max(a, b), rules.toleranceFixedLakhs);
}

export function computeFinancials(proposal: TradeProposal, ctx: TradeContext): TradeFinancials {
  const [s0, s1] = proposal.sides;
  const f0 = ctx.franchises.find((f) => f.id === s0.franchiseId);
  const f1 = ctx.franchises.find((f) => f.id === s1.franchiseId);
  const sal = (f: Franchise | undefined, ids: string[]) =>
    ids.reduce((sum, id) => {
      const p = f?.players.find((x) => x.id === id);
      return sum + (p ? contractSalary(p, f!.id, ctx) : 0);
    }, 0);
  const out0 = sal(f0, s0.playerIds);
  const out1 = sal(f1, s1.playerIds);
  // What each side takes on: the other side's players at their (renegotiated) fees.
  const fee = (f: Franchise | undefined, ids: string[]) =>
    ids.reduce((sum, id) => {
      const p = f?.players.find((x) => x.id === id);
      return sum + (p ? tradeFee(proposal, p, f!.id, ctx) : 0);
    }, 0);
  const in0 = fee(f1, s1.playerIds);
  const in1 = fee(f0, s0.playerIds);
  const diff = in0 - in1; // side 0 takes on this much more (fee-adjusted) salary than it sends
  const netCash = (s0.cashLakhs || 0) - (s1.cashLakhs || 0);
  const fromPurse = ctx.trade.rules.cashSource === 'AuctionPurse';

  const commit = (f: Franchise | undefined) => (f ? f.players.reduce((s, p) => s + contractSalary(p, f.id, ctx), 0) : 0);
  const suggested = Math.max(-ctx.trade.rules.maxCashPerTradeLakhs, Math.min(ctx.trade.rules.maxCashPerTradeLakhs, diff));

  return {
    outgoingSalary: [out0, out1],
    incomingSalary: [in0, in1],
    salaryDifference: diff,
    netCashToSide1: netCash,
    // Purse (cap room): a team frees its outgoing salaries and commits the incoming fees.
    // Cash only touches the purse when the ruleset funds trade cash from it.
    purseAfter: [
      (f0?.remainingPurse ?? 0) + out0 - in0 - (fromPurse ? netCash : 0),
      (f1?.remainingPurse ?? 0) + out1 - in1 + (fromPurse ? netCash : 0),
    ],
    settlementAfter: [
      (ctx.trade.settlement[s0.franchiseId] ?? 0) - (fromPurse ? 0 : netCash),
      (ctx.trade.settlement[s1.franchiseId] ?? 0) + (fromPurse ? 0 : netCash),
    ],
    commitmentAfter: [commit(f0) - out0 + in0, commit(f1) - out1 + in1],
    suggestedCashToSide1: Math.round(suggested / 5) * 5,
  };
}

/** Rosters after the proposal (does not mutate inputs). */
export function rostersAfter(proposal: TradeProposal, franchises: Franchise[]): [Player[], Player[]] {
  const [s0, s1] = proposal.sides;
  const f0 = franchises.find((f) => f.id === s0.franchiseId)!;
  const f1 = franchises.find((f) => f.id === s1.franchiseId)!;
  const give0 = f0.players.filter((p) => s0.playerIds.includes(p.id));
  const give1 = f1.players.filter((p) => s1.playerIds.includes(p.id));
  return [
    [...f0.players.filter((p) => !s0.playerIds.includes(p.id)), ...give1],
    [...f1.players.filter((p) => !s1.playerIds.includes(p.id)), ...give0],
  ];
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------

export function validateTrade(
  proposal: TradeProposal,
  ctx: TradeContext,
  opts: { ignoreWindow?: boolean } = {}
): TradeValidation {
  const issues: TradeValidationIssue[] = [];
  const rules = ctx.trade.rules;
  const [s0, s1] = proposal.sides;
  const f0 = ctx.franchises.find((f) => f.id === s0.franchiseId);
  const f1 = ctx.franchises.find((f) => f.id === s1.franchiseId);
  const financials = computeFinancials(proposal, ctx);
  const emptySnap = { size: 0, overseas: 0, bestXiOvr: 0, strength: 0 };

  if (!f0 || !f1) {
    issues.push({ code: 'FRANCHISE_INELIGIBLE', message: 'Both franchises must exist.' });
    return { valid: false, issues, financials, before: [emptySnap, emptySnap], after: [emptySnap, emptySnap] };
  }
  if (f0.id === f1.id) issues.push({ code: 'SAME_FRANCHISE', message: 'A franchise cannot trade with itself.' });

  if (!opts.ignoreWindow) {
    const w = isWindowOpen(ctx);
    if (!w.open) issues.push({ code: 'WINDOW_CLOSED', message: w.reason });
  }

  if (s0.playerIds.length === 0 || s1.playerIds.length === 0) {
    issues.push({ code: 'EMPTY_SIDE', message: 'Each side must send at least one player (no cash-only deals).' });
  }
  for (const s of proposal.sides) {
    if (s.playerIds.length > rules.maxPlayersPerSide) {
      issues.push({ code: 'TOO_MANY_PLAYERS', message: `At most ${rules.maxPlayersPerSide} players per side.`, franchiseId: s.franchiseId });
    }
    if ((s.cashLakhs || 0) < 0) issues.push({ code: 'CASH_LIMIT', message: 'Cash payments cannot be negative.', franchiseId: s.franchiseId });
  }
  if (s0.playerIds.length + s1.playerIds.length > rules.maxPlayersTotal) {
    issues.push({ code: 'TOO_MANY_PLAYERS', message: `At most ${rules.maxPlayersTotal} players in one trade.` });
  }

  // Ownership, duplicates, locks, contracts, consent
  const all = [...s0.playerIds, ...s1.playerIds];
  if (new Set(all).size !== all.length) issues.push({ code: 'DUPLICATE_PLAYER', message: 'A player appears more than once in this trade.' });
  const locked = new Set(
    ctx.trade.proposals.filter((p) => p.id !== proposal.id && p.status === 'ACCEPTED').flatMap((p) => p.sides.flatMap((s) => s.playerIds))
  );
  for (const [side, f] of [[s0, f0], [s1, f1]] as const) {
    for (const id of side.playerIds) {
      const owners = findOwner(id, ctx.franchises);
      const p = f.players.find((x) => x.id === id);
      if (!p || owners.length !== 1 || owners[0].id !== f.id) {
        issues.push({ code: 'NOT_ON_ROSTER', message: `Player is not on the ${f.shortName} roster.`, franchiseId: f.id, playerId: id });
        continue;
      }
      if (locked.has(id)) {
        issues.push({ code: 'PLAYER_LOCKED', message: `${p.name} is already part of an agreed trade awaiting completion.`, playerId: id });
      }
      const c = ctx.contracts[id];
      if (c && c.franchiseId === f.id && (c.status === 'Retired' || c.status === 'Released')) {
        issues.push({ code: 'CONTRACT_INELIGIBLE', message: `${p.name}'s contract is not active.`, playerId: id });
      } else if (c && c.franchiseId === f.id && c.status === 'Expiring' && ctx.auctionComplete) {
        issues.push({ code: 'CONTRACT_INELIGIBLE', message: `${p.name}'s contract is expiring — he heads to the auction.`, playerId: id });
      }
      const times = ctx.trade.tradedThisSeason[id] || 0;
      if (times >= rules.maxTradesPerPlayerPerSeason) {
        issues.push({
          code: 'CONSENT_DENIED',
          message: rules.requirePlayerConsent
            ? `${p.name} has not consented to another move this season.`
            : `${p.name} has reached the trade limit for this season.`,
          playerId: id,
        });
      }
    }
  }

  // Renegotiated fees stay within a band of the current salary.
  for (const [side, f] of [[s0, f0], [s1, f1]] as const) {
    for (const id of side.playerIds) {
      const fee = proposal.fees?.[id];
      const p = f.players.find((x) => x.id === id);
      if (fee === undefined || !p) continue;
      const [lo, hi] = feeBounds(contractSalary(p, f.id, ctx));
      if (fee < lo || fee > hi) {
        issues.push({ code: 'FEE_OUT_OF_RANGE', message: `${p.name}'s new fee must be between ${formatPrice(lo)} and ${formatPrice(hi)}.`, playerId: id });
      }
    }
  }

  // Salary matching (on the fees each side actually takes on)
  const [out1, out0] = financials.incomingSalary;
  const diff = financials.salaryDifference;
  const netCash = financials.netCashToSide1;
  if (rules.matchingMode === 'Exact' && diff !== 0) {
    issues.push({ code: 'SALARY_MISMATCH', message: `Exact match requires equal contracts (gap ${formatPrice(Math.abs(diff))}).` });
  } else if (rules.matchingMode === 'Tolerance' && Math.abs(diff) > tolerance(rules, out0, out1)) {
    issues.push({ code: 'SALARY_MISMATCH', message: `Contract gap ${formatPrice(Math.abs(diff))} exceeds the ${formatPrice(Math.round(tolerance(rules, out0, out1)))} tolerance.` });
  } else if (rules.matchingMode === 'CashBalanced' && Math.abs(diff - netCash) > tolerance(rules, out0, out1)) {
    const fixable = Math.abs(diff) - rules.maxCashPerTradeLakhs <= tolerance(rules, out0, out1);
    if (!fixable) {
      issues.push({
        code: 'SALARY_MISMATCH',
        message: `Contract gap of ${formatPrice(Math.abs(diff))} is more than the ${formatPrice(rules.maxCashPerTradeLakhs)} cash limit can balance — add or swap players to even out salaries.`,
      });
    } else issues.push({
      code: 'SALARY_MISMATCH',
      message: `Contract gap of ${formatPrice(Math.abs(diff))} is not balanced — use Auto-balance (${formatPrice(Math.abs(financials.suggestedCashToSide1))} ${financials.suggestedCashToSide1 >= 0 ? `from ${f0.shortName}` : `from ${f1.shortName}`}).`,
    });
  }

  // Cash limits & funds
  if (Math.abs(netCash) > rules.maxCashPerTradeLakhs || s0.cashLakhs > rules.maxCashPerTradeLakhs || s1.cashLakhs > rules.maxCashPerTradeLakhs) {
    issues.push({ code: 'CASH_LIMIT', message: `Cash in a single trade is capped at ${formatPrice(rules.maxCashPerTradeLakhs)}.` });
  }
  const payer = netCash > 0 ? 0 : netCash < 0 ? 1 : -1;
  if (payer !== -1) {
    const pf = payer === 0 ? f0 : f1;
    const available = rules.cashSource === 'AuctionPurse' ? pf.remainingPurse : ctx.trade.settlement[pf.id] ?? 0;
    if (Math.abs(netCash) > available) {
      issues.push({
        code: 'INSUFFICIENT_CASH',
        message: `${pf.shortName} only has ${formatPrice(Math.max(0, available))} in its ${rules.cashSource === 'AuctionPurse' ? 'purse' : 'trade cash account'}.`,
        franchiseId: pf.id,
      });
    }
  }

  // Cap room: cash received never rescues a cap violation.
  const [after0, after1] = rostersAfter(proposal, ctx.franchises);
  const needReserve = !ctx.auctionComplete || PRE_AUCTION.includes(ctx.phase);
  for (const [i, f, roster] of [[0, f0, after0], [1, f1, after1]] as const) {
    const cashIn = rules.cashSource === 'AuctionPurse' ? Math.max(0, i === 0 ? -netCash : netCash) : 0;
    const capRoom = financials.purseAfter[i] - cashIn;
    const reserve = needReserve ? Math.max(0, f.minSquadSize - roster.length) * 20 : 0;
    if (capRoom < reserve) {
      issues.push({
        code: 'PURSE_EXCEEDED',
        message:
          reserve > 0
            ? `${f.shortName} would have ${formatPrice(Math.max(0, capRoom))} left but must keep ${formatPrice(reserve)} to fill its squad.`
            : `${f.shortName} would exceed its salary cap by ${formatPrice(-capRoom)}.`,
        franchiseId: f.id,
      });
    }
    if (roster.length > f.maxSquadSize) {
      issues.push({ code: 'SQUAD_MAX', message: `${f.shortName} would have ${roster.length} players (max ${f.maxSquadSize}).`, franchiseId: f.id });
    }
    if (enforcesSquadMinimum(ctx) && roster.length < f.minSquadSize) {
      issues.push({ code: 'SQUAD_MIN', message: `${f.shortName} would drop to ${roster.length} players (min ${f.minSquadSize}).`, franchiseId: f.id });
    }
    const os = roster.filter((p) => p.nationality === 'Overseas').length;
    if (os > f.maxOverseas) {
      issues.push({ code: 'OVERSEAS_MAX', message: `${f.shortName} would have ${os} overseas players (max ${f.maxOverseas}).`, franchiseId: f.id });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    financials,
    before: [squadSnapshot(f0.players, f0.id, ctx.difficulty), squadSnapshot(f1.players, f1.id, ctx.difficulty)],
    after: [squadSnapshot(after0, f0.id, ctx.difficulty), squadSnapshot(after1, f1.id, ctx.difficulty)],
  };
}

/** Set cash so the proposal satisfies the matching rule (CashBalanced), within limits. */
export function autoBalance(proposal: TradeProposal, ctx: TradeContext): TradeProposal {
  const fin = computeFinancials({ ...proposal, sides: [{ ...proposal.sides[0], cashLakhs: 0 }, { ...proposal.sides[1], cashLakhs: 0 }] }, ctx);
  const cash = fin.suggestedCashToSide1;
  return {
    ...proposal,
    sides: [
      { ...proposal.sides[0], cashLakhs: cash > 0 ? cash : 0 },
      { ...proposal.sides[1], cashLakhs: cash < 0 ? -cash : 0 },
    ],
  };
}

let proposalCounter = 0;
export function newProposalId(prefix = 'trd'): string {
  proposalCounter = (proposalCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${proposalCounter.toString(36)}`;
}

export function makeProposal(
  ctx: TradeContext,
  fromId: string,
  toId: string,
  give: string[],
  get: string[],
  initiatedBy: 'human' | 'cpu',
  cash: [number, number] = [0, 0]
): TradeProposal {
  return {
    id: newProposalId(),
    sides: [
      { franchiseId: fromId, playerIds: give, cashLakhs: cash[0] },
      { franchiseId: toId, playerIds: get, cashLakhs: cash[1] },
    ],
    status: 'DRAFT',
    initiatedBy,
    createdTick: ctx.trade.tick,
    updatedTick: ctx.trade.tick,
    season: ctx.season,
    messages: [],
  };
}
