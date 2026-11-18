// ============================================================
// IPL DYNASTY - CPU Trade Intelligence
//
// Trade Utility = Team value after − Team value before − transaction &
// opportunity costs, computed from each franchise's own perspective.
// Difficulty changes planning sophistication only (never legality):
//   Easy    basic OVR valuations, lenient threshold
//   Normal  role/contract-aware values
//   Hard    + future value, replacement cost, core protection
//   Expert  + Monte Carlo outcome simulation & risk aversion,
//           strict protection of franchise cornerstones
// ============================================================

import type { CPUDifficulty, Franchise, Player } from '@/lib/types/game';
import type { CpuTradeEvaluation, InterestBand, TeamDirection, TradeBlockStatus, TradeProposal } from '@/lib/types/trade';
import { createSeededRandom } from '@/lib/utils/random';
import { formatPrice } from '@/lib/utils';
import {
  autoBalance,
  contractSalary,
  feeBounds,
  makeProposal,
  tradeFee,
  rostersAfter,
  validateTrade,
  type TradeContext,
} from './trade-rules';
import { FRANCHISE_STRATEGY_PROFILES } from '@/lib/engines/cpu-gm/opponent-model';
import { COVERAGE_LABEL, generalTradeValue, roleCoverage, selectBestXi, teamStrength, teamTradeValue } from './trade-value';

// ------------------------------------------------------------
// Team direction: contenders buy now, rebuilders sell veterans and buy upside.
// ------------------------------------------------------------

const directionCache = new WeakMap<Franchise[], Map<string, TeamDirection>>();

function xiProfile(fr: Franchise) {
  const xi = selectBestXi(fr.players, (p) => p.ratings.overall);
  const n = Math.max(1, xi.length);
  return { ovr: xi.reduce((s, p) => s + p.ratings.overall, 0) / n, age: xi.reduce((s, p) => s + p.age, 0) / n };
}

/** League-relative plan for a franchise, from its best-XI quality and age. */
export function teamDirection(fr: Franchise, ctx: Pick<TradeContext, 'franchises'>): TeamDirection {
  let cache = directionCache.get(ctx.franchises);
  if (!cache) {
    cache = new Map();
    const profiles = ctx.franchises.map((f) => ({ id: f.id, ...xiProfile(f) }));
    const sorted = [...profiles].sort((a, b) => b.ovr - a.ovr);
    profiles.forEach((pr) => {
      const rank = sorted.findIndex((x) => x.id === pr.id);
      const dir: TeamDirection = rank < 3 ? 'Contending' : rank >= sorted.length - 3 && pr.age >= 28 ? 'Rebuilding' : rank >= sorted.length - 2 ? 'Rebuilding' : 'Balanced';
      cache!.set(pr.id, dir);
    });
    directionCache.set(ctx.franchises, cache);
  }
  return cache.get(fr.id) ?? 'Balanced';
}

export const DIRECTION_BLURB: Record<TeamDirection, string> = {
  Contending: 'Win-now: will pay for proven players, protective of its XI.',
  Balanced: 'Open to fair deals that fix a weakness.',
  Rebuilding: 'Selling veterans and expensive contracts, buying youth and value.',
};

const requestedBy = (ctx: TradeContext, playerId: string, franchiseId: string) => ctx.trade.tradeRequests?.[playerId]?.franchiseId === franchiseId;

/** 1 utility point ≈ ₹1 Cr of value. Strength deltas are scaled into the same unit. */
const STRENGTH_TO_POINTS = 10;

const THRESHOLD: Record<CPUDifficulty, number> = { Easy: -1.5, Normal: 0.5, Hard: 1.5, Expert: 2.5 };
const CORE_PENALTY: Record<CPUDifficulty, number> = { Easy: 3, Normal: 4, Hard: 5, Expert: 7 };
const COUNTER_BAND = 14;

const ROLE_WORDS: Record<string, string> = {
  Batter: 'batter',
  Bowler: 'bowler',
  'All-Rounder': 'all-rounder',
  Wicketkeeper: 'wicketkeeper',
};

