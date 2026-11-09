// ============================================================
// IPL DYNASTY - Retention Engine
// Handles player retentions before auction
// ============================================================

import type {
  Franchise,
  Player,
  RetentionRule,
  RetentionDecision,
  SeededRandom,
  GMPersonality,
} from '@/lib/types/game';
import { formatPrice } from '@/lib/utils/index';

// --- Cost Calculation ---

/** Get the cost (in lakhs) for the nth retention (1-indexed). */
export function getRetentionCost(retentionNumber: number, rules: RetentionRule): number {
  if (retentionNumber < 1 || retentionNumber > rules.maxRetentions) {
    throw new Error(
      `Invalid retention number ${retentionNumber}. Must be 1-${rules.maxRetentions}.`
    );
  }
  return rules.retentionCosts[retentionNumber - 1];
}

// --- Validation ---

export interface RetentionValidation {
  valid: boolean;
  reason: string;
}

/** Validate whether a franchise can retain a specific player. */
export function validateRetention(
  franchise: Franchise,
  player: Player,
  currentRetentions: RetentionDecision[],
  rules: RetentionRule
): RetentionValidation {
  // Already at max retentions
  if (currentRetentions.length >= rules.maxRetentions) {
    return { valid: false, reason: `Maximum ${rules.maxRetentions} retentions reached.` };
  }

  // Player must belong to franchise
  if (player.currentFranchiseId !== franchise.id) {
    return { valid: false, reason: `${player.name} does not belong to ${franchise.shortName}.` };
  }

  // Player already retained
  if (currentRetentions.some((d) => d.playerId === player.id)) {
    return { valid: false, reason: `${player.name} is already retained.` };
  }

  // Check capped retention limit
  const cappedCount = currentRetentions.filter((d) => {
    // We need to look up the player to check status – use franchise roster
    const p = franchise.players.find((fp) => fp.id === d.playerId);
    return p && p.status === 'Capped';
  }).length;
  if (player.status === 'Capped' && cappedCount >= rules.maxCappedRetentions) {
    return {
      valid: false,
      reason: `Maximum ${rules.maxCappedRetentions} capped player retentions reached.`,
    };
  }

  // Check uncapped retention limit
  const uncappedCount = currentRetentions.filter((d) => {
    const p = franchise.players.find((fp) => fp.id === d.playerId);
    return p && p.status === 'Uncapped';
  }).length;
  if (player.status === 'Uncapped' && uncappedCount >= rules.maxUncappedRetentions) {
    return {
      valid: false,
      reason: `Maximum ${rules.maxUncappedRetentions} uncapped player retentions reached.`,
    };
  }

  // Check overseas retention limit
  const overseasCount = currentRetentions.filter((d) => {
    const p = franchise.players.find((fp) => fp.id === d.playerId);
    return p && p.nationality === 'Overseas';
  }).length;
  if (player.nationality === 'Overseas' && overseasCount >= rules.maxOverseasRetentions) {
    return {
      valid: false,
      reason: `Maximum ${rules.maxOverseasRetentions} overseas retentions reached.`,
    };
  }

  // Check if franchise can afford the retention
  const nextRetentionNumber = currentRetentions.length + 1;
  const cost =
    player.status === 'Uncapped'
      ? rules.uncappedRetentionCost
      : getRetentionCost(nextRetentionNumber, rules);

  const totalSpent = currentRetentions.reduce((sum, d) => sum + d.cost, 0);
  const remainingAfter = rules.totalPurse - totalSpent - cost;

  // Must have enough purse remaining to fill minimum squad via auction
  // Each additional player at auction needs at minimum 20 lakhs (base price floor)
  const retainedCount = currentRetentions.length + 1;
  const minSquadRemaining = franchise.minSquadSize - retainedCount;
  const minPurseNeeded = minSquadRemaining * 20; // 20L per minimum auction buy

  if (remainingAfter < minPurseNeeded) {
    return {
      valid: false,
      reason: `Cannot afford retention. Would leave ${formatPrice(remainingAfter)} for ${minSquadRemaining} more players.`,
    };
  }

  return { valid: true, reason: '' };
}

// --- Process Retention ---

/** Apply a retention, returning the updated decision. */
export function processRetention(
  franchise: Franchise,
  player: Player,
  retentionNumber: number,
  rules: RetentionRule
): RetentionDecision {
  const cost =
    player.status === 'Uncapped'
      ? rules.uncappedRetentionCost
      : getRetentionCost(retentionNumber, rules);

  return {
    franchiseId: franchise.id,
    playerId: player.id,
    playerName: player.name,
    retentionNumber,
    cost,
    isRTM: false,
  };
}

// --- GM Personality Weights ---

interface PersonalityWeights {
  qualityWeight: number;
  ageWeight: number; // positive = prefers youth, negative = prefers experience
  marketValueWeight: number;
  scarcityWeight: number;
  loyaltyWeight: number;
  starPremium: number; // extra bonus for elite (90+) players
  maxRetentionWillingness: number; // 0-1 how many of max retentions they'll use
}

