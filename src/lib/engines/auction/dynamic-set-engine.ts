// ============================================================
// IPL DYNASTY - Dynamic Auction Set & Intelligent Sequencing Engine
// Implements role segregation, rating-based tiering, marquee selection,
// interleaved scheduling, and per-set Fisher-Yates randomized ordering.
// ============================================================

import type { Player } from '@/lib/types/game';
import type {
  AuctionSet,
  AuctionSetCategory,
  AuctionPlayerAssignment,
  DynamicAuctionSequence,
  RatingTierThresholds,
} from '@/lib/types/auction-set';
import { DEFAULT_RATING_THRESHOLDS } from '@/lib/types/auction-set';
import { createSeededRandom } from '@/lib/utils/random';

export interface SetGenerationConfig {
  marqueeSize: number; // default 12-16
  minSetSize: number; // default 5
  targetSetSize: number; // default 8-10
  maxSetSize: number; // default 14
  ratingThresholds?: RatingTierThresholds;
}

export const DEFAULT_SET_CONFIG: SetGenerationConfig = {
  marqueeSize: 12,
  minSetSize: 5,
  targetSetSize: 8,
  maxSetSize: 14,
  ratingThresholds: DEFAULT_RATING_THRESHOLDS,
};

/**
 * Determine a player's primary auction category based on capped status and role.
 */
export function getPlayerAuctionCategory(player: Player): AuctionSetCategory {
  const isCapped = player.status === 'Capped';
  const role = player.role;
  const isSpinner = player.isSpinner;

  if (isCapped) {
    if (role === 'Batter') return 'Batsmen';
    if (role === 'All-Rounder') return 'All-Rounders';
    if (role === 'Wicketkeeper') return 'Wicketkeepers';
    if (role === 'Bowler') return isSpinner ? 'Spin Bowlers' : 'Fast Bowlers';
    return 'Batsmen';
  } else {
    if (role === 'Batter') return 'Uncapped Batsmen';
    if (role === 'All-Rounder') return 'Uncapped All-Rounders';
    if (role === 'Wicketkeeper') return 'Uncapped Wicketkeepers';
    if (role === 'Bowler') return isSpinner ? 'Uncapped Spin Bowlers' : 'Uncapped Fast Bowlers';
    return 'Uncapped Batsmen';
  }
}

/**
 * Calculate multi-factor Marquee Selection Score.
 * Considers overall rating, recent form, match experience, base price, and market demand.
 */
export function calculateMarqueeScore(player: Player): number {
  if (player.status !== 'Capped') return 0;
  if (player.ratings.overall < 80) return 0;

  const ovrScore = player.ratings.overall * 0.35;
  const formScore = player.recentForm * 0.20;
  const expScore = Math.min(100, (player.stats?.matches || 0) * 0.6) * 0.15;
  const priceScore = Math.min(100, player.basePrice * 0.5) * 0.15;
  const demandScore = Math.min(100, (player.estimatedMarketValue || player.basePrice) / 15) * 0.15;

  return ovrScore + formScore + expScore + priceScore + demandScore;
}

/**
 * Main Dynamic Auction Sequence Generator.
 * Given an eligible player pool and an auction seed, generates:
 * 1. Marquee selection (removed from role sets)
 * 2. Deterministic rating tiers within each role
 * 3. Dynamic interleaved schedule
 * 4. Fisher-Yates randomized player order strictly WITHIN each set.
 */
