#!/usr/bin/env tsx
// ============================================================
// IPL DYNASTY - Progression calibration harness
// Runs the real career flow headless through the store — mega auction, a full
// league season (in-season form + CPU blooding), progression, mini auctions —
// for 4 seasons × 5 seeds, and checks the growth / youth-pipeline / rating-
// spread targets. Tune PROGRESSION_TUNING until every line says PASS.
//
//   npm run calibrate:progression            (all seeds, detail for seed 42)
//   SEEDS=42 VERBOSE=1 npm run calibrate:progression
// ============================================================

import { useGameStore } from '../src/lib/store/game-store';
import { FRANCHISES } from '../src/lib/data/franchises';
import { GLOBAL_PLAYERS } from '../src/lib/data/players';
import { cpuRetentionDecisions } from '../src/lib/engines/retention-engine';
import { getMegaRetentionRules } from '../src/lib/data/retention-rules';
import { getLeaguePurseForSeason } from '../src/lib/engines/career/contract-engine';
import { auctionTypeFor } from '../src/lib/flow/season-flow';
import { createSeededRandom } from '../src/lib/utils/random';
import { simulateRemainingAuction } from '../src/lib/engines/auction/auction-runner';
import { generateIPLFixtures, calculateStandings } from '../src/lib/engines/tournament-engine';
import { simulateFullMatch } from '../src/lib/engines/match-engine';
import { selectCpuXI } from '../src/lib/engines/squad-engine';
import { executeSeasonAdvance } from '../src/lib/engines/career/multi-season-controller';
import { seasonPerformance } from '../src/lib/engines/career/player-progression';
import { hashString, mulberry32 } from '../src/lib/engines/career/dev-rng';
import { auctionMarketValue, baseMarketValue } from '../src/lib/engines/auction/market-value';
import { PROGRESSION_TUNING } from '../src/lib/engines/career/progression-tuning';
import type { Player, PlayerSeasonStats } from '../src/lib/types/game';

console.warn = () => {}; // zustand persist has no storage here
const SEASONS = Number(process.env.SEASONS ?? 6); // two auction cycles
const START = 2027;
const SEEDS = (process.env.SEEDS ?? '1,7,42,99,2026').split(',').map(Number);
const DETAIL_SEED = Number(process.env.DETAIL_SEED ?? 42);
const VERBOSE = !!process.env.VERBOSE;
const NO_HUMAN = '__none__'; // every franchise is CPU-run

const S = () => useGameStore.getState();
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// ---------------------------------------------------------------- measurement

const BANDS = ['90+', '85-89', '80-84', '75-79', '70-74', '<70'] as const;
type Band = (typeof BANDS)[number];
const bandOf = (o: number): Band => (o >= 90 ? '90+' : o >= 85 ? '85-89' : o >= 80 ? '80-84' : o >= 75 ? '75-79' : o >= 70 ? '70-74' : '<70');
const TARGETS: Record<Band, [number, number]> = {
  '90+': [6, 10],
  '85-89': [20, 32],
  '80-84': [55, 75],
  '75-79': [65, 85],
  '70-74': [45, 65],
  '<70': [0, 999],
};

/** Everyone in a squad + the top 60 of the rest by overall. */
function relevantPool(): Player[] {
  const squads = S().franchises.flatMap((f) => f.players);
  const ids = new Set(squads.map((p) => p.id));
  const rest = S()
    .allPlayers.filter((p) => !ids.has(p.id) && !p.isRetired)
    .sort((a, b) => b.ratings.overall - a.ratings.overall)
    .slice(0, 60);
  // Squad copies can lag allPlayers; prefer the registry's ratings.
  const reg = new Map(S().allPlayers.map((p) => [p.id, p]));
  return [...squads.map((p) => reg.get(p.id) ?? p), ...rest];
}

function bandCounts(pool: Player[]): Record<Band, number> {
  const c = Object.fromEntries(BANDS.map((b) => [b, 0])) as Record<Band, number>;
  for (const p of pool) c[bandOf(p.ratings.overall)]++;
  return c;
}

type YouthTier = 'wonderkid' | 'hot' | 'ready';
function youthTier(p: Player): YouthTier | null {
  if (p.nationality !== 'Indian' || p.status !== 'Uncapped') return null;
  const { overall: o, potential: pot } = p.ratings;
  if (p.age >= 16 && p.age <= 19 && o >= 72 && o <= 78 && pot >= 88) return 'wonderkid';
  if (p.age >= 18 && p.age <= 22 && o >= 70 && o <= 77 && pot >= 82 && pot <= 89) return 'hot';
  if (p.age >= 22 && p.age <= 29 && o >= 74 && o <= 80 && pot >= 76 && pot <= 84) return 'ready';
  return null;
}

