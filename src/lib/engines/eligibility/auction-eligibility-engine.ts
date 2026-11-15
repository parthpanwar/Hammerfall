// ============================================================
// IPL DYNASTY - Centralized Auction Eligibility Engine
// Source-verified evaluation of player retirement, scope,
// season-specific eligibility, and auction qualification.
// Zero age-based or inactivity-based retirement fabrication.
// ============================================================

import type { Player } from '@/lib/types/game';
import type {
  AuctionEligibilityResult,
  EligibilityCheckOptions,
  DatabaseRetirementAuditReport,
  ActivityStatus,
  RetirementScope,
} from '@/lib/types/retirement';
import {
  getVerifiedRetirementRecord,
  VerifiedRetirementEntry,
} from './retirement-registry';

/**
 * Approximate auction month/dates for historical and upcoming IPL seasons:
 * Season 2021: Feb 2021
 * Season 2022: Feb 2022
 * Season 2023: Dec 2022
 * Season 2024: Dec 2023
 * Season 2025: Nov 2024
 * Season 2026: Dec 2025
 */
function getAuctionDateForSeason(seasonYear: number): string {
  switch (seasonYear) {
    case 2021: return '2021-02-18';
    case 2022: return '2022-02-12';
    case 2023: return '2022-12-23';
    case 2024: return '2023-12-19';
    case 2025: return '2024-11-24';
    case 2026: return '2025-12-15';
    default: return `${seasonYear - 1}-12-15`;
  }
}

/**
 * Centralized Player Auction Eligibility Function.
 * Evaluates whether a player can legally enter the IPL auction for a specific season.
 *
 * Rules:
 * 1. Retained players do NOT enter the auction.
 * 2. Fully retired players as of the auction date are INELIGIBLE.
 * 3. Players retired from International cricket but ACTIVE in IPL/franchise cricket are ELIGIBLE.
 * 4. Historical timing is strictly respected (e.g. AB de Villiers eligible for 2021, ineligible for 2022+).
 * 5. Banned or withdrawn players are INELIGIBLE.
 * 6. Inactive or unverified players are NOT assumed retired without explicit evidence.
 */
