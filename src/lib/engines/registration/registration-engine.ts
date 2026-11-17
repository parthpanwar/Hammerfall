// ============================================================
// IPL DYNASTY - Realistic IPL Player Registration Engine
// Generates pre-auction registration lists, assigns valid base prices,
// and produces country, role, and capped status summaries.
// ============================================================

import type { Player, PlayerRole } from '@/lib/types/game';
import type { RegisteredPlayer, RegistrationSummary, BasePriceBracket } from '@/lib/types/registration';
import { OFFICIAL_BASE_PRICES } from '@/lib/types/registration';
import { isPlayerEligibleForAuction } from '../eligibility/auction-eligibility-engine';

/**
 * Assigns an official IPL base price bracket based on player status, ratings, and experience.
 */
export function assignOfficialBasePrice(player: Player): BasePriceBracket {
  const isCapped = player.status === 'Capped';
  const ovr = player.ratings.overall;

  if (!isCapped) {
    // Uncapped players: 20L, 30L, 40L
    if (ovr >= 78) return 40;
    if (ovr >= 72) return 30;
    return 20;
  }

  // Capped players: 50L, 75L, 100L (1 Cr), 150L (1.5 Cr), 200L (2 Cr)
  // Big-name overseas veterans register at the top bracket (Warner, Smith, Bairstow…).
  if (player.nationality === 'Overseas' && player.age >= 33 && ovr >= 80) return 200;
  if (ovr >= 88) return 200;
  if (ovr >= 84) return 150;
  if (ovr >= 80) return 100;
  if (ovr >= 75) return 75;
  return 50;
}

/** Fresh off a breakout domestic season (the off-season before `season`). */
export function isFreshDomesticBreakout(p: Player, season: number): boolean {
  return p.development?.trend === 'Domestic breakout' && p.development.season >= season - 1;
}

/**
 * Mini auctions (after season 1): an uncapped Indian only registers if somebody
 * might actually want him — OVR ≥ 66, POT ≥ 78, IPL cricket in the last two
 * seasons, a new rookie or a domestic breakout. The rest stay in the database.
 */
export function isWorthRegistering(p: Player, season: number): boolean {
  if (p.nationality !== 'Indian' || p.status !== 'Uncapped') return true;
  if (p.ratings.overall >= 66 || p.ratings.potential >= 78) return true;
  if ((p.ipl?.lastSeason ?? 0) >= season - 2 && (p.ipl?.matches ?? 0) > 0) return true;
  if (p.id.startsWith(`gen_${season}_`)) return true;
  return isFreshDomesticBreakout(p, season);
}

/**
 * Generates the official pre-auction registration pool from the global player database.
 */
export function generateAuctionRegistrationPool(
  allPlayers: Player[],
  retainedPlayerIdsOrYear?: Set<string> | number,
  retainedPlayerIdsArg?: Set<string>,
  options?: { filterEligibility?: boolean; seasonYear?: number }
): { registeredPlayers: RegisteredPlayer[]; summary: RegistrationSummary } {
  let retainedPlayerIds = new Set<string>();
  let seasonYear = options?.seasonYear || 2026;
  const shouldFilterEligibility = options?.filterEligibility ?? (typeof retainedPlayerIdsOrYear === 'number');

  if (retainedPlayerIdsOrYear instanceof Set) {
    retainedPlayerIds = retainedPlayerIdsOrYear;
  } else if (typeof retainedPlayerIdsOrYear === 'number') {
    seasonYear = retainedPlayerIdsOrYear;
  }
  if (retainedPlayerIdsArg instanceof Set) {
    retainedPlayerIds = retainedPlayerIdsArg;
  }

  const registeredPlayers: RegisteredPlayer[] = [];

  const byCountry: Record<string, number> = {};
  const byRole: Record<PlayerRole, number> = {
    Batter: 0,
    Bowler: 0,
    'All-Rounder': 0,
    Wicketkeeper: 0,
  };
  const byBasePrice: Record<number, number> = {
    20: 0,
    30: 0,
    40: 0,
    50: 0,
    75: 0,
    100: 0,
    150: 0,
    200: 0,
  };

  let indianCount = 0;
  let overseasCount = 0;
  let cappedIndianCount = 0;
  let uncappedIndianCount = 0;
  let cappedOverseasCount = 0;
  let uncappedOverseasCount = 0;

  for (const player of allPlayers) {
    // Retained players do not register for auction
    if (retainedPlayerIds.has(player.id) || player.isRetained) {
      continue;
    }

    // Evaluate centralized auction eligibility
    const eligibility = isPlayerEligibleForAuction(player, seasonYear, {
      retainedPlayerIds,
      checkRetained: true,
      checkRegistration: false,
    });

    if (shouldFilterEligibility && !eligibility.isEligible) {
      continue;
    }

    const eligibilityStatus = eligibility.isEligible
      ? ('Eligible' as const)
      : eligibility.professionalStatus === 'RETIRED'
      ? ('Retired' as const)
      : ('Ineligible' as const);

    // Assign base price
    const basePrice = assignOfficialBasePrice(player);
    const isIndian = player.nationality === 'Indian';
    const isCapped = player.status === 'Capped';

    const category = `${isCapped ? 'Capped' : 'Uncapped'} ${isIndian ? 'Indian' : 'Overseas'}`;

    if (isIndian) {
      indianCount++;
      if (isCapped) cappedIndianCount++;
      else uncappedIndianCount++;
    } else {
      overseasCount++;
      if (isCapped) cappedOverseasCount++;
      else uncappedOverseasCount++;
    }

    const country = player.country || (isIndian ? 'India' : 'Overseas');
    byCountry[country] = (byCountry[country] || 0) + 1;
    byRole[player.role] = (byRole[player.role] || 0) + 1;
    byBasePrice[basePrice] = (byBasePrice[basePrice] || 0) + 1;

    const registered: RegisteredPlayer = {
      ...player,
      basePrice,
      cappedStatus: player.status,
      eligibilityStatus: 'Eligible',
      isSimulatedRegistration: !player.id.startsWith('cricsheet_'),
      registrationCategory: category,
      shortlistCount: 0,
      shortlistedBy: [],
      finalShortlistSelected: false,
    };

    registeredPlayers.push(registered);
  }

  const summary: RegistrationSummary = {
    totalRegistered: registeredPlayers.length,
    indianCount,
    overseasCount,
    cappedIndianCount,
    uncappedIndianCount,
    cappedOverseasCount,
    uncappedOverseasCount,
    byCountry,
    byRole,
    byBasePrice,
  };

  return { registeredPlayers, summary };
}
