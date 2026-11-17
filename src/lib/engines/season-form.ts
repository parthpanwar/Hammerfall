// ============================================================
// IPL DYNASTY - In-season form
// After every match each player who appeared gets a 0–100 match rating (runs and
// strike rate, wickets and economy) folded into recentForm as a moving average.
// selectionScore reads it, so a youngster who scores in his first few games keeps
// his place, and the CPU's blooding rule reads the appearance log.
// ============================================================

import type { Player } from '@/lib/types/game';
import { PROGRESSION_TUNING } from './career/progression-tuning';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** One player's numbers from one match. */
export interface MatchLine {
  runs?: number;
  balls?: number;
  wickets?: number;
  overs?: number;
  runsConceded?: number;
}

/** 0–100 match rating, centred on 75 for an average IPL contribution; null = did nothing measurable. */
export function matchFormRating(p: Pick<Player, 'role'>, line: MatchLine | undefined): number | null {
  if (!line) return null;
  const balls = line.balls ?? 0;
  const overs = line.overs ?? 0;
  const bat = balls > 0 ? 75 + ((line.runs ?? 0) - 22) * 0.8 + (balls >= 8 ? (((line.runs ?? 0) / balls) * 100 - 138) * 0.1 : 0) : null;
  const bowl = overs >= 1 ? 75 + ((line.wickets ?? 0) - 1) * 12 + (8.8 - (line.runsConceded ?? 0) / overs) * 4 * Math.min(1, overs / 2) : null;
  let v: number | null;
  if (p.role === 'Bowler') v = bowl ?? (bat !== null && balls >= 8 ? bat : null);
  else if (p.role === 'All-Rounder') v = bat !== null && bowl !== null ? (bat + bowl) / 2 + 3 : bat ?? bowl;
  else v = bat;
  return v === null ? null : clamp(v, 20, 100);
}

const popcount5 = (m: number) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1) + ((m >> 4) & 1));

/** Appearances in the team's last five matches (this season only). */
export function recentApps(p: Player, season: number): number {
  return p.seasonForm && p.seasonForm.season === season ? popcount5(p.seasonForm.apps) : 0;
}

/**
 * Fold one match into a squad member's form. `played` = in the XI; `line` = his numbers.
 * Squad members who sat out still shift their appearance log.
 */
export function applyMatchToPlayer(p: Player, season: number, played: boolean, line: MatchLine | undefined, blooded = false): Player {
  const prev = p.seasonForm && p.seasonForm.season === season ? p.seasonForm : { season, matches: 0, apps: 0 };
  const seasonForm = {
    season,
    matches: prev.matches + (played ? 1 : 0),
    apps: ((prev.apps << 1) | (played ? 1 : 0)) & 31,
    blooded: prev.blooded || blooded || undefined,
  };
  let recentForm = p.recentForm || 75;
  if (played) {
    const r = matchFormRating(p, line);
    if (r !== null) {
      const a = PROGRESSION_TUNING.form.emaAlpha;
      recentForm = Math.round((recentForm * (1 - a) + r * a) * 10) / 10;
    }
  }
  return { ...p, recentForm, seasonForm };
}

export interface MatchRecord {
  season: number;
  /** Squad ids of both teams → whether they played. */
  xiIds: Set<string>;
  lines: Map<string, MatchLine>;
  /** Players picked by the blooding rule for this match. */
  bloodedIds?: Set<string>;
}

/** Build per-player lines from a simulated match's innings. */
export function linesFromInnings(
  batsmen: { playerId: string; runs: number; balls: number }[],
  bowlers: { playerId: string; wickets: number; overs: number; runs: number }[]
): Map<string, MatchLine> {
  const lines = new Map<string, MatchLine>();
  for (const b of batsmen) {
    const l = lines.get(b.playerId) ?? {};
    l.runs = (l.runs ?? 0) + b.runs;
    l.balls = (l.balls ?? 0) + b.balls;
    lines.set(b.playerId, l);
  }
  for (const b of bowlers) {
    const l = lines.get(b.playerId) ?? {};
    l.wickets = (l.wickets ?? 0) + b.wickets;
    l.overs = (l.overs ?? 0) + b.overs;
    l.runsConceded = (l.runsConceded ?? 0) + b.runs;
    lines.set(b.playerId, l);
  }
  return lines;
}