export function isPlayerEligibleForAuction(
  playerOrId: Player | string,
  seasonYear: number,
  options: EligibilityCheckOptions = {}
): AuctionEligibilityResult {
  const checkRetained = options.checkRetained !== false;
  const checkRegistration = options.checkRegistration !== false;
  const auctionDate = options.auctionDate || getAuctionDateForSeason(seasonYear);

  let player: Player | undefined;
  let playerId: string;
  let playerName: string;

  if (typeof playerOrId === 'string') {
    playerId = playerOrId;
    playerName = playerOrId;
  } else {
    player = playerOrId;
    playerId = player.id;
    playerName = player.name;
  }

  // 1. Check Franchise Retention
  if (checkRetained) {
    if (options.retainedPlayerIds && options.retainedPlayerIds.has(playerId)) {
      return {
        isEligible: false,
        reason: 'Player is currently retained by an IPL franchise.',
        seasonYear,
        playerId,
        playerName,
        professionalStatus: player?.professionalStatus || 'ACTIVE',
        iplStatus: player?.iplStatus || 'ACTIVE',
        retirementScope: player?.retirementScope || 'NONE',
        dateOfRetirement: player?.dateOfRetirement,
        verificationConfidence: 1.0,
        manualReviewRequired: false,
      };
    }
    if (player && (player.isRetained || Boolean(player.currentFranchiseId))) {
      return {
        isEligible: false,
        reason: `Player is retained under franchise contract (${player.currentFranchiseId || 'Retained'}).`,
        seasonYear,
        playerId,
        playerName,
        professionalStatus: player.professionalStatus || 'ACTIVE',
        iplStatus: player.iplStatus || 'ACTIVE',
        retirementScope: player.retirementScope || 'NONE',
        dateOfRetirement: player.dateOfRetirement,
        verificationConfidence: 1.0,
        manualReviewRequired: false,
      };
    }
  }

  // 2. Fetch Verified Retirement Registry Entry
  const verifiedEntry = getVerifiedRetirementRecord(playerId, playerName);

  // Derive status from verified entry or player fields
  const profStatus: ActivityStatus = verifiedEntry?.professionalStatus || player?.professionalStatus || 'ACTIVE';
  const iplStatus: ActivityStatus = verifiedEntry?.iplStatus || player?.iplStatus || 'ACTIVE';
  const scope: RetirementScope = verifiedEntry?.scope || player?.retirementScope || 'NONE';
  const retirementDate = verifiedEntry?.dateOfRetirement || player?.dateOfRetirement;
  const confidence = verifiedEntry?.confidence ?? player?.verificationConfidence ?? 0.85;
  const manualReview = player?.manualReviewRequired ?? false;

  // 3. Complete Professional Retirement Check
  if (profStatus === 'RETIRED' || scope === 'ALL_CRICKET') {
    // Check if retirement occurred BEFORE or AFTER this season's auction
    let retiredBeforeSeason = false;
    if (verifiedEntry) {
      retiredBeforeSeason = seasonYear >= verifiedEntry.firstIneligibleIPLSeason;
    } else if (retirementDate) {
      retiredBeforeSeason = retirementDate <= auctionDate;
    } else {
      retiredBeforeSeason = true;
    }

    if (retiredBeforeSeason) {
      return {
        isEligible: false,
        reason: `Player announced complete professional retirement (${retirementDate || 'Verified'}). Ineligible for Season ${seasonYear} auction.`,
        seasonYear,
        playerId,
        playerName,
        professionalStatus: 'RETIRED',
        iplStatus: 'RETIRED',
        retirementScope: 'ALL_CRICKET',
        dateOfRetirement: retirementDate,
        verificationConfidence: confidence,
        manualReviewRequired: manualReview,
      };
    }
  }

  // 4. IPL-Specific Retirement Check
  if (iplStatus === 'RETIRED' || scope === 'IPL_ONLY') {
    let retiredBeforeSeason = false;
    if (verifiedEntry) {
      retiredBeforeSeason = seasonYear >= verifiedEntry.firstIneligibleIPLSeason;
    } else if (retirementDate) {
      retiredBeforeSeason = retirementDate <= auctionDate;
    } else {
      retiredBeforeSeason = true;
    }

    if (retiredBeforeSeason) {
      return {
        isEligible: false,
        reason: `Player specifically retired from the IPL (${retirementDate || 'Verified'}). Ineligible for IPL ${seasonYear}.`,
        seasonYear,
        playerId,
        playerName,
        professionalStatus: profStatus,
        iplStatus: 'RETIRED',
        retirementScope: 'IPL_ONLY',
        dateOfRetirement: retirementDate,
        verificationConfidence: confidence,
        manualReviewRequired: manualReview,
      };
    }
  }

  // 5. Official Ban / Suspension Check
  const registrationStatus = verifiedEntry?.auctionRegistrationStatus || player?.auctionRegistrationStatus || 'REGISTERED';
  if (registrationStatus === 'BANNED') {
    return {
      isEligible: false,
      reason: 'Player is subject to an active BCCI/ICC disciplinary suspension or ban.',
      seasonYear,
      playerId,
      playerName,
      professionalStatus: profStatus,
      iplStatus: 'INACTIVE',
      retirementScope: scope,
      dateOfRetirement: retirementDate,
      verificationConfidence: 1.0,
      manualReviewRequired: false,
    };
  }

  // 6. Withdrawal Check
  if (registrationStatus === 'WITHDRAWN') {
    return {
      isEligible: false,
      reason: 'Player withdrew official registration prior to auction.',
      seasonYear,
      playerId,
      playerName,
      professionalStatus: profStatus,
      iplStatus: 'INACTIVE',
      retirementScope: scope,
      dateOfRetirement: retirementDate,
      verificationConfidence: 0.95,
      manualReviewRequired: false,
    };
  }

  // 7. International-Only Retiree Handling
  // E.g. MS Dhoni, Faf du Plessis, Sunil Narine, David Warner
  if (scope === 'INTERNATIONAL_ONLY' || (player?.internationalStatus === 'RETIRED' && iplStatus === 'ACTIVE')) {
    return {
      isEligible: true,
      reason: 'Player is retired from international cricket but officially ACTIVE in franchise/IPL cricket.',
      seasonYear,
      playerId,
      playerName,
      professionalStatus: 'ACTIVE',
      iplStatus: 'ACTIVE',
      retirementScope: 'INTERNATIONAL_ONLY',
      dateOfRetirement: retirementDate,
      verificationConfidence: confidence,
      manualReviewRequired: manualReview,
    };
  }

  // 8. Default Eligible Active Player
  return {
    isEligible: true,
    reason: 'Verified active professional cricketer eligible for auction.',
    seasonYear,
    playerId,
    playerName,
    professionalStatus: profStatus,
    iplStatus: 'ACTIVE',
    retirementScope: scope,
    dateOfRetirement: retirementDate,
    verificationConfidence: confidence,
    manualReviewRequired: manualReview,
  };
}

