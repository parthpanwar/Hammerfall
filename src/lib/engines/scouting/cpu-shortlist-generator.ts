// ============================================================
// IPL DYNASTY - Independent CPU Franchise Shortlisting Engine
// Generates distinct, strategic player shortlists for all nine CPU franchises
// based on GM personalities, squad deficiencies, overseas constraints, and budgets.
// ============================================================

import type { Franchise, Player } from '@/lib/types/game';
import type { RegisteredPlayer } from '@/lib/types/registration';
import type { FranchiseShortlist, ShortlistPriority, ShortlistEntry } from '@/lib/types/scouting';

/**
 * Generates an independent, strategically targeted shortlist for a single CPU franchise.
 */
export function generateCpuFranchiseShortlist(
  franchise: Franchise,
  registrationPool: RegisteredPlayer[],
  seasonYear: number
): FranchiseShortlist {
  const entries: Record<string, ShortlistEntry> = {};
  const currentRetained = franchise.players;

  // 1. Analyze existing roster to identify deficits
  const retainedOverseas = currentRetained.filter((p) => p.nationality === 'Overseas').length;
  const retainedPacers = currentRetained.filter((p) => p.role === 'Bowler' && !p.isSpinner).length;
  const retainedSpinners = currentRetained.filter((p) => p.isSpinner).length;
  const retainedOpeners = currentRetained.filter((p) => p.isOpener).length;
  const retainedWKs = currentRetained.filter((p) => p.role === 'Wicketkeeper').length;

  // Needs scoring multipliers
  const pacerNeed = retainedPacers < 3 ? 1.4 : 1.0;
  const spinnerNeed = retainedSpinners < 2 ? 1.4 : 1.0;
  const openerNeed = retainedOpeners < 2 ? 1.3 : 1.0;
  const wkNeed = retainedWKs < 1 ? 1.6 : retainedWKs < 2 ? 1.2 : 0.8;
  const overseasDiscount = retainedOverseas >= 6 ? 0.4 : retainedOverseas >= 4 ? 0.75 : 1.0;

  // Personality modifiers
  const persona = franchise.gmPersonality;

  // 2. Score every registered player for this specific franchise
  const scoredPlayers = registrationPool.map((p) => {
    let score = p.ratings.overall * 1.0;

    // Tactical role match
    if (p.role === 'Wicketkeeper') score *= wkNeed;
    if (p.isOpener) score *= openerNeed;
    if (p.isSpinner) score *= spinnerNeed;
    if (p.role === 'Bowler' && !p.isSpinner) score *= pacerNeed;

    // Overseas constraint
    if (p.nationality === 'Overseas') score *= overseasDiscount;

    // Personality weights
    switch (persona) {
      case 'YouthFocused':
        if (p.age <= 23) score += (p.ratings.potential - 70) * 0.4 + 10;
        if (p.age >= 32) score -= 8;
        break;
      case 'SuperstarHunter':
      case 'BigSpender':
        if (p.ratings.overall >= 84) score += 18;
        break;
      case 'DomesticFirst':
        if (p.nationality === 'Indian') score += 12;
        break;
      case 'BowlingFirst':
        if (p.role === 'Bowler') score += 12;
        break;
      case 'ValueHunter':
      case 'AnalyticsDriven':
        const valueRatio = p.ratings.overall / Math.max(20, p.basePrice);
        score += valueRatio * 4;
        break;
      case 'BalancedBuilder':
      default:
        // Balanced approach
        score += (p.ratings.consistency - 65) * 0.2;
        break;
    }

    // Hash-based franchise flavor to ensure distinct targets across franchises
    const franchiseFlavor = (Math.abs(hashString(`${franchise.id}-${p.id}-${seasonYear}`)) % 100) / 10.0;
    score += franchiseFlavor;

    return { player: p, score };
  });

  // Sort by calculated franchise score
  scoredPlayers.sort((a, b) => b.score - a.score);

  // 3. Assign to Priority Tiers (Target: 70–90 players per CPU)
  const now = Date.now();

  // Priority A: Top 12 marquee / core targets
  for (let i = 0; i < 12 && i < scoredPlayers.length; i++) {
    const p = scoredPlayers[i].player;
    entries[p.id] = {
      playerId: p.id,
      franchiseId: franchise.id,
      priority: 'PriorityA',
      targetMaxBidLakhs: p.estimatedMarketValue * 1.25,
      tacticalRoleTag: p.role,
      addedTimestamp: now,
    };
  }

  // Priority B: Next 24 strong targets
  for (let i = 12; i < 36 && i < scoredPlayers.length; i++) {
    const p = scoredPlayers[i].player;
    entries[p.id] = {
      playerId: p.id,
      franchiseId: franchise.id,
      priority: 'PriorityB',
      targetMaxBidLakhs: p.estimatedMarketValue,
      tacticalRoleTag: p.role,
      addedTimestamp: now,
    };
  }

  // Priority C: Next 30 backup options
  for (let i = 36; i < 66 && i < scoredPlayers.length; i++) {
    const p = scoredPlayers[i].player;
    entries[p.id] = {
      playerId: p.id,
      franchiseId: franchise.id,
      priority: 'PriorityC',
      targetMaxBidLakhs: p.basePrice * 1.5,
      tacticalRoleTag: p.role,
      addedTimestamp: now,
    };
  }

  // Watchlist: 15 value / high-potential options
  for (let i = 66; i < 81 && i < scoredPlayers.length; i++) {
    const p = scoredPlayers[i].player;
    entries[p.id] = {
      playerId: p.id,
      franchiseId: franchise.id,
      priority: 'Watchlist',
      targetMaxBidLakhs: p.basePrice,
      tacticalRoleTag: p.role,
      addedTimestamp: now,
    };
  }

  return {
    franchiseId: franchise.id,
    seasonYear,
    entries,
  };
}

/**
 * Generates independent shortlists for all CPU franchises, plus human franchise.
 */
export function generateAllFranchiseShortlists(
  franchises: Franchise[],
  registrationPool: RegisteredPlayer[],
  humanFranchiseIdOrShortlist?: string | FranchiseShortlist,
  seasonYear: number = 2026
): Record<string, FranchiseShortlist> {
  const shortlists: Record<string, FranchiseShortlist> = {};
  const humanId =
    typeof humanFranchiseIdOrShortlist === 'string'
      ? humanFranchiseIdOrShortlist
      : humanFranchiseIdOrShortlist?.franchiseId || '';

  for (const franchise of franchises) {
    if (franchise.id === humanId) {
      if (humanFranchiseIdOrShortlist && typeof humanFranchiseIdOrShortlist !== 'string') {
        shortlists[franchise.id] = humanFranchiseIdOrShortlist;
      } else {
        shortlists[franchise.id] = {
          franchiseId: franchise.id,
          seasonYear,
          entries: {},
        };
      }
      continue;
    }
    shortlists[franchise.id] = generateCpuFranchiseShortlist(franchise, registrationPool, seasonYear);
  }

  return shortlists;
}

/**
 * Generates independent shortlists for all nine CPU franchises.
 */
export function generateAllCpuShortlists(
  franchises: Franchise[],
  humanFranchiseId: string,
  registrationPool: RegisteredPlayer[],
  seasonYear: number = 2026
): Record<string, FranchiseShortlist> {
  return generateAllFranchiseShortlists(franchises, registrationPool, humanFranchiseId, seasonYear);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
