// ============================================================
// IPL DYNASTY - Deterministic randomness for player development
// Everything in the career pipeline draws from these seeded streams so the
// same seed + same choices always produce the same career.
// ============================================================

import type { DevProfile, Player } from '@/lib/types/game';
import { PROGRESSION_TUNING } from './progression-tuning';

/** FNV-1a string hash. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 stream from a 32-bit state. */
export function mulberry32(state: number): () => number {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic per-player, per-season random stream. */
export function playerRng(id: string, season: number, seed: number): () => number {
  return mulberry32((hashString(id) ^ Math.imul(season, 2654435761) ^ seed) >>> 0);
}

/** Hidden development profile; derived from the id hash when the save predates the field. */
export function devProfileOf(p: Pick<Player, 'id' | 'devProfile'>): DevProfile {
  if (p.devProfile) return p.devProfile;
  const share = PROGRESSION_TUNING.devProfileShare;
  const u = (hashString(`${p.id}:dev`) % 10000) / 10000;
  let acc = 0;
  for (const k of ['EarlyBloomer', 'Standard', 'LateBloomer', 'Plateau'] as DevProfile[]) {
    acc += share[k];
    if (u < acc) return k;
  }
  return 'Standard';
}
