// ============================================================
// IPL DYNASTY - Trade realism
// Calibrated ratings, renegotiated trade fees, value-for-money CPU judgement,
// team direction, trade requests and request-driven (blockbuster) deals.
// ============================================================

import { useGameStore, buildTradeWorld } from '../../store/game-store';
import { FRANCHISES } from '../../data/franchises';
import { GLOBAL_PLAYERS } from '../../data/players';
import { createSeededRandom } from '../../utils/random';
import { getLeaguePurseForSeason } from '../career/contract-engine';
import { autoBalance, contractSalary, makeProposal, validateTrade } from '../trade/trade-rules';
import { cpuTradeBlock, evaluateProposal, teamDirection, tradeUtility } from '../trade/trade-ai';
import { executeTrade, advanceTradeMarket, type TradeWorld } from '../trade/trade-executor';
import { generateTradeRequests } from '../trade/trade-requests';
import { generalTradeValue } from '../trade/trade-value';

{
  const seeded = createSeededRandom(3);
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

const byName = (n: string) => GLOBAL_PLAYERS.find((p) => p.name === n)!;

/** Fresh IPL 2027 offseason with real squads; the trade window is open at Release Day. */
function world(human: string): TradeWorld {
  const purse = getLeaguePurseForSeason(2027);
  useGameStore.getState().initializeGame(
    { startingSeason: 2027, cycleMode: 'irl', auctionType: 'Mini', rulesPreset: 'Official', cpuDifficulty: 'Normal', auctionPace: 'Normal', matchSimMode: 'Detailed', allowCustomPurse: false, enableInjuries: false, enablePlayerDevelopment: true, seed: 42 },
    human,
    FRANCHISES.map((f) => ({ ...f, totalPurse: purse, remainingPurse: purse })),
    GLOBAL_PLAYERS
  );
  const w = buildTradeWorld(useGameStore.getState());
  // Give every franchise cap room (squads sit at ~₹124 Cr of ₹130 Cr before releases)
  // and a squad slot, so the tests measure judgement rather than the purse.
  return {
    ...w,
    franchises: w.franchises.map((f) => ({ ...f, remainingPurse: f.remainingPurse + 2000 })),
    trade: { ...w.trade, tradeRequests: {} },
  };
}

console.log('\n=== 1. Ratings match real standing ===');
assert(byName('Cameron Green').ratings.overall >= 85, `Cameron Green rated as a ₹25 Cr all-rounder (${byName('Cameron Green').ratings.overall})`);
assert(byName('Prithvi Shaw').ratings.overall <= 76, 'Prithvi Shaw no longer outrates the stars');
assert(GLOBAL_PLAYERS.every((p) => p.ratings.potential >= p.ratings.overall), 'potential is never below overall');
assert(GLOBAL_PLAYERS.filter((p) => p.age >= 31).every((p) => p.ratings.potential === p.ratings.overall), 'no growth headroom from age 31');
const fv = (n: string) => generalTradeValue(byName(n), byName(n).soldPrice).fairValueLakhs;
assert(fv('Rishabh Pant') < byName('Rishabh Pant').soldPrice, 'Pant at ₹27 Cr is above his market value');
assert(fv('Kuldeep Yadav') > byName('Kuldeep Yadav').soldPrice, 'Kuldeep at ₹13.25 Cr is below his market value');
assert(fv('Cameron Green') > 1500, `Green's market value reflects an 86-rated all-rounder (${Math.round(fv('Cameron Green'))}L)`);

console.log('\n=== 2. Renegotiated trade fees ===');
{
  const w = world('dc');
  const pant = byName('Rishabh Pant');
  const kuldeep = byName('Kuldeep Yadav');
  // DC (user) send Kuldeep, receive Pant at a new ₹15 Cr fee.
  const base = makeProposal(w, 'dc', 'lsg', [kuldeep.id], [pant.id], 'human');
  const withFee = autoBalance({ ...base, fees: { [pant.id]: 1500 } }, w);
  const v = validateTrade(withFee, w);
  assert(v.valid, `Pant ↔ Kuldeep with Pant at ₹15 Cr is legal (${v.issues.map((i) => i.code).join(',') || 'ok'})`);
  assert(v.financials.incomingSalary[0] === 1500, 'DC take on Pant at the new ₹15 Cr fee');
  const lsg = w.franchises.find((f) => f.id === 'lsg')!;
  const dc = w.franchises.find((f) => f.id === 'dc')!;
  assert(v.financials.purseAfter[1] === lsg.remainingPurse + 2700 - contractSalary(kuldeep, 'dc', w), 'LSG free all ₹27 Cr of Pant and commit Kuldeep\'s fee');
  assert(v.financials.purseAfter[0] === dc.remainingPurse + contractSalary(kuldeep, 'dc', w) - 1500, 'DC free Kuldeep\'s salary and commit ₹15 Cr');
  const bad = validateTrade({ ...base, fees: { [pant.id]: 900 } }, w);
  assert(bad.issues.some((i) => i.code === 'FEE_OUT_OF_RANGE'), 'a fee below 50% of the current salary is rejected');

  const ev = evaluateProposal(withFee, w, { allowCounter: false });
  assert(ev.decision === 'ACCEPT', `LSG accept Kuldeep for an overpaid Pant (${ev.decision}: ${ev.reasons.join(' ')})`);
  const res = executeTrade(w, { ...withFee, status: 'ACCEPTED' });
  assert(res.ok, 'the trade executes');
  if (res.ok) {
    assert(res.contracts[pant.id].salaryLakhs === 1500 && res.contracts[pant.id].franchiseId === 'dc', 'Pant\'s contract moves to DC at ₹15 Cr');
    assert(res.record.players.find((p) => p.playerId === pant.id)?.previousSalaryLakhs === 2700, 'history records the fee change (₹27 Cr → ₹15 Cr)');
  }
  // A CPU values an incoming player more at a lower fee.
  const cheap = { ...base, sides: [base.sides[1], base.sides[0]] as typeof base.sides };
  const u100 = tradeUtility(cheap, w, 1, 'Normal').utility;
  const u60 = tradeUtility({ ...cheap, fees: { [pant.id]: 1650 } }, w, 1, 'Normal').utility;
  assert(u60 > u100, 'a lower fee makes the same player more attractive to the buyer');
}

console.log('\n=== 3. Cameron Green is tradeable for equal value ===');
{
  const w = world('kkr');
  const green = byName('Cameron Green');
  const kishan = byName('Ishan Kishan');
  // At ₹25.2 Cr the gap to a ₹15.25 Cr player is too big for trade cash; at a
  // renegotiated ₹18 Cr it balances — the way real teams make big-ticket trades work.
  const full = autoBalance(makeProposal(w, 'kkr', 'srh', [green.id], [kishan.id], 'human'), w);
  assert(!validateTrade(full, w).valid, 'Green at his full ₹25.2 Cr fee cannot be balanced against a ₹15 Cr player');
  const prop = autoBalance({ ...makeProposal(w, 'kkr', 'srh', [green.id], [kishan.id], 'human'), fees: { [green.id]: 1800 } }, w);
  assert(validateTrade(prop, w).valid, `Green at a renegotiated ₹18 Cr balances (${validateTrade(prop, w).issues.map((i) => i.code).join(',') || 'ok'})`);
  const ev = evaluateProposal(prop, w, { allowCounter: true });
  assert(ev.decision !== 'REJECT', `SRH engage on Green (₹18 Cr) ↔ Ishan Kishan (${ev.decision}: ${ev.reasons.join(' ')})`);
  const veer = byName('Prashant Veer');
  const junk = autoBalance(makeProposal(w, 'kkr', 'csk', [byName('Saurabh Dubey').id], [veer.id], 'human'), w);
  assert(evaluateProposal(junk, w, { allowCounter: false }).decision !== 'ACCEPT', 'CSK still refuse junk for a big-money prospect');
}

console.log('\n=== 4. Team direction ===');
{
  const w = world('mi');
  const dirs = w.franchises.map((f) => teamDirection(f, w));
  assert(dirs.filter((d) => d === 'Contending').length === 3, 'three contenders');
  assert(dirs.includes('Rebuilding'), `at least one rebuilding side (${w.franchises.map((f, i) => `${f.id}:${dirs[i][0]}`).join(' ')})`);
}

console.log('\n=== 5. Trade requests ===');
{
  let superSeasons = 0;
  let ok = true;
  for (let seed = 1; seed <= 40; seed++) {
    const req = generateTradeRequests(FRANCHISES.map((f) => ({ ...f, players: GLOBAL_PLAYERS.filter((p) => p.currentFranchiseId === f.id) })), 2027, seed, 'mi');
    const list = Object.values(req);
    const teams = new Set(list.map((r) => r.franchiseId));
    if (list.length < 2 || list.length > 3 || teams.size !== list.length) ok = false;
    if (list.some((r) => byName(GLOBAL_PLAYERS.find((p) => p.id === r.playerId)!.name).ratings.overall >= 87)) superSeasons++;
  }
  assert(ok, '2–3 requests a season, never two from one franchise');
  assert(superSeasons >= 4 && superSeasons <= 22, `a superstar asks out in some seasons, not most (${superSeasons}/40)`);

  const w = world('mi');
  const lsg = w.franchises.find((f) => f.id === 'lsg')!;
  const pooran = byName('Nicholas Pooran');
  const withReq: TradeWorld = { ...w, trade: { ...w.trade, tradeRequests: { [pooran.id]: { playerId: pooran.id, franchiseId: 'lsg', season: 2027, reason: 'Wants a fresh start.' } } } };
  assert(cpuTradeBlock(lsg, withReq).some((b) => b.player.id === pooran.id && b.reason.startsWith('Trade request')), 'a requested star appears on his team\'s trade block');
  const offer = autoBalance(makeProposal(w, 'mi', 'lsg', [byName('Tilak Varma').id], [pooran.id], 'human'), w);
  const before = tradeUtility(offer, w, 1, 'Normal').utility;
  const after = tradeUtility(offer, withReq, 1, 'Normal').utility;
  assert(after > before, 'LSG are more willing to move Pooran once he has asked out');

  // Market: requests produce deals or offers over a stretch of market days.
  let moved = 0;
  let offers = 0;
  let mw: TradeWorld = { ...w, trade: { ...w.trade, tradeRequests: generateTradeRequests(w.franchises, 2027, 7, 'mi') } };
  const requested = new Set(Object.keys(mw.trade.tradeRequests!));
  for (let i = 0; i < 25; i++) {
    const r = advanceTradeMarket(mw, 500 + i);
    mw = r.world;
    moved += r.cpuTrades.filter((t) => t.players.some((p) => requested.has(p.playerId))).length;
    offers += r.newOffers.filter((o) => o.sides[0].playerIds.some((id) => requested.has(id))).length;
  }
  console.log(`   ↳ 25 market days: ${moved} request-driven CPU trades, ${offers} request-driven offers to the user`);
  assert(moved + offers > 0, 'players who ask out actually get moved (or shopped to you)');
}

console.log(`\n🎉 Trade realism: ${passed} assertions passed`);
