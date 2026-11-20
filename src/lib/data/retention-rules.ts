// ============================================================
// IPL DYNASTY - Retention Rules
// ============================================================

import type { RetentionRule } from '../types/game';

/**
 * Mega-auction retention slabs, scaled to the league purse.
 *
 * Real history: IPL 2022 (₹90 Cr purse) 16 / 12 / 8 / 6 Cr, uncapped 4 Cr;
 * IPL 2025 (₹120 Cr) 18 / 14 / 11 / 18 / 14 Cr, uncapped 4 Cr. Slabs grow more
 * slowly than the purse (purse ×1.33 → slabs ×~1.2), so they scale with
 * (purse / ₹120 Cr)^0.7 from the 2025 slabs, rounded to ₹50 L:
 *   ₹130 Cr → 19 / 15 / 11.5 / 19 / 15, uncapped 4
 *   ₹150 Cr → 21 / 16.5 / 13 / 21 / 16.5, uncapped 4.5
 *   ₹160 Cr → 22 / 17 / 13.5 / 22 / 17, uncapped 5
 * Retentions take a smaller share of a bigger purse, leaving more money for the
 * auction itself.
 */
export const RETENTION_SLAB_ELASTICITY = 0.7;
const SLABS_2025 = [1800, 1400, 1100, 1800, 1400];
const UNCAPPED_2025 = 400;
const PURSE_2025 = 12000;

export function getMegaRetentionRules(totalPurse: number): RetentionRule {
  const scale = Math.pow(totalPurse / PURSE_2025, RETENTION_SLAB_ELASTICITY);
  const r50 = (v: number) => Math.round(v / 50) * 50;
  const uncapped = r50(UNCAPPED_2025 * scale);
  return {
    maxRetentions: 6,
    maxCappedRetentions: 5,
    maxUncappedRetentions: 2,
    maxOverseasRetentions: 2,
    retentionCosts: [...SLABS_2025.map((c) => r50(c * scale)), uncapped], // slots 1–6
    uncappedRetentionCost: uncapped,
    rtmAllowed: true,
    maxRTMs: 6, // combined with retentions, total cannot exceed 6
    totalPurse,
  };
}

/** The IPL 2025 rule book (₹120 Cr): 18 / 14 / 11 / 18 / 14, uncapped 4. */
export const RETENTION_RULES_2026: RetentionRule = getMegaRetentionRules(12000);

/**
 * Retention rules for mini auctions in subsequent seasons.
 */
export const RETENTION_RULES_MINI: RetentionRule = {
  maxRetentions: 4,
  maxCappedRetentions: 3,
  maxUncappedRetentions: 1,
  maxOverseasRetentions: 2,
  retentionCosts: [1600, 1200, 800, 400],
  uncappedRetentionCost: 400,
  rtmAllowed: false,
  maxRTMs: 0,
  totalPurse: 12000,
};
