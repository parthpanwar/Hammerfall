// ============================================================
// IPL DYNASTY - Atomic trade execution & trade market
//
// executeTrade() is all-or-nothing: it re-validates, builds brand-new
// copies of every structure it touches, checks invariants (single
// ownership, money conservation) and only then returns the new state.
// Any failure returns { ok: false } and the caller's state is untouched —
// the store commits the result in one zustand `set` (a transaction).
// ============================================================

import type { Franchise, Player, PlayingXI } from '@/lib/types/game';
import type { PlayerContract } from '@/lib/types/career';
import type { CashLedgerEntry, TradeProposal, TradeRecord, TradeState } from '@/lib/types/trade';
import { generateBestPlayingXI } from '@/lib/engines/squad-engine';
import { createSeededRandom } from '@/lib/utils/random';
import { contractSalary, isWindowOpen, newProposalId, tradeFee, validateTrade, type TradeContext } from './trade-rules';
import { buildCpuOffer } from './trade-ai';
import { buildRequestDeal } from './trade-requests';

export interface TradeWorld extends TradeContext {
  allPlayers: Player[];
  playingXIs: Record<string, PlayingXI>;
}

export type ExecuteResult =
  | {
      ok: true;
      franchises: Franchise[];
      allPlayers: Player[];
      contracts: Record<string, PlayerContract>;
      playingXIs: Record<string, PlayingXI>;
      trade: TradeState;
      record: TradeRecord;
    }
  | { ok: false; error: string };

