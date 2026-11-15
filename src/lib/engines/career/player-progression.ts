// ============================================================
// IPL DYNASTY - Player Development Engine
// Advances player ratings, age, and attributes across seasons
// with bounded yearly changes and role-sensitive aging.
// ============================================================

import type { DevelopmentTrend, Player, PlayerSeasonStats } from '@/lib/types/game';
import type { PlayerProgressionDelta, PlayerCareerRecord } from '@/lib/types/career';
import { calculateAgeTrajectory } from '@/lib/intelligence/models/age-curve';

/**
 * Calculates attribute evolution for a player transitioning to the next season.
 * Enforces strict boundaries to prevent unrealistic single-season spikes or collapses.
 */
export function progressPlayerAttributes(
  player: Player,
  recentSeasonStats: PlayerSeasonStats | undefined,
  seasonYear: number,
  seed = 0
): { updatedPlayer: Player; delta: PlayerProgressionDelta } {
  const previousOverall = player.ratings.overall;
  const previousBatting = player.ratings.batting;
  const previousBowling = player.ratings.bowling;
  const previousPwr = player.ratings.powerHitting || 60;
  const previousConsistency = player.ratings.consistency || 65;
  const potential = player.ratings.potential;

  // 1. Advance Age
  const newAge = player.age + 1;

  // 2. Obtain role-sensitive age trajectory & phase
  const recentForm = player.recentForm || 75;
  const trajectory = calculateAgeTrajectory(player, recentForm);

  // 3. Season output and game time.
  const rng = playerRng(player.id, seasonYear, seed);
  const luck = rng() * 2 - 1; // development luck: coaching, fitness, role, confidence
  const perf = seasonPerformance(player, recentSeasonStats);
  const matches = recentSeasonStats?.matches ?? 0;
  const gameTime = matches >= 10 ? 0.6 : matches >= 5 ? 0.25 : matches > 0 ? -0.2 : newAge <= 23 ? -0.6 : -0.3;
  const headroom = Math.max(0, potential - previousOverall);
  const p0 = perf ?? 0;

  // 4. Growth / decline, and a potential that moves with the evidence.
  let overallChange = 0;
  let potentialChange = 0;
  let bust = false;
  let note = 'Stable performance in prime';

  if (trajectory.careerPhase === 'Emerging') {
    overallChange = headroom * (0.2 + 0.08 * luck) + p0 * 2 + gameTime;
    overallChange = Math.round(Math.max(matches === 0 && headroom > 0 ? 0 : -1, Math.min(7, overallChange)));
    if (p0 >= 0.5) potentialChange = Math.round(1 + p0 * 3);
    else if (p0 <= -0.4 && matches >= 6) potentialChange = -2 - Math.round(rng() * 2);
    else if (matches === 0 && luck < -0.5) potentialChange = -2 - Math.round(rng() * 2);
    else if (luck > 0.85) potentialChange = 1 + Math.round(rng() * 2);
    // Some prospects simply never kick on.
    if (luck < -0.8 && newAge >= 19 && p0 < 0.4) {
      bust = true;
      potentialChange = Math.min(potentialChange, -3 - Math.round(rng() * 3));
      overallChange = Math.min(overallChange, 0);
    }
    note = 'Young talent developing';
  } else if (trajectory.careerPhase === 'EarlyPrime') {
    // Good players with headroom keep climbing in their mid-twenties.
    overallChange = headroom * (0.28 + 0.08 * luck) + p0 * 1.4 + gameTime * 0.7;
    overallChange = Math.round(Math.max(-2, Math.min(5, overallChange)));
    if (p0 >= 0.55) potentialChange = 1 + Math.round(p0 + rng());
    else if (p0 <= -0.4 && matches >= 6) potentialChange = -2;
    else if (matches === 0 && luck < -0.4 && headroom >= 3) potentialChange = -2;
    note = 'Entering prime career years';
  } else if (trajectory.careerPhase === 'PeakPrime') {
    overallChange = p0 * 1.3 + (player.fitnessLevel >= 80 ? 0.3 : -0.3) + luck * 0.6;
    overallChange = Math.round(Math.max(-3, Math.min(3, overallChange)));
    note = 'Consistent peak prime output';
  } else if (trajectory.careerPhase === 'LatePrime') {
    overallChange = -1 + Math.round(p0 * 0.8 + luck * 0.4);
    overallChange = Math.max(-3, Math.min(1, overallChange));
    note = 'Experienced veteran maintaining quality';
  } else {
    if (trajectory.isOver35Exempt) {
      overallChange = Math.round(p0 * 0.6 - 0.5);
      overallChange = Math.max(-2, Math.min(1, overallChange));
      note = 'Master veteran defying age curve';
    } else {
      const fitnessDefense = (player.fitnessLevel - 70) * 0.03;
      overallChange = Math.round(-2.5 + fitnessDefense + p0 * 0.5);
      overallChange = Math.max(-5, Math.min(0, overallChange));
      note = 'Natural veteran physical decline';
    }
  }

  // Without IPL cricket to show for it, growth is steadier (nobody sees a leap).
  if (matches < 4) overallChange = Math.min(overallChange, 3);

  // Strict clamp on overallChange: [-5, +6]
  overallChange = Math.max(-5, Math.min(6, overallChange));

  const newOverall = Math.max(50, Math.min(99, previousOverall + overallChange));
  const newBatting = Math.max(30, Math.min(99, previousBatting + overallChange));
  const newBowling = Math.max(20, Math.min(99, previousBowling + (player.role === 'Bowler' || player.role === 'All-Rounder' ? overallChange : 0)));
  const newPwr = Math.max(30, Math.min(99, previousPwr + (overallChange < 0 ? overallChange - 1 : overallChange)));
  const newConsistency = Math.max(40, Math.min(99, previousConsistency + (newAge >= 26 ? 1 : 0)));

  // Potential moves with the evidence, and narrows with age.
  let newPotential = potential + potentialChange - (newAge >= 29 ? 1 : 0);
  newPotential = Math.max(newOverall + (newAge <= 25 ? 1 : 0), Math.min(99, newPotential));
  const potentialDelta = newPotential - potential;
  const trend: DevelopmentTrend = bust
    ? 'Bust'
    : matches >= 6 && newAge <= 28 && overallChange >= 2 && (p0 >= 0.55 || potentialDelta >= 3)
    ? 'Breakout'
    : overallChange >= 2
    ? 'Rising'
    : overallChange <= -2 && newAge >= 30
    ? 'Declining'
    : newAge <= 25 && overallChange <= 0 && potentialDelta < 0
    ? 'Stalled'
    : 'Steady';
  note = developmentNote(trend, player, recentSeasonStats, note);

  // New market value estimate based on new overall and age
  const estimatedMarketValue = Math.round(
    Math.max(20, (newOverall - 55) * (newOverall - 55) * (newAge <= 27 ? 1.4 : newAge <= 33 ? 1.0 : 0.7))
  );

  const updatedPlayer: Player = {
    ...player,
    age: newAge,
    ratings: {
      ...player.ratings,
      overall: newOverall,
      batting: newBatting,
      bowling: newBowling,
      powerHitting: newPwr,
      consistency: newConsistency,
      potential: newPotential,
    },
    estimatedMarketValue,
    recentForm: 75, // Reset to standard pre-season baseline
    development: { season: seasonYear, trend, overallDelta: newOverall - previousOverall, potentialDelta, note },
  };

  const delta: PlayerProgressionDelta = {
    playerId: player.id,
    playerName: player.name,
    age: newAge,
    previousOverall,
    newOverall,
    overallDelta: newOverall - previousOverall,
    previousBatting,
    newBatting,
    previousBowling,
    newBowling,
    potential: newPotential,
    progressionNote: note,
    potentialDelta,
    trend,
  };

  return { updatedPlayer, delta };
}

