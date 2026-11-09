// ============================================================
// IPL DYNASTY - Player Development Engine
// Advances player ratings, age, and attributes across seasons
// with bounded yearly changes and role-sensitive aging.
// ============================================================

import type { Player, PlayerSeasonStats } from '@/lib/types/game';
import type { PlayerProgressionDelta, PlayerCareerRecord } from '@/lib/types/career';
import { calculateAgeTrajectory } from '@/lib/intelligence/models/age-curve';

/**
 * Calculates attribute evolution for a player transitioning to the next season.
 * Enforces strict boundaries to prevent unrealistic single-season spikes or collapses.
 */
export function progressPlayerAttributes(
  player: Player,
  recentSeasonStats: PlayerSeasonStats | undefined,
  seasonYear: number
): { updatedPlayer: Player; delta: PlayerProgressionDelta } {
  const previousOverall = player.ratings.overall;
  const previousBatting = player.ratings.batting;
  const previousBowling = player.ratings.bowling;
  const previousPwr = player.ratings.powerHitting || 60;
  const previousConsistency = player.ratings.consistency || 65;
  const potential = player.ratings.potential;

  // 1. Advance Age
  const newAge = player.age + 1;

  // 2. Obtain role-sensitive age trajectory & phase
  const recentForm = player.recentForm || 75;
  const trajectory = calculateAgeTrajectory(player, recentForm);

  // 3. Performance & Game Time Evaluation
  let gameTimeFactor = 0;
  let performanceImpact = 0;

  if (recentSeasonStats && recentSeasonStats.matches > 0) {
    const matches = recentSeasonStats.matches;
    if (matches >= 12) {
      gameTimeFactor = 0.5; // Key regular starter
    } else if (matches >= 6) {
      gameTimeFactor = 0.2;
    } else {
      gameTimeFactor = -0.3; // Limited bench role
    }

    // Role-specific performance check (measured against baseline, avoiding outsized spikes)
    if (player.role === 'Batter' || player.role === 'Wicketkeeper') {
      if (recentSeasonStats.runs >= 450 && recentSeasonStats.strikeRate >= 135) {
        performanceImpact = 1.0;
      } else if (recentSeasonStats.runs >= 300) {
        performanceImpact = 0.4;
      } else if (recentSeasonStats.runs < 100 && matches >= 8) {
        performanceImpact = -0.8;
      }
    } else if (player.role === 'Bowler') {
      if (recentSeasonStats.wickets >= 16 && recentSeasonStats.economyRate <= 8.5) {
        performanceImpact = 1.0;
      } else if (recentSeasonStats.wickets >= 10) {
        performanceImpact = 0.4;
      } else if (recentSeasonStats.wickets < 5 && matches >= 8) {
        performanceImpact = -0.8;
      }
    } else if (player.role === 'All-Rounder') {
      if (recentSeasonStats.runs >= 200 && recentSeasonStats.wickets >= 8) {
        performanceImpact = 1.0;
      } else if (recentSeasonStats.runs >= 120 || recentSeasonStats.wickets >= 5) {
        performanceImpact = 0.3;
      }
    }
  } else {
    // Unsold or benched all season (0 matches)
    gameTimeFactor = newAge <= 23 ? -0.5 : -0.2;
  }

  // 4. Growth / Decline Calculation
  let overallChange = 0;
  let note = 'Stable performance in prime';

  if (trajectory.careerPhase === 'Emerging') {
    // Young players: high growth headroom towards potential
    const growthHeadroom = Math.max(0, potential - previousOverall);
    const growthRate = 0.22 + trajectory.ageFactorModifier;
    overallChange = Math.round(growthHeadroom * growthRate + gameTimeFactor + performanceImpact);
    overallChange = Math.max(1, Math.min(6, overallChange)); // Youngsters grow 1 to 6 pts
    note = 'Young talent showing rapid development';
  } else if (trajectory.careerPhase === 'EarlyPrime') {
    const growthHeadroom = Math.max(0, potential - previousOverall);
    overallChange = Math.round(growthHeadroom * 0.12 + gameTimeFactor * 0.5 + performanceImpact * 0.5);
    overallChange = Math.max(0, Math.min(4, overallChange)); // Early prime grows 0 to 4 pts
    note = 'Entering prime career years';
  } else if (trajectory.careerPhase === 'PeakPrime') {
    // Stable peak: slight fluctuation based on fitness and form
    overallChange = Math.round(performanceImpact * 0.5 + (player.fitnessLevel >= 80 ? 0.5 : -0.5));
    overallChange = Math.max(-2, Math.min(2, overallChange));
    note = 'Consistent peak prime output';
  } else if (trajectory.careerPhase === 'LatePrime') {
    // Gentle decline
    overallChange = -1 + Math.round(performanceImpact * 0.4);
    overallChange = Math.max(-3, Math.min(1, overallChange));
    note = 'Experienced veteran maintaining quality';
  } else {
    // VeteranMaster (36+)
    if (trajectory.isOver35Exempt) {
      // Elite masters (Kohli, Rohit, Dhoni, Bumrah, Narine, Russell) resist sharp drops
      overallChange = Math.round(performanceImpact * 0.4 - 0.5);
      overallChange = Math.max(-2, Math.min(1, overallChange));
      note = 'Master veteran defying age curve';
    } else {
      // Standard veterans experience physical decline
      const fitnessDefense = (player.fitnessLevel - 70) * 0.03;
      overallChange = Math.round(-2.5 + fitnessDefense + performanceImpact * 0.3);
      overallChange = Math.max(-5, Math.min(0, overallChange));
      note = 'Natural veteran physical decline';
    }
  }

  // Strict clamp on overallChange: [-5, +6]
  overallChange = Math.max(-5, Math.min(6, overallChange));

  const newOverall = Math.max(50, Math.min(99, previousOverall + overallChange));
  const newBatting = Math.max(30, Math.min(99, previousBatting + overallChange));
  const newBowling = Math.max(20, Math.min(99, previousBowling + (player.role === 'Bowler' || player.role === 'All-Rounder' ? overallChange : 0)));
  const newPwr = Math.max(30, Math.min(99, previousPwr + (overallChange < 0 ? overallChange - 1 : overallChange)));
  const newConsistency = Math.max(40, Math.min(99, previousConsistency + (newAge >= 26 ? 1 : 0)));

  // Potential slightly narrows as player ages
  const newPotential = newAge >= 28 ? Math.max(newOverall, potential - 1) : potential;

  // New market value estimate based on new overall and age
  const estimatedMarketValue = Math.round(
    Math.max(20, (newOverall - 55) * (newOverall - 55) * (newAge <= 27 ? 1.4 : newAge <= 33 ? 1.0 : 0.7))
  );

  const updatedPlayer: Player = {
    ...player,
    age: newAge,
    ratings: {
      ...player.ratings,
      overall: newOverall,
      batting: newBatting,
      bowling: newBowling,
      powerHitting: newPwr,
      consistency: newConsistency,
      potential: newPotential,
    },
    estimatedMarketValue,
    recentForm: 75, // Reset to standard pre-season baseline
  };

  const delta: PlayerProgressionDelta = {
    playerId: player.id,
    playerName: player.name,
    age: newAge,
    previousOverall,
    newOverall,
    overallDelta: newOverall - previousOverall,
    previousBatting,
    newBatting,
    previousBowling,
    newBowling,
    potential: newPotential,
    progressionNote: note,
  };

  return { updatedPlayer, delta };
}

/**
 * Progresses all active players into the next season.
 */
export function progressAllPlayers(
  players: Player[],
  seasonStats: Record<string, PlayerSeasonStats>,
  nextSeasonYear: number
): { updatedPlayers: Player[]; deltas: PlayerProgressionDelta[] } {
  const updatedPlayers: Player[] = [];
  const deltas: PlayerProgressionDelta[] = [];

  for (const player of players) {
    const stats = seasonStats[player.id];
    const { updatedPlayer, delta } = progressPlayerAttributes(player, stats, nextSeasonYear);
    updatedPlayers.push(updatedPlayer);
    deltas.push(delta);
  }

  return { updatedPlayers, deltas };
}

