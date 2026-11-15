// ============================================================
// IPL DYNASTY - Player Retirement & Auction Eligibility Types
// Governs verified multi-scope retirement statuses, season-specific
// eligibility, source provenance, and audit logs.
// ============================================================

import type { Player } from './game';

/** Granular activity status classifications */
export type ActivityStatus = 'ACTIVE' | 'RETIRED' | 'INACTIVE' | 'UNKNOWN';

/** Scope of player retirement */
export type RetirementScope =
  | 'ALL_CRICKET'           // Completely retired from all professional cricket
  | 'INTERNATIONAL_ONLY'    // Retired from international cricket but active in franchise/domestic
  | 'DOMESTIC_ONLY'         // Retired from domestic/state cricket
  | 'IPL_ONLY'              // Specifically retired from the IPL
  | 'NONE';                 // Fully active cricketer

/** Official IPL auction registration status */
export type AuctionRegistrationStatus =
  | 'REGISTERED'            // Officially registered and approved for auction
  | 'NOT_REGISTERED'        // Eligible cricketer who chose not to register
  | 'WITHDRAWN'             // Registered but subsequently withdrawn before auction
  | 'BANNED';               // Subject to official BCCI/ICC suspension or ban

/** Verified professional match record */
export interface LastVerifiedMatch {
  matchDate: string;        // ISO 8601 (e.g. '2024-05-26')
  tournament: string;       // e.g. 'Indian Premier League', 'ICC Men's T20 World Cup'
  teams: string;            // e.g. 'KKR vs SRH'
  matchType: 'IPL' | 'International-T20' | 'Franchise-T20' | 'Domestic-T20' | 'Other';
}

/** Complete retirement & eligibility metadata attached to a player */
export interface PlayerRetirementRecord {
  playerId: string;
  playerName: string;
  
  // Independent Status Classifications
  internationalStatus: ActivityStatus;
  domesticStatus: ActivityStatus;
  franchiseStatus: ActivityStatus;
  iplStatus: ActivityStatus;
  professionalStatus: ActivityStatus; // Master complete retirement flag

  // Scope & Dates
  retirementScope: RetirementScope;
  dateOfRetirement?: string;          // ISO date e.g. '2021-11-19'
  retirementAnnouncementUrl?: string; // Verification URL or press release citation
  
  // Auction Registration & Season Restrictions
  auctionRegistrationStatus: AuctionRegistrationStatus;
  seasonEligibility: Record<number, boolean>; // Season Year -> Eligible for that specific season

  // Provenance & Evidence
  lastVerifiedMatch?: LastVerifiedMatch;
  lastVerificationDate: string;       // ISO timestamp
  verificationSource: string;         // e.g. 'BCCI Official Registry', 'Cricsheet Verified Match Repository', 'ICC Official Announcement'
  verificationConfidence: number;     // 0.0 to 1.0 (1.0 = official board announcement)
  
  // Quality & Review Controls
  conflictingReports?: boolean;
  manualReviewRequired?: boolean;
  notes?: string;
}

/** Centralized Auction Eligibility Evaluation Result */
export interface AuctionEligibilityResult {
  isEligible: boolean;
  reason: string;
  seasonYear: number;
  playerId: string;
  playerName: string;
  professionalStatus: ActivityStatus;
  iplStatus: ActivityStatus;
  retirementScope: RetirementScope;
  dateOfRetirement?: string;
  verificationConfidence: number;
  manualReviewRequired: boolean;
}

/** Options for auction eligibility checks */
export interface EligibilityCheckOptions {
  checkRegistration?: boolean;        // Default true: must be registered or simulated registered
  checkRetained?: boolean;            // Default true: retained players do not enter auction
  retainedPlayerIds?: Set<string>;    // Set of retained player IDs for the current season
  allowSimulatedRegistration?: boolean; // For fantasy / sandbox modes
  auctionDate?: string;               // ISO date e.g. '2025-12-15' for strict historical timing
}

/** Manual Correction Audit Entry */
export interface RetirementAuditLogEntry {
  id: string;
  playerId: string;
  playerName: string;
  timestamp: string;
  actor: string;                      // e.g. 'Admin Manager', 'Automated Verification Pipeline'
  previousStatus: {
    professionalStatus: ActivityStatus;
    iplStatus: ActivityStatus;
    retirementScope: RetirementScope;
    isEligible: boolean;
  };
  newStatus: {
    professionalStatus: ActivityStatus;
    iplStatus: ActivityStatus;
    retirementScope: RetirementScope;
    isEligible: boolean;
  };
  reason: string;
  sourceCitation: string;
}

/** Audit Report generated after non-destructive database scan */
export interface DatabaseRetirementAuditReport {
  generatedAt: string;
  totalPlayersChecked: number;
  verifiedActiveCount: number;
  verifiedRetiredCount: number;       // Complete professional retirement
  internationalOnlyRetireesCount: number; // Retired internationally, eligible for IPL
  inactiveCount: number;
  unknownStatusCount: number;
  excludedFromCurrentAuctionCount: number; // Ineligible for season 2026
  manualReviewRequiredCount: number;
  retiredPlayersList: Array<{
    id: string;
    name: string;
    country: string;
    role: string;
    dateOfRetirement?: string;
    scope: RetirementScope;
    source: string;
  }>;
  internationalOnlyList: Array<{
    id: string;
    name: string;
    country: string;
    iplEligible: boolean;
  }>;
  manualReviewList: Array<{
    id: string;
    name: string;
    country: string;
    reason: string;
  }>;
}