/**
 * Progresses all active players into the next season, then runs the domestic
 * season (a handful of uncapped players break out and become auction targets)
 * and the India selectors (the IPL's best uncapped Indians earn first caps).
 */
export function progressAllPlayers(
  players: Player[],
  seasonStats: Record<string, PlayerSeasonStats>,
  nextSeasonYear: number,
  seed = 0
): { updatedPlayers: Player[]; deltas: PlayerProgressionDelta[] } {
  const updatedPlayers: Player[] = [];
  const deltas: PlayerProgressionDelta[] = [];

  for (const player of players) {
    const stats = seasonStats[player.id];
    const { updatedPlayer, delta } = progressPlayerAttributes(player, stats, nextSeasonYear, seed);
    updatedPlayers.push(updatedPlayer);
    deltas.push(delta);
  }

  applyDomesticBreakouts(updatedPlayers, deltas, seasonStats, nextSeasonYear, seed);
  applyIndiaCallUps(updatedPlayers, deltas, seasonStats, nextSeasonYear);
  return { updatedPlayers, deltas };
}

// ------------------------------------------------------------------ helpers

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic per-player, per-season random stream (mulberry32). */
function playerRng(id: string, season: number, seed: number): () => number {
  let a = (hashString(id) ^ Math.imul(season, 2654435761) ^ seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Season output against an IPL-average baseline: −1 (poor) … +1.5 (outstanding); null = too little cricket. */
export function seasonPerformance(p: Player, s: PlayerSeasonStats | undefined): number | null {
  if (!s || s.matches < 4) return null;
  const bat =
    s.ballsFaced >= 60
      ? ((s.runs / s.matches - 22) / 14) * 0.6 + ((s.strikeRate - 140) / 22) * 0.4
      : null;
  const bowl =
    s.oversBowled >= 12
      ? ((s.wickets / s.matches - 0.9) / 0.6) * 0.5 + ((8.9 - s.economyRate) / 1.1) * 0.5
      : null;
  let v: number | null;
  if (p.role === 'Bowler') v = bowl;
  else if (p.role === 'All-Rounder') v = bat !== null && bowl !== null ? Math.max(bat, bowl) * 0.6 + Math.min(bat, bowl) * 0.4 + 0.15 : bat ?? bowl;
  else v = bat;
  return v === null ? null : clamp(v, -1, 1.5);
}

function developmentNote(trend: DevelopmentTrend, p: Player, s: PlayerSeasonStats | undefined, fallback: string): string {
  const line = s && s.matches > 0
    ? p.role === 'Bowler' || (p.role === 'All-Rounder' && s.wickets * 25 > s.runs)
      ? `${s.wickets} wkts at ${s.economyRate.toFixed(2)}`
      : `${s.runs} runs at SR ${Math.round(s.strikeRate)}`
    : '';
  switch (trend) {
    case 'Breakout':
      return line ? `Breakout season (${line}) — ceiling raised` : 'Big leap in the nets — ceiling raised';
    case 'Rising':
      return line ? `Kept improving (${line})` : 'Kept improving';
    case 'Bust':
      return 'Development has stalled — scouts have lowered his ceiling';
    case 'Stalled':
      return s && s.matches > 0 ? `Struggled (${line}); projections cut` : 'No game time; development stalled';
    case 'Declining':
      return 'Showing his age';
    default:
      return fallback;
  }
}

const DOMESTIC_LINES: Record<Player['role'], (r: () => number) => string> = {
  Batter: (r) => `Domestic breakout: ${380 + Math.round(r() * 160)} runs at SR ${155 + Math.round(r() * 30)} in the Syed Mushtaq Ali Trophy`,
  Wicketkeeper: (r) => `Domestic breakout: keeper-bat with ${340 + Math.round(r() * 150)} SMAT runs at SR ${150 + Math.round(r() * 30)}`,
  Bowler: (r) => `Domestic breakout: ${16 + Math.round(r() * 8)} SMAT wickets at an economy of ${(6.4 + r() * 1.2).toFixed(1)}`,
  'All-Rounder': (r) => `Domestic breakout: SMAT all-rounder of the season (${220 + Math.round(r() * 120)} runs, ${10 + Math.round(r() * 6)} wkts)`,
};

/**
 * The domestic season: a handful of uncapped Indians who barely played (or were
 * not in the IPL at all) tear up the Syed Mushtaq Ali Trophy. Their ratings jump
 * and scouts flag them — the hidden gems of the next auction.
 */
function applyDomesticBreakouts(
  players: Player[],
  deltas: PlayerProgressionDelta[],
  stats: Record<string, PlayerSeasonStats>,
  season: number,
  seed: number
) {
  const rolls: { i: number; roll: number }[] = [];
  players.forEach((p, i) => {
    if (p.nationality !== 'Indian' || p.status !== 'Uncapped' || p.isRetired) return;
    if (p.age < 19 || p.age > 27) return;
    if ((stats[p.id]?.matches ?? 0) >= 4) return; // regular IPL players are judged on IPL output
    const r = playerRng(p.id, season, seed + 7);
    const head = p.ratings.potential - p.ratings.overall;
    const chance = 0.035 + (head >= 8 ? 0.03 : 0) + (p.age <= 23 ? 0.015 : 0);
    const roll = r();
    if (roll < chance) rolls.push({ i, roll: roll / chance });
  });
  rolls.sort((a, b) => a.roll - b.roll);
  for (const { i } of rolls.slice(0, 8)) {
    const p = players[i];
    const r = playerRng(p.id, season, seed + 11);
    const jump = Math.round(4 + r() * 4 + Math.max(0, 66 - p.ratings.overall) * 0.25);
    const overall = Math.min(86, p.ratings.overall + jump);
    const potential = Math.min(95, Math.max(overall + 3, p.ratings.potential + 2 + Math.round(r() * 3)));
    const d = overall - p.ratings.overall;
    const note = DOMESTIC_LINES[p.role](r);
    players[i] = {
      ...p,
      ratings: {
        ...p.ratings,
        overall,
        potential,
        batting: p.role === 'Bowler' ? p.ratings.batting : Math.min(99, p.ratings.batting + d),
        bowling: p.role === 'Bowler' || p.role === 'All-Rounder' ? Math.min(99, p.ratings.bowling + d) : p.ratings.bowling,
        consistency: Math.min(99, (p.ratings.consistency || 60) + 2),
      },
      development: { season, trend: 'Domestic breakout', overallDelta: (p.development?.overallDelta ?? 0) + d, potentialDelta: potential - p.ratings.potential, note },
    };
    const k = deltas.findIndex((x) => x.playerId === p.id);
    if (k >= 0) {
      deltas[k] = {
        ...deltas[k],
        newOverall: overall,
        overallDelta: overall - deltas[k].previousOverall,
        potential,
        potentialDelta: (deltas[k].potentialDelta ?? 0) + (potential - p.ratings.potential),
        trend: 'Domestic breakout',
        progressionNote: note,
      };
    }
  }
}

/**
 * India selectors: the best uncapped Indians of the IPL season (4–5 a year) earn
 * a first cap. They move to the capped market from the next auction.
 */
function applyIndiaCallUps(
  players: Player[],
  deltas: PlayerProgressionDelta[],
  stats: Record<string, PlayerSeasonStats>,
  season: number
) {
  const picks = players
    .map((p, i) => ({ p, i, perf: p.nationality === 'Indian' && p.status === 'Uncapped' && (stats[p.id]?.matches ?? 0) >= 8 ? seasonPerformance(p, stats[p.id]) : null }))
    .filter((x): x is { p: Player; i: number; perf: number } => x.perf !== null && x.perf >= 0.45 && x.p.ratings.overall >= 72)
    .sort((a, b) => b.perf - a.perf)
    .slice(0, 5);
  for (const { p, i } of picks) {
    const note = `${p.development?.note ?? 'Strong IPL season'} · earned a maiden India call-up`;
    players[i] = {
      ...p,
      status: 'Capped',
      development: { ...(p.development ?? { season, trend: 'Rising', overallDelta: 0, potentialDelta: 0, note }), note, callUp: true },
    };
    const k = deltas.findIndex((x) => x.playerId === p.id);
    if (k >= 0) deltas[k] = { ...deltas[k], callUp: true, progressionNote: note };
  }
}
