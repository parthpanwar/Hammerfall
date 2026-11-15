// ============================================================
// IPL DYNASTY — Auction market report
// Runs complete CPU auctions (a mega and a mini) from the real squads and
// reports how the money moves: leftover purse, spend by set, and what
// proven / unproven / lapsed / young-uncapped players sell for.
//
//   npx tsx scripts/sim_auction_market.ts [seeds=3]
// ============================================================

import { useGameStore } from '../src/lib/store/game-store';
import { FRANCHISES } from '../src/lib/data/franchises';
import { GLOBAL_PLAYERS } from '../src/lib/data/players';
import { getLeaguePurseForSeason } from '../src/lib/engines/career/contract-engine';
import { simulateRemainingAuction } from '../src/lib/engines/auction/auction-runner';
import { createSeededRandom } from '../src/lib/utils/random';
import type { Player, AuctionSession, RetentionDecision } from '../src/lib/types/game';
import { auctionMarketValue, iplPedigree, patienceMultiplier, sessionPriceIndex, unflooredMarketValue } from '../src/lib/engines/auction/market-value';
import { calculateAdvancedSpendingLimit } from '../src/lib/engines/cpu-gm/advanced-valuation';
import { generatePlayerIntelligenceDossier } from '../src/lib/intelligence/valuation/player-intelligence';
import { cpuRetentionDecisions } from '../src/lib/engines/retention-engine';
import { RETENTION_RULES_2026 } from '../src/lib/data/retention-rules';

const SEEDS = Number(process.argv[2] || 3);
const HUMAN = 'none';

type Row = { name: string; price: number; ovr: number; tag: string; set: number; os: boolean; age: number; capped: boolean; team: string; order: number };

function tagOf(p: Player, season: number): string {
  const ipl = p.ipl;
  if (!ipl || ipl.matches === 0) return p.nationality === 'Overseas' ? 'OS-never-IPL' : p.status === 'Uncapped' ? 'IND-uncapped-new' : 'IND-never-IPL';
  const gap = season - 1 - ipl.lastSeason;
  if (gap >= 2) return 'lapsed(2y+)';
  if (ipl.seasons >= 3) return 'proven-recent';
  return 'recent-light';
}