export function generateDynamicAuctionSequence(
  playerPool: Player[],
  seed: number,
  config: SetGenerationConfig = DEFAULT_SET_CONFIG
): DynamicAuctionSequence {
  const rng = createSeededRandom(seed);
  const pool = [...playerPool];

  // 1. Marquee Selection
  // Score all eligible capped players
  const marqueeCandidates = pool
    .filter((p) => p.status === 'Capped' && p.ratings.overall >= 80)
    .map((p) => ({ player: p, score: calculateMarqueeScore(p) }))
    .sort((a, b) => b.score - a.score || b.player.ratings.overall - a.player.ratings.overall);

  const marqueeCount = Math.min(config.marqueeSize, marqueeCandidates.length);
  const marqueePlayers = marqueeCandidates.slice(0, marqueeCount).map((c) => c.player);
  const marqueeIds = new Set(marqueePlayers.map((p) => p.id));

  // 2. Segregate remaining players by role category
  const rolePools: Record<AuctionSetCategory, Player[]> = {
    'Marquee': [],
    'Batsmen': [],
    'All-Rounders': [],
    'Wicketkeepers': [],
    'Fast Bowlers': [],
    'Spin Bowlers': [],
    'Uncapped Batsmen': [],
    'Uncapped All-Rounders': [],
    'Uncapped Wicketkeepers': [],
    'Uncapped Fast Bowlers': [],
    'Uncapped Spin Bowlers': [],
    'Accelerated': [],
  };

  for (const player of pool) {
    if (marqueeIds.has(player.id)) {
      continue; // Strictly excluded from role sets
    }
    const cat = getPlayerAuctionCategory(player);
    rolePools[cat].push(player);
  }

  // 3. Partition each role pool into rating-based tiers
  // Sort players within each role by overall rating descending
  const partitionedSets: Record<AuctionSetCategory, Player[][]> = {
    'Marquee': [],
    'Batsmen': [],
    'All-Rounders': [],
    'Wicketkeepers': [],
    'Fast Bowlers': [],
    'Spin Bowlers': [],
    'Uncapped Batsmen': [],
    'Uncapped All-Rounders': [],
    'Uncapped Wicketkeepers': [],
    'Uncapped Fast Bowlers': [],
    'Uncapped Spin Bowlers': [],
    'Accelerated': [],
  };

  // Marquee into 2 sets: M1 and M2
  if (marqueePlayers.length > 0) {
    const half = Math.ceil(marqueePlayers.length / 2);
    partitionedSets['Marquee'].push(marqueePlayers.slice(0, half)); // M1
    if (marqueePlayers.length > half) {
      partitionedSets['Marquee'].push(marqueePlayers.slice(half)); // M2
    }
  }

  // Partition role pools
  const categoriesToPartition: AuctionSetCategory[] = [
    'Batsmen',
    'All-Rounders',
    'Wicketkeepers',
    'Fast Bowlers',
    'Spin Bowlers',
    'Uncapped Batsmen',
    'Uncapped All-Rounders',
    'Uncapped Wicketkeepers',
    'Uncapped Fast Bowlers',
    'Uncapped Spin Bowlers',
  ];

  for (const cat of categoriesToPartition) {
    const players = rolePools[cat].sort((a, b) => b.ratings.overall - a.ratings.overall);
    if (players.length === 0) continue;

    const tiers: Player[][] = [];
    let currentTier: Player[] = [];

    for (let i = 0; i < players.length; i++) {
      currentTier.push(players[i]);
      // When current tier hits target size, start new tier if enough players remain
      if (currentTier.length >= config.targetSetSize) {
        const remaining = players.length - (i + 1);
        if (remaining >= config.minSetSize) {
          tiers.push(currentTier);
          currentTier = [];
        }
      }
    }

    if (currentTier.length > 0) {
      if (tiers.length > 0 && currentTier.length < config.minSetSize) {
        // Merge tiny remainder into last tier
        tiers[tiers.length - 1].push(...currentTier);
      } else {
        tiers.push(currentTier);
      }
    }

    partitionedSets[cat] = tiers;
  }

  // 4. Construct Scheduled Auction Order
  // Order pattern:
  // Marquee: M1, M2
  // Tier 1 Capped: BAT1, AR1, WK1, FB1, SB1
  // Tier 2 Capped: BAT2, AR2, WK2 (if exists), FB2, SB2
  // Tier 1 Uncapped: UBAT1, UAR1, UWK1, UFB1, USB1
  // Tier 3 Capped: BAT3, AR3, FB3, SB3
  // Tier 2 Uncapped: UBAT2, UAR2, UFB2, USB2
  // Remaining tiers...
  const setCodePrefixes: Record<AuctionSetCategory, string> = {
    'Marquee': 'M',
    'Batsmen': 'BAT',
    'All-Rounders': 'AR',
    'Wicketkeepers': 'WK',
    'Fast Bowlers': 'FB',
    'Spin Bowlers': 'SB',
    'Uncapped Batsmen': 'UBAT',
    'Uncapped All-Rounders': 'UAR',
    'Uncapped Wicketkeepers': 'UWK',
    'Uncapped Fast Bowlers': 'UFB',
    'Uncapped Spin Bowlers': 'USB',
    'Accelerated': 'ACCEL',
  };

  const rawScheduledSets: {
    category: AuctionSetCategory;
    tier: number;
    code: string;
    name: string;
    isUncapped: boolean;
    players: Player[];
  }[] = [];

  // Marquee sets first
  partitionedSets['Marquee'].forEach((tierPlayers, idx) => {
    rawScheduledSets.push({
      category: 'Marquee',
      tier: idx + 1,
      code: `M${idx + 1}`,
      name: `Marquee Players Set ${idx + 1}`,
      isUncapped: false,
      players: tierPlayers,
    });
  });

  // Interleaved scheduling sequence definition
  interface ScheduleStep {
    category: AuctionSetCategory;
    tierIndex: number; // 0-based
  }

  const cappedRoles: AuctionSetCategory[] = [
    'Batsmen',
    'All-Rounders',
    'Wicketkeepers',
    'Fast Bowlers',
    'Spin Bowlers',
  ];

  const uncappedRoles: AuctionSetCategory[] = [
    'Uncapped Batsmen',
    'Uncapped All-Rounders',
    'Uncapped Wicketkeepers',
    'Uncapped Fast Bowlers',
    'Uncapped Spin Bowlers',
  ];

  // Interleaved scheduling: rotate through capped tiers, weaving in uncapped tiers
  const maxCappedTiers = Math.max(...cappedRoles.map((cat) => partitionedSets[cat].length));
  const maxUncappedTiers = Math.max(...uncappedRoles.map((cat) => partitionedSets[cat].length));

  const addSet = (cat: AuctionSetCategory, tierIdx: number) => {
    rawScheduledSets.push({
      category: cat,
      tier: tierIdx + 1,
      code: `${setCodePrefixes[cat]}${tierIdx + 1}`,
      name: `${cat} Set ${tierIdx + 1}`,
      isUncapped: cat.startsWith('Uncapped'),
      players: partitionedSets[cat][tierIdx],
    });
  };

  let cTier = 0;
  let uTier = 0;

  // Tier 1 Capped
  for (const cat of cappedRoles) {
    if (partitionedSets[cat][cTier]) {
      addSet(cat, cTier);
    }
  }
  cTier++;

  // Interleave remaining capped and uncapped tiers until all sets are scheduled
  while (cTier < maxCappedTiers || uTier < maxUncappedTiers) {
    // Add next capped tier if available
    if (cTier < maxCappedTiers) {
      for (const cat of cappedRoles) {
        if (partitionedSets[cat][cTier]) {
          addSet(cat, cTier);
        }
      }
      cTier++;
    }

    // Add next uncapped tier if available
    if (uTier < maxUncappedTiers) {
      for (const cat of uncappedRoles) {
        if (partitionedSets[cat][uTier]) {
          addSet(cat, uTier);
        }
      }
      uTier++;
    }
  }

  // 5. Apply unbiased Fisher-Yates shuffle WITHIN each set
  // Player order differs per seed, but ratings strictly govern set membership
  const finalizedSets: AuctionSet[] = [];
  const assignments: Record<string, AuctionPlayerAssignment> = {};
  const orderedPlayerIds: string[] = [];

  let globalOrder = 1;

  rawScheduledSets.forEach((rawSet, setIndex) => {
    // Shuffle player order within set using seeded PRNG
    const shuffledPlayers = [...rawSet.players];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      const temp = shuffledPlayers[i];
      shuffledPlayers[i] = shuffledPlayers[j];
      shuffledPlayers[j] = temp;
    }

    const setId = `set-${rawSet.code.toLowerCase()}`;
    const playerIds = shuffledPlayers.map((p) => p.id);

    const auctionSet: AuctionSet = {
      id: setId,
      code: rawSet.code,
      name: rawSet.name,
      category: rawSet.category,
      tier: rawSet.tier,
      order: setIndex + 1,
      isUncapped: rawSet.isUncapped,
      playerIds,
      totalCount: playerIds.length,
    };

    finalizedSets.push(auctionSet);

    // Create assignment records for each player in this set
    shuffledPlayers.forEach((player, orderWithinSet) => {
      const assignment: AuctionPlayerAssignment = {
        playerId: player.id,
        playerName: player.name,
        auctionSetId: setId,
        auctionSetCode: rawSet.code,
        auctionSetName: rawSet.name,
        auctionSetCategory: rawSet.category,
        auctionSetTier: rawSet.tier,
        auctionSetOrder: setIndex + 1,
        playerOrderWithinSet: orderWithinSet + 1,
        globalAuctionOrder: globalOrder,
        playerRatingAtAuctionCreation: player.ratings.overall,
      };

      assignments[player.id] = assignment;
      orderedPlayerIds.push(player.id);
      globalOrder++;
    });
  });

  return {
    auctionSeed: seed,
    sets: finalizedSets,
    assignments,
    orderedPlayerIds,
    totalPlayers: orderedPlayerIds.length,
    totalSets: finalizedSets.length,
  };
}