interface SeasonProgress {
  breakouts: number; // Indian, played the season at ≤ 24
  rising: number;
  stalled: number;
  busts: number;
  domestic: number;
  stallRate: number; // (Stalled + Bust) / prospects
  strongGain: number[]; // ≥6 matches, perf ≥ 0.6, Indian ≤ 23
  strongPot: number[];
  poorGain: number[];
  poorPot: number[];
  idleGain: number[]; // 0 matches, Indian ≤ 23 with headroom
  idleBreakouts: number;
}

interface AuctionYouth {
  season: number;
  wonderkids: number;
  hot: number;
  ready: number;
  domestic: number;
  soldPct: number; // wonderkids + hot
  wonderkidPrices: number[];
  hotPrices: number[];
}

interface CareerResult {
  seed: number;
  bands: Record<Band, number>[]; // start of seasons 1..4
  means: number[];
  progress: SeasonProgress[];
  auctions: AuctionYouth[];
  youngRisers: number; // Indians ≤23 & < 76 at S1 who are ≥ 80 by S4
  retirements: number[];
  money: AuctionMoney[];
}

function youngRisersNow(ids: string[]): number {
  const byId = new Map(S().allPlayers.map((p) => [p.id, p]));
  return ids.filter((id) => (byId.get(id)?.ratings.overall ?? 0) >= 80).length;
}

// ---------------------------------------------------------------- flow

function runAuction(compile = true) {
  if (compile) S().compileAuctionPool();
  S().setAuctionSession(simulateRemainingAuction(S().auctionSession!, NO_HUMAN).session);
  S().completeAuction();
  const ids = S().franchises.flatMap((f) => f.players.map((p) => p.id));
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) console.log(`  ⚠️ ${dup.length} players on two squads after the ${S().currentSeason} auction: ${dup.slice(0, 5).join(', ')}`);
}

interface AuctionMoney {
  season: number;
  type: 'Mega' | 'Mini';
  leftCr: number[]; // purse left per team after the auction (Cr)
  spentPct: number; // share of the league's available purse spent
  overpaid: string[]; // ≤ 78 OVR sold for ≥ ₹6 Cr
  overpaidCount: number;
  fadedCount: number; // ≤ 74 OVR sold for ₹5 Cr+
}
const moneyLog: AuctionMoney[] = [];
const peak = new Map<string, number>(); // best overall seen per player

/** Compile + run an auction, logging purse use and suspicious sales. */
function trackedAuction(type: 'Mega' | 'Mini', compiled = false) {
  if (!compiled) S().compileAuctionPool();
  if (process.env.DEBUG_INDEX) {
    const ses = S().auctionSession!;
    console.log(`  [${type} ${ses.seasonYear}] open index ${ses.priceIndex} · pool ${ses.playerPool.length} · squads ${S().franchises.map((f) => f.players.length).join(',')}`);
  }
  const before = new Map(S().franchises.map((f) => [f.id, f.remainingPurse]));
  const available = [...before.values()].reduce((a, b) => a + b, 0);
  const kept = new Set(S().franchises.flatMap((f) => f.players.map((p) => p.id)));
  runAuction(false);
  const left = S().franchises.map((f) => f.remainingPurse);
  if (process.env.DEBUG_RICH && type === 'Mega') for (const f of S().franchises) if (f.remainingPurse >= 1000) console.log(`  RICH ${f.shortName} left ₹${(f.remainingPurse / 100).toFixed(1)} n ${f.players.length} os ${f.players.filter((p) => p.nationality === 'Overseas').length} retained ${f.retainedPlayers?.length ?? 0}`);
  if (process.env.DEBUG_INDEX) console.log(`  [${type}] squads after ${S().franchises.map((f) => f.players.length).join(',')}`);
  const sales = S().franchises.flatMap((f) => f.players.filter((p) => !kept.has(p.id)));
  // Faded or merely decent established players at star prices (developing youngsters excluded).
  // ₹6 Cr at a ₹120 Cr purse, scaled with the purse.
  const bar = Math.round((600 * (S().franchises[0]?.totalPurse ?? 12000)) / 12000);
  const bad = sales.filter((p) => p.age >= 26 && p.ratings.overall <= 78 && p.soldPrice >= bar).sort((a, b) => b.soldPrice - a.soldPrice);
  const faded = sales.filter((p) => p.ratings.overall <= 74 && p.soldPrice >= 500);
  moneyLog.push({
    season: S().currentSeason,
    type,
    leftCr: left.map((l) => l / 100),
    spentPct: available ? 1 - left.reduce((a, b) => a + b, 0) / available : 1,
    overpaid: bad.slice(0, 6).map((p) => `${p.name} ${p.age} ${p.ratings.overall}(peak ${peak.get(p.id) ?? p.ratings.overall}) ₹${(p.soldPrice / 100).toFixed(1)}Cr ${p.status}`),
    overpaidCount: bad.length,
    fadedCount: faded.length,
  });
  return moneyLog[moneyLog.length - 1];
}

