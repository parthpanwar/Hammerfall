// ============================================================
// IPL DYNASTY - Prospect labels for the UI
// ============================================================

import type { Player } from '@/lib/types/game';

/** "Wonderkid" (uncapped, POT 88+) or "Prospect" (uncapped Indian ≤ 23, POT 84+). */
export function prospectLabel(p: Player): 'Wonderkid' | 'Prospect' | null {
  if (p.status !== 'Uncapped') return null;
  if (p.ratings.potential >= 88 && p.age <= 21) return 'Wonderkid';
  if (p.nationality === 'Indian' && p.age <= 23 && p.ratings.potential >= 84) return 'Prospect';
  return null;
}

/** Show the development note: anything but a quiet "Steady" year, and always a new rookie's scouting report. */
export function showDevelopmentNote(p: Player, season: number): boolean {
  const d = p.development;
  if (!d || !d.note || d.season < season - 1) return false;
  return d.trend !== 'Steady' || p.id.startsWith(`gen_${d.season}_`);
}
