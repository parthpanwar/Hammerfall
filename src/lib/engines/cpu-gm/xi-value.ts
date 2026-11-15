// ============================================================
// IPL DYNASTY - Playing XI value
//
// How much a player is really worth to a team's XI — not his raw overall.
//
// • selectionScore: what a selector sees. Overall, adjusted for age (a 39-year-old
//   rated 82 is not an 82 any more), actual IPL output, and development minutes for
//   young Indians with real headroom (a franchise plays its Suryavanshi ahead of a
//   fading overseas name).
// • xiGain: how much a candidate lifts this squad's best XI. Empty XI spots are
//   filled with a "replacement-level" Indian from the remaining pool, so an early
//   overseas buy is measured against the Indian the team could sign later — not
//   against an empty chair. That is what stops teams filling all eight overseas
//   slots in the first fifty lots.
// ============================================================

import type { AuctionSession, Franchise, Player } from '@/lib/types/game';
import { generateBestPlayingXI } from '../squad-engine';
import { selectionScore } from '../selection-score';

export { selectionScore };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The squad's best XI under real selection (overseas cap, WK, bowling balance). */
export function bestXi(squad: Player[]): Player[] {
  if (squad.length === 0) return [];
  const xi = generateBestPlayingXI({ id: 'xi', players: squad } as unknown as Franchise);
  const byId = new Map(squad.map((p) => [p.id, p]));
  return xi.players.map((id) => byId.get(id)!).filter(Boolean);
}

const ROLE_SLOTS: { role: Player['role']; spinner?: boolean; n: number }[] = [
  { role: 'Wicketkeeper', n: 1 },
  { role: 'Batter', n: 3 },
  { role: 'All-Rounder', n: 2 },
  { role: 'Bowler', n: 2 },
  { role: 'Bowler', spinner: true, n: 1 },
  { role: 'Bowler', n: 2 },
];

/** Phantom Indians at replacement level, so an empty XI is never "free" to fill. */
function replacements(level: number): Player[] {
  const out: Player[] = [];
  let i = 0;
  for (const slot of ROLE_SLOTS) {
    for (let k = 0; k < slot.n; k++) {
      out.push({
        id: `__repl_${i++}`,
        name: 'Replacement',
        age: 27,
        nationality: 'Indian',
        status: 'Capped',
        role: slot.role,
        isSpinner: !!slot.spinner,
        isOpener: false,
        ratings: { overall: level, potential: level, batting: level, bowling: level, fielding: 60, consistency: 60 },
      } as unknown as Player);
    }
  }
  return out;
}

function xiTotal(squad: Player[], level: number): number {
  const pool = level > 0 && squad.length < 25 ? [...squad, ...replacements(level)] : squad;
  return bestXi(pool).reduce((t, p) => t + (p.id.startsWith('__repl_') ? level : selectionScore(p)), 0);
}

const levelCache = new Map<string, number>();

/**
 * Replacement level: the selection score of the Indian a team could still pick up
 * later in this auction (deep enough in the remaining pool to cover the league's
 * open XI spots).
 */
export function replacementLevel(session: AuctionSession): number {
  const key = `${session.id}:${session.round}:${session.currentPlayerIndex}`;
  const hit = levelCache.get(key);
  if (hit !== undefined) return hit;
  const remaining = session.playerPool
    .slice(session.currentPlayerIndex + 1)
    .filter((p) => p.nationality === 'Indian')
    .map(selectionScore)
    .sort((a, b) => b - a);
  const openXi = session.franchises.reduce((t, f) => t + Math.max(0, 11 - f.players.length), 0);
  const depth = Math.max(6, Math.round(openXi * 0.6));
  const level = clamp(remaining[Math.min(depth, remaining.length - 1)] ?? 68, 68, 78);
  if (levelCache.size > 5000) levelCache.clear();
  levelCache.set(key, level);
  return level;
}

const baseCache = new Map<string, number>();

/** Selection-score points an overseas player must beat the local option by. */
export const OVERSEAS_SLOT_COST = 2.5;

/**
 * Points (selection-score units) the candidate adds to this squad's best XI.
 * 0 = he would not start.
 */
export function xiGain(franchise: Franchise, candidate: Player, session?: AuctionSession): number {
  if (franchise.players.some((p) => p.id === candidate.id)) return 0;
  // Without an auction context, measure against a typical domestic squad player.
  const level = session ? replacementLevel(session) : 70;
  const key = `${franchise.id}:${level}:${franchise.players.length}:${franchise.players.map((p) => p.id).join(',')}`;
  let base = baseCache.get(key);
  if (base === undefined) {
    base = xiTotal(franchise.players, level);
    if (baseCache.size > 4000) baseCache.clear();
    baseCache.set(key, base);
  }
  const withHim = xiTotal([...franchise.players, candidate], level);
  let gain = withHim - base;
  // An overseas spot is one of only four: it has to buy a clear upgrade on the
  // Indian who would otherwise play there.
  if (candidate.nationality === 'Overseas') gain -= OVERSEAS_SLOT_COST;
  return Math.max(0, Math.round(gain * 10) / 10);
}
