// ============================================================
// IPL DYNASTY - Selection score
// What a selector sees when picking this season's XI: overall, adjusted for age
// (a 39-year-old rated 82 is not an 82 any more), actual IPL output, and
// development minutes for young Indians with real headroom — a franchise plays its
// Suryavanshi ahead of a fading overseas name.
// ============================================================

import type { Player } from '@/lib/types/game';
import { iplPerformance } from './auction/market-value';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function selectionScore(p: Player): number {
  let s = p.ratings.overall;
  const perf = p.ipl && p.ipl.matches >= 8 ? iplPerformance(p) : 0;
  const head = p.ratings.potential - p.ratings.overall;
  if (p.nationality === 'Indian' && p.age <= 23 && head >= 5) s += Math.min(3, 1 + head / 6);
  // Past 34 the legs go, whatever the rating says. Proven IPL performers fade slower
  // until 36; after that nobody is spared.
  if (p.age >= 35) s -= Math.min(2, p.age - 34) * (perf >= 0.3 ? 0.6 : 1.3) + Math.max(0, p.age - 36) * 1.5;
  s += clamp(perf * 4, -3, 3);
  return Math.round(s * 10) / 10;
}
