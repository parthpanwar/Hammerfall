// ============================================================
// IPL DYNASTY - Progression tuning
// Every knob of the growth / youth-pipeline / rating-spread system lives here so
// the whole thing can be tuned in one place against
// `npm run calibrate:progression` (scripts/calibrate_progression.ts).
// ============================================================

import type { DevProfile } from '@/lib/types/game';

export const PROGRESSION_TUNING = {
  // ---- Hidden development profile (share of players, by id hash) ----
  devProfileShare: { EarlyBloomer: 0.2, Standard: 0.5, LateBloomer: 0.15, Plateau: 0.15 } as Record<DevProfile, number>,
  devProfile: {
    EarlyBloomer: { young: 1.25, old: 0.8 }, // ×young up to 22, ×old after 24
    LateBloomer: { young: 0.8, late: 1.3 }, // ×young up to 22, ×late from 24 to 28
    Plateau: { all: 0.6 },
  },

  // ---- Growth (ages ≤ 28 with headroom) ----
  /** Share of headroom (potential − overall) closed per year, by age. */
  ageRate: [
    { maxAge: 20, rate: 0.34 },
    { maxAge: 22, rate: 0.3 },
    { maxAge: 24, rate: 0.25 },
    { maxAge: 27, rate: 0.16 },
    { maxAge: 28, rate: 0.08 },
  ],
  /** Game-time multiplier by IPL matches played. */
  playMult: [
    { minMatches: 12, mult: 1.4 },
    { minMatches: 8, mult: 1.25 },
    { minMatches: 4, mult: 1.0 },
    { minMatches: 1, mult: 0.6 },
    { minMatches: 0, mult: 0.35 },
  ],
  /** Flat bonus by season output (seasonPerformance); null perf → 0. */
  perfBonus: [
    { minPerf: 1.0, bonus: 4 },
    { minPerf: 0.6, bonus: 3 },
    { minPerf: 0.3, bonus: 1.5 },
    { minPerf: 0, bonus: 0.5 },
    { minPerf: -0.4, bonus: -0.5 },
    { minPerf: -Infinity, bonus: -1.5 },
  ],
  luck: 1.0,
  /** Change clamps by age. */
  clampYoung: [-2, 9] as [number, number], // ≤ 24
  clampMid: [-2, 6] as [number, number], // 25–27
  clamp28: [-3, 3] as [number, number],
  /** One-off breakout leap: matches ≥ 6, perf ≥ 0.8, age ≤ 24. */
  breakoutLeap: { maxGain: 10, minMatches: 6, minPerf: 0.8, maxAge: 24 },
  /** A 0-match prospect still develops a little from nets and domestic cricket. */
  noMatchGain: [0, 3] as [number, number],
  /** 25+ without a game: no growth to speak of. */
  noMatchGainOlder: [-1, 1] as [number, number],
  /** Established players who sat out the whole season lose a little sharpness. */
  idleVeteranLoss: 1,
  /** …and from 30, a season on the bench costs more. */
  idleVeteranLoss30: 2,
  /** Breakout tag: ≥ minMatches and (Δ ≥ bigGain, or Δ ≥ gain with perf ≥ minPerf / potential +3). */
  breakoutTag: { minMatches: 6, maxNewAge: 28, bigGain: 4, bigGainMinPerf: -0.2, gain: 3, minPerf: 0.25, potGain: 3 },
  /** Older players without IPL cricket: no visible leap. */
  benchCapOlder: 3,

  // ---- Elite compression: each raw point gained above a level counts less ----
  compression: [
    { above: 91, weight: 0.25 },
    { above: 88, weight: 0.4 },
    { above: 84, weight: 0.6 },
  ],

  // ---- Potential ----
  potential: {
    strong: { minPerf: 0.6, minMatches: 6, maxAge: 25, gain: [3, 6] as [number, number] },
    good: { minPerf: 0.3, gain: [1, 3] as [number, number] },
    poor: { maxPerf: -0.4, minMatches: 6, loss: [3, 4] as [number, number] },
    noMatches: { minAge: 22, loss: [0, 2] as [number, number] },
    /** potential ≥ newOverall + floor, by (new) age. */
    floorByAge: [
      { maxAge: 19, floor: 6 },
      { maxAge: 21, floor: 5 },
      { maxAge: 23, floor: 4 },
      { maxAge: 25, floor: 2 },
    ],
    cap: 97,
    convergeFromAge: 29,
  },
  /** Prospects who simply never kick on: chance per season for 19+ without a good season. */
  bust: { chance: 0.06, potLoss: [3, 5] as [number, number] },

  // ---- Prime and decline ----
  peak: { perfWeight: 1.3, luck: 0.6, fitBias: 0, unfitBias: -0.4, clamp: [-3, 3] as [number, number] },
  late: {
    /** Late-prime rules apply from this age even where the role's age curve still says "peak". */
    fromAge: 33,
    /** perf ≥ provenPerf: lose 0–1. */
    provenPerf: 0.3,
    /** Capped Indians 30+ with perf < midPerf (or < minMatches): lose 2–3. */
    midPerf: 0.1,
    minMatches: 6,
    midLoss: [2, 3] as [number, number],
    /** Everyone else past his peak: change = −baseLoss + perf × 0.8 ± luck. */
    baseLoss: 1.5,
    luck: 0.6,
  },

  // ---- Domestic breakouts ----
  domestic: {
    cap: 15,
    baseChance: 0.07,
    headroomBonus: 0.04, // headroom ≥ 8
    youthBonus: 0.02, // age ≤ 23
    minAge: 19,
    maxAge: 27,
    lateBloomerMaxAge: 29,
    jump: [5, 10] as [number, number],
    potGain: [2, 5] as [number, number],
    ovrCap: 84,
  },

  // ---- In-season form and selection ----
  form: {
    emaAlpha: 0.35,
    youngBonusMax: 5,
    /** Young-Indian bonus = 1 + headroom / youngBonusDivisor (age ≤ 23, headroom ≥ 5). */
    youngBonusDivisor: 3,
    formDivisor: 5,
    formClamp: [-3, 4] as [number, number],
    minMatchesForForm: 2,
    fadingVetPenalty: 2,
    bloodingChance: 0.35,
    bloodingMinPotential: 82,
    /** A blooded prospect must be within this many selection points of the man he replaces. */
    bloodingMaxGap: 6,
  },

  // ---- Auction market ----
  market: {
    /** Share of headroom the auction pays for, by age. */
    youth: [
      { maxAge: 19, weight: 0.12 },
      { maxAge: 21, weight: 0.1 },
      { maxAge: 24, weight: 0.08 },
      { maxAge: 27, weight: 0.05 },
    ],
    /** Valuation bump for last off-season's breakout / domestic breakout players. */
    breakoutBump: 1.15,
    /** Share of the mini-auction price inflation that reaches never-played uncapped players. */
    unprovenInflation: 0,
    /** Pedigree multiplier for a young uncapped Indian who has never played the IPL. */
    prospectPedigree: 1.1,
    /** CPU bid ceiling for never-played uncapped players, × market value. */
    prospectBidCeiling: 1.1,
    /** Share of a cash-rich room's price inflation that reaches a player, by current overall. */
    inflationByOvr: [
      { minOvr: 85, weight: 1 },
      { minOvr: 82, weight: 0.85 },
      { minOvr: 79, weight: 0.75 },
      { minOvr: 76, weight: 0.55 },
      { minOvr: 0, weight: 0.25 },
    ],
    /** …halved-ish for players 32+ who are no longer elite. */
    veteranInflation: 0.6,
    decliningDiscount: 0.85,
    agingDiscount: 0.9,
    /** Max pedigree multiplier for a player rated below 80 (no name premium). */
    reputationCapBelow80: 1.1,
    /** CPU bid ceiling (× market value) for players 30+ rated 80 or less. */
    veteranBidCeiling: 1.15,
    /** Mega-auction spend pacing: valuation boost when a team holds more per open slot than slots cost. */
    megaPace: { fillTo: 20, maxBoost: 2.6, exponent: 0.7, targetSpend: 0.97, scheduleExponent: 0.6, lagGain: 6, qualityDepthOvr: 76, lateFrom: 0.2, lateSlotShare: 2.4, lateMaxOverMarket: 2.0, bestRemainingShare: 0.7 },
    /** Bid ceiling: rating-curve price at (current overall + margin) × multiplier × inflation. */
    ceilingOvrMargin: 3,
    ceilingMultiplier: 1.0,
    /** Mega price index never opens below this. */
    megaIndexFloor: 1.2,
    /** Late in a mega, a team still holding this much keeps buying useful squad players (OVR ≥ minOvr). */
    megaDepth: { minPurse: 300, minOvr: 70, maxSquad: 24, fromProgress: 0.6 },
  },
};

export type ProgressionTuning = typeof PROGRESSION_TUNING;

/** Pick the first row whose predicate matches (tables are ordered). */
export function lookup<T>(rows: T[], pred: (r: T) => boolean, fallback: T): T {
  for (const r of rows) if (pred(r)) return r;
  return fallback;
}