export function executeTrade(
  world: TradeWorld,
  proposal: TradeProposal,
  opts: { faultInjection?: 'afterRosters' | 'afterMoney'; timestamp?: number } = {}
): ExecuteResult {
  try {
    const v = validateTrade(proposal, world);
    if (!v.valid) return { ok: false, error: v.issues.map((i) => i.message).join(' ') };

    const [s0, s1] = proposal.sides;
    const fin = v.financials;
    const f0 = world.franchises.find((f) => f.id === s0.franchiseId)!;
    const f1 = world.franchises.find((f) => f.id === s1.franchiseId)!;
    const moving: { p: Player; from: Franchise; to: Franchise }[] = [
      ...f0.players.filter((p) => s0.playerIds.includes(p.id)).map((p) => ({ p, from: f0, to: f1 })),
      ...f1.players.filter((p) => s1.playerIds.includes(p.id)).map((p) => ({ p, from: f1, to: f0 })),
    ];
    const previousSalary = new Map(moving.map((m) => [m.p.id, contractSalary(m.p, m.from.id, world)]));
    // The new franchise pays the (possibly renegotiated) trade fee.
    const salaryOf = new Map(moving.map((m) => [m.p.id, tradeFee(proposal, m.p, m.from.id, world)]));
    const movingIds = new Set(moving.map((m) => m.p.id));

    // --- Rosters (new objects only) ---
    const moved = (m: (typeof moving)[number]): Player => ({
      ...m.p,
      currentFranchiseId: m.to.id,
      currentContractValue: salaryOf.get(m.p.id)!,
      previousFranchises: Array.from(new Set([...(m.p.previousFranchises || []), m.from.id])),
      isRetained: false,
    });
    const incomingFor = (fid: string) => moving.filter((m) => m.to.id === fid).map(moved);
    const commitBefore = (f: Franchise) => f.players.reduce((s, p) => s + contractSalary(p, f.id, world), 0);
    const totalBefore = f0.remainingPurse + f1.remainingPurse + commitBefore(f0) + commitBefore(f1);

    const rebuild = (f: Franchise, purse: number): Franchise => {
      const players = [...f.players.filter((p) => !movingIds.has(p.id)), ...incomingFor(f.id)];
      return {
        ...f,
        players,
        retainedPlayers: (f.retainedPlayers || []).filter((p) => !movingIds.has(p.id)),
        remainingPurse: purse,
        currentOverseasCount: players.filter((p) => p.nationality === 'Overseas').length,
      };
    };
    const n0 = rebuild(f0, fin.purseAfter[0]);
    const n1 = rebuild(f1, fin.purseAfter[1]);
    const franchises = world.franchises.map((f) => (f.id === n0.id ? n0 : f.id === n1.id ? n1 : f));
    if (opts.faultInjection === 'afterRosters') throw new Error('Injected fault after roster update');

    // --- Contracts follow the player; salary is unchanged by cash ---
    const contracts = { ...world.contracts };
    for (const m of moving) {
      const old = contracts[m.p.id];
      contracts[m.p.id] = {
        playerId: m.p.id,
        playerName: m.p.name,
        franchiseId: m.to.id,
        salaryLakhs: salaryOf.get(m.p.id)!,
        yearsRemaining: old?.yearsRemaining ?? 1,
        signingSeason: old?.signingSeason ?? world.season,
        status: old?.status === 'Expiring' ? 'Expiring' : 'Active',
        originalAcquisition: 'Trade',
        isRetained: false,
      };
    }

    // --- Cash settlement ---
    const ts = opts.timestamp ?? Date.now();
    const trade: TradeState = {
      ...world.trade,
      settlement: { ...world.trade.settlement },
      ledger: [...world.trade.ledger],
      tradedThisSeason: { ...world.trade.tradedThisSeason },
    };
    let cash: TradeRecord['cash'] = null;
    if (fin.netCashToSide1 !== 0) {
      const from = fin.netCashToSide1 > 0 ? f0.id : f1.id;
      const to = from === f0.id ? f1.id : f0.id;
      const amount = Math.abs(fin.netCashToSide1);
      if (world.trade.rules.cashSource === 'SettlementAccount') {
        trade.settlement[from] = (trade.settlement[from] ?? 0) - amount;
        trade.settlement[to] = (trade.settlement[to] ?? 0) + amount;
      }
      const entry: CashLedgerEntry = {
        id: newProposalId('cash'),
        tradeId: proposal.id,
        season: world.season,
        fromFranchiseId: from,
        toFranchiseId: to,
        amountLakhs: amount,
        source: world.trade.rules.cashSource,
        timestamp: ts,
      };
      trade.ledger.push(entry);
      cash = { fromFranchiseId: from, toFranchiseId: to, amountLakhs: amount };
    }
    if (opts.faultInjection === 'afterMoney') throw new Error('Injected fault after money update');

    // --- Invariants (abort the whole transaction on any breach) ---
    const ownership = new Map<string, number>();
    for (const f of franchises) for (const p of f.players) ownership.set(p.id, (ownership.get(p.id) || 0) + 1);
    if ([...ownership.values()].some((n) => n > 1)) throw new Error('Invariant: a player would belong to two franchises');
    const commitAfter = (f: Franchise) => f.players.reduce((s, p) => s + (contracts[p.id]?.franchiseId === f.id ? contracts[p.id].salaryLakhs : contractSalary(p, f.id, world)), 0);
    const totalAfter = n0.remainingPurse + n1.remainingPurse + commitAfter(n0) + commitAfter(n1);
    if (Math.abs(totalAfter - totalBefore) > 0.001) throw new Error('Invariant: purse + salary commitments must be conserved');
    const settleBefore = Object.values(world.trade.settlement).reduce((a, b) => a + b, 0);
    const settleAfter = Object.values(trade.settlement).reduce((a, b) => a + b, 0);
    if (Math.abs(settleBefore - settleAfter) > 0.001) throw new Error('Invariant: trade cash must be conserved');

    // --- Players registry, XIs, bookkeeping ---
    const movedById = new Map([...n0.players, ...n1.players].filter((p) => movingIds.has(p.id)).map((p) => [p.id, p]));
    const allPlayers = world.allPlayers.map((p) => movedById.get(p.id) || p);
    const playingXIs = { ...world.playingXIs };
    for (const f of [n0, n1]) {
      if (playingXIs[f.id] && playingXIs[f.id].players.some((id) => movingIds.has(id))) {
        playingXIs[f.id] = generateBestPlayingXI(f);
      }
    }
    for (const id of movingIds) trade.tradedThisSeason[id] = (trade.tradedThisSeason[id] || 0) + 1;
    // A request is settled once the player moves.
    if (trade.tradeRequests && [...movingIds].some((id) => trade.tradeRequests![id])) {
      trade.tradeRequests = Object.fromEntries(Object.entries(trade.tradeRequests).filter(([id]) => !movingIds.has(id)));
    }

    const record: TradeRecord = {
      id: proposal.id,
      season: world.season,
      phase: world.phase,
      tick: world.trade.tick,
      timestamp: ts,
      franchiseIds: [f0.id, f1.id],
      players: moving.map((m) => ({
        playerId: m.p.id,
        playerName: m.p.name,
        fromFranchiseId: m.from.id,
        toFranchiseId: m.to.id,
        salaryLakhs: salaryOf.get(m.p.id)!,
        ...(salaryOf.get(m.p.id) !== previousSalary.get(m.p.id) ? { previousSalaryLakhs: previousSalary.get(m.p.id) } : {}),
        overall: m.p.ratings.overall,
        role: m.p.role,
      })),
      cash,
      status: 'COMPLETED',
      initiatedBy: proposal.initiatedBy,
      isCpuToCpu: f0.id !== world.humanFranchiseId && f1.id !== world.humanFranchiseId,
      preSquad: v.before,
      postSquad: v.after,
      matchingMode: world.trade.rules.matchingMode,
    };
    trade.history = [record, ...world.trade.history];
    trade.proposals = world.trade.proposals
      .map((p) => (p.id === proposal.id ? { ...p, status: 'COMPLETED' as const } : p))
      // Any other open deal that involved a moved player is now void.
      .map((p) =>
        p.id !== proposal.id && ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'COUNTEROFFERED', 'ACCEPTED'].includes(p.status) && p.sides.some((s) => s.playerIds.some((id) => movingIds.has(id)))
          ? { ...p, status: 'CANCELLED' as const, messages: [...p.messages, 'Cancelled: a player in this deal has been traded.'] }
          : p
      );

    return { ok: true, franchises, allPlayers, contracts, playingXIs, trade, record };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ------------------------------------------------------------
// Market tick
// ------------------------------------------------------------

export interface MarketTickResult {
  world: TradeWorld;
  events: string[];
  newOffers: TradeProposal[];
  cpuTrades: TradeRecord[];
}

const OPEN: TradeProposal['status'][] = ['SUBMITTED', 'UNDER_REVIEW', 'COUNTEROFFERED'];

/**
 * One "market day": expire stale proposals, decay negotiation memory, let CPUs
 * send (rate-limited) offers to the user and do deals with each other.
 */
export function advanceTradeMarket(input: TradeWorld, seed: number): MarketTickResult {
  const rng = createSeededRandom(seed);
  let world: TradeWorld = { ...input, trade: { ...input.trade, tick: input.trade.tick + 1 } };
  const t = world.trade;
  const events: string[] = [];
  const rules = t.rules;

  // Expiry
  t.proposals = t.proposals.map((p) =>
    OPEN.includes(p.status) && t.tick - p.updatedTick > rules.proposalExpiryTicks
      ? { ...p, status: 'EXPIRED' as const, messages: [...p.messages, 'Offer expired.'] }
      : p
  );
  // Memory decay
  t.memory = Object.fromEntries(
    Object.entries(t.memory).map(([k, m]) => (t.tick - m.lastTick >= 2 ? [k, { lowballs: Math.max(0, m.lowballs - 1), lastTick: t.tick }] : [k, m]))
  );

  if (!isWindowOpen(world).open) return { world, events, newOffers: [], cpuTrades: [] };

  // CPU → user offers (rate-limited)
  const newOffers: TradeProposal[] = [];
  const openToUser = () =>
    t.proposals.filter((p) => p.initiatedBy === 'cpu' && OPEN.includes(p.status) && p.sides[1].franchiseId === world.humanFranchiseId).length;
  const cpus = world.franchises.filter((f) => f.id !== world.humanFranchiseId).sort(() => rng.next() - 0.5);
  for (const cpu of cpus) {
    if (openToUser() >= rules.maxOpenCpuOffers) break;
    const last = t.lastCpuOfferTick[cpu.id] ?? -Infinity;
    if (t.tick - last < rules.cpuOfferCooldownTicks || !rng.nextBool(0.45)) continue;
    const offer = buildCpuOffer(world, cpu.id, world.humanFranchiseId);
    if (!offer) continue;
    const prop = { ...offer, createdTick: t.tick, updatedTick: t.tick };
    t.proposals = [...t.proposals, prop];
    t.lastCpuOfferTick = { ...t.lastCpuOfferTick, [cpu.id]: t.tick };
    newOffers.push(prop);
    events.push(`${cpu.shortName} sent you a trade offer.`);
  }

  // CPU ↔ CPU deals
  const cpuTrades: TradeRecord[] = [];
  if (rng.nextBool(rules.cpuToCpuTradeChance)) {
    for (let attempt = 0; attempt < 12 && cpuTrades.length === 0; attempt++) {
      const a = cpus[Math.floor(rng.next() * cpus.length)];
      const b = cpus[Math.floor(rng.next() * cpus.length)];
      if (!a || !b || a.id === b.id) continue;
      const offer = buildCpuOffer(world, a.id, b.id);
      if (!offer) continue;
      const res = executeTrade(world, { ...offer, status: 'ACCEPTED' });
      if (!res.ok) continue;
      world = { ...world, franchises: res.franchises, allPlayers: res.allPlayers, contracts: res.contracts, playingXIs: res.playingXIs, trade: res.trade };
      cpuTrades.push(res.record);
      events.push(`${a.shortName} and ${b.shortName} completed a trade.`);
    }
  }

  // Trade requests: a player who has asked out may move — once in a while, a superstar.
  for (const req of Object.values(world.trade.tradeRequests || {})) {
    if (!rng.nextBool(0.3)) continue;
    const owner = world.franchises.find((f) => f.players.some((p) => p.id === req.playerId));
    // The user decides on their own players; requests for them only boost CPU interest.
    if (!owner || owner.id !== req.franchiseId || owner.id === world.humanFranchiseId) continue;
    const player = owner.players.find((p) => p.id === req.playerId)!;
    const buyers = world.franchises.filter((f) => f.id !== owner.id).sort(() => rng.next() - 0.5).slice(0, 4);
    for (const b of buyers) {
      if (b.id === world.humanFranchiseId) {
        const open = world.trade.proposals.filter((p) => p.initiatedBy === 'cpu' && OPEN.includes(p.status) && p.sides[1].franchiseId === world.humanFranchiseId);
        if (open.length >= rules.maxOpenCpuOffers || open.some((p) => p.sides[0].playerIds.includes(req.playerId))) continue;
        const deal = buildRequestDeal(world, owner.id, b.id, req.playerId);
        if (!deal) continue;
        const prop = { ...deal, createdTick: world.trade.tick, updatedTick: world.trade.tick };
        world = { ...world, trade: { ...world.trade, proposals: [...world.trade.proposals, prop] } };
        newOffers.push(prop);
        events.push(`${owner.shortName} offered you ${player.name}, who has asked for a trade.`);
        break;
      }
      const deal = buildRequestDeal(world, owner.id, b.id, req.playerId);
      if (!deal) continue;
      const res = executeTrade(world, { ...deal, status: 'ACCEPTED' });
      if (!res.ok) continue;
      world = { ...world, franchises: res.franchises, allPlayers: res.allPlayers, contracts: res.contracts, playingXIs: res.playingXIs, trade: res.trade };
      cpuTrades.push(res.record);
      events.push(`${player.ratings.overall >= 86 ? 'BLOCKBUSTER — ' : ''}${player.name} traded from ${owner.shortName} to ${b.shortName}.`);
      break;
    }
  }

  return { world, events, newOffers, cpuTrades };
}

/** New season: keep history, ledger and balances; clear per-season limits and open deals. */
export function rollTradeSeason(trade: TradeState, season: number): TradeState {
  return {
    ...trade,
    season,
    tradedThisSeason: {},
    proposals: trade.proposals.map((p) =>
      ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(p.status) ? p : { ...p, status: 'EXPIRED' as const }
    ),
    memory: {},
  };
}
