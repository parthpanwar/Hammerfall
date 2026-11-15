// ============================================================
// IPL DYNASTY - Player Trading System test suite
// Runs a real career up to a completed auction, then exercises the
// rules engine, CPU negotiation, atomic execution, market and seasons.
// ============================================================

import { useGameStore, buildTradeWorld } from '../../store/game-store';
import { FRANCHISES } from '../../data/franchises';
import { GLOBAL_PLAYERS } from '../../data/players';
import { cpuRetentionDecisions } from '../retention-engine';
import { RETENTION_RULES_2026 } from '../../data/retention-rules';
import { createSeededRandom } from '../../utils/random';
import { simulateRemainingAuction } from '../auction/auction-runner';
import { RULE_PRESETS, autoBalance, makeProposal, validateTrade, contractSalary } from '../trade/trade-rules';
import { evaluateProposal, findTrades, tradeUtility, cpuTradeBlock } from '../trade/trade-ai';
import { executeTrade, advanceTradeMarket, type TradeWorld } from '../trade/trade-executor';
import { generalTradeValue, teamTradeValue } from '../trade/trade-value';
import { serializeCompact, parseCompact } from '../../store/player-compaction';
import type { CPUDifficulty, Franchise, Player } from '../../types/game';
import type { TradeProposal, TradeRules } from '../../types/trade';

// Deterministic career: the store seeds the auction with Math.random, so pin it.
// Override with TEST_SEED=n to explore other careers.
const TEST_SEED = Number(process.env.TEST_SEED || 7);
{
  const seeded = createSeededRandom(TEST_SEED);
  Math.random = () => seeded.next();
}

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  passed++;
  console.log(`✅ PASSED: ${msg}`);
}
const codes = (w: TradeWorld, p: TradeProposal) => validateTrade(p, w).issues.map((i) => i.code);

// ------------------------------------------------------------------
// Setup: new career → retentions → registration → auction → complete
// ------------------------------------------------------------------
const store = useGameStore;
store.getState().initializeGame(
  { startingSeason: 2026, auctionType: 'Mega', rulesPreset: 'Official', cpuDifficulty: 'Normal', auctionPace: 'Normal', matchSimMode: 'Detailed', allowCustomPurse: false, enableInjuries: false, enablePlayerDevelopment: true, seed: 42 },
  'mi',
  FRANCHISES,
  GLOBAL_PLAYERS
);
{
  const rng = createSeededRandom(7);
  const all = [];
  for (const f of store.getState().franchises) {
    const d = cpuRetentionDecisions(f, RETENTION_RULES_2026, rng);
    all.push(...d);
    const kept = f.players.filter((p) => d.some((x) => x.playerId === p.id));
    store.getState().updateFranchise(f.id, { players: kept, retainedPlayers: kept, remainingPurse: 12000 - d.reduce((a, b) => a + b.cost, 0) });
  }
  store.getState().setRetentionDecisions(all);
  store.getState().completeRetention();
  store.getState().initializeRegistration();
  store.getState().compileAuctionPool();
  store.getState().setAuctionSession(simulateRemainingAuction(store.getState().auctionSession!, 'mi').session);
  store.getState().completeAuction();
  store.getState().setPhase('SquadManagement');
}

console.log('\n--- TEST 1: Setup & contract sync ---');
const base = () => buildTradeWorld(store.getState());
{
  const w = base();
  assert(!!store.getState().careerState.trade, 'Trade state initialised with the career');
  const unsynced = w.franchises.flatMap((f) => f.players.filter((p) => w.contracts[p.id]?.franchiseId !== f.id));
  assert(unsynced.length === 0, `Every rostered player has a contract with his franchise after the auction (${unsynced.length} missing)`);
  assert(w.franchises.every((f) => f.players.length >= 18 && f.players.length <= 25), 'All squads legal after auction');
}

/** Same world under different rules / difficulty, without touching the store. */
function withRules(w: TradeWorld, rules: Partial<TradeRules>, difficulty?: CPUDifficulty): TradeWorld {
  return { ...w, difficulty: difficulty ?? w.difficulty, trade: { ...w.trade, rules: { ...w.trade.rules, ...rules } } };
}
function team(w: TradeWorld, id: string): Franchise {
  return w.franchises.find((f) => f.id === id)!;
}
const byOvr = (ps: Player[]) => [...ps].sort((a, b) => b.ratings.overall - a.ratings.overall);
function pick(f: Franchise, pred: (p: Player) => boolean = () => true, n = 1, order: 'top' | 'bottom' = 'top') {
  const l = byOvr(f.players.filter(pred));
  return (order === 'top' ? l : l.reverse()).slice(0, n).map((p) => p.id);
}
const indian = (p: Player) => p.nationality === 'Indian';

