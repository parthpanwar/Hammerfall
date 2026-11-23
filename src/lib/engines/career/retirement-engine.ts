// ============================================================
// IPL DYNASTY - Probabilistic Player Retirement Engine
// Evaluates aging players and decides retirements realistically.
// Preserves full player data for historical and Hall of Fame records.
// ============================================================

import type { Player, PlayerSeasonStats } from '@/lib/types/game';
import type { RetirementRecord, PlayerCareerRecord } from '@/lib/types/career';
import { isStalwart } from './overseas-pipeline';

// Master veterans with extreme passion / longevity
const HIGH_LONGEVITY_VETERANS = new Set([
  'ms-dhoni',
  'rohit-sharma',
  'virat-kohli',
  'sunil-narine',
  'ravindra-jadeja',
  'faf-du-plessis',
  'andre-russell',
  'ravichandran-ashwin',
]);

/**
 * Calculates the exact retirement probability for a player.
 */
export function calculateRetirementProbability(
  player: Player,
  seasonStats?: PlayerSeasonStats
): { probability: number; reason: RetirementRecord['reason'] } {
  const age = player.age;

  // Players under 33 do not retire under normal circumstances
  if (age < 33) {
    return { probability: 0.0, reason: 'Age' };
  }

  let baseProb = 0.0;
  let primaryReason: RetirementRecord['reason'] = 'Age';

  // Slower than before: careers now run two auction cycles, and T20 specialists
  // play on into their late thirties.
  if (age === 33 || age === 34) {
    baseProb = 0.02;
  } else if (age === 35 || age === 36) {
    baseProb = 0.07;
  } else if (age === 37 || age === 38) {
    baseProb = 0.2;
  } else if (age === 39 || age === 40) {
    baseProb = 0.42;
  } else if (age === 41 || age === 42) {
    baseProb = 0.68;
  } else {
    baseProb = 0.9; // 43+
  }

  // Elite longevity exemption discount
  if (HIGH_LONGEVITY_VETERANS.has(player.id) || isStalwart(player.id)) {
    baseProb *= 0.45; // Significantly lower retirement chance for legends like Dhoni/Kohli/Rohit
  }

  // Fast bowler physical toll modifier
  const isFastBowler =
    player.role === 'Bowler' &&
    (player.bowlingStyle.includes('Fast') || player.bowlingStyle.includes('Medium'));
  if (isFastBowler) {
    baseProb += 0.05;
    primaryReason = 'Fitness';
  }

  // Season game time & performance factor
  if (seasonStats && seasonStats.matches > 0) {
    if (seasonStats.matches >= 12) {
      // Regular starter still in high demand: lower retirement urge
      baseProb -= 0.15;
    }

    // High performance discount
    if (seasonStats.runs >= 400 || seasonStats.wickets >= 15) {
      baseProb -= 0.20; // Had an amazing season, motivated to continue!
    } else if (seasonStats.runs < 100 && seasonStats.wickets < 5 && seasonStats.matches >= 7) {
      // Struggled with form
      baseProb += 0.1;
      primaryReason = 'Performance';
    }
  } else {
    // Unsold or completely benched (0 matches in IPL)
    baseProb += 0.12;
    primaryReason = 'Unsold';
  }

  // Fitness level modifier
  if (player.fitnessLevel < 60) {
    baseProb += 0.15;
    primaryReason = 'Fitness';
  } else if (player.fitnessLevel >= 85) {
    baseProb -= 0.05;
  }

  // Clamp probability between 0 and 0.98
  const probability = Math.max(0.0, Math.min(0.98, baseProb));

  return { probability, reason: primaryReason };
}

/**
 * Processes retirements across all active players at the conclusion of a season.
 * Retired players are marked and preserved in retirement records.
 */
/** Retirements per off-season are capped: the IPL loses a handful of names a year (3–7), not dozens. */
export const RETIREMENT_CAP = [3, 7] as const;
/** A player under contract only walks away from IPL money at this age. */
export const SQUAD_RETIREMENT_AGE = 40;

/**
 * @param squadIds players in an IPL squad this season. They are being paid, so
 *   they play on; only the 40+ consider stopping. Everyone else is a free agent
 *   (unsold or released), and those are the ones who call it a day.
 */
export function processSeasonRetirements(
  players: Player[],
  seasonStats: Record<string, PlayerSeasonStats>,
  seasonYear: number,
  randomSeedMultiplier: number = 1.0,
  squadIds?: Set<string>
): {
  activePlayers: Player[];
  retiredPlayers: Player[];
  retirementRecords: RetirementRecord[];
} {
  const activePlayers: Player[] = [];
  const retiredPlayers: Player[] = [];
  const retirementRecords: RetirementRecord[] = [];

  // Roll everyone, then keep the oldest few who decided to stop.
  const decided: { i: number; reason: RetirementRecord['reason'] }[] = [];
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (player.isRetired) continue;
    const stats = seasonStats[player.id];
    let { probability, reason } = calculateRetirementProbability(player, stats);
    if (squadIds?.has(player.id)) {
      if (player.age < SQUAD_RETIREMENT_AGE) probability = 0;
      else probability *= 0.5;
    }
    // Deterministic pseudo-random roll using player ID hash and seed
    const hash = simpleStringHash(`${player.id}-${seasonYear}-${randomSeedMultiplier}`);
    const roll = (hash % 1000) / 1000.0;
    if (roll < probability) decided.push({ i, reason });
  }
  const picked = new Map(
    decided
      .sort((a, b) => players[b.i].age - players[a.i].age || players[b.i].ratings.overall - players[a.i].ratings.overall)
      .slice(0, RETIREMENT_CAP[0] + (simpleStringHash(`retirements-${seasonYear}-${randomSeedMultiplier}`) % (RETIREMENT_CAP[1] - RETIREMENT_CAP[0] + 1)))
      .map((d) => [d.i, d.reason] as const)
  );

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const reason = picked.get(i) ?? 'Age';
    const willRetire = picked.has(i);

    if (willRetire) {
      const retiredPlayer: Player = {
        ...player,
        status: 'Uncapped',
        isRetained: false,
        isSold: false,
        isAvailableForAuction: false,
        currentFranchiseId: null,
      };

      const record: RetirementRecord = {
        playerId: player.id,
        playerName: player.name,
        lastFranchiseId: player.currentFranchiseId || 'FreeAgent',
        retirementSeason: seasonYear,
        age: player.age,
        careerMatches: player.stats.matches,
        careerRuns: player.stats.runs,
        careerWickets: player.stats.wickets,
        highestScore: player.stats.highScore,
        bestBowling: player.stats.bestBowling,
        hallOfFame: player.ratings.overall >= 85 || player.stats.runs >= 4000 || player.stats.wickets >= 120,
        reason,
      };

      retiredPlayers.push(retiredPlayer);
      retirementRecords.push(record);
    } else {
      activePlayers.push(player);
    }
  }

  return { activePlayers, retiredPlayers, retirementRecords };
}

function simpleStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

