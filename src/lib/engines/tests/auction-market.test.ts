// ============================================================
// IPL DYNASTY - Auction market realism
// IPL pedigree (proven / recent / lapsed / unproven overseas / young uncapped),
// the market price index (cash-rich minis inflate), overpaid-contract releases,
// IPL experience accumulating across a career, and full simulated auctions.
// ============================================================

import { useGameStore } from '../../store/game-store';
import { FRANCHISES } from '../../data/franchises';
import { GLOBAL_PLAYERS } from '../../data/players';
import { createSeededRandom } from '../../utils/random';
import { getLeaguePurseForSeason } from '../career/contract-engine';
import { simulateRemainingAuction } from '../auction/auction-runner';
import { baseMarketValue, computePriceIndex, iplPedigree, isOverpaidContract } from '../auction/market-value';
import { addIplSeason } from '../career/ipl-experience';
import type { AuctionSession, Franchise, Player, PlayerSeasonStats, RetentionDecision } from '../../types/game';
import { cpuRetentionDecisions } from '../retention-engine';
import { getMegaRetentionRules } from '../../data/retention-rules';

{
  const seeded = createSeededRandom(11);
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
const SEASON = 2027;

console.log('\n=== 1. Real IPL records are attached ===');
assert((byName('Jasprit Bumrah').ipl?.seasons ?? 0) >= 10, `Bumrah has a long IPL record (${byName('Jasprit Bumrah').ipl?.seasons} seasons)`);
assert(byName('Kyle Jamieson').ipl?.matches === 15, 'Kyle Jamieson: 15 IPL matches');
assert(iplPedigree(byName('Kyle Jamieson'), SEASON).tag === 'IPL flop risk', 'Jamieson (econ 10+) is an IPL flop risk');
assert(iplPedigree(byName('Ruturaj Gaikwad'), SEASON).proven, 'Ruturaj Gaikwad is proven in the IPL');
const neverOs = GLOBAL_PLAYERS.find((p) => p.nationality === 'Overseas' && !p.ipl && p.ratings.overall >= 78)!;
assert(iplPedigree(neverOs, SEASON).tag === 'Unproven in India', `${neverOs.name} (never played IPL) is unproven in India`);

console.log('\n=== 2. Pedigree ordering at equal rating ===');
// Same player, different IPL histories.
const template: Player = { ...byName('Ruturaj Gaikwad'), nationality: 'Overseas', status: 'Capped', age: 28 };
const proven: Player = { ...template, ipl: { ...template.ipl!, lastSeason: 2026, lastSquadSeason: 2026 } };
const lapsed: Player = { ...template, ipl: { ...template.ipl!, lastSeason: 2023, lastSquadSeason: 2023 } };
const unproven: Player = { ...template, ipl: undefined };
const v = (p: Player) => baseMarketValue(p, SEASON);
assert(v(proven) > v(lapsed), `recent IPL regular (${v(proven)}L) > player out of the IPL for 3 years (${v(lapsed)}L)`);
assert(v(lapsed) > v(unproven) * 0.9, 'a lapsed IPL player is not worth much less than an unknown');
assert(v(proven) > v(unproven) * 1.4, `proven IPL star clearly beats an equally rated overseas debutant (${v(proven)}L vs ${v(unproven)}L)`);
const youngU: Player = { ...byName('Ruturaj Gaikwad'), nationality: 'Indian', status: 'Uncapped', age: 21, basePrice: 30, ratings: { ...byName('Ruturaj Gaikwad').ratings, overall: 70, potential: 82 }, ipl: undefined };
const oldU: Player = { ...youngU, age: 30, ratings: { ...youngU.ratings, potential: 70 } };
assert(v(youngU) > v(oldU) * 1.5, `young uncapped prospect (${v(youngU)}L) ≫ 30-year-old uncapped journeyman (${v(oldU)}L) at the same OVR`);

console.log('\n=== 3. Market price index ===');
const pool = GLOBAL_PLAYERS.filter((p) => !p.currentFranchiseId).slice(0, 90);
const team = (purse: number, size: number): Franchise => ({ ...FRANCHISES[0], remainingPurse: purse, totalPurse: 13000, players: GLOBAL_PLAYERS.slice(0, size) });
const richMini = computePriceIndex(Array.from({ length: 10 }, () => team(2500, 19)), pool, SEASON, false);
const poorMini = computePriceIndex(Array.from({ length: 10 }, () => team(300, 19)), pool, SEASON, false);
assert(richMini > 1, `cash-rich mini inflates prices (index ${richMini})`);
assert(poorMini < richMini, `a cash-poor room pays less (index ${poorMini})`);

console.log('\n=== 4. Overpaid contracts go back to the pool ===');
const vi = byName('Venkatesh Iyer');
assert(isOverpaidContract({ ...vi, ratings: { ...vi.ratings, overall: 76, potential: 76 } }, 2375, SEASON), 'a ₹23.75 Cr fee for a 76-rated player is overpaid');
assert(!isOverpaidContract(byName('Jasprit Bumrah'), 1800, SEASON), 'Bumrah at ₹18 Cr is not overpaid');

console.log('\n=== 5. IPL experience grows during a career ===');
const rookie: Player = { ...youngU, ipl: undefined };
const s: PlayerSeasonStats = { playerId: rookie.id, seasonYear: 2027, franchiseId: 'mi', matches: 12, innings: 11, runs: 380, ballsFaced: 260, battingAverage: 38, strikeRate: 146, fours: 30, sixes: 18, fifties: 3, hundreds: 0, highScore: 78, wickets: 0, oversBowled: 0, runsConceded: 0, bowlingAverage: 0, economyRate: 0, bestBowling: '-', catches: 4, playerOfMatch: 1, dotBallPercentage: 0, boundaryPercentage: 0, powerplayRuns: 0, deathOverRuns: 0, powerplayWickets: 0, deathOverWickets: 0 };
const after = addIplSeason(rookie.ipl, s, 2027, true)!;
assert(after.seasons === 1 && after.matches === 12 && after.lastSeason === 2027, 'a debut season is recorded (1 season, 12 matches)');
assert(iplPedigree({ ...rookie, ipl: after }, 2028).gap === 0, 'next auction sees him as a current IPL player');
const benched = addIplSeason(undefined, undefined, 2027, true)!;
assert(benched.matches === 0 && benched.lastSquadSeason === 2027, 'a squad member who did not play is still marked as in the league');

console.log('\n=== 6. Simulated auctions spend the money sensibly ===');
function auction(mode: 'Mega' | 'Mini') {
  const season = mode === 'Mega' ? 2028 : 2027;
  const purse = getLeaguePurseForSeason(season);
  useGameStore.getState().initializeGame(
    { startingSeason: season, cycleMode: mode === 'Mega' ? 'custom' : 'irl', auctionType: mode, rulesPreset: 'Official', cpuDifficulty: 'Normal', auctionPace: 'Normal', matchSimMode: 'Detailed', allowCustomPurse: false, enableInjuries: false, enablePlayerDevelopment: true, seed: 5 },
    'mi',
    FRANCHISES.map((f) => ({ ...f, totalPurse: purse, remainingPurse: purse })),
    GLOBAL_PLAYERS
  );
  if (mode === 'Mini') useGameStore.getState().confirmMiniReleases([]);
  else {
    // Every franchise retains like a CPU, as the Retention screen does.
    const rng = createSeededRandom(6);
    let all: RetentionDecision[] = [];
    for (const f of useGameStore.getState().franchises) {
      const decisions = cpuRetentionDecisions(f, getMegaRetentionRules(f.totalPurse), rng);
      all = all.concat(decisions);
      const kept = f.players.filter((p) => decisions.some((d) => d.playerId === p.id));
      useGameStore.getState().updateFranchise(f.id, {
        remainingPurse: f.totalPurse - decisions.reduce((t, d) => t + d.cost, 0),
        retainedPlayers: kept,
        players: kept,
        releasedPlayers: f.players.filter((p) => !kept.includes(p)),
      });
    }
    useGameStore.getState().setRetentionDecisions(all);
    useGameStore.getState().completeRetention();
  }
  useGameStore.getState().initializeRegistration();
  useGameStore.getState().compileAuctionPool();
  let session = useGameStore.getState().auctionSession as AuctionSession;
  session = { ...session, franchises: session.franchises.map((f) => ({ ...f, isHumanControlled: false })) };
  const before = session.franchises.reduce((t, f) => t + f.remainingPurse, 0);
  const res = simulateRemainingAuction(session, 'none');
  const left = res.session.franchises.reduce((t, f) => t + f.remainingPurse, 0);
  const price = (id: string) => res.session.soldPlayers.find((x) => x.playerId === id)?.price ?? 0;
  return { session, res, before, left, price };
}
const mini = auction('Mini');
console.log(`   ↳ mini: index ${mini.session.priceIndex}, ₹${(mini.before / 100).toFixed(1)} Cr in hand, ₹${(mini.left / 100).toFixed(1)} Cr left`);
// ≤ 40% (was ≤ 30%): surplus mini money now chases current quality, not mid-tier or
// faded names, so a thin pool can't absorb all of it — by design.
assert(mini.left / mini.before <= 0.4, `mini auction spends most of the league's money (${Math.round((mini.left / mini.before) * 100)}% left; was ~87%)`);
assert(Math.max(...mini.res.session.soldPlayers.map((x) => x.price)) >= 1000, 'the best players in a cash-rich mini go for ₹10 Cr+');
const minisOverPaid = mini.res.session.soldPlayers.filter((x) => {
  const p = mini.session.playerPool.find((q) => q.id === x.playerId);
  return p && p.ratings.overall < 70 && x.price > 800;
});
assert(minisOverPaid.length === 0, 'no sub-70 player goes for ₹8 Cr+');

const mega = auction('Mega');
const sold = mega.res.session.soldPlayers.map((x) => ({ p: mega.session.playerPool.find((q) => q.id === x.playerId)!, price: x.price })).filter((x) => x.p);
const avg = (xs: { price: number }[]) => xs.reduce((t, x) => t + x.price, 0) / Math.max(1, xs.length);
const band = sold.filter((x) => x.p.ratings.overall >= 78 && x.p.ratings.overall <= 83);
const recent = band.filter((x) => iplPedigree(x.p, 2028).proven && (iplPedigree(x.p, 2028).gap ?? 9) <= 1);
const lapsedB = band.filter((x) => (iplPedigree(x.p, 2028).gap ?? 0) >= 2);
const osNew = band.filter((x) => iplPedigree(x.p, 2028).tag === 'Unproven in India');
console.log(`   ↳ mega 78–83 OVR: proven/recent ₹${(avg(recent) / 100).toFixed(2)} Cr (${recent.length}) · lapsed ₹${(avg(lapsedB) / 100).toFixed(2)} Cr (${lapsedB.length}) · unproven overseas ₹${(avg(osNew) / 100).toFixed(2)} Cr (${osNew.length})`);
assert(avg(recent) > avg(lapsedB), 'proven, recent IPL players outsell lapsed ones at the same rating');
assert(osNew.length === 0 || avg(recent) > avg(osNew), 'proven IPL players outsell overseas debutants at the same rating');
assert(mega.left / mega.before <= 0.3, `mega auction leaves little money on the table (${Math.round((mega.left / mega.before) * 100)}%)`);
const top = Math.max(...sold.map((x) => x.price));
assert(top >= 1500 && top <= 3300, `mega headline price is realistic (₹${(top / 100).toFixed(2)} Cr)`);

console.log(`\n🎉 Auction market: ${passed} assertions passed`);