// ------------------------------------------------------------------
console.log('\n--- TEST 2: One-for-one, two-for-one, three-for-two ---');
{
  const w = withRules(base(), { squadMinimumPolicy: 'Never', matchingMode: 'CashBalanced', maxCashPerTradeLakhs: 5000, settlementOpeningBalanceLakhs: 5000 });
  w.trade = { ...w.trade, settlement: Object.fromEntries(w.franchises.map((f) => [f.id, 5000])) };
  // Give both sides cap room so multi-player swaps are not purse-bound (CPUs often finish the auction near ₹0).
  // Partner: the CPU squad with the most room, so 2-for-1 / 3-for-2 test trade shape, not the 25-man cap.
  const partnerId = [...w.franchises].filter((f) => f.id !== 'mi').sort((a, b) => a.players.length - b.players.length)[0].id;
  w.franchises = w.franchises.map((f) => (f.id === 'mi' || f.id === partnerId ? { ...f, remainingPurse: f.remainingPurse + 3000 } : f));
  const A = team(w, 'mi');
  const B = team(w, partnerId);

  const p11 = autoBalance(makeProposal(w, A.id, B.id, pick(A, indian, 1, 'bottom'), pick(B, indian, 1, 'bottom'), 'human'), w);
  assert(validateTrade(p11, w).valid, `1-for-1 is valid (${codes(w, p11).join(',') || 'ok'})`);
  const r11 = executeTrade(w, { ...p11, status: 'ACCEPTED' });
  assert(r11.ok, '1-for-1 executes');
  if (r11.ok) {
    const a = r11.franchises.find((f) => f.id === A.id)!;
    assert(a.players.some((p) => p.id === p11.sides[1].playerIds[0]) && !a.players.some((p) => p.id === p11.sides[0].playerIds[0]), 'Ownership swapped');
    assert(r11.contracts[p11.sides[1].playerIds[0]].franchiseId === A.id, 'Contract follows the player');
    assert(r11.contracts[p11.sides[1].playerIds[0]].originalAcquisition === 'Trade', 'Contract acquisition recorded as Trade');
  }

  const p21 = autoBalance(makeProposal(w, A.id, B.id, pick(A, indian, 2, 'bottom'), pick(B, indian, 1, 'bottom'), 'human'), w);
  assert(validateTrade(p21, w).valid, `2-for-1 is valid (${codes(w, p21).join(',') || 'ok'})`);
  const p32 = autoBalance(makeProposal(w, A.id, B.id, pick(A, indian, 3, 'bottom'), pick(B, indian, 2, 'bottom'), 'human'), w);
  assert(validateTrade(p32, w).valid, `3-for-2 is valid (${codes(w, p32).join(',') || 'ok'})`);
  const r32 = executeTrade(w, { ...p32, status: 'ACCEPTED' });
  assert(r32.ok && r32.record.players.length === 5, '3-for-2 executes and records 5 players');
  const p41 = makeProposal(w, A.id, B.id, pick(A, indian, 4, 'bottom'), pick(B, indian, 1), 'human');
  assert(codes(w, p41).includes('TOO_MANY_PLAYERS'), '4 players on one side exceeds the configured limit');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 3: Salary matching modes & cash balancing ---');
{
  const w0 = base();
  const A = team(w0, 'mi');
  const B = team(w0, 'csk');
  // Pick a pair with a real salary gap
  const a = byOvr(A.players.filter(indian)).find((p) => contractSalary(p, A.id, w0) <= 300)!;
  const b = byOvr(B.players.filter(indian)).find((p) => contractSalary(p, B.id, w0) >= contractSalary(a, A.id, w0) + 150)!;
  assert(!!a && !!b, 'Found a pair with a salary gap');
  const raw = makeProposal(w0, A.id, B.id, [a.id], [b.id], 'human');
  const gap = contractSalary(b, B.id, w0) - contractSalary(a, A.id, w0);

  const exact = withRules(w0, RULE_PRESETS.Exact);
  assert(codes(exact, raw).includes('SALARY_MISMATCH'), 'Exact match rejects unequal contracts');
  const tol = withRules(w0, { ...RULE_PRESETS.Tolerance, tolerancePct: 0, toleranceFixedLakhs: gap + 1 });
  assert(!codes(tol, raw).includes('SALARY_MISMATCH'), 'Tolerance match accepts a gap inside the allowance');
  const tolTight = withRules(w0, { ...RULE_PRESETS.Tolerance, tolerancePct: 0, toleranceFixedLakhs: gap - 1 });
  assert(codes(tolTight, raw).includes('SALARY_MISMATCH'), 'Tolerance match rejects a gap outside the allowance');

  const cb = withRules(w0, { ...RULE_PRESETS.CashBalanced, maxCashPerTradeLakhs: Math.max(500, gap + 50), toleranceFixedLakhs: 0, tolerancePct: 0 });
  cb.trade = { ...cb.trade, settlement: Object.fromEntries(cb.franchises.map((f) => [f.id, 5000])) };
  assert(codes(cb, raw).includes('SALARY_MISMATCH'), 'Cash-balanced mode flags an unbalanced deal');
  const bal = autoBalance(raw, cb);
  assert(bal.sides[0].cashLakhs === Math.round(gap / 5) * 5, `Auto-balance suggests ${bal.sides[0].cashLakhs}L from the side taking on salary`);
  assert(!codes(cb, bal).includes('SALARY_MISMATCH'), 'Auto-balanced deal satisfies the matching rule');

  const res = executeTrade(cb, { ...bal, status: 'ACCEPTED' });
  assert(res.ok, 'Cash-balanced trade executes');
  if (res.ok) {
    const before = cb.trade.settlement;
    assert(res.trade.settlement[A.id] === before[A.id] - bal.sides[0].cashLakhs && res.trade.settlement[B.id] === before[B.id] + bal.sides[0].cashLakhs, 'Cash moved between settlement accounts only');
    assert(res.contracts[b.id].salaryLakhs === contractSalary(b, B.id, cb), 'Cash payment did not rewrite the player salary');
    const nA = res.franchises.find((f) => f.id === A.id)!;
    assert(nA.remainingPurse === A.remainingPurse - gap, 'Purse (cap room) moved by the salary difference, not the cash');
    assert(res.trade.ledger.length === cb.trade.ledger.length + 1 && res.trade.ledger[res.trade.ledger.length - 1].amountLakhs === bal.sides[0].cashLakhs, 'Ledger entry recorded');
  }

  const broke = withRules(cb, {});
  broke.trade = { ...broke.trade, settlement: { ...broke.trade.settlement, [A.id]: 0 } };
  assert(codes(broke, bal).includes('INSUFFICIENT_CASH'), 'Insufficient trade cash is rejected');
  const capped = withRules(cb, { maxCashPerTradeLakhs: 10 });
  assert(codes(capped, bal).includes('CASH_LIMIT'), 'Per-trade cash cap enforced');

  const official = withRules(w0, RULE_PRESETS.OfficialIPL);
  assert(!codes(official, raw).includes('SALARY_MISMATCH'), 'Official IPL mode uses its own rules (no NBA-style matching)');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 4: Squad size, overseas, purse ---');
{
  const w = base();
  const small = [...w.franchises].sort((a, b) => a.players.length - b.players.length)[0];
  const other = w.franchises.find((f) => f.id !== small.id)!;
  assert(small.players.length === 18 || small.players.length > 18, `Smallest squad has ${small.players.length}`);
  const twoForOne = makeProposal(w, small.id, other.id, pick(small, indian, small.players.length - 17 + 1, 'bottom'), pick(other, indian, 1, 'bottom'), 'human');
  assert(codes(w, twoForOne).includes('SQUAD_MIN'), 'Completed-squad mode rejects dropping below 18');
  const pre = { ...w, phase: 'Registration' as const, auctionComplete: false };
  assert(!codes(pre, twoForOne).includes('SQUAD_MIN'), 'Pre-auction phase allows smaller temporary rosters');

  // Max squad: pad a team to 25 in a test-only copy
  const filler = GLOBAL_PLAYERS.filter((p) => !w.franchises.some((f) => f.players.some((x) => x.id === p.id)) && p.nationality === 'Indian');
  const fullTeam: Franchise = { ...other, players: [...other.players, ...filler.slice(0, 25 - other.players.length)] };
  const wFull = { ...w, franchises: w.franchises.map((f) => (f.id === other.id ? fullTeam : f)) };
  const intoFull = makeProposal(wFull, small.id, other.id, pick(team(wFull, small.id), indian, 2, 'bottom'), pick(fullTeam, indian, 1, 'bottom'), 'human');
  assert(codes(withRules(wFull, { squadMinimumPolicy: 'Never' }), intoFull).includes('SQUAD_MAX'), 'Trade pushing a squad to 26 is rejected');

  // Overseas: team with 8 overseas receives an overseas player for an Indian
  const eight = w.franchises.find((f) => f.players.filter((p) => p.nationality === 'Overseas').length === 8 && f.id !== 'mi');
  const donor = w.franchises.find((f) => f.id !== eight?.id && f.players.some((p) => p.nationality === 'Overseas'));
  if (eight && donor) {
    const os = makeProposal(w, eight.id, donor.id, pick(eight, indian, 1, 'bottom'), pick(donor, (p) => p.nationality === 'Overseas', 1, 'bottom'), 'human');
    assert(codes(w, os).includes('OVERSEAS_MAX'), 'Trade creating a 9th overseas player is rejected');
  }

  // Purse: taking on salary beyond cap room
  const poor = [...w.franchises].sort((a, b) => a.remainingPurse - b.remainingPurse)[0];
  const rich = w.franchises.find((f) => f.id !== poor.id)!;
  const exp = byOvr(rich.players).sort((a, b) => contractSalary(b, rich.id, w) - contractSalary(a, rich.id, w))[0];
  const cheap = byOvr(poor.players).sort((a, b) => contractSalary(a, poor.id, w) - contractSalary(b, poor.id, w))[0];
  if (contractSalary(exp, rich.id, w) - contractSalary(cheap, poor.id, w) > poor.remainingPurse) {
    const cap = makeProposal(w, poor.id, rich.id, [cheap.id], [exp.id], 'human');
    assert(codes(withRules(w, { matchingMode: 'OfficialIPL' }), cap).includes('PURSE_EXCEEDED'), 'Taking on salary beyond the purse is rejected');
    const cashTry = { ...cap, sides: [cap.sides[0], { ...cap.sides[1], cashLakhs: 500 }] as TradeProposal['sides'] };
    assert(codes(withRules(w, { matchingMode: 'OfficialIPL', cashSource: 'AuctionPurse' }), cashTry).includes('PURSE_EXCEEDED'), 'Incoming cash does not make a cap violation legal');
  }
}

// ------------------------------------------------------------------
console.log('\n--- TEST 5: Eligibility, windows, duplicates ---');
{
  const w = base();
  const A = team(w, 'mi');
  const B = team(w, 'rcb');
  const foreign = makeProposal(w, A.id, B.id, pick(B, () => true, 1), pick(B, () => true, 1, 'bottom'), 'human');
  assert(codes(w, foreign).includes('NOT_ON_ROSTER'), 'Cannot trade a player you do not own');
  const dup = makeProposal(w, A.id, B.id, [A.players[0].id, A.players[0].id], pick(B, () => true, 1), 'human');
  assert(codes(w, dup).includes('DUPLICATE_PLAYER'), 'Duplicate player in a proposal is rejected');
  const ok = autoBalance(makeProposal(w, A.id, B.id, pick(A, indian, 1, 'bottom'), pick(B, indian, 1, 'bottom'), 'human'), w);
  assert(codes({ ...w, phase: 'Auction' }, ok).includes('WINDOW_CLOSED'), 'Trading blocked during the auction');
  assert(codes({ ...w, phase: 'ShortlistReveal' }, ok).includes('WINDOW_CLOSED'), 'Trading blocked once the final auction list is out');
  assert(codes({ ...w, seasonStarted: true }, ok).includes('WINDOW_CLOSED'), 'Trading blocked once the season has started');
  const consent = withRules(w, RULE_PRESETS.OfficialIPL);
  consent.trade = { ...consent.trade, tradedThisSeason: { [ok.sides[0].playerIds[0]]: 1 } };
  assert(codes(consent, ok).includes('CONSENT_DENIED'), 'Player consent enforced in Official mode');
  const locked = { ...w, trade: { ...w.trade, proposals: [{ ...ok, id: 'other', status: 'ACCEPTED' as const }] } };
  assert(codes(locked, { ...ok, id: 'mine' }).includes('PLAYER_LOCKED'), 'Player in an agreed trade cannot be used again');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 6: Trade value engine ---');
{
  const young = GLOBAL_PLAYERS.filter((p) => p.age <= 24 && p.ratings.potential >= 80 && p.nationality === 'Indian')[0];
  const old = GLOBAL_PLAYERS.filter((p) => p.age >= 35 && Math.abs(p.ratings.overall - (young?.ratings.overall ?? 0)) <= 4)[0];
  if (young && old) {
    const gy = generalTradeValue(young, 300).value;
    const go = generalTradeValue(old, 900).value;
    assert(gy > go, `Young high-potential player on ₹3 Cr (${gy}) out-values similar-rated veteran on ₹9 Cr (${go})`);
  }
  const p = GLOBAL_PLAYERS.find((x) => x.isDeathBowler && x.ratings.overall >= 80)!;
  assert(teamTradeValue(p, 'mi', 'Hard') !== teamTradeValue(p, 'rr', 'Hard'), 'Team-specific value differs by franchise strategy');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 7: CPU acceptance, rejection & counteroffers ---');
{
  const w = base();
  const A = team(w, 'mi');
  for (const diff of ['Easy', 'Normal', 'Hard', 'Expert'] as CPUDifficulty[]) {
    const wd = withRules(w, {}, diff);
    let rejected = 0;
    let total = 0;
    for (const B of w.franchises.filter((f) => f.id !== 'mi')) {
      const star = byOvr(B.players)[0];
      const scrub = byOvr(A.players).reverse()[0];
      const prop = autoBalance(makeProposal(wd, A.id, B.id, [scrub.id], [star.id], 'human'), wd);
      const ev = evaluateProposal(prop, wd);
      total++;
      if (ev.decision !== 'ACCEPT') rejected++;
      if (ev.decision === 'ACCEPT') console.log(`   ⚠️ ${diff}: ${B.shortName} accepted ${scrub.name} for ${star.name}`);
    }
    assert(rejected === total, `${diff}: no CPU gives up its best player for your worst (${rejected}/${total} refused)`);
  }

  let countered: TradeProposal | null = null;
  let counterReason = '';
  outer: for (const B of w.franchises.filter((f) => f.id !== 'mi')) {
    for (const star of byOvr(B.players).slice(0, 6)) {
      for (const mid of byOvr(A.players).slice(4, 14)) {
        const prop = autoBalance(makeProposal(w, A.id, B.id, [mid.id], [star.id], 'human'), w);
        if (!validateTrade(prop, w).valid) continue;
        const ev = evaluateProposal(prop, w);
        if (ev.decision === 'COUNTER' && ev.counter) {
          countered = ev.counter;
          counterReason = ev.reasons.join(' ');
          break outer;
        }
      }
    }
  }
  assert(!!countered, 'CPU produces a counteroffer for a near-miss proposal');
  if (countered) {
    console.log(`   ↳ "${counterReason}"`);
    assert(validateTrade(countered, w).valid, 'Counteroffer respects every trading rule');
    assert(evaluateProposal(countered, w, { allowCounter: false }).decision === 'ACCEPT', 'CPU accepts its own counteroffer');
  }

  // Store flow: submit → counter/accept → confirm
  const s = store.getState();
  const B = team(w, 'dc');
  const give = pick(A, indian, 1, 'bottom');
  const get = pick(B, indian, 1, 'bottom');
  const ev = s.submitTrade(autoBalance(makeProposal(w, 'mi', 'dc', give, get, 'human'), w));
  assert(['ACCEPT', 'REJECT', 'COUNTER'].includes(ev.decision) && ev.reasons.length > 0, `Store submit returns a decision with reasons (${ev.decision}: ${ev.reasons[0]})`);
}

// ------------------------------------------------------------------
console.log('\n--- TEST 8: Trade Finder & trade blocks ---');
{
  const w = base();
  const A = team(w, 'mi');
  const offered = byOvr(A.players).slice(3, 4).map((p) => p.id);
  const t0 = Date.now();
  const offers = findTrades(w, offered, {}, 10);
  const ms = Date.now() - t0;
  console.log(`   ↳ Trade Finder: ${offers.length} offers in ${ms}ms`);
  assert(ms < 15000, 'Trade Finder completes in reasonable time (pruned beam search)');
  assert(offers.every((o) => validateTrade(o.proposal, w).valid), 'Every Trade Finder offer is legal');
  assert(offers.every((o) => o.probability >= 0.35), 'Trade Finder only returns plausible offers');
  const filtered = findTrades(w, offered, { franchiseId: 'csk' }, 10);
  assert(filtered.every((o) => o.partnerId === 'csk'), 'Franchise filter respected');
  const blocks = w.franchises.filter((f) => f.id !== 'mi').map((f) => cpuTradeBlock(f, w));
  assert(blocks.some((b) => b.length > 0), 'CPU franchises identify players they would move');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 9: Atomic execution & rollback ---');
{
  const w = base();
  const A = team(w, 'mi');
  const B = team(w, 'kkr');
  const prop = { ...autoBalance(makeProposal(w, A.id, B.id, pick(A, indian, 1, 'bottom'), pick(B, indian, 1, 'bottom'), 'human'), w), status: 'ACCEPTED' as const };
  const snapshot = JSON.stringify({ f: w.franchises, c: w.contracts, t: w.trade, a: w.allPlayers.length });
  for (const fault of ['afterRosters', 'afterMoney'] as const) {
    const r = executeTrade(w, prop, { faultInjection: fault });
    assert(!r.ok, `Fault injected ${fault} aborts the trade`);
  }
  assert(JSON.stringify({ f: w.franchises, c: w.contracts, t: w.trade, a: w.allPlayers.length }) === snapshot, 'No partial updates: inputs untouched after rollback');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 10: Market ticks, CPU offers, CPU↔CPU trades & money conservation ---');
{
  // Offseason-like cap room (post-auction CPUs sit near ₹0, which freezes most deals).
  const b0 = base();
  let w = withRules({ ...b0, franchises: b0.franchises.map((f) => ({ ...f, remainingPurse: f.remainingPurse + 1500 })) }, { cpuToCpuTradeChance: 1, cpuOfferCooldownTicks: 1 });
  const total = (x: TradeWorld) => x.franchises.reduce((s, f) => s + f.remainingPurse + f.players.reduce((a, p) => a + contractSalary(p, f.id, x), 0), 0);
  const cash = (x: TradeWorld) => Object.values(x.trade.settlement).reduce((a, b) => a + b, 0);
  const t0 = total(w);
  const c0 = cash(w);
  // Earlier sections may already have completed trades on this career.
  const h0 = w.trade.history.length;
  let cpuTrades = 0;
  let offers = 0;
  for (let i = 0; i < 20; i++) {
    const r = advanceTradeMarket(w, 1000 + i);
    w = r.world;
    cpuTrades += r.cpuTrades.length;
    offers += r.newOffers.length;
  }
  console.log(`   ↳ 20 market days: ${cpuTrades} CPU↔CPU trades, ${offers} offers to the user`);
  assert(cpuTrades > 0, 'CPU franchises trade with each other');
  assert(Math.abs(total(w) - t0) < 0.01, 'League purse + salary commitments conserved across CPU trades');
  assert(Math.abs(cash(w) - c0) < 0.01, 'League trade cash conserved (no money created or destroyed)');
  const ids = w.franchises.flatMap((f) => f.players.map((p) => p.id));
  assert(ids.length === new Set(ids).size, 'No player on two franchises after many trades');
  assert(w.franchises.every((f) => f.players.length >= 18 && f.players.length <= 25 && f.players.filter((p) => p.nationality === 'Overseas').length <= 8), 'All squads remain legal');
  const open = w.trade.proposals.filter((p) => p.initiatedBy === 'cpu' && p.status === 'SUBMITTED' && p.sides[1].franchiseId === 'mi');
  assert(open.length <= w.trade.rules.maxOpenCpuOffers, `CPU offers to the user are rate-limited (${open.length} open)`);
  assert(open.every((p) => validateTrade(p, w).valid), 'CPU-initiated offers are legal');
  assert(w.trade.history.length - h0 === cpuTrades, 'Every CPU trade is recorded in history');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 11: Exploit simulation (hundreds of negotiations) ---');
{
  // Remove financial friction so the CPU's judgement (not the purse) is what's tested.
  const rich = base();
  const w0: TradeWorld = withRules(
    { ...rich, franchises: rich.franchises.map((f) => ({ ...f, remainingPurse: f.remainingPurse + 8000 })) },
    { maxCashPerTradeLakhs: 5000 }
  );
  w0.trade = { ...w0.trade, settlement: Object.fromEntries(w0.franchises.map((f) => [f.id, 9000])) };
  const rng = createSeededRandom(99);
  for (const diff of ['Easy', 'Normal', 'Hard', 'Expert'] as CPUDifficulty[]) {
    const w = withRules(w0, {}, diff);
    const A = team(w, 'mi');
    let exploits = 0;
    let accepted = 0;
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const B = w.franchises.filter((f) => f.id !== 'mi')[Math.floor(rng.next() * 9)];
      const stars = byOvr(B.players).slice(0, 3);
      const weak = byOvr(A.players).reverse().slice(0, 8);
      const give = [weak[Math.floor(rng.next() * weak.length)].id];
      if (rng.nextBool(0.5)) give.push(weak[Math.floor(rng.next() * weak.length)].id);
      const star = stars[Math.floor(rng.next() * stars.length)];
      const prop = autoBalance(makeProposal(w, A.id, B.id, Array.from(new Set(give)), [star.id], 'human'), w);
      if (!validateTrade(prop, w).valid) continue;
      n++;
      const ev = evaluateProposal(prop, w, { allowCounter: false });
      if (ev.decision === 'ACCEPT') {
        accepted++;
        const giveVal = prop.sides[0].playerIds.reduce((s, id) => s + generalTradeValue(A.players.find((p) => p.id === id)!, 0).value, 0);
        if (generalTradeValue(star, 0).value - giveVal / prop.sides[0].playerIds.length > 12) {
          exploits++;
          if (process.env.TRADE_DEBUG && exploits <= 2) {
            const u = tradeUtility(prop, w, 1, diff);
            const gNames = prop.sides[0].playerIds.map((id) => { const p = A.players.find((x) => x.id === id)!; return `${p.name}(${p.ratings.overall},${p.role})`; });
            console.log('DEBUG', diff, B.id, gNames, '→', star.name, star.ratings.overall, star.role, JSON.stringify({ ...u, coreOutgoing: u.coreOutgoing.map((p) => p.name) }));
          }
        }
      }
    }
    console.log(`   ↳ ${diff}: ${n} junk-for-star offers, ${accepted} accepted, ${exploits} lopsided`);
    assert(n >= 40, `${diff}: simulation evaluated ${n} legal negotiations`);
    assert(exploits === 0, `${diff}: CPUs cannot be fleeced with junk-for-star trades`);

    // Fair-value swaps (similar general value, same role) should sometimes be accepted.
    let fair = 0;
    let fairAccepted = 0;
    const buckets = [0, 0, 0, 0, 0].map(() => ({ n: 0, acc: 0 }));
    for (let i = 0; i < 150; i++) {
      const B = w.franchises.filter((f) => f.id !== 'mi')[Math.floor(rng.next() * 9)];
      const mine = A.players[Math.floor(rng.next() * A.players.length)];
      const theirs = B.players
        .filter((p) => p.role === mine.role)
        .sort((x, y) => Math.abs(generalTradeValue(x, 0).value - generalTradeValue(mine, 0).value) - Math.abs(generalTradeValue(y, 0).value - generalTradeValue(mine, 0).value))[0];
      if (!theirs) continue;
      const prop = autoBalance(makeProposal(w, A.id, B.id, [mine.id], [theirs.id], 'human'), w);
      if (!validateTrade(prop, w).valid) continue;
      fair++;
      const ev = evaluateProposal(prop, w, { allowCounter: false });
      const b = buckets[Math.min(4, Math.floor(ev.acceptanceProbability * 5))];
      b.n++;
      if (ev.decision === 'ACCEPT') {
        fairAccepted++;
        b.acc++;
      }
    }
    console.log(`   ↳ ${diff}: ${fairAccepted}/${fair} like-for-like swaps accepted · calibration ${buckets.map((b, i) => `${i * 20}-${i * 20 + 20}%:${b.acc}/${b.n}`).join(' ')}`);
    assert(fairAccepted > 0 && fairAccepted < fair, `${diff}: CPUs accept some fair swaps and refuse others`);
  }
  // Repeated lowballs raise the asking price
  const s = store.getState();
  const w = base();
  const A = team(w, 'mi');
  const B = team(w, 'srh');
  const lowball = autoBalance(makeProposal(w, 'mi', 'srh', pick(A, () => true, 1, 'bottom'), pick(B, () => true, 1), 'human'), w);
  const before = w.trade.memory['srh']?.lowballs || 0;
  for (let i = 0; i < 3; i++) s.submitTrade({ ...lowball, id: `lb-${i}` });
  assert((store.getState().careerState.trade!.memory['srh']?.lowballs || 0) > before, 'Repeated lowball offers are remembered by the CPU');
}

// ------------------------------------------------------------------
console.log('\n--- TEST 12: Store flow, cancellation, history, saves, multi-season ---');
{
  const s = store.getState();
  s.setPhase('SquadManagement');
  // Find a deal the CPU accepts
  const w = base();
  const A = team(w, 'mi');
  let done = false;
  for (const B of w.franchises.filter((f) => f.id !== 'mi')) {
    for (const g of byOvr(A.players).slice(2, 10)) {
      for (const r of byOvr(B.players).slice(4, 12)) {
        const prop = autoBalance(makeProposal(w, 'mi', B.id, [g.id], [r.id], 'human'), w);
        if (!validateTrade(prop, w).valid || tradeUtility(prop, w, 1, w.difficulty).utility < 1) continue;
        const ev = store.getState().submitTrade(prop);
        if (ev.decision !== 'ACCEPT') continue;
        const res = store.getState().confirmTrade(prop.id);
        assert(res.ok, `Accepted trade confirmed through the store (${g.name} ↔ ${r.name})`);
        done = true;
        break;
      }
      if (done) break;
    }
    if (done) break;
  }
  assert(done, 'User can complete a trade with a CPU franchise');
  const st = store.getState();
  const rec = st.careerState.trade!.history.find((h) => !h.isCpuToCpu);
  assert(!!rec && rec.players.length === 2 && rec.preSquad.length === 2 && rec.postSquad.length === 2, 'History stores teams, players, salaries and pre/post squad ratings');
  const moved = rec!.players.find((p) => p.toFranchiseId === 'mi')!;
  assert(st.allPlayers.find((p) => p.id === moved.playerId)?.currentFranchiseId === 'mi', 'Player registry updated with new franchise');

  // Cancellation
  const w2 = buildTradeWorld(st);
  const A2 = team(w2, 'mi');
  const B2 = team(w2, 'gt');
  const c = autoBalance(makeProposal(w2, 'mi', 'gt', pick(A2, indian, 1, 'bottom'), pick(B2, indian, 1, 'bottom'), 'human'), w2);
  st.submitTrade(c);
  st.cancelTrade(c.id);
  const after = store.getState().careerState.trade!.proposals.find((p) => p.id === c.id);
  assert(!after || after.status === 'CANCELLED' || after.status === 'REJECTED' || after.status === 'COUNTEROFFERED', `Cancelled proposal state is ${after?.status}`);

  // Save consistency (compact serialisation round-trip)
  const raw = serializeCompact({ franchises: st.franchises, careerState: st.careerState, allPlayers: st.allPlayers });
  const back = parseCompact<{ franchises: Franchise[]; careerState: typeof st.careerState }>(raw);
  assert(JSON.stringify(back.careerState.trade!.history) === JSON.stringify(st.careerState.trade!.history), 'Trade history survives save/load');
  assert(JSON.stringify(back.franchises.map((f) => f.players.map((p) => p.id))) === JSON.stringify(st.franchises.map((f) => f.players.map((p) => p.id))), 'Rosters survive save/load');

  // Multi-season
  const historyLen = st.careerState.trade!.history.length;
  st.advanceSeason();
  const next = store.getState();
  assert(next.currentSeason === 2027, 'Season advanced');
  assert(next.careerState.trade!.history.length === historyLen, 'Trade history kept across seasons');
  assert(Object.keys(next.careerState.trade!.tradedThisSeason).length === 0, 'Per-season trade limits reset');
  const nw = buildTradeWorld(next);
  const mi = team(nw, 'mi');
  const rr = team(nw, 'rr');
  if (mi.players.length && rr.players.length) {
    const p = autoBalance(makeProposal(nw, 'mi', 'rr', pick(mi, indian, 1, 'bottom'), pick(rr, indian, 1, 'bottom'), 'human'), nw);
    const v = validateTrade(p, nw);
    console.log(`   ↳ Season 2027 offseason trade validity: ${v.valid ? 'valid' : v.issues.map((i) => i.code).join(',')}`);
    assert(!v.issues.some((i) => i.code === 'WINDOW_CLOSED'), 'Offseason window is open in the new season');
  }
}

console.log(`\n🎉 TRADE SYSTEM: ${passed} assertions passed\n`);
