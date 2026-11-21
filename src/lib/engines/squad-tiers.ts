// ============================================================
// IPL DYNASTY - How an IPL squad is built, in five tiers
//  1. Cornerstones (Indian or overseas): Kohli, Bumrah, Gill, Buttler, Rashid…
//  2. Indian core: good-not-great Indians, 82–87.
//  3. Overseas starters: 80–87 internationals who fill the four overseas spots
//     in the XI without being the face of the franchise.
//  4. Indian depth: young Indians, bench cover, future starters.
//  5. Overseas backups: cover for an overseas starter (Duffy behind Hazlewood,
//     de Kock behind Rickelton) and young internationals being groomed
//     (Bethell, Maphaka, Lhuan-dre Pretorius).
// ============================================================

import type { Player } from '@/lib/types/game';
import { isStalwart } from './career/overseas-pipeline';

export type SquadTier = 1 | 2 | 3 | 4 | 5;

export const TIER_MIN = { cornerstone: 88, indianCore: 82, overseasStarter: 80 };

export const TIER_LABEL: Record<SquadTier, string> = {
  1: 'Cornerstone',
  2: 'Indian core',
  3: 'Overseas starter',
  4: 'Indian depth',
  5: 'Overseas backup',
};

export function squadTier(p: Pick<Player, 'id' | 'nationality' | 'ratings'>): SquadTier {
  const o = p.ratings.overall;
  if (o >= TIER_MIN.cornerstone || (isStalwart(p.id) && o >= TIER_MIN.overseasStarter)) return 1;
  if (p.nationality === 'Indian') return o >= TIER_MIN.indianCore ? 2 : 4;
  return o >= TIER_MIN.overseasStarter ? 3 : 5;
}

/** A young overseas player worth carrying as a backup while he develops. */
export function isOverseasGroomer(p: Pick<Player, 'nationality' | 'age' | 'ratings'>): boolean {
  return p.nationality === 'Overseas' && p.age <= 24 && p.ratings.potential >= 84;
}

/** Chip text for the UI, e.g. "Tier 3 · Overseas starter". */
export function tierLabel(p: Pick<Player, 'id' | 'nationality' | 'age' | 'ratings'>): string {
  const t = squadTier(p);
  if (t === 5 && isOverseasGroomer(p)) return 'Tier 5 · Overseas prospect';
  if (t === 4 && p.age <= 23 && p.ratings.potential >= 82) return 'Tier 4 · Future starter';
  return `Tier ${t} · ${TIER_LABEL[t]}`;
}
