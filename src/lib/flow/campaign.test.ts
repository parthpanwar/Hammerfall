// ============================================================
// IPL DYNASTY - Campaign cycle test
// Two cycles: 2026 mega → 2027, 2028 mini → 2029 mega → 2030, 2031 mini → end.
// Checks release-based mini years, the small mini pool, the second mega's
// retentions under the grown purse, legal squads and the transaction log.
// ============================================================

import { useGameStore } from '../store/game-store';
import { FRANCHISES } from '../data/franchises';
import { GLOBAL_PLAYERS } from '../data/players';
import { cpuRetentionDecisions } from '../engines/retention-engine';
import { RETENTION_RULES_2026 } from '../data/retention-rules';
import { createSeededRandom } from '../utils/random';
import { simulateRemainingAuction } from '../engines/auction/auction-runner';
import { auctionTypeFor, CAMPAIGN_SEASONS } from './season-flow';
import { getMegaRetentionRules } from '../data/retention-rules';
import { getLeaguePurseForSeason } from '../engines/career/contract-engine';

{
  const seeded = createSeededRandom(Number(process.env.TEST_SEED || 11));
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

const store = useGameStore;
const S = () => store.getState();
const log = () => S().careerState.transactions ?? [];

function runAuction() {
  S().compileAuctionPool();
  S().setAuctionSession(simulateRemainingAuction(S().auctionSession!, 'mi').session);
  S().completeAuction();
}
function squadsLegal() {
  const ids = S().franchises.flatMap((f) => f.players.map((p) => p.id));
  return (
    ids.length === new Set(ids).size &&
    S().franchises.every((f) => f.players.length >= 18 && f.players.length <= 25 && f.players.filter((p) => p.nationality === 'Overseas').length <= 8)
  );
}

console.log('\n=== Year 1: 2026 mega auction ===');
S().initializeGame(
  { startingSeason: 2026, auctionType: 'Mega', rulesPreset: 'Official', cpuDifficulty: 'Normal', auctionPace: 'Normal', matchSimMode: 'Detailed', allowCustomPurse: false, enableInjuries: false, enablePlayerDevelopment: true, seed: 42 },
  'mi',
  FRANCHISES,
  GLOBAL_PLAYERS
);
assert(auctionTypeFor(2026, S().settings) === 'Mega', '2026 is a mega auction');
{
  const rng = createSeededRandom(7);
  const all = [];
  for (const f of S().franchises) {
    const d = cpuRetentionDecisions(f, RETENTION_RULES_2026, rng);
    all.push(...d);
    const kept = f.players.filter((p) => d.some((x) => x.playerId === p.id));
    S().updateFranchise(f.id, { players: kept, retainedPlayers: kept, remainingPurse: 12000 - d.reduce((a, b) => a + b.cost, 0) });
  }
  S().setRetentionDecisions(all);
  S().completeRetention();
  S().initializeRegistration();
}
const megaPool = S().registrationPool.length;
assert(Object.keys(S().franchiseShortlists['mi']?.entries ?? {}).length === 0, 'Your shortlist starts empty (not auto-filled as if you were a CPU)');
assert(log().filter((t) => t.type === 'Retained').length === S().retentionDecisions.length, 'Mega retentions logged as transactions');
runAuction();
assert(squadsLegal(), 'Squads legal after the mega auction');
assert(log().filter((t) => t.season === 2026 && t.type === 'Signed').length > 100, 'Mega auction signings logged');

for (const season of [2027, 2028, 2029, 2030, 2031]) {
  if (auctionTypeFor(season, S().settings) === 'Mega') {
    console.log(`\n=== Year ${season - 2025}: ${season} mega auction (second cycle) ===`);
    S().advanceSeason();
    assert(S().currentSeason === season, `${season} reached`);
    const purse = S().franchises[0].totalPurse;
    assert(purse === getLeaguePurseForSeason(season, S().settings) && purse > 12500, `purse grew for the second mega (₹${purse / 100} Cr)`);
    assert(S().franchises.every((f) => f.players.length >= 15), 'CPU squads reach Retention Day intact (no silent pre-retention)');
    const rules = getMegaRetentionRules(purse);
    const rng = createSeededRandom(season);
    const all = [];
    for (const f of S().franchises) {
      const d = cpuRetentionDecisions(f, rules, rng);
      all.push(...d);
      const kept = f.players.filter((p) => d.some((x) => x.playerId === p.id));
      S().updateFranchise(f.id, { players: kept, retainedPlayers: kept, remainingPurse: purse - d.reduce((a, b) => a + b.cost, 0) });
    }
    S().setRetentionDecisions(all);
    S().completeRetention();
    S().initializeRegistration();
    assert(S().registrationPool.length > 250, `second mega pool is deep (${S().registrationPool.length})`);
    runAuction();
    assert(squadsLegal(), `Squads legal after the ${season} mega auction`);
    // (CPU purse use is measured by scripts/calibrate_progression.ts with all-CPU leagues;
    // here the human sits out holding ₹100 Cr+, which distorts the room's price index.)
    continue;
  }
  console.log(`\n=== Year ${season - 2025}: ${season} mini auction ===`);
  const prevRosters = new Map(S().franchises.map((f) => [f.id, f.players.map((p) => p.id)]));
  S().advanceSeason();
  assert(S().currentSeason === season && auctionTypeFor(season, S().settings) === 'Mini', `${season} is a mini auction`);
  {
    const retired = new Set(S().careerState.retirements.map((r) => r.playerId));
    const released = new Set(log().filter((t) => t.season === season && t.type === 'Released').map((t) => t.playerId));
    const unexplained = S().franchises.flatMap((f) => {
      const now = new Set(f.players.map((p) => p.id));
      return (prevRosters.get(f.id) ?? []).filter((id) => !now.has(id) && !retired.has(id) && !released.has(id));
    });
    assert(unexplained.length === 0, `Squads stay together into the mini year: only retirements and releases leave (${unexplained.length} unexplained)`);
  }
  const cpuReleases = log().filter((t) => t.season === season && t.type === 'Released');
  assert(cpuReleases.length > 0 && cpuReleases.every((t) => t.franchiseId !== 'mi'), 'CPU releases logged at the rollover');

  const mi = S().franchises.find((f) => f.id === 'mi')!;
  const before = mi.players.length;
  const cut = [...mi.players].sort((a, b) => a.ratings.overall - b.ratings.overall).slice(0, 3).map((p) => p.id);
  const r = S().confirmMiniReleases(cut);
  assert(r.ok, `Human releases accepted (${r.message})`);
  const after = S().franchises.find((f) => f.id === 'mi')!;
  assert(after.players.length === before - 3 && !after.players.some((p) => cut.includes(p.id)), 'Only the released players leave the squad');
  assert(after.remainingPurse > 0 && after.remainingPurse < after.totalPurse, 'Purse = cap minus the salaries kept');

  S().initializeRegistration();
  const pool = S().registrationPool;
  const rostered = new Set(S().franchises.flatMap((f) => f.players.map((p) => p.id)));
  assert(pool.length <= 140 && pool.length < megaPool / 2, `Mini pool is small (${pool.length} vs ${megaPool} in the mega)`);
  assert(cut.every((id) => pool.some((p) => p.id === id)), 'Your released players are in the mini pool');
  assert(!pool.some((p) => rostered.has(p.id)), 'No kept player leaks into the pool');

  runAuction();
  assert(squadsLegal(), `Squads legal after the ${season} mini auction`);
  assert(log().some((t) => t.season === season && t.type === 'Signed' && t.window === 'Mini'), 'Mini signings logged');
}

console.log('\n=== End of cycle ===');
S().advanceSeason();
assert(S().currentSeason === 2031, `No season ${2026 + CAMPAIGN_SEASONS}: the campaign ends after ${CAMPAIGN_SEASONS} seasons`);
assert(new Set(log().map((t) => t.id)).size === log().length, 'Transaction log has no duplicates');

console.log(`\n🎉 Campaign cycle: ${passed} assertions passed`);
