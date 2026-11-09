// ============================================================
// IPL DYNASTY - Retention Rules
// ============================================================

import type { RetentionRule } from '../types/game';

/**
 * Retention rules for the IPL 2026 Mega Auction.
 * Based on the IPL 2025 mega auction format with up to 6 retentions/RTMs.
 * Costs are in lakhs (1 crore = 100 lakhs).
 */
export const RETENTION_RULES_2026: RetentionRule = {
  maxRetentions: 6,
  maxCappedRetentions: 5,
  maxUncappedRetentions: 2,
  maxOverseasRetentions: 2,
  retentionCosts: [1800, 1400, 1100, 1800, 1400, 400], // costs for slots 1-6
  uncappedRetentionCost: 400, // 4 Cr for uncapped
  rtmAllowed: true,
  maxRTMs: 6, // combined with retentions, total cannot exceed 6
  totalPurse: 12000, // 120 Cr
};

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
