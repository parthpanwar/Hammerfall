// ============================================================
// IPL DYNASTY - Player Intelligence Engine Types
// Standardized schema for Cricsheet data, feature engineering,
// Bayesian shrinkage, age-development projections, and scouting.
// ============================================================

import type { Player, Franchise, PlayerRole } from '../types/game';
import type { TacticalRole } from '../engines/cpu-gm/tactical-roles';

// --- 1. Provenance & Cricsheet Schema ---

export interface DataProvenance {
  source: 'Cricsheet IPL Match Repository' | 'Official IPL Feed' | 'Verified T20 Archive';
  version: string;
  lastUpdated: string; // ISO 8601
  matchCount: number;
  seasonsIncluded: number[];
  license: string;
}

export interface MatchDelivery {
  over: number;            // 0-19
  ball: number;            // 1-6
  batterId: string;
  bowlerId: string;
  nonStrikerId: string;
  runsBatter: number;
  runsExtra: number;
  extraType?: 'wide' | 'noball' | 'bye' | 'legbye';
  isWicket: boolean;
  dismissalType?: string;
  playerDismissedId?: string;
  phase: 'Powerplay' | 'Middle' | 'Death'; // PP: 0-5, Mid: 6-14, Death: 15-19
  bowlerType: 'Pace' | 'Spin';
}

export interface MatchSummary {
  matchId: string;
  season: number; // 2024, 2025, 2026
  date: string;
  venue: string;
  team1: string;
  team2: string;
  winner: string;
  deliveries: MatchDelivery[];
}

// --- 2. Player Season & Aggregate Features ---

export interface SeasonBattingStats {
  season: number;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  outs: number;
  average: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  dotBallPct: number;
  boundaryPct: number;
  // Phase splits
  powerplaySR: number;
  middleSR: number;
  deathSR: number;
  powerplayRuns: number;
  deathRuns: number;
  // Bowling type splits
  vsPaceAvg: number;
  vsPaceSR: number;
  vsSpinAvg: number;
  vsSpinSR: number;
}

export interface SeasonBowlingStats {
  season: number;
  matches: number;
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
  economy: number;
  strikeRate: number;
  dotBallPct: number;
  // Phase splits
  powerplayEconomy: number;
  powerplayWickets: number;
  middleEconomy: number;
  middleWickets: number;
  deathEconomy: number;
  deathWickets: number;
}

export interface FormRollingMetrics {
  last5MatchesAvgRating: number;
  last10MatchesAvgRating: number;
  last20MatchesAvgRating: number;
  momentumSlope: number; // Positive = upward form trajectory, negative = slump
  consistencyScore: number; // 0-100 (inverse of volatility)
  volatilityIndex: number; // Standard deviation of match impacts
}

export interface BayesianShrinkageMetrics {
  rawBattingAverage: number;
  shrunkBattingAverage: number;
  rawStrikeRate: number;
  shrunkStrikeRate: number;
  rawBowlingEconomy: number;
  shrunkBowlingEconomy: number;
  sampleWeight: number; // 0.0 to 1.0 (confidence in observed sample)
  shrinkageFactor: number; // How much pulled toward role prior
}

// --- 3. Age & Development Trajectory ---

export interface AgeTrajectory {
  currentAge: number;
  peakAgeWindow: [number, number]; // e.g. [27, 32]
  careerPhase: 'Emerging' | 'EarlyPrime' | 'PeakPrime' | 'LatePrime' | 'VeteranMaster';
  ageFactorModifier: number; // Multiplier on projection (-0.05 to +0.08)
  projectedPeakAbility: number; // Projected career max rating
  expectedLongevitySeasons: number; // Estimated remaining top-tier seasons
  isOver35Exempt: boolean; // True for proven elite veterans who defy blunt dropoffs
}

// --- 4. Machine Learning & Projections ---

export interface LongevitySeasonProjection {
  season: number;
  projectedAge: number;
  projectedRating: number;
  uncertaintyStdDev: number;
  trajectoryPhase: string;
}

export interface MLPredictionModelOutput {
  modelType: 'Calibrated Statistical Ensemble' | 'Gradient Boosted Tree Regressor' | 'LightGBM Multi-Stage Gradient Boosted Decision Ensemble';
  trainingSeasons: number[];
  testSeason: number;
  mae: number;
  rmse: number;
  rSquared: number;
  projectedBattingRuns: number;
  projectedBattingStrikeRate: number;
  projectedWickets: number;
  projectedEconomyRate: number;
  overallImpactScore: number; // 0-100
  uncertaintyStdDev: number; // Standard error of projection
}

// --- 5. Unified Player Intelligence Dossier ---

export interface PlayerIntelligenceDossier {
  playerId: string;
  playerName: string;
  provenance: DataProvenance;
  lastUpdated: string;
  
  // Historical Actuals (Never fabricated)
  seasons: {
    batting: SeasonBattingStats[];
    bowling: SeasonBowlingStats[];
  };

  // Engineered Features
  form: FormRollingMetrics;
  bayesian: BayesianShrinkageMetrics;
  ageProfile: AgeTrajectory;
  phaseStrengths: {
    powerplay: number; // 0-100
    middle: number;    // 0-100
    death: number;     // 0-100
  };
  bowlingTypeAffinities: {
    vsPaceRating: number; // 0-100
    vsSpinRating: number; // 0-100
  };

  // ML / Projections (Strictly kept separate from actuals)
  projection: MLPredictionModelOutput;
  confidenceLevel: number; // 0-100%
  availabilityRisk: number; // 0-100 (workload/injury risk)
  
  // Model 2: Multi-Season Development & Decline (1, 2, 3 seasons ahead)
  longevityProjections?: LongevitySeasonProjection[];

  // Tactical Role Ratings (0-100 for each of the 11 roles)
  tacticalRoleScores: Record<TacticalRole, number>;
  primaryTacticalRole: TacticalRole;
  secondaryTacticalRole?: TacticalRole;

  // Model 3: Calibrated Market Value Range (in Lakhs)
  marketValuation: {
    fairValue: number;
    priceFloor: number;
    priceCeiling: number;
    expectedDemandTier: 'Elite Marquee' | 'High Impact' | 'Solid Starter' | 'Value Rotation' | 'Speculative Buy';
    soldProbability?: number;
  };

  // Model 4: Team-Specific Valuations (in Lakhs)
  teamValuations?: Record<string, {
    franchiseId: string;
    franchiseName: string;
    fitScore: number;
    maxBidLakhs: number;
    reasons: string[];
  }>;

  // Explainability & Diagnostics
  explainability?: {
    topDrivingFeatures: string[];
    ageModifier: number;
    recentForm: number;
    momentum: number;
  };
}

// --- 6. Franchise Fit Analysis ---

export interface FranchiseFitReport {
  franchiseId: string;
  franchiseName: string;
  fitScore: number; // 0-100
  verdict: 'Must-Target' | 'Strong Addition' | 'Conditional Value' | 'Avoid / Redundant';
  reasonsToBuy: string[];
  reasonsToPass: string[];
  maxRecommendedBid: number; // in Lakhs
  roleSynergyScore: number;
}

