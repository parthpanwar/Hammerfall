// ============================================================
// IPL DYNASTY - Starting rating spread
// A one-time, monotonic remap of `overall` at load so the league starts with the
// right shape: a rare elite, a deep band of 80–84 starters and a healthy 75–79
// middle. Ranks are preserved and nobody moves more than ±4. Saves made before
// the remap keep their original ratings (see player-compaction: RATING_REMAP_VERSION).
// ============================================================

import type { Player } from '../types/game';
import { hashString } from '../engines/career/dev-rng';

/** Bump when the remap changes; saves stamp the version they were made with. */
export const RATING_REMAP_VERSION = 1;

/** Lift the potential of young 60–64 uncapped Indians so the season-1 pool has some upside. */
export const LIFT_YOUNG_UNCAPPED_POTENTIAL = true;

/**
 * Target counts in the IPL-relevant pool (squads + the best 60 outside them),
 * from the top: 90+, 85–89, 80–84, 75–79, 70–74. Everyone below keeps his rating.
 */
const TARGET_BANDS: { top: number; count: number }[] = [
  { top: 94, count: 7 }, // 90+
  { top: 89, count: 28 }, // 85–89
  { top: 84, count: 70 }, // 80–84
  { top: 79, count: 72 }, // 75–79
  { top: 74, count: 56 }, // 70–74
];
const KEEP_TOP = 3; // the genuine 90+ stars are left exactly as they are
const MAX_SHIFT = 4;
const NO_LIFT_FROM_AGE = 36;

function isActive(p: Player) {
  return !p.isRetired && p.professionalStatus !== 'RETIRED';
}

/**
 * Per-player targets for the relevant pool (rank → band, ties broken by the raw
 * model rating), plus a monotonic value map for everyone outside it.
 */
function buildMap(players: Player[]): { byId: Map<string, number>; f: (v: number) => number } {
  const squad = players.filter((p) => p.currentFranchiseId && isActive(p));
  const rest = players
    .filter((p) => !p.currentFranchiseId && isActive(p))
    .sort((a, b) => b.ratings.overall - a.ratings.overall || a.id.localeCompare(b.id))
    .slice(0, 60);
  const pool = [...squad, ...rest].sort(
    (a, b) =>
      b.ratings.overall - a.ratings.overall ||
      (b.ratings.modelOverall ?? 0) - (a.ratings.modelOverall ?? 0) ||
      a.id.localeCompare(b.id)
  );

  // Rank → target overall (each band spread evenly from its top to its bottom).
  const target: number[] = [];
  let rank = 0;
  for (const band of TARGET_BANDS) {
    const lo = band.top === 94 ? 90 : band.top - 4;
    for (let i = 0; i < band.count && rank < pool.length; i++, rank++) {
      target.push(band.top - Math.floor(((band.top - lo + 1) * i) / band.count));
    }
  }
  const sums = new Map<number, { t: number; n: number }>();
  pool.forEach((p, i) => {
    if (i < KEEP_TOP || i >= target.length) return;
    const v = p.ratings.overall;
    const e = sums.get(v) ?? { t: 0, n: 0 };
    e.t += target[i];
    e.n += 1;
    sums.set(v, e);
  });
  const keepFloor = pool[KEEP_TOP - 1]?.ratings.overall ?? 99;
  const lowest = pool[Math.min(pool.length, target.length) - 1]?.ratings.overall ?? 0;

  const delta = new Map<number, number>();
  for (let v = 99; v >= 40; v--) {
    let d: number;
    if (v >= keepFloor) d = 0;
    else if (sums.has(v)) {
      const e = sums.get(v)!;
      d = Math.round(e.t / e.n) - v;
    } else if (v < lowest) {
      // Fade the shift out below the relevant pool.
      const anchor = delta.get(lowest) ?? 0;
      d = Math.round(anchor * Math.max(0, 1 - (lowest - v) / 5));
    } else d = delta.get(v + 1) ?? 0;
    delta.set(v, Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, d)));
  }
  // Monotonic: a higher original rating never maps below a lower one.
  let ceiling = 99;
  const mapped = new Map<number, number>();
  for (let v = 99; v >= 40; v--) {
    const m = Math.min(ceiling, v + delta.get(v)!);
    mapped.set(v, m);
    ceiling = m;
  }
  for (let v = 40; v <= 99; v++) {
    // Keep ranks strict-ish from below too (never push below a lower original).
    const below = mapped.get(v - 1);
    if (below !== undefined && mapped.get(v)! < below) mapped.set(v, below);
  }
  const f = (v: number) => (v < 40 || v > 99 ? v : mapped.get(v)!);

  // Per player inside the pool: his rank's target, within ±MAX_SHIFT, never above the man ranked above him.
  const byId = new Map<string, number>();
  let prev = 99;
  pool.forEach((p, i) => {
    const raw = p.ratings.overall;
    let t = i < KEEP_TOP ? raw : i < target.length ? Math.max(raw - MAX_SHIFT, Math.min(raw + MAX_SHIFT, target[i])) : f(raw);
    t = Math.min(t, prev);
    byId.set(p.id, t);
    prev = t;
  });
  return { byId, f };
}

/** Apply the remap (and the optional potential lift) to the bundled database. */
export function remapRatingSpread(players: Player[]): Player[] {
  const { byId, f } = buildMap(players);
  return players.map((p) => {
    const raw = p.ratings.overall;
    let overall = !isActive(p) ? raw : byId.get(p.id) ?? f(raw);
    // Never lift a player in his late thirties: his shipped rating already lags his decline.
    if (p.age >= NO_LIFT_FROM_AGE) overall = Math.min(overall, raw);
    const d = overall - raw;
    let potential = Math.max(overall, p.ratings.potential + d);
    if (
      LIFT_YOUNG_UNCAPPED_POTENTIAL &&
      p.nationality === 'Indian' &&
      p.status === 'Uncapped' &&
      p.age <= 23 &&
      raw >= 60 &&
      raw <= 64 &&
      potential < 74
    ) {
      potential = 74 + (hashString(`${p.id}:lift`) % 11); // 74–84
    }
    // Young Indians already knocking on the door (65–75) get an age-appropriate ceiling:
    // the shipped data has many 21-year-olds at overall + 6, which leaves nothing to grow into.
    if (LIFT_YOUNG_UNCAPPED_POTENTIAL && p.nationality === 'Indian' && p.age <= 23 && overall >= 65 && overall <= 75) {
      const gap = (p.age <= 19 ? 10 : p.age <= 21 ? 8 : 6) + (hashString(`${p.id}:gap`) % 5);
      potential = Math.max(potential, Math.min(88, overall + gap));
    }
    if (d === 0 && potential === p.ratings.potential) return p;
    const r = p.ratings;
    const bat = p.role === 'Batter' || p.role === 'Wicketkeeper' || p.role === 'All-Rounder';
    const bowl = p.role === 'Bowler' || p.role === 'All-Rounder';
    return {
      ...p,
      ratings: {
        ...r,
        overall,
        potential,
        batting: bat ? Math.max(15, Math.min(99, r.batting + d)) : r.batting,
        bowling: bowl ? Math.max(10, Math.min(99, r.bowling + d)) : r.bowling,
        preRemapOverall: raw,
        remapVersion: RATING_REMAP_VERSION,
      },
    };
  });
}
