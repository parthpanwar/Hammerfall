// ============================================================
// IPL DYNASTY - Dynamic league
// Front offices that change strategy after each season, XI selection that
// respects age / IPL output / youth minutes, overseas-slot discipline, no
// single-team buying streaks, and player development with breakouts, busts,
// domestic breakouts and India call-ups.
// ============================================================

import { FRANCHISES } from '../../data/franchises';
import { GLOBAL_PLAYERS } from '../../data/players';
import type { AuctionPurchase, AuctionSession, Franchise, Player, PlayerSeasonStats, StandingsEntry } from '../../types/game';
import { selectionScore } from '../selection-score';
import { bestXi, xiGain } from '../cpu-gm/xi-value';
import { haulDamping } from '../cpu-gm/advanced-valuation';
import { buildLeagueContext, planNextStrategy, defaultStrategy } from '../cpu-gm/strategy-planner';
import { getFranchiseActivePersonality } from '../cpu-gm/personalities';
import { progressAllPlayers, progressPlayerAttributes } from '../career/player-progression';
import { iplPedigree } from '../auction/market-value';

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
const squads: Franchise[] = FRANCHISES.map((f) => ({ ...f, players: GLOBAL_PLAYERS.filter((p) => p.currentFranchiseId === f.id) }));
const squad = (id: string) => squads.find((f) => f.id === id)!;

console.log('\n=== 1. Selection: age, IPL output and youth minutes ===');
const warner = byName('David Warner');
const vaibhav = byName('Vaibhav Suryavanshi');
assert(selectionScore(vaibhav) > selectionScore(warner), `Suryavanshi (${selectionScore(vaibhav)}) is picked ahead of a 39-year-old Warner (${selectionScore(warner)})`);
const rr = squad('rr');
const rrWithWarner = { ...rr, players: [...rr.players, warner] };
assert(bestXi(rrWithWarner.players).some((p) => p.id === vaibhav.id), 'RR still play Suryavanshi if they sign Warner');
// (< 5: the starting-spread remap moved RR's weakest overseas starter, Pretorius, from 73 to 71.)
assert(xiGain(rr, warner) < 5, `Warner is at best a marginal upgrade on RR's weakest overseas starter (gain ${xiGain(rr, warner)})`);

console.log('\n=== 2. Overseas slots are for starters ===');
const rcb = squad('rcb');
const xiOverseas = bestXi(rcb.players).filter((p) => p.nationality === 'Overseas').length;
const benchOs = GLOBAL_PLAYERS.filter((p) => p.nationality === 'Overseas' && !p.currentFranchiseId && p.ratings.overall <= 74).slice(0, 5);
assert(xiOverseas === 4, `RCB already field four overseas players (${xiOverseas})`);
assert(benchOs.every((p) => xiGain(rcb, p) === 0), 'a ~74-rated overseas player adds nothing to an XI with four better overseas starters');
const oldOs = GLOBAL_PLAYERS.find((p) => p.nationality === 'Overseas' && p.age >= 36 && p.ratings.overall >= 80 && (p.ipl?.lastSquadSeason ?? 0) < 2025);
if (oldOs) {
  const ped = iplPedigree(oldOs, 2028);
  assert(ped.multiplier < 0.5, `${oldOs.name} (${oldOs.age}, out of the IPL) is heavily discounted (×${ped.multiplier.toFixed(2)})`);
}

console.log('\n=== 3. No single franchise sweeps lot after lot ===');
const sale = (franchiseId: string, i: number): AuctionPurchase => ({ playerId: `p${i}`, playerName: `p${i}`, franchiseId, price: 300, basePrice: 50, round: 1, bidCount: 3 } as AuctionPurchase);
const fakeSession = { soldPlayers: [sale('mi', 1), sale('lsg', 2), sale('lsg', 3), sale('lsg', 4)] } as unknown as AuctionSession;
const mid = byName('Mukesh Kumar');
assert(haulDamping(squad('lsg'), fakeSession, mid) < 1, 'a team that just won three lots in a row eases off');
assert(haulDamping(squad('mi'), fakeSession, mid) === 1, 'other teams bid normally');