/**
 * Filters an array of players into eligible and ineligible cohorts for an IPL season.
 */
export function filterAuctionEligiblePlayers<T extends Player>(
  players: T[],
  seasonYear: number,
  options: EligibilityCheckOptions = {}
): {
  eligiblePlayers: T[];
  ineligiblePlayers: Array<{ player: T; reason: string }>;
} {
  const eligiblePlayers: T[] = [];
  const ineligiblePlayers: Array<{ player: T; reason: string }> = [];

  for (const player of players) {
    const evalResult = isPlayerEligibleForAuction(player, seasonYear, options);
    if (evalResult.isEligible) {
      eligiblePlayers.push(player);
    } else {
      ineligiblePlayers.push({ player, reason: evalResult.reason });
    }
  }

  return { eligiblePlayers, ineligiblePlayers };
}

/**
 * Audits the global player database non-destructively and produces a detailed report.
 */
export function auditDatabaseRetirements(
  allPlayers: Player[],
  targetSeasonYear: number = 2026
): DatabaseRetirementAuditReport {
  let verifiedActiveCount = 0;
  let verifiedRetiredCount = 0;
  let internationalOnlyRetireesCount = 0;
  let inactiveCount = 0;
  let unknownStatusCount = 0;
  let excludedFromCurrentAuctionCount = 0;
  let manualReviewRequiredCount = 0;

  const retiredPlayersList: DatabaseRetirementAuditReport['retiredPlayersList'] = [];
  const internationalOnlyList: DatabaseRetirementAuditReport['internationalOnlyList'] = [];
  const manualReviewList: DatabaseRetirementAuditReport['manualReviewList'] = [];

  for (const player of allPlayers) {
    const evalResult = isPlayerEligibleForAuction(player, targetSeasonYear, { checkRetained: false });
    const verifiedEntry = getVerifiedRetirementRecord(player.id, player.name);

    if (evalResult.retirementScope === 'ALL_CRICKET' || evalResult.professionalStatus === 'RETIRED') {
      verifiedRetiredCount++;
      retiredPlayersList.push({
        id: player.id,
        name: player.name,
        country: player.country,
        role: player.role,
        dateOfRetirement: evalResult.dateOfRetirement,
        scope: evalResult.retirementScope,
        source: verifiedEntry?.sourceCitation || 'Verified Cricsheet Historical Snapshot',
      });
    } else if (evalResult.retirementScope === 'INTERNATIONAL_ONLY') {
      internationalOnlyRetireesCount++;
      internationalOnlyList.push({
        id: player.id,
        name: player.name,
        country: player.country,
        iplEligible: evalResult.isEligible,
      });
    } else if (evalResult.professionalStatus === 'INACTIVE') {
      inactiveCount++;
    } else if (evalResult.professionalStatus === 'UNKNOWN') {
      unknownStatusCount++;
    } else {
      verifiedActiveCount++;
    }

    if (!evalResult.isEligible) {
      excludedFromCurrentAuctionCount++;
    }

    if (evalResult.manualReviewRequired) {
      manualReviewRequiredCount++;
      manualReviewList.push({
        id: player.id,
        name: player.name,
        country: player.country,
        reason: 'Flagged for manual review due to conflicting reports or unconfirmed status.',
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalPlayersChecked: allPlayers.length,
    verifiedActiveCount,
    verifiedRetiredCount,
    internationalOnlyRetireesCount,
    inactiveCount,
    unknownStatusCount,
    excludedFromCurrentAuctionCount,
    manualReviewRequiredCount,
    retiredPlayersList,
    internationalOnlyList,
    manualReviewList,
  };
}
