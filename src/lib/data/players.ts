// ============================================================
// IPL DYNASTY - Comprehensive Global Player Database
// Contains 1250 verified real-world cricketers across India,
// Australia, England, South Africa, West Indies, New Zealand, Afghanistan,
// Sri Lanka, Bangladesh, and Associate Nations.
// ============================================================

import type { IplRecord, Player } from '../types/game';
import globalData from './global-player-database.json';
import iplHistory from './ipl-history.json';

const IPL = (iplHistory as { players: Record<string, IplRecord> }).players;

/** The season the bundled squads and IPL records run to. */
export const DATA_SEASON = 2026;

/**
 * Full global player database, each player carrying their real IPL record (if any).
 * Everyone in an IPL 2026 squad is marked as a 2026 squad member, played or not.
 */
export const GLOBAL_PLAYERS: Player[] = (globalData.players as Player[]).map((p) => {
  const rec = IPL[p.id];
  if (!rec && !p.currentFranchiseId) return p;
  const base: IplRecord = rec ?? { seasons: 0, matches: 0, firstSeason: DATA_SEASON, lastSeason: 0, runs: 0, strikeRate: 0, battingAvg: 0, wickets: 0, economy: 0, ballsBowled: 0 };
  return { ...p, ipl: { ...base, lastSquadSeason: p.currentFranchiseId ? DATA_SEASON : base.lastSeason } };
});

/** Core starting players for the initial season franchises (193 players) */
export const PLAYERS: Player[] = GLOBAL_PLAYERS.filter((p) => p.currentFranchiseId !== null || p.basePrice >= 100);
