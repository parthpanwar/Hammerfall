// ============================================================
// IPL DYNASTY - Official IPL Squad Constraints & Rules Types
// Supports squad sizes 18 to 25, maximum 8 overseas, and custom rules.
// ============================================================

import type { Franchise, Player } from './game';

/** Season-versioned squad constraints preset */
export interface SquadRules {
  presetName: 'Official' | 'Custom';
  minSquadSize: number; // Official IPL: 18
  maxSquadSize: number; // Official IPL: 25
  maxOverseas: number; // Official IPL: 8 (maximum, not mandatory)
  requireExactOverseas: boolean; // Custom rule: default false
  customPurseLakhs?: number;
}

export const OFFICIAL_IPL_SQUAD_RULES: SquadRules = {
  presetName: 'Official',
  minSquadSize: 18,
  maxSquadSize: 25,
  maxOverseas: 8,
  requireExactOverseas: false,
};

/** Deep squad composition analytics */
export interface SquadComposition {
  franchiseId: string;
  franchiseName: string;
  totalPlayers: number;
  indianPlayers: number;
  overseasPlayers: number;
  cappedIndian: number;
  uncappedIndian: number;
  cappedOverseas: number;
  uncappedOverseas: number;
  batters: number;
  bowlers: number;
  allRounders: number;
  wicketkeepers: number;
  remainingPurse: number;
  remainingSquadSlots: number; // slots left to reach max (25)
  minSlotsNeeded: number; // slots needed to reach legal minimum (18)
  remainingOverseasSlots: number; // slots left before hitting 8 max
  isLegal: boolean;
  validationErrors: string[];
}