function printMoney(m: AuctionMoney) {
  console.log(
    `  ${m.type} auction ${m.season} money: spent ${(m.spentPct * 100).toFixed(0)}% of available · left per team ₹[${m.leftCr.map((x) => x.toFixed(1)).join(', ')}] Cr · ≤78 OVR (26+) sold ≥₹6 Cr: ${m.overpaidCount}${m.overpaid.length ? ' — ' + m.overpaid.join(' | ') : ''}`
  );
}

/** Retention Day for every (CPU) franchise under the season's slabs. */
function megaRetention(seed: number) {
  const rng = createSeededRandom(seed + S().currentSeason);
  const decisions = [];
  for (const f of S().franchises) {
    const d = cpuRetentionDecisions(f, getMegaRetentionRules(f.totalPurse), rng);
    decisions.push(...d);
    const kept = f.players.filter((p) => d.some((x) => x.playerId === p.id));
    S().updateFranchise(f.id, { players: kept, retainedPlayers: kept, remainingPurse: f.totalPurse - d.reduce((a, b) => a + b.cost, 0) });
  }
  S().setRetentionDecisions(decisions);
  S().completeRetention();
  S().initializeRegistration();
}

function auctionYouth(season: number): AuctionYouth {
  S().compileAuctionPool();
  const pool = S().finalAuctionPool;
  if (process.env.DEBUG_PRICES) {
    const ses = S().auctionSession!;
    for (const p of pool.filter((x) => youthTier(x) === 'wonderkid' || youthTier(x) === 'hot'))
      console.log(`    $ ${p.name} ${p.age} ${p.ratings.overall}/${p.ratings.potential} base ${baseMarketValue(p, season)} mkt ${auctionMarketValue(p, ses)} idx ${ses.priceIndex}`);
  }
  const tiers = pool.map((p) => ({ p, t: youthTier(p) }));
  const domestic = pool.filter((p) => p.development?.trend === 'Domestic breakout' && p.development.season === season).length;
  trackedAuction('Mini', true);
  const owner = new Map<string, Player>();
  for (const f of S().franchises) for (const p of f.players) owner.set(p.id, p);
  const youth = tiers.filter((x) => x.t === 'wonderkid' || x.t === 'hot');
  const sold = youth.filter((x) => owner.has(x.p.id));
  const price = (id: string) => owner.get(id)?.soldPrice ?? 0;
  return {
    season,
    wonderkids: tiers.filter((x) => x.t === 'wonderkid').length,
    hot: tiers.filter((x) => x.t === 'hot').length,
    ready: tiers.filter((x) => x.t === 'ready').length,
    domestic,
    soldPct: youth.length ? sold.length / youth.length : 1,
    wonderkidPrices: tiers.filter((x) => x.t === 'wonderkid' && owner.has(x.p.id)).map((x) => price(x.p.id)),
    hotPrices: tiers.filter((x) => x.t === 'hot' && owner.has(x.p.id)).map((x) => price(x.p.id)),
  };
}

function playSeason(seed: number) {
  const season = S().currentSeason;
  const fixtures = generateIPLFixtures(S().franchises);
  S().setFixtures(fixtures);
  for (const f of S().franchises) {
    const rng = mulberry32((hashString(`opening:${f.id}`) ^ seed) >>> 0);
    S().setPlayingXI(f.id, selectCpuXI(f, { rng, season }));
  }
  fixtures.forEach((fix, m) => {
    const st = S();
    const t1 = st.franchises.find((f) => f.id === fix.team1Id)!;
    const t2 = st.franchises.find((f) => f.id === fix.team2Id)!;
    const xi1 = st.playingXIs[t1.id];
    const xi2 = st.playingXIs[t2.id];
    const sim = simulateFullMatch(fix, t1, t2, xi1, xi2, seed * 100003 + season * 101 + m);
    fix.isCompleted = true;
    fix.result = sim.matchResult;
    // Same recording path as the Tournament hub.
    const counted = new Set<string>();
    const appearance = (id: string) => (counted.has(id) ? 0 : (counted.add(id), 1));
    for (const b of [...sim.innings1.batsmen, ...sim.innings2.batsmen]) {
      if (b.balls > 0) S().updatePlayerSeasonStats(b.playerId, { runs: b.runs, ballsFaced: b.balls, fours: b.fours, sixes: b.sixes, matches: appearance(b.playerId) });
    }
    for (const b of [...sim.innings1.bowlers, ...sim.innings2.bowlers]) {
      if (b.overs > 0) S().updatePlayerSeasonStats(b.playerId, { oversBowled: b.overs, wickets: b.wickets, runsConceded: b.runs, matches: appearance(b.playerId) });
    }
    for (const id of [...xi1.players, ...xi2.players]) if (!counted.has(id)) S().updatePlayerSeasonStats(id, { matches: appearance(id) });
    S().recordMatchForm({
      matchKey: fix.id,
      team1Id: t1.id,
      team2Id: t2.id,
      team1XI: xi1.players,
      team2XI: xi2.players,
      batsmen: [...sim.innings1.batsmen, ...sim.innings2.batsmen],
      bowlers: [...sim.innings1.bowlers, ...sim.innings2.bowlers],
    });
  });
  S().setFixtures(fixtures);
  S().setStandings(calculateStandings(S().franchises, fixtures));
}