function getPersonalityWeights(personality: GMPersonality): PersonalityWeights {
  switch (personality) {
    case 'Aggressive':
      return {
        qualityWeight: 1.3,
        ageWeight: 0.0,
        marketValueWeight: 0.8,
        scarcityWeight: 1.1,
        loyaltyWeight: 0.5,
        starPremium: 1.5,
        maxRetentionWillingness: 0.9,
      };
    case 'YouthFocused':
      return {
        qualityWeight: 0.9,
        ageWeight: 1.5,
        marketValueWeight: 0.7,
        scarcityWeight: 1.0,
        loyaltyWeight: 0.6,
        starPremium: 0.8,
        maxRetentionWillingness: 0.7,
      };
    case 'AnalyticsDriven':
      return {
        qualityWeight: 1.2,
        ageWeight: 0.4,
        marketValueWeight: 1.3,
        scarcityWeight: 1.4,
        loyaltyWeight: 0.3,
        starPremium: 0.9,
        maxRetentionWillingness: 0.8,
      };
    case 'SuperstarHunter':
      return {
        qualityWeight: 1.5,
        ageWeight: -0.3,
        marketValueWeight: 0.6,
        scarcityWeight: 0.8,
        loyaltyWeight: 0.7,
        starPremium: 2.0,
        maxRetentionWillingness: 1.0,
      };
    case 'BalancedBuilder':
      return {
        qualityWeight: 1.0,
        ageWeight: 0.3,
        marketValueWeight: 1.0,
        scarcityWeight: 1.2,
        loyaltyWeight: 0.8,
        starPremium: 1.0,
        maxRetentionWillingness: 0.8,
      };
    case 'BowlingFirst':
      return {
        qualityWeight: 1.0,
        ageWeight: 0.2,
        marketValueWeight: 0.9,
        scarcityWeight: 1.3,
        loyaltyWeight: 0.5,
        starPremium: 1.0,
        maxRetentionWillingness: 0.8,
      };
    case 'ValueHunter':
      return {
        qualityWeight: 0.8,
        ageWeight: 0.5,
        marketValueWeight: 1.5,
        scarcityWeight: 1.1,
        loyaltyWeight: 0.4,
        starPremium: 0.6,
        maxRetentionWillingness: 0.6,
      };
    case 'DomesticFirst':
      return {
        qualityWeight: 1.0,
        ageWeight: 0.3,
        marketValueWeight: 0.9,
        scarcityWeight: 1.0,
        loyaltyWeight: 1.2,
        starPremium: 0.9,
        maxRetentionWillingness: 0.8,
      };
    case 'BigSpender':
      return {
        qualityWeight: 1.4,
        ageWeight: -0.2,
        marketValueWeight: 0.5,
        scarcityWeight: 0.9,
        loyaltyWeight: 0.6,
        starPremium: 1.8,
        maxRetentionWillingness: 1.0,
      };
    case 'PatientBuilder':
      return {
        qualityWeight: 0.9,
        ageWeight: 1.2,
        marketValueWeight: 1.1,
        scarcityWeight: 1.0,
        loyaltyWeight: 1.0,
        starPremium: 0.7,
        maxRetentionWillingness: 0.6,
      };
  }
}

// --- Player Retention Value Scoring ---

function calculateRetentionValue(
  player: Player,
  franchise: Franchise,
  retentionNumber: number,
  rules: RetentionRule,
  weights: PersonalityWeights
): number {
  let score = 0;

  // Quality score (0-100 → 0-10 base)
  const qualityBase = player.ratings.overall / 10;
  score += qualityBase * weights.qualityWeight;

  // Star premium for elite players
  if (player.ratings.overall >= 90) {
    score += 3.0 * weights.starPremium;
  } else if (player.ratings.overall >= 85) {
    score += 1.5 * weights.starPremium;
  } else if (player.ratings.overall >= 80) {
    score += 0.5 * weights.starPremium;
  }

  // Age factor – younger is better (T20 prime is ~25-32)
  const ageFactor = player.age <= 23 ? 2.0
    : player.age <= 27 ? 1.5
    : player.age <= 31 ? 1.0
    : player.age <= 34 ? 0.5
    : 0.0;
  score += ageFactor * weights.ageWeight;

  // Market value efficiency – is retention cheaper than what we'd pay at auction?
  const cost =
    player.status === 'Uncapped'
      ? rules.uncappedRetentionCost
      : getRetentionCost(retentionNumber, rules);
  const marketRatio = player.estimatedMarketValue > 0
    ? cost / player.estimatedMarketValue
    : 1.0;
  // Lower ratio = better value
  const valueScore = marketRatio <= 0.6 ? 3.0
    : marketRatio <= 0.8 ? 2.0
    : marketRatio <= 1.0 ? 1.0
    : marketRatio <= 1.3 ? 0.3
    : 0.0;
  score += valueScore * weights.marketValueWeight;

  // Role scarcity – how hard is this role to replace?
  const rolePlayers = franchise.players.filter(
    (p) => p.role === player.role && p.id !== player.id
  );
  const scarcityScore = rolePlayers.length === 0 ? 3.0
    : rolePlayers.length === 1 ? 2.0
    : rolePlayers.length === 2 ? 1.0
    : 0.5;
  score += scarcityScore * weights.scarcityWeight;

  // Bowling-first personality bonus
  if (
    weights === getPersonalityWeights('BowlingFirst') &&
    (player.role === 'Bowler' || (player.role === 'All-Rounder' && player.ratings.bowling > player.ratings.batting))
  ) {
    score += 2.0;
  }

  // Domestic-first personality bonus for Indian players
  if (
    weights === getPersonalityWeights('DomesticFirst') &&
    player.nationality === 'Indian'
  ) {
    score += 1.5;
  }

  // Loyalty – how long has the player been with the franchise?
  const loyaltyScore = player.previousFranchises.includes(franchise.id) ? 0.5 : 0;
  const currentLoyalty = player.currentFranchiseId === franchise.id ? 1.5 : 0;
  score += (loyaltyScore + currentLoyalty) * weights.loyaltyWeight;

  // Form and fitness modifiers
  score += (player.recentForm / 100) * 1.0;
  score -= ((100 - player.fitnessLevel) / 100) * 0.5;

  // Potential bonus for young uncapped players
  if (player.status === 'Uncapped' && player.age <= 23 && player.ratings.potential >= 80) {
    score += 1.5 * weights.ageWeight;
  }

  return score;
}

