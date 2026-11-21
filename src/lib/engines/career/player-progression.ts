// ============================================================
// IPL DYNASTY - Player Development Engine
// Advances player ratings, age, and attributes across seasons
// with bounded yearly changes and role-sensitive aging.
// ============================================================

import type { DevelopmentTrend, DevProfile, Player, PlayerSeasonStats } from '@/lib/types/game';
import type { PlayerProgressionDelta } from '@/lib/types/career';
import { calculateAgeTrajectory } from '@/lib/intelligence/models/age-curve';
import { PROGRESSION_TUNING, lookup } from './progression-tuning';
import { devProfileOf, hashString, mulberry32, playerRng } from './dev-rng';
import { isStalwart, risingStarCeiling } from './overseas-pipeline';

const T = PROGRESSION_TUNING;
const r1 = (rng: () => number, [lo, hi]: [number, number]) => lo + Math.round(rng() * (hi - lo));

/**
 * The level a player really tops out at. Potential is the scouts' public guess;
 * only a few prospects reach it. Most good youngsters settle in the high 70s or
 * low 80s, and a wonderkid is a real chance of a star, not a certainty. Drawn
 * per career (seeded) so it can't be learned from one save to the next, and
 * kept on the player once drawn. Overseas rising stars have a fixed ceiling.
 */
export function hiddenCeiling(p: Player, seed = 0): number {
  if (p.ceiling !== undefined) return p.ceiling;
  const { overall, potential } = p.ratings;
  const star = risingStarCeiling(p.id);
  if (star !== undefined) return Math.max(overall, star);
  const C = T.ceiling;
  const head = potential - overall;
  if (head < C.minHeadroom || p.age > C.maxAge) return potential;
  const rng = mulberry32((hashString(`${p.id}:ceiling`) ^ Math.imul(seed | 0, 2654435761)) >>> 0);
  const u = rng();
  const v = rng();
  const starChance = lookup(C.starChance, (r) => potential >= r.minPot, C.starChance[C.starChance.length - 1]).chance;
  if (u < starChance) return potential;
  const band = u < starChance + C.goodChance ? C.good : C.ordinary;
  const share = band.share[0] + v * (band.share[1] - band.share[0]);
  // A cap below his current level just means he has already peaked.
  return Math.max(overall, Math.min(band.cap, overall + Math.round(head * share)));
}

/** Overseas players play all year: internationals and the T20 leagues. */
function awaySeason(p: Player, rng: () => number): { matches: number; perf: number } | null {
  if (p.nationality !== 'Overseas' || p.isRetired) return null;
  const O = T.overseas;
  const matches = p.status === 'Capped' ? O.awayMatches.capped : O.awayMatches.uncapped;
  const perf = clamp(O.awayPerf.mean + (rng() * 2 - 1) * O.awayPerf.noise, -1, 1.2);
  return { matches, perf };
}

/** Development multiplier from the hidden profile at this age. */
function profileMultiplier(profile: DevProfile, age: number): number {
  const d = T.devProfile;
  if (profile === 'EarlyBloomer') return age <= 22 ? d.EarlyBloomer.young : age > 24 ? d.EarlyBloomer.old : 1;
  if (profile === 'LateBloomer') return age <= 22 ? d.LateBloomer.young : age >= 24 && age <= 28 ? d.LateBloomer.late : 1;
  if (profile === 'Plateau') return d.Plateau.all;
  return 1;
}

/**
 * Elite compression: each raw point gained above 84 counts 0.6, above 88 counts
 * 0.4, above 91 counts 0.25. A 74 jumps to 82 easily; an 88 needs an outstanding
 * season to reach 90. Losses are not compressed.
 */
export function applyGain(previous: number, change: number, rng?: () => number): number {
  if (change <= 0) return previous + change;
  let level = previous;
  let remaining = change;
  while (remaining > 1e-9) {
    const step = Math.min(1, remaining);
    const w = lookup(T.compression, (c) => level >= c.above, { above: 0, weight: 1 }).weight;
    level += step * w;
    remaining -= step;
  }
  // Fractions round up with their own probability (seeded), so the compression
  // holds on average: a +1 at 84 is a 60% chance of 85, not a certainty.
  const base = Math.floor(level + 1e-9);
  const frac = level - base;
  return frac < 1e-9 ? base : base + ((rng ? rng() : 0.5) < frac ? 1 : 0);
}

