// ============================================================
// IPL DYNASTY - Realistic IPL Player Registration Engine
// Generates pre-auction registration lists, assigns valid base prices,
// and produces country, role, and capped status summaries.
// ============================================================

import type { Player, PlayerRole } from '@/lib/types/game';
import type { RegisteredPlayer, RegistrationSummary, BasePriceBracket } from '@/lib/types/registration';
import { OFFICIAL_BASE_PRICES } from '@/lib/types/registration';

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
  if (ovr >= 88) return 200;
  if (ovr >= 84) return 150;
  if (ovr >= 80) return 100;
  if (ovr >= 75) return 75;
  return 50;
}

/**
 * Generates the official pre-auction registration pool from the global player database.
 */
export function generateAuctionRegistrationPool(
  allPlayers: Player[],
  retainedPlayerIdsOrYear?: Set<string> | number,
  retainedPlayerIdsArg?: Set<string>
): { registeredPlayers: RegisteredPlayer[]; summary: RegistrationSummary } {
  let retainedPlayerIds = new Set<string>();
  if (retainedPlayerIdsOrYear instanceof Set) {
    retainedPlayerIds = retainedPlayerIdsOrYear;
  } else if (retainedPlayerIdsArg instanceof Set) {
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
