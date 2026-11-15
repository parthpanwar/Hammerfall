// ============================================================
// IPL DYNASTY - Trade Value Engine
// Reuses the Player Intelligence dossier (ML projections, uncertainty,
// availability, longevity, market valuation) — no retraining.
//
//  generalTradeValue  -> market-wide sporting value (0-100)
//  teamTradeValue     -> utility of a player to one franchise (drives CPUs)
//  teamStrength       -> franchise strength used for before/after trade utility
// ============================================================

import type { CPUDifficulty, Player } from '@/lib/types/game';
import type { SquadSnapshot } from '@/lib/types/trade';
import { generatePlayerIntelligenceDossier } from '@/lib/intelligence/valuation/player-intelligence';
import { getPlayerTacticalRoles, type TacticalRole } from '@/lib/engines/cpu-gm/tactical-roles';
import { FRANCHISE_STRATEGY_PROFILES } from '@/lib/engines/cpu-gm/opponent-model';

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** League-wide scarcity of tactical roles (higher = harder to replace). */
const ROLE_SCARCITY: Record<TacticalRole, number> = {
  'Opening batter': 55,
  'Middle-order anchor': 45,
  'Power hitter': 58,
  Finisher: 62,
  'Wicketkeeper-batter': 72,
  'Pace-bowling all-rounder': 74,
  'Spin-bowling all-rounder': 66,
  'Powerplay seamer': 58,
  'Death-over specialist': 76,
  'Wrist spinner': 70,
  'Finger spinner': 52,
};

export interface TradeValueBreakdown {
  value: number; // 0-100
  current: number;
  projected: number;
  future: number;
  form: number;
  consistency: number;
  versatility: number;
  scarcity: number;
  availability: number;
  uncertaintyPenalty: number;
  contractScore: number;
  fairValueLakhs: number;
  roles: TacticalRole[];
}

const generalCache = new Map<string, TradeValueBreakdown>();

/**
 * Market price (lakhs) a player of this level commands at auction. Inverse of the
 * curve used to calibrate ratings from real IPL fees: 88 ≈ ₹27 Cr, 86 ≈ ₹20 Cr,
 * 84 ≈ ₹15 Cr, 80 ≈ ₹8.2 Cr, 75 ≈ ₹3.6 Cr, 70 ≈ ₹1.3 Cr. Upside (young players)
 * raises the price; late-career decline lowers it.
 */
export function ratingMarketValue(p: Player): number {
  const ovr = p.ratings.overall;
  const headroom = Math.max(0, p.ratings.potential - ovr);
  const youth = p.age <= 22 ? 0.55 : p.age <= 25 ? 0.4 : p.age <= 28 ? 0.2 : 0;
  const decline = p.age >= 37 ? 4 : p.age >= 35 ? 2.5 : p.age >= 33 ? 1 : 0;
  const effective = ovr + headroom * youth - decline;
  const crores = Math.exp((effective - 64) / 7.2) - 1;
  return Math.round(Math.max(20, Math.min(3000, crores * 100)));
}

function safeDossier(p: Player) {
  try {
    return generatePlayerIntelligenceDossier(p);
  } catch {
    return null;
  }
}

/** Rating-anchored expectation for next season: growth toward potential, late-career decline. */
function curveRating(p: Player): number {
  const youth = p.age <= 22 ? 0.5 : p.age <= 25 ? 0.3 : p.age <= 28 ? 0.1 : 0;
  const decline = p.age >= 36 ? 4 : p.age >= 33 ? 2 : 0;
  return clamp(p.ratings.overall + Math.max(0, p.ratings.potential - p.ratings.overall) * youth - decline);
}

/**
 * Expected rating next season. Anchored on the calibrated rating and age curve; the
 * longevity model (stats-driven) only contributes 30%, so a noisy stats profile can't
 * drag a star down (or lift a squad player up) by ten points.
 */
export function futureRating(p: Player): number {
  const d = safeDossier(p);
  const next = d?.longevityProjections?.[0]?.projectedRating;
  const curve = curveRating(p);
  if (typeof next === 'number' && Number.isFinite(next)) return clamp(0.7 * curve + 0.3 * next);
  return curve;
}

/**
 * Market-wide trade value. Salary is an input (contract surplus) but value is
 * NOT salary: a cheap young pacer with upside can out-value an expensive veteran.
 */