/**
 * Calculates attribute evolution for a player transitioning to the next season.
 * Young players close a share of their headroom that grows with game time and
 * output; primes hold; veterans decline, faster when they stop producing.
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

  const age = player.age; // the age he played the season at
  const newAge = age + 1;
  const trajectory = calculateAgeTrajectory(player, player.recentForm || 75);

  const rng = playerRng(player.id, seasonYear, seed);
  const luck = rng() * 2 - 1; // coaching, fitness, role, confidence
  const iplPerf = seasonPerformance(player, recentSeasonStats);
  const iplMatches = recentSeasonStats?.matches ?? 0;
  // Overseas players are judged on their whole year unless the IPL was most of it.
  const away = awaySeason(player, rng);
  const fromAway = !!away && iplMatches < 6;
  const perf = fromAway ? (iplPerf === null ? away.perf : (iplPerf + away.perf) / 2) : iplPerf;
  const matches = fromAway ? Math.max(iplMatches, away.matches) : iplMatches;
  const p0 = perf ?? 0;
  // Growth chases the hidden ceiling, not the scouts' potential.
  let ceiling = hiddenCeiling(player, seed);
  const headroom = Math.max(0, ceiling - previousOverall);
  const bonusScale = clamp(headroom / T.ceiling.bonusRoom, 0, 1);
  const profile = devProfileOf(player);
  const prevMatches = player.development?.matches; // undefined = unknown (season 1 / old save)
  const indianCapped = player.nationality === 'Indian' && player.status === 'Capped';

  let change = 0;
  let potentialChange = 0;
  let bust = false;
  let note = 'Stable performance in prime';
  const growthPath = age <= 24 || (age <= 28 && headroom >= 3);

  if (growthPath) {
    // ---- Growth: close a share of the headroom ----
    const ageRate = lookup(T.ageRate, (r) => age <= r.maxAge, { maxAge: 99, rate: 0 }).rate;
    const playMult = lookup(T.playMult, (r) => matches >= r.minMatches, { minMatches: 0, mult: 0.35 }).mult;
    let perfBonus = perf === null ? 0 : lookup(T.perfBonus, (r) => perf >= r.minPerf, T.perfBonus[T.perfBonus.length - 1]).bonus;
    if (perfBonus > 0) perfBonus *= bonusScale; // a great season can't carry him past his ceiling
    const raw = headroom * ageRate * playMult * profileMultiplier(profile, age) + perfBonus + luck * T.luck;
    let [lo, hi] = age <= 24 ? T.clampYoung : age <= 27 ? T.clampMid : T.clamp28;
    const leap = T.breakoutLeap;
    if (matches >= leap.minMatches && perf !== null && perf >= leap.minPerf && age <= leap.maxAge && headroom >= 6) hi = Math.max(hi, leap.maxGain);
    if (matches === 0) [lo, hi] = age >= 25 ? T.noMatchGainOlder : headroom > 0 ? [T.noMatchGain[0], Math.min(T.noMatchGain[1], headroom)] : [-1, 1];
    hi = Math.min(hi, headroom + (luck > 0.6 ? 1 : 0)); // at the ceiling he only holds
    lo = Math.min(lo, hi);
    change = Math.round(clamp(raw, lo, hi));
    if (age > 24 && matches < 4) change = Math.min(change, T.benchCapOlder);

    // An outstanding season can lift the true ceiling a little.
    const O = T.ceiling.overachieve;
    if (perf !== null && perf >= O.minPerf && matches >= O.minMatches && ceiling < potential && rng() < O.chance) {
      ceiling = Math.min(potential, ceiling + r1(rng, O.gain));
    }

    // ---- Potential moves with the evidence ----
    const P = T.potential;
    if (perf !== null && matches >= P.strong.minMatches && perf >= P.strong.minPerf && age <= P.strong.maxAge) {
      const t = clamp((perf - P.strong.minPerf) / 0.6 + luck * 0.25, 0, 1);
      potentialChange = Math.round(P.strong.gain[0] + t * (P.strong.gain[1] - P.strong.gain[0]));
    } else if (perf !== null && perf >= P.good.minPerf) {
      potentialChange = r1(rng, P.good.gain);
    } else if (perf !== null && perf <= P.poor.maxPerf && matches >= P.poor.minMatches) {
      potentialChange = -r1(rng, P.poor.loss);
    } else if (matches === 0 && (age >= P.noMatches.minAge || prevMatches === 0)) {
      potentialChange = -r1(rng, P.noMatches.loss);
    }
    if (profile === 'Plateau' && age >= 22 && p0 < 0.6) potentialChange -= 1;
    // Near his real ceiling a big season earns less optimism…
    if (potentialChange > 0 && headroom < 3) potentialChange = Math.min(potentialChange, 1);
    // …and once he stops growing the scouts revise the projection toward the truth.
    const R = T.ceiling.revision;
    if (age >= R.minAge && potential - ceiling >= R.gap && previousOverall + change >= ceiling) {
      potentialChange = Math.min(potentialChange, 0) - r1(rng, R.loss);
    }

    // Some prospects simply never kick on.
    if (age >= 19 && headroom >= 4 && p0 < 0.4 && rng() < T.bust.chance) {
      bust = true;
      change = Math.min(change, Math.round(rng()));
      potentialChange = Math.min(potentialChange, -r1(rng, T.bust.potLoss));
    }
    note = age <= 23 ? 'Young talent developing' : 'Entering prime career years';
  } else if (isStalwart(player.id) && age < T.overseas.stalwart.untilAge && p0 >= -0.2) {
    // A franchise cornerstone: holds his level while he keeps producing.
    const W = T.overseas.stalwart;
    change = clamp(Math.round(p0 * 0.8 - (age >= 33 ? W.driftFrom33 : W.drift) + luck * 0.6), W.clamp[0], W.clamp[1]);
    note = 'Still a franchise cornerstone';
  } else if (trajectory.careerPhase === 'VeteranMaster') {
    if (trajectory.isOver35Exempt) {
      change = clamp(Math.round(p0 * 0.6 - 0.5), -2, 1);
      note = 'Master veteran defying age curve';
    } else {
      const fitnessDefense = (player.fitnessLevel - 70) * 0.03;
      change = clamp(Math.round(-2.5 + fitnessDefense + p0 * 0.5), -5, 0);
      note = 'Natural veteran physical decline';
    }
  } else {
    const L = T.late;
    const fading = indianCapped && age >= 30 && (perf === null || perf < L.midPerf || matches < L.minMatches);
    if (fading) {
      // Out of the India side and out of the XI: the selectors move on.
      change = -r1(rng, L.midLoss);
      note = 'Passed over: no longer a first-choice pick';
    } else if (trajectory.careerPhase === 'LatePrime' || age >= L.fromAge) {
      change = p0 >= L.provenPerf ? (luck > 0 ? 0 : -1) : clamp(Math.round(-L.baseLoss + p0 * 0.8 + luck * L.luck), -3, 1);
      note = 'Experienced veteran maintaining quality';
    } else {
      // Peak prime (or a young player already at his ceiling): roughly flat.
      change = Math.round(clamp(p0 * T.peak.perfWeight + (player.fitnessLevel >= 80 ? T.peak.fitBias : T.peak.unfitBias) + luck * T.peak.luck, T.peak.clamp[0], T.peak.clamp[1]));
      note = 'Consistent peak prime output';
    }
    if (matches < 4) change = Math.min(change, T.benchCapOlder);
    if (matches === 0 && !trajectory.isOver35Exempt) change = Math.min(change, luck > 0.5 ? 0 : -(age >= 30 ? T.idleVeteranLoss30 : T.idleVeteranLoss));
  }

  change = clamp(change, -5, 10);
  const newOverall = clamp(applyGain(previousOverall, change, rng), 50, 99);
  const d = newOverall - previousOverall;

  // Components move by role; overall stays the source of truth.
  const batPrimary = player.role === 'Batter' || player.role === 'Wicketkeeper' || (player.role === 'All-Rounder' && previousBatting >= previousBowling);
  let batD = 0;
  let bowlD = 0;
  if (player.role === 'Batter' || player.role === 'Wicketkeeper') batD = d;
  else if (player.role === 'Bowler') bowlD = d;
  else if (batPrimary) [batD, bowlD] = [d, Math.round(d * 0.5)];
  else [batD, bowlD] = [Math.round(d * 0.5), d];
  const pwrD = player.role === 'Bowler' ? 0 : batPrimary ? (d < 0 ? d - 1 : d) : Math.round(d * 0.5);
  const newBatting = clamp(previousBatting + batD, 15, 99);
  const newBowling = clamp(previousBowling + bowlD, 10, 99);
  const newPwr = clamp(previousPwr + pwrD, 30, 99);
  const newConsistency = clamp(previousConsistency + (newAge >= 26 ? 1 : 0), 40, 99);

  // Potential: moves with the evidence, keeps an age-appropriate gap, narrows from 29.
  const P = T.potential;
  let newPotential = potential + potentialChange - (newAge >= P.convergeFromAge ? 1 : 0);
  const floor = lookup(P.floorByAge, (r) => newAge <= r.maxAge, { maxAge: 99, floor: 0 }).floor;
  newPotential = Math.max(newOverall, Math.min(P.cap, Math.max(newOverall + floor, newPotential)));
  // The public projection never sits below what he really is going to be.
  if (newPotential < ceiling && growthPath) newPotential = Math.min(P.cap, ceiling);
  const potentialDelta = newPotential - potential;

  const trend: DevelopmentTrend = bust
    ? 'Bust'
    : matches >= T.breakoutTag.minMatches &&
      newAge <= T.breakoutTag.maxNewAge &&
      ((d >= T.breakoutTag.bigGain && p0 >= T.breakoutTag.bigGainMinPerf) || (d >= T.breakoutTag.gain && (p0 >= T.breakoutTag.minPerf || potentialDelta >= T.breakoutTag.potGain)))
    ? 'Breakout'
    : d >= 2
    ? 'Rising'
    : d <= -2 && newAge >= 30
    ? 'Declining'
    : newAge <= 25 && d <= 0 && potentialDelta < 0
    ? 'Stalled'
    : 'Steady';
  note = fromAway && (trend === 'Breakout' || trend === 'Rising')
    ? trend === 'Breakout' ? `Big year for ${player.country} and in the T20 leagues: ceiling raised` : `Kept improving with ${player.country} and in the T20 leagues`
    : developmentNote(trend, player, recentSeasonStats, note);

  const estimatedMarketValue = Math.round(
    Math.max(20, (newOverall - 55) * (newOverall - 55) * (newAge <= 27 ? 1.4 : newAge <= 33 ? 1.0 : 0.7))
  );

  const updatedPlayer: Player = {
    ...player,
    age: newAge,
    devProfile: profile,
    ceiling: Math.max(ceiling, newOverall),
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
    seasonForm: undefined,
    development: { season: seasonYear, trend, overallDelta: d, potentialDelta, note, matches: iplMatches, perf: iplPerf },
  };

  const delta: PlayerProgressionDelta = {
    playerId: player.id,
    playerName: player.name,
    age: newAge,
    previousOverall,
    newOverall,
    overallDelta: d,
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
  applyOverseasBreakouts(updatedPlayers, deltas, seasonStats, nextSeasonYear, seed);
  applyIndiaCallUps(updatedPlayers, deltas, seasonStats, nextSeasonYear);
  return { updatedPlayers, deltas };
}

// ------------------------------------------------------------------ helpers

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
      if (p.seasonForm?.blooded && line) return `Earned a place in the XI mid-season and kept it (${line}): ceiling raised`;
      return line ? `Breakout season (${line}): ceiling raised` : 'Big leap in the nets: ceiling raised';
    case 'Rising':
      if (p.seasonForm?.blooded && line) return `Earned a place in the XI after a mid-season debut (${line})`;
      return line ? `Kept improving (${line})` : s && s.matches === 0 ? 'Kept improving in the nets and domestic cricket' : 'Kept improving';
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

export const DOMESTIC_LINES: Record<Player['role'], (r: () => number) => string> = {
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
  const D = T.domestic;
  const rolls: { i: number; roll: number }[] = [];
  players.forEach((p, i) => {
    if (p.nationality !== 'Indian' || p.status !== 'Uncapped' || p.isRetired) return;
    // p.age is already next season's age here; the domestic season was played a year younger.
    const age = p.age - 1;
    const maxAge = devProfileOf(p) === 'LateBloomer' ? D.lateBloomerMaxAge : D.maxAge;
    if (age < D.minAge || age > maxAge) return;
    if ((stats[p.id]?.matches ?? 0) >= 4) return; // regular IPL players are judged on IPL output
    if (p.ratings.overall >= D.ovrCap) return;
    if (hiddenCeiling(p, seed) - p.ratings.overall < D.minRoom) return; // nothing left to unlock
    const r = playerRng(p.id, season, seed + 7);
    const head = p.ratings.potential - p.ratings.overall;
    const chance = D.baseChance + (head >= 8 ? D.headroomBonus : 0) + (age <= 23 ? D.youthBonus : 0);
    const roll = r();
    if (roll < chance) rolls.push({ i, roll: roll / chance });
  });
  rolls.sort((a, b) => a.roll - b.roll);
  for (const { i } of rolls.slice(0, D.cap)) {
    const p = players[i];
    const r = playerRng(p.id, season, seed + 11);
    // Bigger jumps from lower down: a 64 can become a 73, a 78 becomes an 83.
    const jump = clamp(Math.round(D.jump[0] + r() * 3 + Math.max(0, 72 - p.ratings.overall) * 0.35), D.jump[0], D.jump[1]);
    const overall = Math.min(D.ovrCap, hiddenCeiling(p, seed), p.ratings.overall + jump);
    const potential = Math.min(T.potential.cap, Math.max(overall + 3, p.ratings.potential + r1(r, D.potGain)));
    const d = overall - p.ratings.overall;
    const note = DOMESTIC_LINES[p.role](r);
    const batPrimary = p.role !== 'Bowler' && (p.role !== 'All-Rounder' || p.ratings.batting >= p.ratings.bowling);
    players[i] = {
      ...p,
      ratings: {
        ...p.ratings,
        overall,
        potential,
        batting: batPrimary ? Math.min(99, p.ratings.batting + d) : p.role === 'All-Rounder' ? Math.min(99, p.ratings.batting + Math.round(d / 2)) : p.ratings.batting,
        bowling: p.role === 'Bowler' || (p.role === 'All-Rounder' && !batPrimary) ? Math.min(99, p.ratings.bowling + d) : p.role === 'All-Rounder' ? Math.min(99, p.ratings.bowling + Math.round(d / 2)) : p.ratings.bowling,
        consistency: Math.min(99, (p.ratings.consistency || 60) + 2),
      },
      development: { ...(p.development ?? { matches: 0, perf: null }), season, trend: 'Domestic breakout', overallDelta: (p.development?.overallDelta ?? 0) + d, potentialDelta: potential - p.ratings.potential + (p.development?.potentialDelta ?? 0), note },
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

const LEAGUE: Record<string, string> = {
  Australia: 'the Big Bash',
  England: 'The Hundred',
  'South Africa': 'the SA20',
  'West Indies': 'the CPL',
  'New Zealand': 'the Super Smash',
  Afghanistan: 'the ILT20',
  'Sri Lanka': 'the LPL',
  Bangladesh: 'the BPL',
  Pakistan: 'the PSL',
};

/**
 * The overseas off-season: a few young internationals who sat out (or barely
 * played) the IPL have a big year at home and arrive at the auction as targets.
 * Shares the "Domestic breakout" tag, so the auction flags them the same way.
 */