/** Progress into the next season (store flow; the 4th season bypasses the campaign-end guard). */
function advance(): void {
  const st = S();
  if (st.currentSeason < st.settings.startingSeason + 2) {
    S().advanceSeason();
  } else {
    const r = executeSeasonAdvance(st, st.careerState);
    useGameStore.setState({ ...r.updatedGameState, careerState: r.updatedCareerState });
  }
}

function measureProgress(before: Map<string, Player>, stats: Record<string, PlayerSeasonStats>, nextSeason: number): SeasonProgress {
  const after = new Map(S().allPlayers.map((p) => [p.id, p]));
  const out: SeasonProgress = {
    breakouts: 0, rising: 0, stalled: 0, busts: 0, domestic: 0, stallRate: 0,
    strongGain: [], strongPot: [], poorGain: [], poorPot: [], idleGain: [], idleBreakouts: 0,
  };
  let prospects = 0;
  let stalls = 0;
  for (const [id, b] of before) {
    const a = after.get(id);
    if (!a || a.development?.season !== nextSeason) continue;
    const t = a.development.trend;
    const indian = b.nationality === 'Indian';
    if (t === 'Domestic breakout') out.domestic++;
    if (!indian || b.age > 24) continue;
    if (t === 'Breakout') out.breakouts++;
    if (t === 'Rising') out.rising++;
    if (t === 'Stalled') out.stalled++;
    if (t === 'Bust') out.busts++;
    if (b.age > 23) continue;
    const s = stats[id];
    const m = s?.matches ?? 0;
    const perf = seasonPerformance(b, s);
    const gain = a.ratings.overall - b.ratings.overall;
    const pot = a.ratings.potential - b.ratings.potential;
    const head = b.ratings.potential - b.ratings.overall;
    if (head >= 5) {
      prospects++;
      if (t === 'Stalled' || t === 'Bust') stalls++;
    }
    if (t === 'Domestic breakout') continue; // judged on domestic cricket, not IPL
    if (m >= 6 && perf !== null && perf >= 0.6) (out.strongGain.push(gain), out.strongPot.push(pot));
    if (m >= 6 && perf !== null && perf <= -0.4) (out.poorGain.push(gain), out.poorPot.push(pot));
    if (m === 0 && head >= 5) {
      out.idleGain.push(gain);
      if (t === 'Breakout') out.idleBreakouts++;
    }
  }
  out.stallRate = prospects ? stalls / prospects : 0;
  return out;
}

