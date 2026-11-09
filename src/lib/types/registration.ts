// ============================================================
// IPL DYNASTY - Player Registration & Eligibility Types
// Governs pre-auction registration, base-price brackets, and pool summaries.
// ============================================================

import type { Player, PlayerNationality, PlayerRole, PlayerStatus } from './game';

/** Official IPL auction base price brackets (in Lakhs) */
export const OFFICIAL_BASE_PRICES = [20, 30, 40, 50, 75, 100, 150, 200] as const;
export type BasePriceBracket = (typeof OFFICIAL_BASE_PRICES)[number];

/** Player eligibility status for the upcoming season */
export type EligibilityStatus = 'Eligible' | 'Ineligible' | 'Retired' | 'Withdrawn';

/** Player registered for the upcoming IPL auction */
export interface RegisteredPlayer extends Player {
  cricsheetId?: string;
  alternateNames?: string[];
  dob?: string;
  cappedStatus: PlayerStatus; // 'Capped' | 'Uncapped'
  eligibilityStatus: EligibilityStatus;
  isSimulatedRegistration: boolean;
  registrationCategory: string; // e.g. 'Capped Indian', 'Uncapped Overseas', etc.
  shortlistCount: number; // Count of franchises that shortlisted this player (0-10)
  shortlistedBy: string[]; // Franchise IDs that shortlisted him
  finalShortlistSelected: boolean;
  auctionSet?: string; // e.g. 'M1', 'BA1', 'UFA1', 'ACCEL'
  auctionOrder?: number;
}

/** Pre-auction registration pool statistical breakdown */
export interface RegistrationSummary {
  totalRegistered: number;
  indianCount: number;
  overseasCount: number;
  cappedIndianCount: number;
  uncappedIndianCount: number;
  cappedOverseasCount: number;
  uncappedOverseasCount: number;
  byCountry: Record<string, number>;
  byRole: Record<PlayerRole, number>;
  byBasePrice: Record<number, number>;
}