export function generalTradeValue(p: Player, salaryLakhs: number, yearsRemaining = 1): TradeValueBreakdown {
  const key = `${p.id}|${p.ratings.overall}|${p.age}|${salaryLakhs}|${yearsRemaining}`;
  const hit = generalCache.get(key);
  if (hit) return hit;

  const d = safeDossier(p);
  const current = p.ratings.overall;
  // Stats projection is a minority input next to the calibrated rating.
  const projected = 0.65 * current + 0.35 * (d?.projection.overallImpactScore ?? current);
  const future = futureRating(p);
  const form = clamp(p.recentFormRating ?? p.ratings.recentFormRating ?? p.recentForm ?? 70);
  const consistency = clamp(p.ratings.consistency);
  const roles = getPlayerTacticalRoles(p);
  const versatility = clamp(roles.length * 28);
  const scarcity = roles.length ? Math.max(...roles.map((r) => ROLE_SCARCITY[r] ?? 50)) : 45;
  const availability = clamp(100 - (d?.availabilityRisk ?? p.injuryRisk ?? 20));
  const uncertainty = d?.projection.uncertaintyStdDev ?? 8;
  const uncertaintyPenalty = clamp((uncertainty - 6) * 0.6, 0, 6);
  // Fair value is anchored on calibrated ratings; the stats model only nudges it.
  const modelFair = d?.marketValuation.fairValue ?? p.estimatedMarketValue ?? p.basePrice;
  const fair = Math.max(20, 0.85 * ratingMarketValue(p) + 0.15 * modelFair);
  let contractScore = clamp(50 + ((fair - salaryLakhs) / Math.max(fair, 100)) * 50);
  if (contractScore > 50) contractScore = clamp(contractScore + 4 * (Math.max(1, yearsRemaining) - 1));

  const value = clamp(
    0.45 * current +
      0.08 * projected +
      0.17 * future +
      0.04 * form +
      0.05 * consistency +
      0.04 * versatility +
      0.05 * scarcity +
      0.07 * contractScore +
      0.05 * availability -
      uncertaintyPenalty
  );

  const out: TradeValueBreakdown = {
    value: Math.round(value * 10) / 10,
    current,
    projected,
    future,
    form,
    consistency,
    versatility,
    scarcity,
    availability,
    uncertaintyPenalty,
    contractScore,
    fairValueLakhs: fair,
    roles,
  };
  generalCache.set(key, out);
  return out;
}

/** Utility of a player to a specific franchise (strategy profile + difficulty sophistication). */
export function teamTradeValue(p: Player, franchiseId: string, difficulty: CPUDifficulty, salaryLakhs = p.currentContractValue || p.basePrice): number {
  if (difficulty === 'Easy') return p.ratings.overall;
  const g = generalTradeValue(p, salaryLakhs);
  const profile = FRANCHISE_STRATEGY_PROFILES[franchiseId];
  let v = difficulty === 'Normal' ? 0.55 * g.value + 0.45 * p.ratings.overall : g.value;
  if (profile) {
    const affinity = Math.max(1, ...g.roles.map((r) => profile.roleAffinities[r] ?? 1));
    v += (affinity - 1) * 8;
    if (p.nationality === 'Indian') v += (profile.domesticPremium - 1) * 6;
    if (difficulty === 'Hard' || difficulty === 'Expert') {
      // Youth-focused GMs value runway; veteran-focused GMs value proven players.
      v += clamp(profile.experiencePreference * (p.age - 28) * 0.4, -4, 4);
    }
  }
  return clamp(v);
}

// ------------------------------------------------------------
// Team strength
// ------------------------------------------------------------

const isWk = (p: Player) => p.role === 'Wicketkeeper' || p.secondaryRole === 'Wicketkeeper';
const bowls = (p: Player) => p.role === 'Bowler' || p.role === 'All-Rounder' || p.ratings.bowling >= 60;
const bats = (p: Player) => p.role === 'Batter' || p.role === 'Wicketkeeper' || p.role === 'All-Rounder' || p.ratings.batting >= 60;
const isSpin = (p: Player) => p.isSpinner && bowls(p);
const isPace = (p: Player) => !p.isSpinner && bowls(p) && p.bowlingStyle !== 'None';

