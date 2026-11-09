// ============================================================
// IPL DYNASTY - Role-Sensitive Age-Development Curve
// Models player growth, peak longevity, and aging trajectories without
// blunt penalties for elite over-35 veterans.
// ============================================================

import type { Player, PlayerRole } from '../../types/game';
import type { AgeTrajectory } from '../types';

interface RolePeakSpec {
  peakStart: number;
  peakEnd: number;
  annualGrowthPrePeak: number;
  annualDeclinePostPeak: number;
}

const ROLE_PEAK_SPECS: Record<PlayerRole, RolePeakSpec> = {
  Batter: {
    peakStart: 26,
    peakEnd: 33,
    annualGrowthPrePeak: 0.04,
    annualDeclinePostPeak: 0.015,
  },
  Bowler: {
    // Spinners vs Pacers handled dynamically in function
    peakStart: 25,
    peakEnd: 30,
    annualGrowthPrePeak: 0.045,
    annualDeclinePostPeak: 0.025,
  },
  Wicketkeeper: {
    peakStart: 25,
    peakEnd: 32,
    annualGrowthPrePeak: 0.035,
    annualDeclinePostPeak: 0.018,
  },
  'All-Rounder': {
    peakStart: 25,
    peakEnd: 31,
    annualGrowthPrePeak: 0.04,
    annualDeclinePostPeak: 0.022,
  },
};

// Known elite masters who maintain exceptional performance past 35
const OVER_35_VETERAN_EXEMPTIONS = new Set([
  'ms-dhoni',
  'rohit-sharma',
  'virat-kohli',
  'sunil-narine',
  'andre-russell',
  'ravindra-jadeja',
  'faf-du-plessis',
  'mohammed-shami',
  'ravichandran-ashwin',
  'bhuvneshwar-kumar',
  'glenn-maxwell',
]);

/**
 * Calculates a player's role-sensitive age development curve and trajectory.
 */
export function calculateAgeTrajectory(player: Player, recentForm: number = 75): AgeTrajectory {
  const age = player.age;
  const isSpinner = player.isSpinner || player.bowlingStyle.includes('Break') || player.bowlingStyle.includes('Orthodox');
  
  // Custom peak window for spinners: spinners mature later and last longer (peak 27 to 35)
  let peakStart = ROLE_PEAK_SPECS[player.role].peakStart;
  let peakEnd = ROLE_PEAK_SPECS[player.role].peakEnd;

  if (player.role === 'Bowler' && isSpinner) {
    peakStart = 27;
    peakEnd = 35;
  }

  const isOver35Exempt = OVER_35_VETERAN_EXEMPTIONS.has(player.id) || (age >= 35 && recentForm >= 80);

  let careerPhase: AgeTrajectory['careerPhase'] = 'PeakPrime';
  let ageFactorModifier = 0.0;
  let expectedLongevitySeasons = 3;

  if (age <= 23) {
    careerPhase = 'Emerging';
    // Young high-potential boost
    const potentialBonus = (player.ratings.potential - 70) * 0.002;
    ageFactorModifier = 0.05 + Math.max(0, potentialBonus);
    expectedLongevitySeasons = 10 + (23 - age);
  } else if (age < peakStart) {
    careerPhase = 'EarlyPrime';
    ageFactorModifier = 0.025;
    expectedLongevitySeasons = 7 + (peakStart - age);
  } else if (age <= peakEnd) {
    careerPhase = 'PeakPrime';
    ageFactorModifier = 0.005; // Peak baseline stability
    expectedLongevitySeasons = 4 + (peakEnd - age);
  } else if (age <= 35) {
    careerPhase = 'LatePrime';
    // Gentle decline offset by recent form
    const formOffset = (recentForm - 70) * 0.001;
    ageFactorModifier = -0.01 + Math.max(-0.02, formOffset);
    expectedLongevitySeasons = Math.max(2, 38 - age);
  } else {
    careerPhase = 'VeteranMaster';
    if (isOver35Exempt) {
      // Elite veterans maintain elite baseline with zero large penalties
      ageFactorModifier = -0.005; // Virtually flat!
      expectedLongevitySeasons = Math.max(1, 44 - age);
    } else {
      // Non-exempt veterans: modest natural decline adjusted by fitness
      const fitnessDefense = (player.fitnessLevel - 70) * 0.001;
      ageFactorModifier = -0.025 + Math.max(-0.015, fitnessDefense);
      expectedLongevitySeasons = Math.max(1, 40 - age);
    }
  }

  // Projected peak ability
  let projectedPeakAbility = player.ratings.overall;
  if (age < peakEnd) {
    const yearsToPeak = Math.max(1, peakEnd - age);
    const growthHeadroom = Math.max(0, player.ratings.potential - player.ratings.overall);
    projectedPeakAbility = Math.min(99, Math.round(player.ratings.overall + growthHeadroom * 0.75));
  }

  return {
    currentAge: age,
    peakAgeWindow: [peakStart, peakEnd],
    careerPhase,
    ageFactorModifier: Math.round(ageFactorModifier * 1000) / 1000,
    projectedPeakAbility,
    expectedLongevitySeasons,
    isOver35Exempt,
  };
}