/**
 * Future Auction Pool Analysis for CPU General Managers.
 * Computes future player supply by role and quality tier to prevent early overbidding.
 */
export interface UpcomingPoolAnalysis {
  role: string;
  isCapped: boolean;
  remainingInSameRole: number;
  betterPlayersRemainingInRole: number; // Count of remaining players rated higher than candidate
  comparablePlayersRemainingInRole: number; // Within +/- 3 OVR
  eliteRemainingInRole: number; // OVR >= 85
  highQualityRemainingInRole: number; // OVR >= 78
  upcomingSetsForRole: number; // Count of future sets containing this role
  scarcityFactor: number; // 0.6 (plenty of alternatives) to 1.4 (last option)
  earlyDiscountMultiplier: number; // Discount multiplier if better players exist later
}

/**
 * Evaluates future auction sets and remaining candidate pool for a given player.
 */
export function analyzeUpcomingPool(
  candidate: Player,
  session: { playerPool: Player[]; currentPlayerIndex: number; sets?: AuctionSet[]; setAssignments?: Record<string, AuctionPlayerAssignment> }
): UpcomingPoolAnalysis {
  const remainingPlayers = session.playerPool.slice(session.currentPlayerIndex + 1);
  const candCategory = getPlayerAuctionCategory(candidate);
  const candRating = candidate.ratings.overall;

  const sameRoleRemaining = remainingPlayers.filter(
    (p) => getPlayerAuctionCategory(p) === candCategory
  );

  const betterPlayers = sameRoleRemaining.filter((p) => p.ratings.overall > candRating);
  const comparablePlayers = sameRoleRemaining.filter(
    (p) => Math.abs(p.ratings.overall - candRating) <= 3
  );
  const elitePlayers = sameRoleRemaining.filter((p) => p.ratings.overall >= 85);
  const highQualityPlayers = sameRoleRemaining.filter((p) => p.ratings.overall >= 78);

  // Remaining upcoming sets for this role
  let upcomingSetsCount = 1;
  if (session.sets && session.setAssignments && session.setAssignments[candidate.id]) {
    const currentSetOrder = session.setAssignments[candidate.id].auctionSetOrder;
    upcomingSetsCount = session.sets.filter(
      (s) => s.category === candCategory && s.order > currentSetOrder
    ).length;
  }

  // Scarcity factor
  let scarcityFactor = 1.0;
  if (sameRoleRemaining.length === 0) scarcityFactor = 1.45;
  else if (sameRoleRemaining.length <= 2) scarcityFactor = 1.25;
  else if (sameRoleRemaining.length <= 5) scarcityFactor = 1.05;
  else if (sameRoleRemaining.length > 15) scarcityFactor = 0.85;

  // Early auction overbidding discount:
  // If an average player (OVR < 78) appears early, but 3+ better players remain in future sets,
  // apply a strategic discount so CPU saves purse for the upcoming stars!
  let earlyDiscountMultiplier = 1.0;
  if (candRating < 80 && betterPlayers.length >= 3) {
    // There are substantially better options coming later
    const ratingDeficit = Math.max(0, 80 - candRating);
    earlyDiscountMultiplier = Math.max(0.65, 1.0 - (ratingDeficit * 0.025) - Math.min(0.15, betterPlayers.length * 0.03));
  } else if (candRating >= 85) {
    // Star player: no discount, high demand
    earlyDiscountMultiplier = 1.0;
  }

  return {
    role: candidate.role,
    isCapped: candidate.status === 'Capped',
    remainingInSameRole: sameRoleRemaining.length,
    betterPlayersRemainingInRole: betterPlayers.length,
    comparablePlayersRemainingInRole: comparablePlayers.length,
    eliteRemainingInRole: elitePlayers.length,
    highQualityRemainingInRole: highQualityPlayers.length,
    upcomingSetsForRole: upcomingSetsCount,
    scarcityFactor,
    earlyDiscountMultiplier,
  };
}
