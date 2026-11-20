// ============================================================
// IPL DYNASTY - Real IPL timeline test
// Real IPL 2026 squads → IPL 2027 mini (last year of the 2025–27 cycle)
// → IPL 2028 mega → 2029, 2030 mini → IPL 2031 mega → 2032, 2033 mini → end.
// ============================================================

import { useGameStore } from '../store/game-store';
import { FRANCHISES } from '../data/franchises';
import { GLOBAL_PLAYERS } from '../data/players';
import { cpuRetentionDecisions } from '../engines/retention-engine';
import { getMegaRetentionRules } from '../data/retention-rules';
import { createSeededRandom } from '../utils/random';
import { simulateRemainingAuction } from '../engines/auction/auction-runner';
import { getLeaguePurseForSeason } from '../engines/career/contract-engine';
import { auctionTypeFor, campaignLength, irlAuctionType, seasonLabel } from './season-flow';

{
  const seeded = createSeededRandom(Number(process.env.TEST_SEED || 5));
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

const S = () => useGameStore.getState();
const log = () => S().careerState.transactions ?? [];
const legal = () => {
  const ids = S().franchises.flatMap((f) => f.players.map((p) => p.id));
  return ids.length === new Set(ids).size && S().franchises.every((f) => f.players.length >= 18 && f.players.length <= 25 && f.players.filter((p) => p.nationality === 'Overseas').length <= 8);
};
const runAuction = () => {
  S().compileAuctionPool();
  S().setAuctionSession(simulateRemainingAuction(S().auctionSession!, 'mi').session);
  S().completeAuction();
};

console.log('\n=== Real IPL calendar ===');
assert(irlAuctionType(2025) === 'Mega' && irlAuctionType(2026) === 'Mini' && irlAuctionType(2027) === 'Mini', 'IPL 2025 mega, 2026 and 2027 mini');
assert(irlAuctionType(2028) === 'Mega' && irlAuctionType(2031) === 'Mega', 'next mega auctions before IPL 2028 and 2031');
assert(seasonLabel(2027, { auctionType: 'Mini', startingSeason: 2027, cycleMode: 'irl' }) === 'IPL 2027 · Mini auction (Dec 2026)', 'the IPL 2027 auction is labelled Dec 2026');

console.log('\n=== Real squads ===');
const squad = (fid: string) => GLOBAL_PLAYERS.filter((p) => p.currentFranchiseId === fid).map((p) => p.name);
assert(squad('csk').includes('Sanju Samson') && squad('rr').includes('Ravindra Jadeja'), 'Samson at CSK, Jadeja at RR (2025 trade)');
assert(squad('kkr').includes('Cameron Green') && squad('kkr').includes('Matheesha Pathirana'), 'Green and Pathirana at KKR');
assert(FRANCHISES.every((f) => { const n = squad(f.id).length; return n >= 24 && n <= 25; }), 'every franchise has its 24–25 man IPL 2026 squad');

console.log('\n=== IPL 2027 · mini (joining the live cycle) ===');
const purse = getLeaguePurseForSeason(2027);
S().initializeGame(
  { startingSeason: 2027, cycleMode: 'irl', auctionType: 'Mini', rulesPreset: 'Official', cpuDifficulty: 'Normal', auctionPace: 'Normal', matchSimMode: 'Detailed', allowCustomPurse: false, enableInjuries: false, enablePlayerDevelopment: true, seed: 42 },
  'mi',
  FRANCHISES.map((f) => ({ ...f, totalPurse: purse, remainingPurse: purse })),
  GLOBAL_PLAYERS
);
assert(campaignLength(S().settings) === 7, 'Real timeline runs IPL 2027–2033 (7 seasons, two full cycles after 2027)');
assert(auctionTypeFor(2027, S().settings) === 'Mini', 'first window is a mini auction (Release Day)');
const before = new Map(S().franchises.map((f) => [f.id, f.players.length]));
const r = S().confirmMiniReleases([]);
assert(r.ok, `keeping the full MI squad is allowed (${r.message})`);
const cpuRel = log().filter((t) => t.type === 'Released' && t.season === 2027);
assert(cpuRel.length >= 30, `CPUs released players before the 2027 mini auction (${cpuRel.length})`);
assert(S().franchises.filter((f) => f.id !== 'mi').every((f) => f.players.length < (before.get(f.id) ?? 0) && f.players.length >= 16 && f.remainingPurse >= 0), 'every CPU trimmed its squad and stays within purse');
S().initializeRegistration();
assert(S().registrationPool.length <= 140, `small mini pool (${S().registrationPool.length})`);
runAuction();
assert(legal(), 'squads legal after the IPL 2027 mini auction');

function megaYear(season: number) {
  console.log(`\n=== IPL ${season} · mega ===`);
  S().advanceSeason();
  assert(S().currentSeason === season && auctionTypeFor(season, S().settings) === 'Mega', `IPL ${season} has a mega auction`);
  const purse = S().franchises[0].totalPurse;
  assert(purse === getLeaguePurseForSeason(season), `IPL ${season} purse follows the real trend (₹${purse / 100} Cr)`);
  const rules = getMegaRetentionRules(purse);
  const rng = createSeededRandom(season);
  const all = [];
  for (const f of S().franchises) {
    const d = cpuRetentionDecisions(f, rules, rng);
    all.push(...d);
    const kept = f.players.filter((p) => d.some((x) => x.playerId === p.id));
    S().updateFranchise(f.id, { players: kept, retainedPlayers: kept, remainingPurse: f.totalPurse - d.reduce((a, b) => a + b.cost, 0) });
  }
  S().setRetentionDecisions(all);
  S().completeRetention();
  S().initializeRegistration();
  assert(S().registrationPool.length > 300, `mega pool is deep (${S().registrationPool.length})`);
  runAuction();
  assert(legal(), `squads legal after the IPL ${season} mega auction`);
}

function miniYear(season: number) {
  console.log(`\n=== IPL ${season} · mini ===`);
  S().advanceSeason();
  assert(S().currentSeason === season && auctionTypeFor(season, S().settings) === 'Mini', `IPL ${season} has a mini auction`);
  const cpuBefore = log().filter((t) => t.type === 'Released' && t.season === season && t.franchiseId !== 'mi').length;
  assert(S().confirmMiniReleases([]).ok, 'releases confirmed');
  const cpuAfter = log().filter((t) => t.type === 'Released' && t.season === season && t.franchiseId !== 'mi').length;
  assert(cpuAfter === cpuBefore, 'CPU releases are not applied twice (already done at the rollover)');
  S().initializeRegistration();
  runAuction();
  assert(legal(), `squads legal after the IPL ${season} mini auction`);
}

megaYear(2028);
miniYear(2029);
miniYear(2030);
megaYear(2031);
miniYear(2032);
miniYear(2033);

console.log('\n=== End ===');
S().advanceSeason();
assert(S().currentSeason === 2033, 'campaign ends after IPL 2033');

console.log(`\n🎉 Real IPL timeline: ${passed} assertions passed`);
