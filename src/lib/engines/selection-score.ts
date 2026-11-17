// ============================================================
// IPL DYNASTY - Selection score
// What a selector sees when picking this season's XI: overall, adjusted for age
// (a 39-year-old rated 82 is not an 82 any more), actual IPL output, current
// form, and development minutes for young Indians with real headroom — a
// franchise plays its Suryavanshi ahead of a fading overseas name, and a
// youngster who scores runs in his first games keeps his place.
// ============================================================

import type { Player } from '@/lib/types/game';
import { iplPerformance } from './auction/market-value';
import { PROGRESSION_TUNING } from './career/progression-tuning';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function selectionScore(p: Player): number {
  const F = PROGRESSION_TUNING.form;
  let s = p.ratings.overall;
  const perf = p.ipl && p.ipl.matches >= 8 ? iplPerformance(p) : 0;
  const head = p.ratings.potential - p.ratings.overall;
  if (p.nationality === 'Indian' && p.age <= 23 && head >= 5) s += Math.min(F.youngBonusMax, 1 + head / F.youngBonusDivisor);
  // Past 34 the legs go, whatever the rating says. Proven IPL performers fade slower
  // until 36; after that nobody is spared.
  if (p.age >= 35) s -= Math.min(2, p.age - 34) * (perf >= 0.3 ? 0.6 : 1.3) + Math.max(0, p.age - 36) * 1.5;
  s += clamp(perf * 4, -3, 3);
  // In-season form, once there are a couple of games to go on.
  if ((p.seasonForm?.matches ?? 0) >= F.minMatchesForForm) {
    s += clamp(((p.recentForm || 75) - 75) / F.formDivisor, F.formClamp[0], F.formClamp[1]);
  }
  // Experienced Indians out of the India side who did little last season get passed over.
  const last = p.development;
  if (p.nationality === 'Indian' && p.status === 'Capped' && p.age >= 30 && last && typeof last.perf === 'number' && last.perf < PROGRESSION_TUNING.late.midPerf) {
    s -= F.fadingVetPenalty;
  }
  return Math.round(s * 10) / 10;
}