/** Best XI under T20 constraints: ≤4 overseas, 1 keeper, 5 bowling options, 6 batting options. */
export function selectBestXi(players: Player[], valueOf: (p: Player) => number): Player[] {
  const sorted = [...players].sort((a, b) => valueOf(b) - valueOf(a));
  const xi: Player[] = [];
  const os = () => xi.filter((p) => p.nationality === 'Overseas').length;
  const take = (pred: (p: Player) => boolean, n: number) => {
    for (const p of sorted) {
      if (xi.length >= 11 || n <= 0) break;
      if (xi.includes(p) || !pred(p)) continue;
      if (p.nationality === 'Overseas' && os() >= 4) continue;
      xi.push(p);
      n--;
    }
  };
  take(isWk, 1);
  take(bowls, 5 - xi.filter(bowls).length);
  take(bats, 6 - xi.filter(bats).length);
  take(() => true, 11 - xi.length);
  return xi;
}

export interface StrengthBreakdown {
  strength: number;
  xi: Player[];
  xiScore: number;
  depthScore: number;
  futureScore: number;
  rolePenalty: number;
  coverage: { wk: number; pace: number; spin: number; openers: number; death: number };
}

export function roleCoverage(players: Player[]) {
  return {
    wk: players.filter(isWk).length,
    pace: players.filter(isPace).length,
    spin: players.filter(isSpin).length,
    openers: players.filter((p) => p.isOpener).length,
    death: players.filter((p) => p.isDeathBowler).length,
  };
}

const COVERAGE_TARGET = { wk: 2, pace: 4, spin: 2, openers: 2, death: 2 };
const COVERAGE_WEIGHT = { wk: 0.9, pace: 0.5, spin: 0.6, openers: 0.45, death: 0.65 };
export const COVERAGE_LABEL: Record<keyof typeof COVERAGE_TARGET, string> = {
  wk: 'wicketkeeping',
  pace: 'pace bowling',
  spin: 'spin bowling',
  openers: 'opening batting',
  death: 'death bowling',
};

export function teamStrength(players: Player[], franchiseId: string, difficulty: CPUDifficulty, valueOf?: (p: Player) => number): StrengthBreakdown {
  const v = valueOf ?? ((p: Player) => teamTradeValue(p, franchiseId, difficulty));
  const xi = selectBestXi(players, v);
  const xiVals = xi.map(v);
  while (xiVals.length < 11) xiVals.push(40);
  const xiScore = xiVals.reduce((a, b) => a + b, 0) / 11;

  const bench = players.filter((p) => !xi.includes(p)).map(v).sort((a, b) => b - a).slice(0, 5);
  while (bench.length < 5) bench.push(35);
  const depthScore = bench.reduce((a, b) => a + b, 0) / 5;

  const futureScore = xi.length ? xi.reduce((s, p) => s + futureRating(p), 0) / xi.length : 40;
  const cov = roleCoverage(players);
  let rolePenalty = 0;
  (Object.keys(COVERAGE_TARGET) as (keyof typeof COVERAGE_TARGET)[]).forEach((k) => {
    rolePenalty += Math.max(0, COVERAGE_TARGET[k] - cov[k]) * COVERAGE_WEIGHT[k];
  });
  if (difficulty === 'Easy') rolePenalty *= 0.4;

  const futureWeight = difficulty === 'Hard' || difficulty === 'Expert' ? 0.1 : 0;
  const strength = xiScore * (0.72 + (0.1 - futureWeight)) + depthScore * 0.18 + futureScore * futureWeight - rolePenalty;
  return { strength, xi, xiScore, depthScore, futureScore, rolePenalty, coverage: cov };
}

export function squadSnapshot(players: Player[], franchiseId: string, difficulty: CPUDifficulty): SquadSnapshot {
  const s = teamStrength(players, franchiseId, difficulty === 'Easy' ? 'Normal' : difficulty);
  const ovrXi = selectBestXi(players, (p) => p.ratings.overall);
  return {
    size: players.length,
    overseas: players.filter((p) => p.nationality === 'Overseas').length,
    bestXiOvr: ovrXi.length ? Math.round(ovrXi.reduce((a, p) => a + p.ratings.overall, 0) / ovrXi.length) : 0,
    strength: Math.round(s.strength * 10) / 10,
  };
}