function describe(p: Player): string {
  if (p.isDeathBowler && p.role !== 'Batter') return 'death bowler';
  if (p.isSpinner && p.role !== 'Batter') return 'frontline spinner';
  if (p.role === 'Bowler') return 'strike bowler';
  if (p.isOpener) return 'opening batter';
  if (p.role === 'Batter') return 'primary run scorer';
  return ROLE_WORDS[p.role] || 'player';
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function interestBand(prob: number): InterestBand {
  if (prob < 0.08) return 'None';
  if (prob < 0.3) return 'Low';
  if (prob < 0.55) return 'Moderate';
  if (prob < 0.8) return 'Strong';
  return 'Very Strong';
}

function hashProposal(p: TradeProposal): number {
  const s = p.sides.map((x) => `${x.franchiseId}:${[...x.playerIds].sort().join(',')}:${x.cashLakhs}`).join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface UtilityBreakdown {
  utility: number;
  strengthGain: number;
  salaryCost: number;
  cashValue: number;
  transactionCost: number;
  corePenalty: number;
  /** Contract value gained (+) or lost (−) vs rating-based fair value. */
  valueForMoney: number;
  direction: TeamDirection;
  /** Set when the best outgoing player is worth far more than anything coming back. */
  undervalued?: Player;
  coreOutgoing: Player[];
  incomingInXi: number;
  coverageLost: string[];
  coverageGained: string[];
  riskStd: number;
}

/** Utility of a proposal for one franchise (side index 0 or 1). */
export function tradeUtility(proposal: TradeProposal, ctx: TradeContext, sideIdx: 0 | 1, difficulty: CPUDifficulty): UtilityBreakdown {
  const me = proposal.sides[sideIdx];
  const other = proposal.sides[sideIdx === 0 ? 1 : 0];
  const fr = ctx.franchises.find((f) => f.id === me.franchiseId)!;
  const otherFr = ctx.franchises.find((f) => f.id === other.franchiseId)!;
  const after = rostersAfter(proposal, ctx.franchises)[sideIdx];

  const valueCache = new Map<string, number>();
  const valueOf = (p: Player) => {
    let v = valueCache.get(p.id);
    if (v === undefined) {
      const mine = fr.players.some((x) => x.id === p.id);
      // Incoming players are judged at the fee this franchise would actually pay.
      v = teamTradeValue(p, fr.id, difficulty, mine ? contractSalary(p, fr.id, ctx) : tradeFee(proposal, p, otherFr.id, ctx));
      valueCache.set(p.id, v);
    }
    return v;
  };

  const before = teamStrength(fr.players, fr.id, difficulty, valueOf);
  const afterS = teamStrength(after, fr.id, difficulty, valueOf);
  let strengthGain = (afterS.strength - before.strength) * STRENGTH_TO_POINTS;

  const outgoing = fr.players.filter((p) => me.playerIds.includes(p.id));
  const incoming = otherFr.players.filter((p) => other.playerIds.includes(p.id));

  // Expert: Monte Carlo over projection uncertainty of the players that move.
  let riskStd = 0;
  if (difficulty === 'Expert') {
    const rng = createSeededRandom(hashProposal(proposal) ^ (sideIdx + 1));
    const moving = [...outgoing, ...incoming];
    const sd = new Map(moving.map((p) => [p.id, Math.max(2, 10 - (p.ratingConfidence ?? 0.6) * 8)]));
    const samples: number[] = [];
    for (let i = 0; i < 24; i++) {
      const noise = new Map(moving.map((p) => {
        const u = Math.max(1e-6, rng.next());
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
        return [p.id, z * (sd.get(p.id) || 4)];
      }));
      const vo = (p: Player) => valueOf(p) + (noise.get(p.id) || 0);
      samples.push((teamStrength(after, fr.id, difficulty, vo).strength - teamStrength(fr.players, fr.id, difficulty, vo).strength) * STRENGTH_TO_POINTS);
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    riskStd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
    strengthGain = mean - 0.35 * riskStd;
  }

  const outSal = outgoing.reduce((s, p) => s + contractSalary(p, fr.id, ctx), 0);
  const inSal = incoming.reduce((s, p) => s + tradeFee(proposal, p, otherFr.id, ctx), 0);
  const direction = teamDirection(fr, ctx);
  const discipline = 0.5 + (FRANCHISE_STRATEGY_PROFILES[fr.id]?.priceDiscipline ?? 0.5);
  const deltaCr = (inSal - outSal) / 100;
  // Taking on salary costs cap room; shedding it helps, but less (you must replace the player).
  let salaryCost = difficulty === 'Easy' ? 0 : deltaCr >= 0 ? deltaCr * 0.45 * discipline : Math.max(-2.5, deltaCr * 0.2 * discipline);
  if (direction === 'Contending' && salaryCost > 0) salaryCost *= 0.7; // contenders will pay for a win-now piece
  if (direction === 'Rebuilding' && salaryCost < 0) salaryCost *= 1.5; // rebuilders prize cap relief
  // Trade cash cannot be spent at the auction (separate settlement account), so it is
  // worth less than a crore of playing value and can never buy a star on its own.
  const netCashCr = ((other.cashLakhs || 0) - (me.cashLakhs || 0)) / 100;
  const cashValue = netCashCr >= 0 ? Math.min(3, netCashCr * 0.4) : netCashCr * 0.6;
  const transactionCost = 0.4 * (outgoing.length + incoming.length);

  // Cornerstones: the franchise's top 3 by its own valuation.
  const core = [...fr.players].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 3);
  // A player who has asked to leave, or a veteran on a rebuilding side, is no longer
  // treated as untouchable — the franchise just wants fair value back.
  const requestedOut = outgoing.filter((p) => requestedBy(ctx, p.id, fr.id));
  const coreOutgoing = outgoing.filter(
    (p) => core.includes(p) && !requestedOut.includes(p) && !(direction === 'Rebuilding' && p.age >= 31)
  );
  // Contract-free market talent (used for cornerstone protection and the talent gap).
  const talent = (p: Player) => generalTradeValue(p, 0).value;
  const bestInTalent = incoming.length ? Math.max(...incoming.map(talent)) : 0;
  // A cornerstone on a contract well above his market value is protected less —
  // franchises do move an expensive captain for better value (the Pant ↔ Kuldeep case).
  const overpaid = (p: Player) => {
    const sal = contractSalary(p, fr.id, ctx);
    return sal > 1.3 * generalTradeValue(p, sal).fairValueLakhs;
  };
  // ...and getting an equal or better player back is not "losing" a cornerstone.
  let corePenalty = coreOutgoing
    .filter((p) => talent(p) > bestInTalent + 2)
    .reduce((t, p) => t + CORE_PENALTY[difficulty] * (overpaid(p) ? 0.5 : 1), 0);
  if (difficulty === 'Hard' || difficulty === 'Expert') {
    // Replacement cost: losing your best at a role with nobody close behind.
    for (const p of outgoing) {
      const sameRole = after.filter((x) => x.role === p.role).map(valueOf).sort((a, b) => b - a)[0] ?? 40;
      corePenalty += Math.max(0, valueOf(p) - sameRole - 8) * 0.08;
    }
  }

  // Star premium: a cornerstone is only sold for comparable market value, however
  // well the return fits a role need.
  if (coreOutgoing.length) {
    const gvOf = (p: Player, owner: string) =>
      generalTradeValue(p, owner === fr.id ? contractSalary(p, owner, ctx) : tradeFee(proposal, p, owner, ctx)).value;
    const bestIn = incoming.length ? Math.max(...incoming.map((p) => gvOf(p, otherFr.id))) : 0;
    const premium: Record<CPUDifficulty, number> = { Easy: 0.3, Normal: 0.5, Hard: 0.7, Expert: 1 };
    for (const p of coreOutgoing) corePenalty += Math.max(0, gvOf(p, fr.id) - bestIn - 8) * premium[difficulty];
  }

  // Talent gap (contract-free market value): the best player leaving vs the best arriving.
  // A role fit can justify a small drop, but nobody sells far below market — e.g. an
  // overseas star benched only by the 4-overseas XI limit is still a tradeable asset.
  const talentGap = outgoing.length ? Math.max(...outgoing.map(talent)) - bestInTalent : 0;
  const talentPremium: Record<CPUDifficulty, number> = { Easy: 0.25, Normal: 0.8, Hard: 1.1, Expert: 1.3 };
  // Selling a player who wants out (or a rebuilding side's veteran) is a buyer's market.
  const motivatedSeller = requestedOut.length > 0 || (direction === 'Rebuilding' && outgoing.every((p) => p.age >= 31));
  if (talentGap > 8) corePenalty += (talentGap - 8) * talentPremium[difficulty] * (motivatedSeller ? 0.5 : 1);
  // Hard line: however desperate the squad need, a GM does not give up a player worth
  // far more than anything coming back (Easy GMs are allowed to be fleeced a little).
  const undervalued = talentGap > 8 ? [...outgoing].sort((a, b) => talent(b) - talent(a))[0] : undefined;
  if (talentGap > (difficulty === 'Easy' ? 18 : 12) + (motivatedSeller ? 6 : 0)) corePenalty += 25;

  const covB = before.coverage;
  const covA = afterS.coverage;
  const keys = Object.keys(covB) as (keyof typeof covB)[];
  const coverageLost = keys.filter((k) => covA[k] < covB[k] && covA[k] < 2).map((k) => COVERAGE_LABEL[k]);
  const coverageGained = keys.filter((k) => covA[k] > covB[k] && covB[k] < 2).map((k) => COVERAGE_LABEL[k]);
  const incomingInXi = incoming.filter((p) => afterS.xi.includes(p)).length;

  // Opportunity cost: a bench player is still a tradeable asset worth his market value.
  const gvSum = (ps: Player[], owner: string) =>
    ps.reduce((t, p) => t + generalTradeValue(p, owner === fr.id ? contractSalary(p, owner, ctx) : tradeFee(proposal, p, owner, ctx)).value, 0);
  const assetWeight: Record<CPUDifficulty, number> = { Easy: 0.1, Normal: 0.18, Hard: 0.25, Expert: 0.3 };
  const assetDelta = (gvSum(incoming, otherFr.id) - gvSum(outgoing, fr.id)) * assetWeight[difficulty];
  strengthGain += Math.min(assetDelta, 2);

  // Value for money: shedding an overpaid contract or landing an underpaid one is real
  // value (Pant at ₹27 Cr vs Kuldeep at ₹13.25 Cr). Measured against rating-based fair value.
  const surplus = (p: Player, salary: number) => (generalTradeValue(p, salary).fairValueLakhs - salary) / 100;
  const vfmWeight: Record<CPUDifficulty, number> = { Easy: 0, Normal: 0.12, Hard: 0.16, Expert: 0.18 };
  const vfmRaw =
    incoming.reduce((t, p) => t + surplus(p, tradeFee(proposal, p, otherFr.id, ctx)), 0) -
    outgoing.reduce((t, p) => t + surplus(p, contractSalary(p, fr.id, ctx)), 0);
  const valueForMoney = Math.max(-3, Math.min(3, vfmRaw * vfmWeight[difficulty] * (direction === 'Rebuilding' ? 1.4 : direction === 'Contending' ? 0.8 : 1)));

  // Rebuilders buy upside: young players' headroom is worth more to them.
  const upside = (ps: Player[]) => ps.filter((p) => p.age <= 25).reduce((t, p) => t + Math.max(0, p.ratings.potential - p.ratings.overall), 0);
  const youthTerm = direction === 'Rebuilding' && difficulty !== 'Easy' ? (upside(incoming) - upside(outgoing)) * 0.08 : 0;
  if (direction === 'Contending') strengthGain *= 1.1;

  // Money (cash, cap relief) can soften a weaker squad but never fully pay for lost talent.
  let financial = cashValue - salaryCost;
  // With comparable talent coming back, freed cap room can be reinvested, so it may
  // offset more of a short-term dip; otherwise money only softens half the loss.
  if (strengthGain < 0 && financial > 0) {
    financial = Math.min(financial, talentGap <= 4 ? 0.8 * -strengthGain + 1 : 0.5 * -strengthGain + 0.5);
  }
  // Cash and salary relief cannot buy talent: with a big talent gap they add nothing.
  if (talentGap > 8 && financial > 0) financial = Math.max(0, financial * (1 - (talentGap - 8) / 4));
  // Contract value is player value, not cash, so it is not capped like money —
  // but it never rescues a lopsided talent swap either.
  const vfm = talentGap > 8 ? Math.min(0, valueForMoney) : valueForMoney;
  const utility = strengthGain + financial + vfm + youthTerm - transactionCost - corePenalty;
  return { utility, strengthGain, salaryCost, cashValue, valueForMoney, direction, transactionCost, corePenalty, undervalued, coreOutgoing, incomingInXi, coverageLost, coverageGained, riskStd };
}

export function thresholdFor(ctx: TradeContext, franchiseId: string, difficulty: CPUDifficulty): number {
  const mem = ctx.trade.memory[franchiseId];
  return THRESHOLD[difficulty] + Math.min(3, (mem?.lowballs || 0) * 0.6);
}

/** Structured, valuation-derived reasons (never raw numbers). */
function reasonsFor(u: UtilityBreakdown, incoming: Player[], accepted: boolean): string[] {
  const r: string[] = [];
  if (u.coreOutgoing.length) {
    const p = u.coreOutgoing[0];
    r.push(`We are not willing to lose ${p.name}, our ${describe(p)}, for this package.`);
  } else if (!accepted && u.undervalued) {
    r.push(`${u.undervalued.name} is worth far more than anything in this package — cash will not close that gap.`);
  }
  if (u.coverageLost.length) r.push(`This would leave us thin on ${u.coverageLost.join(' and ')}.`);
  if (!accepted && u.valueForMoney <= -1) r.push('We would be taking on a contract above his market value — a lower fee could change our mind.');
  if (accepted && u.valueForMoney >= 1) r.push('The contract value works for us.');
  if (accepted && u.direction === 'Rebuilding') r.push('It fits our rebuild.');
  if (!accepted && incoming.length && u.incomingInXi === 0) {
    r.push(`The incoming player${incoming.length > 1 ? 's do' : ' does'} not break into our best XI.`);
  } else if (!accepted && u.strengthGain < 0) {
    r.push('Insufficient compensation — our squad gets weaker on paper.');
  }
  if (u.salaryCost > 1.5) r.push('Taking on that much extra salary is too expensive for us.');
  if (accepted) {
    if (u.coverageGained.length) r.push(`This strengthens our ${u.coverageGained.join(' and ')}.`);
    else if (u.incomingInXi) r.push('The incoming talent upgrades our starting XI.');
    else r.push('The deal improves our squad balance and finances.');
  }
  return r;
}

export function evaluateProposal(
  proposal: TradeProposal,
  ctx: TradeContext,
  opts: { cpuSide?: 0 | 1; allowCounter?: boolean; userIsHuman?: boolean } = {}
): CpuTradeEvaluation {
  const cpuSide = opts.cpuSide ?? 1;
  const cpuId = proposal.sides[cpuSide].franchiseId;
  const difficulty = ctx.difficulty;
  const threshold = thresholdFor(ctx, cpuId, difficulty);
  const validation = validateTrade(proposal, ctx);
  const u = tradeUtility(proposal, ctx, cpuSide, difficulty);
  const otherFr = ctx.franchises.find((f) => f.id === proposal.sides[cpuSide === 1 ? 0 : 1].franchiseId)!;
  const incoming = otherFr.players.filter((p) => proposal.sides[cpuSide === 1 ? 0 : 1].playerIds.includes(p.id));
  const prob = sigmoid((u.utility - threshold) / 1.6);

  const hardIssues = validation.issues.filter((i) => i.code !== 'SALARY_MISMATCH' && i.code !== 'INSUFFICIENT_CASH' && i.code !== 'CASH_LIMIT');
  if (hardIssues.length) {
    const own = hardIssues.find((i) => i.franchiseId === cpuId) || hardIssues[0];
    const msg =
      own.code === 'OVERSEAS_MAX' && u.utility >= threshold
        ? 'The offer is attractive, but it would exceed our overseas limit.'
        : own.message;
    return { decision: 'REJECT', acceptanceProbability: 0, interest: interestBand(u.utility >= threshold ? 0.5 : prob), reasons: [msg], utility: u.utility, threshold };
  }

  const financialIssue = validation.issues.find((i) => i.code === 'SALARY_MISMATCH' || i.code === 'INSUFFICIENT_CASH' || i.code === 'CASH_LIMIT');

  if (!financialIssue && u.utility >= threshold) {
    return { decision: 'ACCEPT', acceptanceProbability: prob, interest: interestBand(prob), reasons: reasonsFor(u, incoming, true), utility: u.utility, threshold };
  }

  if (opts.allowCounter !== false && u.utility >= threshold - COUNTER_BAND) {
    const counter = buildCounter(proposal, ctx, cpuSide);
    if (counter) {
      return {
        decision: 'COUNTER',
        acceptanceProbability: prob,
        interest: interestBand(Math.max(prob, 0.35)),
        reasons: [...(financialIssue ? ['The financial difference exceeds our permitted trade tolerance.'] : reasonsFor(u, incoming, false)), counter.messages[0]].filter(Boolean),
        counter,
        utility: u.utility,
        threshold,
      };
    }
  }

  const reasons = financialIssue ? ['The financial difference exceeds our permitted trade tolerance.', financialIssue.message] : reasonsFor(u, incoming, false);
  return { decision: 'REJECT', acceptanceProbability: financialIssue ? 0 : prob, interest: interestBand(prob), reasons: reasons.length ? reasons : ['This deal does not work for us.'], utility: u.utility, threshold };
}

// ------------------------------------------------------------
// Counteroffers
// ------------------------------------------------------------

function blockOf(ctx: TradeContext, playerId: string): TradeBlockStatus | undefined {
  return ctx.trade.humanBlock[playerId];
}

function balanced(p: TradeProposal, ctx: TradeContext): TradeProposal {
  return ctx.trade.rules.matchingMode === 'CashBalanced' ? autoBalance(p, ctx) : p;
}

/**
 * Search small edits to the proposal and return the one that clears the CPU's
 * threshold at the lowest cost to the other side. All candidates are fully
 * validated, so counters always respect the trading rules.
 */
export function buildCounter(proposal: TradeProposal, ctx: TradeContext, cpuSide: 0 | 1 = 1): TradeProposal | null {
  const userSide = cpuSide === 1 ? 0 : 1;
  const user = proposal.sides[userSide];
  const cpu = proposal.sides[cpuSide];
  const userFr = ctx.franchises.find((f) => f.id === user.franchiseId)!;
  const cpuFr = ctx.franchises.find((f) => f.id === cpu.franchiseId)!;
  const rules = ctx.trade.rules;
  const threshold = thresholdFor(ctx, cpuFr.id, ctx.difficulty);
  const gv = (p: Player, fid: string) => generalTradeValue(p, contractSalary(p, fid, ctx)).value;
  const userCost = (p: TradeProposal) => {
    const give = userFr.players.filter((x) => p.sides[userSide].playerIds.includes(x.id)).reduce((s, x) => s + gv(x, userFr.id), 0);
    const get = cpuFr.players.filter((x) => p.sides[cpuSide].playerIds.includes(x.id)).reduce((s, x) => s + gv(x, cpuFr.id), 0);
    // A fee cut costs the user a little goodwill (the player has to accept a pay cut).
    const feeCut = p.sides[userSide].playerIds.reduce((t, id) => {
      const x = userFr.players.find((y) => y.id === id);
      const fee = p.fees?.[id];
      return x && fee !== undefined ? t + Math.max(0, contractSalary(x, userFr.id, ctx) - fee) / 100 : t;
    }, 0);
    return give - get + (p.sides[userSide].cashLakhs - p.sides[cpuSide].cashLakhs) / 100 + feeCut * 0.25;
  };
  const withSides = (u: typeof user, c: typeof cpu): TradeProposal => {
    const sides = cpuSide === 1 ? [u, c] : [c, u];
    return { ...proposal, sides: sides as TradeProposal['sides'] };
  };

  type Cand = { p: TradeProposal; msg: string };
  const cands: Cand[] = [];
  const cpuValue = (p: Player) => teamTradeValue(p, cpuFr.id, ctx.difficulty, contractSalary(p, userFr.id, ctx));

  // 1. Ask for an additional player from the user (not untouchable).
  if (user.playerIds.length < rules.maxPlayersPerSide && user.playerIds.length + cpu.playerIds.length < rules.maxPlayersTotal) {
    userFr.players
      .filter((p) => !user.playerIds.includes(p.id) && blockOf(ctx, p.id) !== 'Untouchable')
      .sort((a, b) => cpuValue(b) - cpuValue(a))
      .slice(0, 10)
      .forEach((p) => cands.push({ p: balanced(withSides({ ...user, playerIds: [...user.playerIds, p.id] }, cpu), ctx), msg: `Add ${p.name} and we have a deal.` }));
  }
  // 2. Upgrade one of the user's offered players.
  for (const out of user.playerIds) {
    const outP = userFr.players.find((x) => x.id === out);
    if (!outP) continue;
    userFr.players
      .filter((p) => !user.playerIds.includes(p.id) && blockOf(ctx, p.id) !== 'Untouchable' && cpuValue(p) > cpuValue(outP))
      .sort((a, b) => cpuValue(a) - cpuValue(b))
      .slice(0, 6)
      .forEach((p) =>
        cands.push({
          p: balanced(withSides({ ...user, playerIds: user.playerIds.map((id) => (id === out ? p.id : id)) }, cpu), ctx),
          msg: `Replace ${outP.name} with ${p.name} and we can move forward.`,
        })
      );
  }
  // 3. Offer a different (lower-value) player instead of one requested.
  for (const req of cpu.playerIds) {
    const reqP = cpuFr.players.find((x) => x.id === req);
    if (!reqP) continue;
    cpuFr.players
      .filter((p) => !cpu.playerIds.includes(p.id) && p.role === reqP.role && p.ratings.overall < reqP.ratings.overall)
      .sort((a, b) => b.ratings.overall - a.ratings.overall)
      .slice(0, 4)
      .forEach((p) =>
        cands.push({
          p: balanced(withSides(user, { ...cpu, playerIds: cpu.playerIds.map((id) => (id === req ? p.id : id)) }), ctx),
          msg: `We'd rather keep ${reqP.name}. We can offer ${p.name} instead.`,
        })
      );
  }
  // 4. Drop one requested player from a multi-player ask.
  if (cpu.playerIds.length > 1) {
    for (const req of cpu.playerIds) {
      const reqP = cpuFr.players.find((x) => x.id === req);
      cands.push({ p: balanced(withSides(user, { ...cpu, playerIds: cpu.playerIds.filter((id) => id !== req) }), ctx), msg: `We keep ${reqP?.name}; the rest of the deal works.` });
    }
  }
  // 5. Request a cash adjustment.
  const base = tradeUtility(proposal, ctx, cpuSide, ctx.difficulty).utility;
  const gap = threshold - base;
  if (gap > 0 && rules.matchingMode !== 'Exact') {
    const need = Math.ceil((gap + 0.3) * 100 / 25) * 25;
    const cash = Math.min(rules.maxCashPerTradeLakhs, need + user.cashLakhs);
    if (cash > user.cashLakhs) {
      cands.push({ p: withSides({ ...user, cashLakhs: cash }, { ...cpu, cashLakhs: 0 }), msg: `We need ${formatPrice(cash)} in trade cash to make this work.` });
    }
  }

  // 6. Renegotiate the fee of a player the CPU would take on (the Pant scenario:
  //    "we'll take him, but not at ₹27 Cr").
  for (const id of user.playerIds) {
    const p = userFr.players.find((x) => x.id === id);
    if (!p) continue;
    const cur = contractSalary(p, userFr.id, ctx);
    const [lo] = feeBounds(cur);
    for (const pct of [0.85, 0.7, 0.55]) {
      const fee = Math.max(lo, Math.round((cur * pct) / 5) * 5);
      if (fee >= cur || fee === proposal.fees?.[id]) continue;
      const fees = { ...(proposal.fees || {}), [id]: fee };
      cands.push({ p: balanced({ ...withSides(user, cpu), fees }, ctx), msg: `We'll take ${p.name}, but at a fee of ${formatPrice(fee)} rather than ${formatPrice(cur)}.` });
    }
  }

  let best: { p: TradeProposal; msg: string; cost: number } | null = null;
  for (const c of cands) {
    const v = validateTrade(c.p, ctx);
    if (!v.valid) continue;
    const u = tradeUtility(c.p, ctx, cpuSide, ctx.difficulty).utility;
    if (u < threshold) continue;
    const cost = userCost(c.p);
    if (!best || cost < best.cost) best = { ...c, cost };
  }
  if (!best) return null;
  return {
    ...best.p,
    id: `${proposal.id}-c${ctx.trade.tick}`,
    parentId: proposal.id,
    status: 'COUNTEROFFERED',
    initiatedBy: 'cpu',
    updatedTick: ctx.trade.tick,
    messages: [best.msg],
  };
}

// ------------------------------------------------------------
// Trade blocks
// ------------------------------------------------------------

export interface CpuBlockEntry {
  player: Player;
  reason: string;
}

/** Players a CPU franchise would move: surplus, ageing, overpaid or outside its XI. */
export function cpuTradeBlock(fr: Franchise, ctx: TradeContext): CpuBlockEntry[] {
  const valueOf = (p: Player) => teamTradeValue(p, fr.id, ctx.difficulty, contractSalary(p, fr.id, ctx));
  const s = teamStrength(fr.players, fr.id, ctx.difficulty, valueOf);
  const cov = s.coverage;
  const out: CpuBlockEntry[] = [];
  // Cornerstones (top 3 by the franchise's own valuation) are never shopped.
  const core = new Set([...fr.players].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 3).map((p) => p.id));
  // Players who asked to leave are shopped first — even stars.
  for (const p of fr.players) {
    const req = ctx.trade.tradeRequests?.[p.id];
    if (req && req.franchiseId === fr.id) out.push({ player: p, reason: `Trade request — ${req.reason.replace(/\.$/, '').toLowerCase()}` });
  }
  const dir = teamDirection(fr, ctx);
  for (const p of fr.players) {
    if (core.has(p.id) || out.some((o) => o.player.id === p.id)) continue;
    if (dir === 'Rebuilding' && p.age >= 31 && p.ratings.overall >= 80) {
      out.push({ player: p, reason: 'Rebuilding — open to moving a veteran' });
      continue;
    }
    const g = generalTradeValue(p, contractSalary(p, fr.id, ctx));
    const inXi = s.xi.includes(p);
    const sal = contractSalary(p, fr.id, ctx);
    if (!inXi && p.role === 'Wicketkeeper' && cov.wk > 2) out.push({ player: p, reason: 'Surplus wicketkeeper' });
    else if (!inXi && p.isSpinner && cov.spin > 3) out.push({ player: p, reason: 'Surplus spin option' });
    else if (!inXi && !p.isSpinner && p.role === 'Bowler' && cov.pace > 5) out.push({ player: p, reason: 'Surplus seamer' });
    else if (p.age >= 34 && g.future < p.ratings.overall - 3) out.push({ player: p, reason: 'Ageing — rebuilding around youth' });
    else if (!inXi && sal > g.fairValueLakhs * 1.6 && sal >= 300) out.push({ player: p, reason: 'Contract above market value' });
    else if (!inXi && p.role === 'Batter' && fr.players.filter((x) => x.role === 'Batter').length > 7) out.push({ player: p, reason: 'Surplus batter' });
  }
  return out;
}

// ------------------------------------------------------------
// Trade Finder (beam search)
// ------------------------------------------------------------

export interface FinderFilters {
  franchiseId?: string;
  role?: Player['role'];
  maxAge?: number;
  minOverall?: number;
  maxSalaryLakhs?: number;
  /** Minimum acceptance probability (Easy ≥ .25, Normal ≥ .4, Hard ≥ .6). */
  minProbability?: number;
}

export interface FinderResult {
  proposal: TradeProposal;
  partnerId: string;
  probability: number;
  interest: InterestBand;
  userGain: number;
  summary: string;
}

export function findTrades(ctx: TradeContext, offeredIds: string[], filters: FinderFilters = {}, limit = 10): FinderResult[] {
  const me = ctx.franchises.find((f) => f.id === ctx.humanFranchiseId)!;
  const offered = me.players.filter((p) => offeredIds.includes(p.id));
  if (!offered.length) return [];
  const rules = ctx.trade.rules;
  const minProb = filters.minProbability ?? 0.35;
  const results: FinderResult[] = [];
  const BEAM = 6;

  const score = (p: TradeProposal) => {
    const v = validateTrade(p, ctx);
    if (!v.valid) return null;
    const cpu = tradeUtility(p, ctx, 1, ctx.difficulty);
    const thr = thresholdFor(ctx, p.sides[1].franchiseId, ctx.difficulty);
    const prob = sigmoid((cpu.utility - thr) / 1.6);
    const userGain = tradeUtility(p, ctx, 0, 'Hard').strengthGain;
    return { prob, userGain, rank: userGain * prob + prob * 2 };
  };

  for (const fr of ctx.franchises) {
    if (fr.id === me.id || (filters.franchiseId && fr.id !== filters.franchiseId)) continue;
    const pool = fr.players.filter(
      (p) =>
        (!filters.role || p.role === filters.role) &&
        (!filters.maxAge || p.age <= filters.maxAge) &&
        (!filters.minOverall || p.ratings.overall >= filters.minOverall) &&
        (!filters.maxSalaryLakhs || contractSalary(p, fr.id, ctx) <= filters.maxSalaryLakhs)
    );
    // Prune: only players that would make the user's side better at a plausible price.
    const myValue = (p: Player) => teamTradeValue(p, me.id, 'Hard', contractSalary(p, fr.id, ctx));
    const candidates = pool.sort((a, b) => myValue(b) - myValue(a)).slice(0, 14);

    let beam: { ids: string[]; s: { prob: number; userGain: number; rank: number } }[] = [];
    for (const c of candidates) {
      const prop = balanced(makeProposal(ctx, me.id, fr.id, offeredIds, [c.id], 'human'), ctx);
      const s = score(prop);
      if (s) beam.push({ ids: [c.id], s });
    }
    beam.sort((a, b) => b.s.rank - a.s.rank);
    beam = beam.slice(0, BEAM);

    if (rules.maxPlayersPerSide > 1 && offeredIds.length + 2 <= rules.maxPlayersTotal) {
      const expanded: typeof beam = [];
      for (const b of beam) {
        for (const c of candidates.slice(0, 8)) {
          if (b.ids.includes(c.id)) continue;
          const ids = [...b.ids, c.id];
          const prop = balanced(makeProposal(ctx, me.id, fr.id, offeredIds, ids, 'human'), ctx);
          const s = score(prop);
          if (s && s.rank > b.s.rank) expanded.push({ ids, s });
        }
      }
      beam = [...beam, ...expanded].sort((a, b) => b.s.rank - a.s.rank).slice(0, BEAM);
    }

    beam
      .filter((b) => b.s.prob >= minProb && b.s.userGain > -0.5)
      .slice(0, 2)
      .forEach((b) => {
        const prop = balanced(makeProposal(ctx, me.id, fr.id, offeredIds, b.ids, 'human'), ctx);
        const names = fr.players.filter((p) => b.ids.includes(p.id)).map((p) => p.name).join(' + ');
        results.push({ proposal: prop, partnerId: fr.id, probability: b.s.prob, interest: interestBand(b.s.prob), userGain: b.s.userGain, summary: `${fr.shortName}: ${names}` });
      });
  }
  return results.sort((a, b) => b.userGain * b.probability - a.userGain * a.probability).slice(0, limit);
}

// ------------------------------------------------------------
// CPU-initiated offers (to the user) and CPU ↔ CPU deals
// ------------------------------------------------------------

/** The coverage area a franchise most needs, if any. */
export function biggestNeed(fr: Franchise): keyof ReturnType<typeof roleCoverage> | null {
  const cov = roleCoverage(fr.players);
  const target = { wk: 2, pace: 4, spin: 2, openers: 2, death: 2 };
  let worst: keyof typeof cov | null = null;
  let gap = 0;
  (Object.keys(target) as (keyof typeof cov)[]).forEach((k) => {
    const g = target[k] - cov[k];
    if (g > gap) {
      gap = g;
      worst = k;
    }
  });
  return worst;
}

const fills: Record<string, (p: Player) => boolean> = {
  wk: (p) => p.role === 'Wicketkeeper' || p.secondaryRole === 'Wicketkeeper',
  pace: (p) => !p.isSpinner && (p.role === 'Bowler' || p.role === 'All-Rounder') && p.bowlingStyle !== 'None',
  spin: (p) => p.isSpinner && (p.role === 'Bowler' || p.role === 'All-Rounder'),
  openers: (p) => p.isOpener,
  death: (p) => p.isDeathBowler,
};

// ------------------------------------------------------------
// Complementary needs: one-player marginal strength
// ------------------------------------------------------------

interface Marginals {
  /** Strength (utility points) the franchise loses if this player leaves. */
  loss: Map<string, number>;
  /** Strength (utility points) gained by adding an outside player (cached lazily). */
  gain: (p: Player, owner: string) => number;
  core: Set<string>;
}

const marginalCache = new WeakMap<Franchise[], Map<string, Marginals>>();

/**
 * How much each player matters to his own franchise, and how much an outside
 * player would add. Efficiently built, full squads have no glaring role gaps,
 * so mutually good deals are swaps of *depth one side can spare* for *a slot the
 * other side is thin at* — which only shows up at the margin, not in coverage counts.
 */
function marginals(fr: Franchise, ctx: TradeContext): Marginals {
  let byFr = marginalCache.get(ctx.franchises);
  if (!byFr) {
    byFr = new Map();
    marginalCache.set(ctx.franchises, byFr);
  }
  const hit = byFr.get(fr.id);
  if (hit) return hit;
  const owners = new Map<string, string>(fr.players.map((p) => [p.id, fr.id]));
  const val = (p: Player) => teamTradeValue(p, fr.id, ctx.difficulty, contractSalary(p, owners.get(p.id) ?? fr.id, ctx));
  const base = teamStrength(fr.players, fr.id, ctx.difficulty, val).strength;
  const loss = new Map(
    fr.players.map((p) => [p.id, (base - teamStrength(fr.players.filter((x) => x.id !== p.id), fr.id, ctx.difficulty, val).strength) * STRENGTH_TO_POINTS])
  );
  const gains = new Map<string, number>();
  const gain = (p: Player, owner: string) => {
    let g = gains.get(p.id);
    if (g === undefined) {
      owners.set(p.id, owner);
      g = (teamStrength([...fr.players, p], fr.id, ctx.difficulty, val).strength - base) * STRENGTH_TO_POINTS;
      gains.set(p.id, g);
    }
    return g;
  };
  const core = new Set([...fr.players].sort((a, b) => val(b) - val(a)).slice(0, 3).map((p) => p.id));
  const m = { loss, gain, core };
  byFr.set(fr.id, m);
  return m;
}

/**
 * Player-for-player packages where each side gives what it can spare and gets what
 * it is thin at, at comparable market value. Pre-screened on one-player marginals;
 * the caller still validates and scores every package with the full trade utility.
 */
function complementaryPackages(ctx: TradeContext, cpu: Franchise, partner: Franchise, allowed: (p: Player) => boolean): [string[], string[]][] {
  const A = marginals(cpu, ctx);
  const B = marginals(partner, ctx);
  const talent = (p: Player) => generalTradeValue(p, 0).value;
  const movable = (p: Player, fr: Franchise, m: Marginals) => !m.core.has(p.id) || requestedBy(ctx, p.id, fr.id);
  const gives = cpu.players.filter((p) => movable(p, cpu, A));
  const gets = partner.players.filter((p) => allowed(p) && movable(p, partner, B));
  const tx = 0.8; // one-for-one transaction cost, as in tradeUtility

  type Pair = { give: Player; get: Player; a: number; b: number };
  const pairs: Pair[] = [];
  for (const t of gets) {
    const gainA = A.gain(t, partner.id);
    if (gainA <= 0) continue;
    for (const x of gives) {
      // Beyond this gap the talent-gap penalties kick in for one side or the other.
      if (Math.abs(talent(x) - talent(t)) > 8) continue;
      const a = gainA - (A.loss.get(x.id) ?? 0) - tx;
      if (a <= 0) continue;
      const b = B.gain(x, cpu.id) - (B.loss.get(t.id) ?? 0) - tx;
      if (b <= 0) continue;
      pairs.push({ give: x, get: t, a, b });
    }
  }
  pairs.sort((p, q) => Math.min(q.a, q.b) - Math.min(p.a, p.b));
  const top = pairs.slice(0, 16);
  const out: [string[], string[]][] = top.map((p) => [[p.give.id], [p.get.id]]);

  // Two-for-one either way (salary matching or depth for quality), squad room permitting.
  const rules = ctx.trade.rules;
  if (rules.maxPlayersPerSide >= 2 && rules.maxPlayersTotal >= 3) {
    const spare = (m: Marginals, ps: Player[], exclude: string) =>
      ps.filter((p) => p.id !== exclude).sort((p, q) => (m.loss.get(p.id) ?? 0) - (m.loss.get(q.id) ?? 0)).slice(0, 3);
    for (const p of top.slice(0, 5)) {
      if (partner.players.length < partner.maxSquadSize) {
        for (const y of spare(A, gives, p.give.id)) out.push([[p.give.id, y.id], [p.get.id]]);
      }
      if (cpu.players.length < cpu.maxSquadSize) {
        for (const y of spare(B, gets, p.get.id)) out.push([[p.give.id], [p.get.id, y.id]]);
      }
    }
  }
  return out;
}

/**
 * A CPU looks at its biggest need, scans a partner's roster for players who
 * fill it, and builds a package from its own trade block. It also looks for
 * complementary swaps (depth it can spare for a slot it is thin at, and vice
 * versa for the partner). Returns the best proposal both sides should
 * plausibly accept, or null.
 */
export function buildCpuOffer(ctx: TradeContext, cpuId: string, partnerId: string): TradeProposal | null {
  const cpu = ctx.franchises.find((f) => f.id === cpuId)!;
  const partner = ctx.franchises.find((f) => f.id === partnerId)!;
  const need = biggestNeed(cpu);
  const partnerIsHuman = partnerId === ctx.humanFranchiseId;
  const cpuVal = (p: Player, owner: string) => teamTradeValue(p, cpuId, ctx.difficulty, contractSalary(p, owner, ctx));
  const xi = teamStrength(cpu.players, cpuId, ctx.difficulty).xi;
  const weakestXi = xi.length ? Math.min(...xi.map((p) => cpuVal(p, cpuId))) : 0;

  // Targets: players who fill the biggest role gap, or (no gap) who would upgrade the XI.
  const allowed = (p: Player) => !partnerIsHuman || ctx.trade.humanBlock[p.id] !== 'Untouchable';
  const boost = (p: Player) => (partnerIsHuman && ['Shopping', 'Available'].includes(ctx.trade.humanBlock[p.id] || '') ? 6 : 0);
  const targets = partner.players
    .filter((p) => allowed(p) && (need ? fills[need](p) : cpuVal(p, partnerId) > weakestXi + 2))
    .sort((a, b) => cpuVal(b, partnerId) + boost(b) - (cpuVal(a, partnerId) + boost(a)))
    .slice(0, 8);

  // Packages: trade-block players first, then bench players outside the XI.
  const blockIds = cpuTradeBlock(cpu, ctx).map((b) => b.player.id);
  const bench = cpu.players.filter((p) => !xi.includes(p)).map((p) => p.id);
  const sellable = Array.from(new Set([...blockIds, ...bench])).slice(0, 10);
  const packages: string[][] = [];
  sellable.forEach((a, i) => {
    packages.push([a]);
    sellable.slice(i + 1, i + 4).forEach((b) => packages.push([a, b]));
  });

  const deals: [string[], string[]][] = [];
  for (const t of targets) for (const pkg of packages) deals.push([pkg, [t.id]]);
  const seen = new Set(deals.map(([g, r]) => `${[...g].sort()}|${[...r].sort()}`));
  for (const d of complementaryPackages(ctx, cpu, partner, allowed)) {
    const key = `${[...d[0]].sort()}|${[...d[1]].sort()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deals.push(d);
    }
  }
  if (!deals.length) return null;

  let best: { p: TradeProposal; u: number; fit: UtilityBreakdown } | null = null;
  // Offers to the human need a clearer edge (avoids spam); CPU↔CPU deals just need to clear both thresholds.
  const myThreshold = thresholdFor(ctx, cpuId, ctx.difficulty) + (partnerIsHuman ? 1 : 0.25);
  const theirThreshold = thresholdFor(ctx, partnerId, ctx.difficulty);
  for (const [give, get] of deals) {
    const prop = balanced(makeProposal(ctx, cpuId, partnerId, give, get, 'cpu'), ctx);
    if (!validateTrade(prop, ctx).valid) continue;
    const mineU = tradeUtility(prop, ctx, 0, ctx.difficulty);
    const mine = mineU.utility;
    if (mine < myThreshold) continue;
    // Must look reasonable to the partner too (no spam / insulting offers).
    const theirs = partnerIsHuman ? tradeUtility(prop, ctx, 1, 'Hard') : tradeUtility(prop, ctx, 1, ctx.difficulty);
    const theirsOk = partnerIsHuman ? theirs.strengthGain > -0.6 : theirs.utility >= theirThreshold;
    if (!theirsOk) continue;
    if (!best || mine > best.u) best = { p: prop, u: mine, fit: mineU };
  }
  if (!best) return null;
  const target = partner.players.find((p) => best!.p.sides[1].playerIds.includes(p.id));
  const gained = need && best.fit.coverageGained.includes(COVERAGE_LABEL[need]) ? COVERAGE_LABEL[need] : best.fit.coverageGained[0];
  return {
    ...best.p,
    status: 'SUBMITTED',
    messages: [
      gained
        ? `${cpu.shortName} need ${gained} and see ${target?.name} as the answer.`
        : best.fit.incomingInXi
          ? `${cpu.shortName} believe ${target?.name} would upgrade their starting XI.`
          : `${cpu.shortName} want ${target?.name} to strengthen their squad depth.`,
    ],
  };
}