function applyOverseasBreakouts(
  players: Player[],
  deltas: PlayerProgressionDelta[],
  stats: Record<string, PlayerSeasonStats>,
  season: number,
  seed: number
) {
  const B = T.overseas.breakout;
  const rolls: { i: number; roll: number }[] = [];
  players.forEach((p, i) => {
    if (p.nationality !== 'Overseas' || p.isRetired || p.development?.trend === 'Breakout') return;
    if (p.age - 1 > B.maxAge || (stats[p.id]?.matches ?? 0) >= 6) return;
    if (hiddenCeiling(p, seed) - p.ratings.overall < B.minRoom) return;
    const roll = playerRng(p.id, season, seed + 19)();
    if (roll < B.chance) rolls.push({ i, roll });
  });
  rolls.sort((a, b) => a.roll - b.roll);
  for (const { i } of rolls.slice(0, B.cap)) {
    const p = players[i];
    const r = playerRng(p.id, season, seed + 23);
    const overall = Math.min(hiddenCeiling(p, seed), p.ratings.overall + r1(r, B.jump));
    const d = overall - p.ratings.overall;
    const potential = Math.max(p.ratings.potential, overall + 2);
    const league = LEAGUE[p.country] ?? 'his home T20 league';
    const bowlerish = p.role === 'Bowler' || (p.role === 'All-Rounder' && p.ratings.bowling > p.ratings.batting);
    const note = bowlerish
      ? `Breakout in ${league}: ${14 + Math.round(r() * 8)} wickets at an economy of ${(6.6 + r() * 1.1).toFixed(1)}`
      : `Breakout in ${league}: ${360 + Math.round(r() * 160)} runs at SR ${150 + Math.round(r() * 30)}`;
    players[i] = {
      ...p,
      ratings: {
        ...p.ratings,
        overall,
        potential,
        batting: bowlerish ? p.ratings.batting : Math.min(99, p.ratings.batting + d),
        bowling: bowlerish ? Math.min(99, p.ratings.bowling + d) : p.ratings.bowling,
      },
      development: { ...(p.development ?? { matches: 0, perf: null }), season, trend: 'Domestic breakout', overallDelta: (p.development?.overallDelta ?? 0) + d, potentialDelta: potential - p.ratings.potential + (p.development?.potentialDelta ?? 0), note },
    };
    const k = deltas.findIndex((x) => x.playerId === p.id);
    if (k >= 0) {
      deltas[k] = { ...deltas[k], newOverall: overall, overallDelta: overall - deltas[k].previousOverall, potential, trend: 'Domestic breakout', progressionNote: note };
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