// --- CPU AI Retention Decisions ---

/** CPU AI makes retention decisions for a franchise. */
export function cpuRetentionDecisions(
  franchise: Franchise,
  rules: RetentionRule,
  rng: SeededRandom
): RetentionDecision[] {
  const weights = getPersonalityWeights(franchise.gmPersonality);
  const decisions: RetentionDecision[] = [];

  // Determine how many retentions this GM wants to make
  const maxWilling = Math.round(rules.maxRetentions * weights.maxRetentionWillingness);
  const targetRetentions = Math.max(1, maxWilling); // At least consider 1

  // Score all players in the franchise roster
  const candidates = franchise.players
    .map((player) => {
      const retentionNum = decisions.length + 1;
      const value = calculateRetentionValue(player, franchise, retentionNum, rules, weights);
      return { player, value };
    })
    .sort((a, b) => b.value - a.value);

  // Add slight randomness noise based on difficulty
  const difficultyNoise: Record<string, number> = {
    Easy: 2.0,
    Normal: 1.0,
    Hard: 0.5,
    Expert: 0.2,
  };
  const noise = difficultyNoise[franchise.cpuDifficulty] ?? 1.0;

  const noisyCandidates = candidates.map((c) => ({
    ...c,
    value: c.value + (rng.next() - 0.5) * noise,
  }));
  noisyCandidates.sort((a, b) => b.value - a.value);

  // Iterate through candidates and decide retentions
  let cappedRetained = 0;
  let uncappedRetained = 0;
  let overseasRetained = 0;
  let totalSpent = 0;

  for (const candidate of noisyCandidates) {
    if (decisions.length >= targetRetentions) break;

    const { player } = candidate;

    // Enforce sub-limits
    if (player.status === 'Capped' && cappedRetained >= rules.maxCappedRetentions) continue;
    if (player.status === 'Uncapped' && uncappedRetained >= rules.maxUncappedRetentions) continue;
    if (player.nationality === 'Overseas' && overseasRetained >= rules.maxOverseasRetentions) continue;

    const retentionNum = decisions.length + 1;
    const cost =
      player.status === 'Uncapped'
        ? rules.uncappedRetentionCost
        : getRetentionCost(retentionNum, rules);

    // Can we afford it?
    const retainedAfterThis = decisions.length + 1;
    const minSquadRemaining = franchise.minSquadSize - retainedAfterThis;
    const minPurseNeeded = minSquadRemaining * 20;
    const remainingAfter = rules.totalPurse - totalSpent - cost;

    if (remainingAfter < minPurseNeeded) continue;

    // Minimum value threshold – don't retain low value players
    // Higher difficulty = smarter threshold
    const threshold: Record<string, number> = {
      Easy: 3.0,
      Normal: 4.5,
      Hard: 5.5,
      Expert: 6.5,
    };
    const minValue = threshold[franchise.cpuDifficulty] ?? 4.5;

    if (candidate.value < minValue) continue;

    decisions.push({
      franchiseId: franchise.id,
      playerId: player.id,
      playerName: player.name,
      retentionNumber: retentionNum,
      cost,
      isRTM: false,
    });

    totalSpent += cost;
    if (player.status === 'Capped') cappedRetained++;
    if (player.status === 'Uncapped') uncappedRetained++;
    if (player.nationality === 'Overseas') overseasRetained++;
  }

  return decisions;
}