function diag(before: Map<string, Player>, stats: Record<string, PlayerSeasonStats>, pool: Player[]) {
  const after = new Map(S().allPlayers.map((p) => [p.id, p]));
  const inPool = new Set(pool.map((p) => p.id));
  const groups = new Map<string, number[]>();
  const add = (k: string, v: number) => groups.set(k, [...(groups.get(k) ?? []), v]);
  for (const id of inPool) {
    const b = before.get(id);
    const a = after.get(id);
    if (!b || !a || a.isRetired) continue;
    const d = a.ratings.overall - b.ratings.overall;
    const ab = b.age <= 20 ? '≤20' : b.age <= 24 ? '21-24' : b.age <= 28 ? '25-28' : b.age <= 31 ? '29-31' : b.age <= 34 ? '32-34' : '35+';
    add(`age ${ab}`, d);
    add(`band ${bandOf(b.ratings.overall)}`, d);
    const m = stats[id]?.matches ?? 0;
    add(`m ${m === 0 ? '0' : m < 6 ? '1-5' : '6+'}`, d);
  }
  console.log('  Δ OVR (relevant pool): ' + [...groups.entries()].sort().map(([k, v]) => `${k}: ${mean(v) >= 0 ? '+' : ''}${mean(v).toFixed(2)} (n${v.length})`).join(' | '));
  // Flows in and out of 80–84 (players in the pool before the off-season).
  const outs: string[] = [];
  const ins: string[] = [];
  for (const id of inPool) {
    const b = before.get(id)!;
    const a = after.get(id);
    if (!b) continue;
    const wasIn = bandOf(b.ratings.overall) === '80-84';
    const nowIn = a && !a.isRetired && bandOf(a.ratings.overall) === '80-84';
    const tag = `${b.name.split(' ').pop()}(${b.age},${b.nationality[0]}${b.status[0]},m${stats[id]?.matches ?? 0},${b.ratings.overall}→${a?.isRetired ? 'ret' : a?.ratings.overall})`;
    if (wasIn && !nowIn) outs.push(tag);
    if (!wasIn && nowIn) ins.push(tag);
  }
  console.log(`  80–84 out (${outs.length}): ${outs.join(' ')}`);
  console.log(`  80–84 in (${ins.length}): ${ins.join(' ')}`);
  const yi = [...before.values()].filter((b) => b.nationality === 'Indian' && b.age <= 24 && (stats[b.id]?.matches ?? 0) >= 6);
  const ds = yi.map((b) => (after.get(b.id)?.ratings.overall ?? 0) - b.ratings.overall).sort((x, y) => x - y);
  console.log(`  Young Indians with 6+ matches: n=${ds.length} Δ=[${ds.join(',')}]`);
}

function printTopYoung(stats: Record<string, PlayerSeasonStats>, before: Map<string, Player>) {
  const rows = S()
    .allPlayers.filter((p) => p.nationality === 'Indian' && p.age <= 25 && !p.isRetired && before.has(p.id))
    .sort((a, b) => b.ratings.overall - a.ratings.overall)
    .slice(0, 15)
    .map((p) => {
      const b = before.get(p.id)!;
      const s = stats[p.id];
      const perf = seasonPerformance(b, s);
      return `    ${p.name} (${b.age}) ${b.ratings.overall}/${b.ratings.potential} → ${p.ratings.overall}/${p.ratings.potential} ${p.development?.trend ?? '-'} m${s?.matches ?? 0} perf ${perf === null ? '—' : perf.toFixed(2)}`;
    });
  console.log('  Top 15 Indians ≤ 24:\n' + rows.join('\n'));
}

function printBands(label: string, c: Record<Band, number>, m: number) {
  console.log(`  ${label}: ${BANDS.map((b) => `${b} ${c[b]}`).join(' · ')} · mean ${m.toFixed(2)}`);
}