console.log('\n=== 4. Front offices review their strategy every season ===');
const ctx = buildLeagueContext(squads);
const standings = (order: string[]): StandingsEntry[] => order.map((id, i) => ({ franchiseId: id, position: i + 1 }) as StandingsEntry);
const order = squads.map((f) => f.id);
const lastId = order[order.length - 1];
const champId = order[0];
const champ = planNextStrategy(squad(champId), standings(order), 2027, { champion: true, finalist: false }, ctx, 1);
assert(champ.strategy.rationale.length > 0 && champ.strategy.season === 2028, `champions review their plan (${champ.to}: “${champ.strategy.rationale}”)`);
const worst = planNextStrategy(squad(lastId), standings(order), 2027, { champion: false, finalist: false }, ctx, 1);
assert(worst.changed, `a 10th-place side changes course (${worst.from} → ${worst.to})`);
const twice = planNextStrategy({ ...squad(lastId), strategy: worst.strategy }, standings(order), 2028, { champion: false, finalist: false }, ctx, 1);
assert(twice.strategy.history.length === 2, 'strategy history accumulates season by season');
const changedCount = squads.filter((f) => planNextStrategy(f, standings([...order].reverse()), 2027, { champion: false, finalist: false }, ctx, 3).changed).length;
assert(changedCount >= 3 && changedCount <= 9, `results reshuffle several front offices, not all of them (${changedCount}/10 changed)`);
const withPlan: Franchise = { ...squad(lastId), strategy: worst.strategy };
assert(getFranchiseActivePersonality('fresh-session', withPlan) === worst.to, 'the auction uses the reviewed strategy');
assert(getFranchiseActivePersonality('fresh-session', squad('csk')) === defaultStrategy('csk').archetype, 'before any review, teams play their IRL philosophy');

console.log('\n=== 5. Player development ===');
const stat = (p: Player, m: number, runs: number, sr: number, wkts = 0, econ = 0): PlayerSeasonStats =>
  ({ playerId: p.id, seasonYear: 2027, franchiseId: 'mi', matches: m, innings: m, runs, ballsFaced: Math.round((runs * 100) / Math.max(1, sr)), battingAverage: runs / Math.max(1, m * 0.7), strikeRate: sr, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highScore: 0, wickets: wkts, oversBowled: wkts ? m * 4 : 0, runsConceded: wkts ? Math.round(econ * m * 4) : 0, bowlingAverage: 0, economyRate: econ, bestBowling: '-', catches: 0, playerOfMatch: 0, dotBallPercentage: 0, boundaryPercentage: 0, powerplayRuns: 0, deathOverRuns: 0, powerplayWickets: 0, deathOverWickets: 0 }) as PlayerSeasonStats;

// A good mid-twenties player with headroom keeps climbing.
const riser: Player = { ...byName('Ruturaj Gaikwad'), age: 24, ratings: { ...byName('Ruturaj Gaikwad').ratings, overall: 76, potential: 86 } };
const up = progressPlayerAttributes(riser, stat(riser, 14, 520, 152), 2028).updatedPlayer;
assert(up.ratings.overall - 76 >= 3, `a 24-year-old 76/86 with a 520-run season improves (+${up.ratings.overall - 76})`);
const flop = progressPlayerAttributes(riser, stat(riser, 12, 140, 112), 2028).updatedPlayer;
assert(flop.ratings.potential < up.ratings.potential, `a poor season lowers the projected ceiling (${flop.ratings.potential} vs ${up.ratings.potential})`);

// Whole league, one simulated season of output.
const stats: Record<string, PlayerSeasonStats> = {};
let i = 0;
for (const f of squads) {
  for (const p of f.players.slice(0, 14)) {
    const k = (i++ * 37) % 100;
    stats[p.id] = p.role === 'Bowler' ? stat(p, 12, 20, 100, 6 + (k % 14), 7.2 + (k % 30) / 10) : stat(p, 12, 150 + k * 5, 120 + (k % 50));
  }
}
const { updatedPlayers, deltas } = progressAllPlayers(GLOBAL_PLAYERS, stats, 2028, 9);
const trend = (t: string) => updatedPlayers.filter((p) => p.development?.trend === t);
assert(trend('Breakout').length >= 5, `a season produces breakouts (${trend('Breakout').length})`);
assert(trend('Bust').length >= 1, `and some prospects bust (${trend('Bust').length})`);
const domestic = trend('Domestic breakout');
assert(domestic.length >= 8 && domestic.length <= 15, `8–15 domestic breakouts emerge (${domestic.map((p) => p.name).join(', ')})`);
assert(domestic.every((p) => p.status === 'Uncapped' && p.nationality === 'Indian'), 'domestic breakouts are uncapped Indians');
const callUps = updatedPlayers.filter((p) => p.development?.callUp);
assert(callUps.length >= 1 && callUps.length <= 5, `India call up the season's best uncapped performers (${callUps.map((p) => p.name).join(', ')})`);
assert(callUps.every((p) => p.status === 'Capped'), 'call-ups move to the capped market');
assert(deltas.filter((d) => (d.potentialDelta ?? 0) !== 0).length > 50, 'potential is dynamic across the league');
const gem = domestic[0];
assert(iplPedigree(gem, 2028).tag === 'Domestic breakout', `the auction flags ${gem.name} as a domestic breakout`);

console.log(`\n🎉 Dynamic league: ${passed} assertions passed`);
