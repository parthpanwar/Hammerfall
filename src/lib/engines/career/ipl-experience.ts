// ============================================================
// IPL DYNASTY - IPL experience ledger
// Every player carries their real IPL record (Cricsheet, to 2026). When a
// career season ends, everyone who was in an IPL squad gets that season added:
// matches and output if they played, and a "last IPL squad" year either way.
// Auction AI reads this to prefer proven, recent IPL players.
// ============================================================

import type { Franchise, IplRecord, Player, PlayerSeasonStats } from '@/lib/types/game';

const EMPTY = (season: number): IplRecord => ({
  seasons: 0,
  matches: 0,
  firstSeason: season,
  lastSeason: 0,
  runs: 0,
  strikeRate: 0,
  battingAvg: 0,
  wickets: 0,
  economy: 0,
  ballsBowled: 0,
});

/** Fold one season's stats into an IPL record. */
export function addIplSeason(rec: IplRecord | undefined, s: PlayerSeasonStats | undefined, season: number, inSquad: boolean): IplRecord | undefined {
  const played = !!s && s.matches > 0;
  if (!played && !inSquad) return rec;
  const r = { ...(rec ?? EMPTY(season)) };
  r.lastSquadSeason = Math.max(r.lastSquadSeason ?? 0, season);
  if (!played) return r;
  const prevBalls = r.strikeRate > 0 ? (r.runs * 100) / r.strikeRate : 0;
  const prevOuts = r.battingAvg > 0 ? r.runs / r.battingAvg : 0;
  const runs = r.runs + s!.runs;
  const balls = prevBalls + s!.ballsFaced;
  const outs = prevOuts + (s!.battingAverage > 0 ? s!.runs / s!.battingAverage : 0);
  const ballsBowled = r.ballsBowled + Math.round((s!.oversBowled || 0) * 6);
  const conceded = (r.economy * r.ballsBowled) / 6 + (s!.runsConceded || 0);
  r.seasons += 1;
  r.matches += s!.matches;
  r.firstSeason = r.seasons === 1 ? season : Math.min(r.firstSeason, season);
  r.lastSeason = season;
  r.runs = runs;
  r.strikeRate = balls > 0 ? Math.round((runs * 1000) / balls) / 10 : 0;
  r.battingAvg = outs > 0 ? Math.round((runs * 10) / outs) / 10 : runs;
  r.wickets += s!.wickets || 0;
  r.ballsBowled = ballsBowled;
  r.economy = ballsBowled > 0 ? Math.round((conceded * 600) / ballsBowled) / 100 : 0;
  return r;
}

/** Apply the finished season to every player who was in a squad (or played). */
export function applyIplSeason(
  allPlayers: Player[],
  franchises: Franchise[],
  seasonStats: Record<string, PlayerSeasonStats>,
  season: number
): Player[] {
  const squad = new Set(franchises.flatMap((f) => f.players.map((p) => p.id)));
  return allPlayers.map((p) => {
    const inSquad = squad.has(p.id);
    const s = seasonStats[p.id];
    if (!inSquad && !(s && s.matches > 0)) return p;
    return { ...p, ipl: addIplSeason(p.ipl, s, season, inSquad) };
  });
}