function runCareer(seed: number): CareerResult {
  const detail = seed === DETAIL_SEED || VERBOSE;
  const seeded = createSeededRandom(seed);
  Math.random = () => seeded.next(); // the store's auction seeds
  const purse = getLeaguePurseForSeason(START);
  S().initializeGame(
    { startingSeason: START, cycleMode: 'custom', auctionType: 'Mega', rulesPreset: 'Official', cpuDifficulty: 'Normal', auctionPace: 'Normal', matchSimMode: 'Quick', allowCustomPurse: false, enableInjuries: false, enablePlayerDevelopment: true, seed },
    NO_HUMAN,
    FRANCHISES.map((f) => ({ ...f, totalPurse: purse, remainingPurse: purse })),
    GLOBAL_PLAYERS
  );
  moneyLog.length = 0;
  peak.clear();
  for (const p of S().allPlayers) peak.set(p.id, p.ratings.overall);
  megaRetention(seed);
  const firstMega = trackedAuction('Mega');

  const res: CareerResult = { seed, bands: [], means: [], progress: [], auctions: [], youngRisers: 0, retirements: [], money: [] };
  const startYoung = S().allPlayers.filter((p) => p.nationality === 'Indian' && p.age <= 23 && p.ratings.overall < 76 && !p.isRetired).map((p) => p.id);
  if (detail) {
    console.log(`\n================ seed ${seed} ================`);
    printMoney(firstMega);
  }
  const traces = new Map<string, { name: string; ovr: number; pot: number; m: number; t?: string }[]>();
  const snap = () => {
    const reg = new Map(S().allPlayers.map((p) => [p.id, p]));
    for (const id of startYoung) {
      const p = reg.get(id);
      if (!p) continue;
      const m = S().playerSeasonStats[id]?.matches ?? 0;
      const arr = traces.get(id) ?? [];
      // Entry k = ratings at the start of season k and the matches he played in it.
      arr.push({ name: p.name, ovr: p.ratings.overall, pot: p.ratings.potential, m, t: p.development?.trend });
      traces.set(id, arr);
    }
  };

  for (let y = 1; y <= SEASONS; y++) {
    for (const p of S().allPlayers) peak.set(p.id, Math.max(peak.get(p.id) ?? 0, p.ratings.overall));
    const pool = relevantPool();
    const c = bandCounts(pool);
    res.bands.push(c);
    res.means.push(mean(pool.map((p) => p.ratings.overall)));
    if (y === 4) res.youngRisers = youngRisersNow(startYoung);
    if (detail) {
      console.log(`\n-- Season ${S().currentSeason} (year ${y}) --`);
      printBands('IPL-relevant pool', c, res.means[y - 1]);
      if (process.env.DIAG) {
        const mid = pool.filter((p) => p.ratings.overall >= 70 && p.ratings.overall < 80);
        const k = (p: Player) => `${p.id.startsWith('gen_') ? 'rookie' : 'db'}/${p.age <= 23 ? '≤23' : p.age <= 29 ? '24-29' : '30+'}/${p.nationality[0]}${p.status[0]}`;
        const c2 = new Map<string, number>();
        for (const p of mid) c2.set(k(p), (c2.get(k(p)) ?? 0) + 1);
        const sq = new Set(S().franchises.flatMap((f) => f.players.map((p) => p.id)));
        console.log(`  70–79 (${mid.length}, in squads ${mid.filter((p) => sq.has(p.id)).length}): ` + [...c2.entries()].sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(' · '));
        console.log(`  squad sizes: ${S().franchises.map((f) => f.players.length).join(',')}`);
        const sqIds = new Set(S().franchises.flatMap((f) => f.players.map((p) => p.id)));
        const sc = bandCounts(pool.filter((p) => sqIds.has(p.id)));
        const fc = bandCounts(pool.filter((p) => !sqIds.has(p.id)));
        console.log(`  squads: ${BANDS.map((b) => `${b} ${sc[b]}`).join(' · ')}   |   top-60 free agents: ${BANDS.map((b) => `${b} ${fc[b]}`).join(' · ')}`);
      }
    }
    if (y === SEASONS) break;

    playSeason(seed);
    snap();
    const stats = S().playerSeasonStats;
    const before = new Map(S().allPlayers.map((p) => [p.id, p]));
    const next = S().currentSeason + 1;
    advance();
    const retired = before.size - S().allPlayers.filter((p) => before.has(p.id)).length;
    res.retirements.push(retired);
    if (detail) console.log(`  Retirements → ${next}: ${retired}`);
    const prog = measureProgress(before, stats, next);
    if (process.env.DIAG && detail) diag(before, stats, pool);
    res.progress.push(prog);
    if (detail) {
      console.log(
        `  Progression → ${next}: Breakout ${prog.breakouts} · Rising ${prog.rising} · Stalled ${prog.stalled} · Bust ${prog.busts} · Domestic breakout ${prog.domestic} · stall rate ${(prog.stallRate * 100).toFixed(0)}%`
      );
      console.log(
        `  Strong young (n=${prog.strongGain.length}): +${mean(prog.strongGain).toFixed(1)} OVR, +${mean(prog.strongPot).toFixed(1)} POT · poor (n=${prog.poorGain.length}): ${mean(prog.poorGain).toFixed(1)} OVR, ${mean(prog.poorPot).toFixed(1)} POT · idle (n=${prog.idleGain.length}): +${mean(prog.idleGain).toFixed(1)} OVR`
      );
      printTopYoung(stats, before);
    }
    if (auctionTypeFor(S().currentSeason, S().settings) === 'Mega') {
      megaRetention(seed);
      const m = trackedAuction('Mega');
      if (detail) printMoney(m);
    } else {
      // Mini auction for the next season. CPUs released at the rollover; every kept
      // player is carried as a "retention" (what confirmMiniReleases does for the human).
      const st = S();
      useGameStore.setState({
        franchises: st.franchises.map((f) => ({ ...f, retainedPlayers: f.players })),
        retentionDecisions: st.franchises.flatMap((f) =>
          f.players.map((p, i) => ({ franchiseId: f.id, playerId: p.id, playerName: p.name, retentionNumber: i + 1, cost: p.soldPrice || p.currentContractValue || p.basePrice, isRTM: false }))
        ),
        retentionComplete: true,
      });
      S().initializeRegistration();
      const a = auctionYouth(S().currentSeason);
      res.auctions.push(a);
      if (detail) {
        printMoney(moneyLog[moneyLog.length - 1]);
        console.log(
          `  Mini auction ${a.season}: wonderkids ${a.wonderkids} · hot prospects ${a.hot} · ready-now ${a.ready} · domestic breakouts ${a.domestic} · youth sold ${(a.soldPct * 100).toFixed(0)}% · wonderkid median ₹${(median(a.wonderkidPrices) / 100).toFixed(2)} Cr [${a.wonderkidPrices.map((p) => (p / 100).toFixed(1)).join(', ')}] · hot median ₹${(median(a.hotPrices) / 100).toFixed(2)} Cr`
        );
      }
    }
  }
  snap();
  res.money = [...moneyLog];
  if (process.env.DIAG && detail) {
    const tr = traces;
    const rows = startYoung
      .map((id) => tr.get(id)!)
      .filter((t) => t && t[0].ovr >= 68)
      .sort((a, b) => b[b.length - 1].ovr - a[a.length - 1].ovr);
    console.log('  S1 cohort (Indian ≤23, 68–75):');
    for (const t of rows) console.log('    ' + t.map((x) => `${x.ovr}/${x.pot} m${x.m}${x.t ? ' ' + x.t[0] : ''}`).join(' → ') + `  ${t[0].name}`);
  }
  if (detail) console.log(`  Indians ≤23 and <76 at season 1 who are ≥80 by season 4: ${res.youngRisers}`);
  return res;
}