function run(mode: 'mega' | 'mini', seed: number) {
  const seeded = createSeededRandom(seed);
  Math.random = () => seeded.next();
  const season = mode === 'mega' ? 2028 : 2027;
  const purse = getLeaguePurseForSeason(season);
  const s = useGameStore.getState();
  s.initializeGame(
    {
      startingSeason: season,
      cycleMode: mode === 'mega' ? 'custom' : 'irl',
      auctionType: mode === 'mega' ? 'Mega' : 'Mini',
      rulesPreset: 'Official',
      cpuDifficulty: 'Normal',
      auctionPace: 'Normal',
      matchSimMode: 'Detailed',
      allowCustomPurse: false,
      enableInjuries: false,
      enablePlayerDevelopment: true,
      seed,
    },
    'mi',
    FRANCHISES.map((f) => ({ ...f, totalPurse: purse, remainingPurse: purse })),
    GLOBAL_PLAYERS
  );
  const st = useGameStore.getState();
  if (mode === 'mini') st.confirmMiniReleases([]);
  else {
    // Every franchise retains like a CPU (same logic the Retention screen uses).
    const rng = createSeededRandom(seed + 1);
    let all: RetentionDecision[] = [];
    for (const f of useGameStore.getState().franchises) {
      const decisions = cpuRetentionDecisions(f, { ...RETENTION_RULES_2026, totalPurse: f.totalPurse }, rng);
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
    useGameStore.getState().initializeRegistration();
  }
  if (mode === 'mini') useGameStore.getState().initializeRegistration();
  useGameStore.getState().compileAuctionPool();
  let session = useGameStore.getState().auctionSession as AuctionSession;
  // Every franchise is CPU-run for the report.
  session = { ...session, franchises: session.franchises.map((f) => ({ ...f, isHumanControlled: false })) };
  if (process.env.PROBE) {
    for (const name of process.env.PROBE.split(',')) {
      const idx = session.playerPool.findIndex((x) => x.name === name);
      if (idx < 0) { console.log('probe: not in pool', name); continue; }
      const p = session.playerPool[idx];
      const at = { ...session, currentPlayerIndex: idx };
      const mv = auctionMarketValue(p, at);
      const lims = at.franchises.map((f) => `${f.shortName}:${calculateAdvancedSpendingLimit(f, p, at, generatePlayerIntelligenceDossier(p), 'Normal')}`);
      console.log(`probe ${name} base ${p.basePrice} raw ${unflooredMarketValue(p, at)} ovr ${p.ratings.overall} idx ${sessionPriceIndex(at)} mv ${mv} patience ${patienceMultiplier(p, at).toFixed(2)} ped ${iplPedigree(p, session.seasonYear).tag}\n   ${lims.join(' ')}`);
    }
  }
  const before = session.franchises.reduce((t, f) => t + f.remainingPurse, 0);
  if (process.env.DEBUG) console.log(`[${mode}] price index ${session.priceIndex} · pool ${session.playerPool.length} · slots`, session.franchises.map((f) => f.players.length).join(','));
  const res = simulateRemainingAuction(session, HUMAN);
  const after = res.session.franchises.reduce((t, f) => t + f.remainingPurse, 0);
  const setOrder = (id: string) => session.setAssignments?.[id]?.auctionSetOrder ?? 99;
  const rows: Row[] = res.session.soldPlayers.map((sp, order) => {
    const p = session.playerPool.find((x) => x.id === sp.playerId) ?? GLOBAL_PLAYERS.find((x) => x.id === sp.playerId)!;
    return { name: p.name, price: sp.price, ovr: p.ratings.overall, tag: tagOf(p, season), set: setOrder(p.id), os: p.nationality === 'Overseas', age: p.age, capped: p.status === 'Capped', team: sp.franchiseId, order };
  });
  const first50Lots = session.playerPool.slice(0, 50);
  if (process.env.DEBUG) console.log(`[${mode}] overseas share of the first 50 lots offered: ${Math.round((first50Lots.filter((p) => p.nationality === 'Overseas').length / 50) * 100)}%; overseas held at start: ${session.franchises.map((f) => f.players.filter((p) => p.nationality === 'Overseas').length).join(',')}`);
  const startOs = new Map(session.franchises.map((f) => [f.id, f.players.filter((p) => p.nationality === 'Overseas').length]));
  const osAt50 = session.franchises.map((f) => (startOs.get(f.id) ?? 0) + rows.filter((r) => r.order < 50 && r.os && r.team === f.id).length);
  console.log(`[${mode}] overseas held per team after 50 sales: avg ${(osAt50.reduce((t, x) => t + x, 0) / osAt50.length).toFixed(1)}, max ${Math.max(...osAt50)} (of 8) · 34+ overseas bought: ${rows.filter((r) => r.os && r.age >= 34).map((r) => `${r.name} ${r.age} ₹${(r.price / 100).toFixed(2)}`).join(', ')}`);
  if (process.env.LIST === mode) for (const f of res.session.franchises) console.log(`  ${f.shortName} (${f.players.length}, ₹${(f.remainingPurse / 100).toFixed(1)} Cr left): ` + rows.filter((r) => r.team === f.id).map((r) => `${r.name} ${r.ovr}${r.os ? '*' : ''}/${r.age} ₹${(r.price / 100).toFixed(2)}`).join(' · '));
  return { before, after, rows, teams: res.session.franchises.map((f) => [f.shortName, f.remainingPurse, f.players.length] as const) };
}

const cr = (l: number) => `₹${(l / 100).toFixed(2)} Cr`;
for (const mode of ['mini', 'mega'] as const) {
  const all: Row[] = [];
  let before = 0;
  let after = 0;
  let last: ReturnType<typeof run> | null = null;
  for (let i = 1; i <= SEEDS; i++) {
    const r = run(mode, i * 101);
    all.push(...r.rows);
    before += r.before;
    after += r.after;
    last = r;
  }
  console.log(`\n================ ${mode.toUpperCase()} auction (${SEEDS} runs) ================`);
  console.log(`League purse in hand ${cr(before / SEEDS)} → left unspent ${cr(after / SEEDS)} (${Math.round((after / before) * 100)}%)`);
  console.log('Leftover by team (last run):', last!.teams.map(([n, p, c]) => `${n} ${cr(p)} (${c})`).join(' · '));
  const sets = [...new Set(all.map((r) => r.set))].sort((a, b) => a - b);
  const total = all.reduce((t, r) => t + r.price, 0);
  let cum = 0;
  console.log('Spend by set order:');
  for (const s of sets.slice(0, 12)) {
    const v = all.filter((r) => r.set === s).reduce((t, r) => t + r.price, 0);
    cum += v;
    console.log(`  set ${String(s).padStart(2)}  ${cr(v / SEEDS).padStart(12)}  cum ${Math.round((cum / total) * 100)}%`);
  }
  console.log('Average price by IPL pedigree (OVR-matched bands):');
  for (const band of [[84, 99], [78, 83], [70, 77]]) {
    const inBand = all.filter((r) => r.ovr >= band[0] && r.ovr <= band[1]);
    const by: Record<string, Row[]> = {};
    for (const r of inBand) (by[r.tag] ||= []).push(r);
    console.log(`  OVR ${band[0]}–${band[1]}: ` + Object.entries(by).map(([t, rs]) => `${t} ${cr(rs.reduce((x, r) => x + r.price, 0) / rs.length)} (n=${rs.length})`).join(' · '));
  }
  const young = all.filter((r) => !r.os && !r.capped && r.age <= 23);
  const olderU = all.filter((r) => !r.os && !r.capped && r.age >= 27);
  const avg = (rs: Row[]) => cr(rs.reduce((x, r) => x + r.price, 0) / Math.max(1, rs.length));
  const ao = (rs: Row[]) => (rs.reduce((x, r) => x + r.ovr, 0) / Math.max(1, rs.length)).toFixed(1);
  console.log(`  Uncapped Indians: age ≤23 avg ${avg(young)} (n=${young.length}, OVR ${ao(young)}) · age 27+ avg ${avg(olderU)} (n=${olderU.length}, OVR ${ao(olderU)})`);
  for (const b of [[60, 67], [68, 73], [74, 99]]) {
    const y = young.filter((r) => r.ovr >= b[0] && r.ovr <= b[1]);
    const o = olderU.filter((r) => r.ovr >= b[0] && r.ovr <= b[1]);
    console.log(`    uncapped OVR ${b[0]}–${b[1]}: ≤23 ${avg(y)} (n=${y.length}) · 27+ ${avg(o)} (n=${o.length})`);
  }
  // Streaks: the longest run of consecutive sales to one franchise (per run).
  let worst = 0;
  let worstTeam = '';
  for (let i = 0, run = 0; i < all.length; i++) {
    run = i > 0 && all[i].team === all[i - 1].team && all[i].order === all[i - 1].order + 1 ? run + 1 : 1;
    if (run > worst) { worst = run; worstTeam = all[i].team; }
  }
  const streaks3 = all.filter((r, i) => i >= 2 && all[i - 1].team === r.team && all[i - 2].team === r.team && all[i - 2].order === r.order - 2).length;
  console.log(`  Longest one-team buying streak: ${worst} (${worstTeam}) · lots ending a 3+ streak: ${streaks3}`);
  const first50 = all.filter((r) => r.order < 50);
  console.log(`  Overseas share of the first 50 sales: ${Math.round((first50.filter((r) => r.os).length / Math.max(1, first50.length)) * 100)}% · overseas aged 34+ bought: ${all.filter((r) => r.os && r.age >= 34).length / SEEDS} per auction`);
  const early = all.filter((r) => r.set <= 4);
  console.log(`  First 4 sets: unproven overseas avg ${avg(early.filter((r) => r.tag === 'OS-never-IPL'))} (n=${early.filter((r) => r.tag === 'OS-never-IPL').length}) · proven-recent avg ${avg(early.filter((r) => r.tag === 'proven-recent'))} · share of total spend ${Math.round((early.reduce((x, r) => x + r.price, 0) / total) * 100)}%`);
  console.log('Top 12 buys:');
  [...all].sort((a, b) => b.price - a.price).slice(0, 12).forEach((r) => console.log(`  TOP ${cr(r.price).padStart(12)}  ${r.name} (${r.ovr}, ${r.tag}, set ${r.set})`));
}