// ---------------------------------------------------------------- report

const t0 = Date.now();
const results = SEEDS.map(runCareer);
const all = <T,>(f: (r: CareerResult) => T[]) => results.flatMap(f);

console.log('\n================ PASS / FAIL (averaged over seeds ' + SEEDS.join(', ') + ') ================');
console.log('(progression criteria: first cycle, 3 progressions; money criteria: both cycles)');
const rows: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail: string) => rows.push([name, ok, detail]);

for (let y = 0; y < Math.min(4, results[0].bands.length); y++) {
  const avg = Object.fromEntries(BANDS.map((b) => [b, mean(results.map((r) => r.bands[y][b]))])) as Record<Band, number>;
  const bad = BANDS.filter((b) => avg[b] < TARGETS[b][0] - 0.5 || avg[b] > TARGETS[b][1] + 0.5);
  const size = BANDS.reduce((t, b) => t + avg[b], 0);
  check(`Rating spread at start of season ${y + 1}`, bad.length === 0, BANDS.map((b) => `${b} ${avg[b].toFixed(1)}`).join(' · ') + ` (n ${size.toFixed(0)})` + (bad.length ? `  (off: ${bad.join(', ')})` : ''));
}
const drift = mean(results.map((r) => Math.max(...r.means) - Math.min(...r.means)));
check('League mean drift ≤ ±1.0', drift <= 2.0 && mean(results.map((r) => Math.abs(r.means[3] - r.means[0]))) <= 1.0, `S1→S4 ${mean(results.map((r) => r.means[3] - r.means[0])).toFixed(2)}, max range ${drift.toFixed(2)}`);
const sg = all((r) => r.progress.slice(0, 3).flatMap((p) => p.strongGain));
const sp = all((r) => r.progress.slice(0, 3).flatMap((p) => p.strongPot));
check('Strong young season: +5..+10 OVR', mean(sg) >= 5 && mean(sg) <= 10, `mean +${mean(sg).toFixed(1)} (n=${sg.length}), ${((sg.filter((g) => g >= 5 && g <= 10).length / Math.max(1, sg.length)) * 100).toFixed(0)}% in range`);
check('Strong young season: +3..+6 POT', mean(sp) >= 3 && mean(sp) <= 6, `mean +${mean(sp).toFixed(1)}`);
const bo = all((r) => r.progress.slice(0, 3).map((p) => p.breakouts));
check('Breakout Indian youngsters per season 8–15', mean(bo) >= 8 && mean(bo) <= 15, `mean ${mean(bo).toFixed(1)} [${bo.join(', ')}]`);
const yr = results.map((r) => r.youngRisers);
check('≥12 young Indians (<76 at S1) reach 80+ by S4', mean(yr) >= 12, `mean ${mean(yr).toFixed(1)} [${yr.join(', ')}]`);
const pg = all((r) => r.progress.slice(0, 3).flatMap((p) => p.poorGain));
const pp = all((r) => r.progress.slice(0, 3).flatMap((p) => p.poorPot));
check('Poor young season: −2..−4 POT, little growth', !pp.length || (mean(pp) <= -2 && mean(pp) >= -4 && mean(pg) <= 2), `POT ${mean(pp).toFixed(1)}, OVR ${mean(pg).toFixed(1)} (n=${pp.length})`);
const sr = all((r) => r.progress.slice(0, 3).map((p) => p.stallRate));
check('Prospects who stall 10–20%', mean(sr) >= 0.1 && mean(sr) <= 0.2, `${(mean(sr) * 100).toFixed(1)}%`);
const ig = all((r) => r.progress.slice(0, 3).flatMap((p) => p.idleGain));
const ib = all((r) => r.progress.slice(0, 3).map((p) => p.idleBreakouts)).reduce((a, b) => a + b, 0);
check('0-match prospects: +0..+3, no breakouts', mean(ig) >= 0 && mean(ig) <= 3 && ib === 0, `mean +${mean(ig).toFixed(2)} (n=${ig.length}), breakouts ${ib}`);
const dom = all((r) => r.progress.slice(0, 3).map((p) => p.domestic));
check('Domestic breakouts per off-season 8–15', mean(dom) >= 8 && mean(dom) <= 15, `mean ${mean(dom).toFixed(1)} [${dom.join(', ')}]`);
const au = all((r) => r.auctions);
check('Mini pool: 2–4 wonderkids', mean(au.map((a) => a.wonderkids)) >= 2 && mean(au.map((a) => a.wonderkids)) <= 4, `mean ${mean(au.map((a) => a.wonderkids)).toFixed(1)}`);
check('Mini pool: 6–10 hot prospects', mean(au.map((a) => a.hot)) >= 6 && mean(au.map((a) => a.hot)) <= 10, `mean ${mean(au.map((a) => a.hot)).toFixed(1)}`);
check('Mini pool: 8–12 ready-now performers', mean(au.map((a) => a.ready)) >= 8 && mean(au.map((a) => a.ready)) <= 12, `mean ${mean(au.map((a) => a.ready)).toFixed(1)}`);
check('Mini pool: 8–15 domestic breakouts', mean(au.map((a) => a.domestic)) >= 8 && mean(au.map((a) => a.domestic)) <= 15, `mean ${mean(au.map((a) => a.domestic)).toFixed(1)}`);
check('≥80% of wonderkids + hot prospects sold', mean(au.map((a) => a.soldPct)) >= 0.8, `${(mean(au.map((a) => a.soldPct)) * 100).toFixed(0)}%`);
const wp = au.flatMap((a) => a.wonderkidPrices);
const inBand = wp.filter((p) => p >= 100 && p <= 600).length / Math.max(1, wp.length);
check('Wonderkid prices mostly ₹1–6 Cr', median(wp) >= 100 && median(wp) <= 600 && inBand >= 0.6, `median ₹${(median(wp) / 100).toFixed(2)} Cr, ${(inBand * 100).toFixed(0)}% in band (n=${wp.length})`);

const megas = all((r) => r.money.filter((m) => m.type === 'Mega'));
const minis = all((r) => r.money.filter((m) => m.type === 'Mini'));
const megaLeft = megas.flatMap((m) => m.leftCr);
check('Mega auctions: no team keeps ₹10 Cr+', megaLeft.filter((l) => l >= 10).length === 0, `mean left ₹${mean(megaLeft).toFixed(1)} Cr, max ₹${Math.max(...megaLeft).toFixed(1)} Cr, teams ≥₹10 Cr ${megaLeft.filter((l) => l >= 10).length}/${megaLeft.length}, spent ${(mean(megas.map((m) => m.spentPct)) * 100).toFixed(0)}%`);
check('≤78 OVR (26+) at star money (₹6 Cr per ₹120 Cr purse), megas', mean(megas.map((m) => m.overpaidCount)) <= 1, `per mega ${mean(megas.map((m) => m.overpaidCount)).toFixed(1)}`);
check('≤78 OVR (26+) at star money, minis', mean(minis.map((m) => m.overpaidCount)) <= 2, `per mini ${mean(minis.map((m) => m.overpaidCount)).toFixed(1)}, mini spend ${(mean(minis.map((m) => m.spentPct)) * 100).toFixed(0)}%`);
const allMoney = [...megas, ...minis];
check('No ≤74 OVR player sold for ₹5 Cr+ (any auction)', allMoney.every((m) => m.fadedCount === 0), `total ${allMoney.reduce((t, m) => t + m.fadedCount, 0)} across ${allMoney.length} auctions`);
const ret = all((r) => r.retirements);
check('Retirements per off-season (info)', true, `mean ${mean(ret).toFixed(1)} [${ret.join(', ')}]`);

for (const [name, ok, detail] of rows) console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name.padEnd(48)} ${detail}`);
console.log(`\n${rows.filter((r) => r[1]).length}/${rows.length} criteria pass · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log('PROGRESSION_TUNING.domestic =', JSON.stringify(PROGRESSION_TUNING.domestic));
