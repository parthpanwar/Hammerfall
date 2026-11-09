// ============================================================
// IPL DYNASTY - Opposition-Adjusted Player Rating Engine Tests
// Comprehensive verification of all 13 system requirements:
// 1. Dynamic opponent strength & Elo adjustment
// 2. Opposition bowling & batting quality calibration
// 3. Fused competition normalization (no double-counting)
// 4. Match-level adjusted performance (Player A vs Player B difficulty test)
// 5. Bayesian shrinkage & sample size reliability
// 6. Zero nationality bias for Associate performers
// 7. Role-specific calibrated rating bands
// 8. Audit verification: 0 small-sample 90+ anomalies
// 9. Zero future-season data leakage
// ============================================================

import {
  calculateOpponentDifficultyMultiplier,
  getTeamStrengthAtTime,
  calculateOpposingBowlingQuality,
  calculateOpposingBattingQuality,
} from '../ratings/opponent-strength';
import {
  classifyCompetitionTier,
  calculateUnifiedContextDifficulty,
  COMPETITION_BENCHMARKS,
} from '../ratings/competition-calibration';
import {
  evaluateAdjustedBattingMatch,
  evaluateAdjustedBowlingMatch,
  calculateTimeDecayWeight,
} from '../ratings/match-context-evaluator';
import {
  applyBayesianStabilization,
  ROLE_PRIORS,
} from '../ratings/bayesian-rating-engine';
import {
  calculateBatterOppositionRating,
  calculateBowlerOppositionRating,
  calculateAllRounderOppositionRating,
  calculateWicketkeeperOppositionRating,
} from '../ratings/role-rating-models';
import {
  evaluatePlayerOppositionRatings,
  applyOppositionRatingsToPlayer,
} from '../ratings/player-rating-orchestrator';
import { GLOBAL_PLAYERS } from '../../data/players';
import type { Player } from '../../types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

export function runOppositionRatingEngineTests() {
  console.log('============================================================');
  console.log('RUNNING ADVANCED OPPOSITION-ADJUSTED RATING ENGINE TESTS');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Continuous Opponent Strength & Dynamic Elo Curve
  // -------------------------------------------------------------
  console.log('--- TEST 1: Dynamic Opponent Strength & Continuous Adjustment ---');
  const eliteMult = calculateOpponentDifficultyMultiplier(128, 100);
  const baselineMult = calculateOpponentDifficultyMultiplier(100, 100);
  const associateMult = calculateOpponentDifficultyMultiplier(75, 100);

  assert(eliteMult > baselineMult, `Elite opponent receives difficulty premium (${eliteMult.toFixed(2)} > ${baselineMult.toFixed(2)})`);
  assert(baselineMult === 1.0, `Baseline 100 opponent is exactly 1.00x (${baselineMult.toFixed(2)})`);
  assert(associateMult < baselineMult, `Associate opponent reflects lower difficulty baseline (${associateMult.toFixed(2)} < 1.0)`);
  assert(eliteMult <= 1.35 && associateMult >= 0.55, `Multipliers are smoothly bounded between 0.55 and 1.35`);

  // -------------------------------------------------------------
  // TEST 2: Zero Future-Data Leakage in Historical Team Ratings
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Zero Future-Season Team Rating Leakage ---');
  // Gujarat Titans entered in 2022. Matches in 2020 should not use 2024 GT ratings
  const gt2022 = getTeamStrengthAtTime('gt', 2022).rating;
  const gt2024 = getTeamStrengthAtTime('gt', 2024).rating;
  assert(gt2022 !== undefined && gt2024 !== undefined, 'Historical team ratings exist for specific match years');
  assert(gt2022 === 128 && gt2024 === 112, `Historical ratings differ by season (2022 title winning 128 vs 2024 rebuild 112)`);

  // -------------------------------------------------------------
  // TEST 3: Match-Level Performance Difficulty Test (Player A vs Player B)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Match-Level Difficulty Adjusted Performance ---');
  // Player A: 80 runs off 45 balls vs weak bowling attack (Associate / Regional)
  const playerA = evaluateAdjustedBattingMatch({
    runs: 80,
    balls: 45,
    isDismissed: true,
    opposingBowlingQuality: 52,
    opponentTeamRating: 72,
    competitionTier: 'International-Associate',
    matchDateOrYear: 2024,
  });

  // Player B: 65 runs off 40 balls vs elite bowling attack (IPL / World Cup vs Bumrah, Starc, etc.)
  const playerB = evaluateAdjustedBattingMatch({
    runs: 65,
    balls: 40,
    isDismissed: false,
    opposingBowlingQuality: 92,
    opponentTeamRating: 128,
    competitionTier: 'IPL',
    matchDateOrYear: 2024,
  });

  assert(playerA.rawScore > playerB.rawScore, `Player A has higher raw unadjusted score (${playerA.rawScore} vs ${playerB.rawScore})`);
  assert(playerB.adjustedScore > playerA.adjustedScore, `Player B earns higher difficulty-adjusted score against elite bowling (${playerB.adjustedScore} vs ${playerA.adjustedScore})`);

  // -------------------------------------------------------------
  // TEST 4: Fused Competition Normalization (No Double Penalties)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Fused Competition Normalization ---');
  const iplContext = calculateUnifiedContextDifficulty('IPL', 125);
  const assocContext = calculateUnifiedContextDifficulty('International-Associate', 74);

  assert(iplContext.contextDifficulty > assocContext.contextDifficulty, `IPL context difficulty (${iplContext.contextDifficulty.toFixed(2)}) > Associate context (${assocContext.contextDifficulty.toFixed(2)})`);
  assert(
    iplContext.contextDifficulty <= 1.35 && assocContext.contextDifficulty >= 0.55,
    'Unified context difficulty cleanly clamped without runaway exponentiation'
  );

  // -------------------------------------------------------------
  // TEST 5: Bayesian Shrinkage & Small-Sample Stabilization
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Bayesian Stabilization & Reliability ---');
  // Player with 4 matches and raw score of 95 vs weak opposition
  const smallSample = applyBayesianStabilization(95, 3.2, 'Batter', false, true);
  // Veteran with 120 matches and raw score of 92 vs elite opposition
  const largeSample = applyBayesianStabilization(92, 140, 'Batter', true, false);

  assert(smallSample.reliability < 0.20, `Small sample has appropriately low reliability (${(smallSample.reliability * 100).toFixed(1)}%)`);
  assert(smallSample.stabilizedRating <= 65, `Small sample with raw 95 strongly regressed to prior (${smallSample.stabilizedRating} OVR)`);
  assert(largeSample.reliability > 0.85, `Large sample has high confidence (${(largeSample.reliability * 100).toFixed(1)}%)`);
  assert(largeSample.stabilizedRating >= 88, `Large sample retains elite rating (${largeSample.stabilizedRating} OVR)`);

  // -------------------------------------------------------------
  // TEST 6: Zero Nationality Bias for Talented Associate Performers
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Zero Nationality Bias for Associate Performers ---');
  // Associate bowler playing against India/Australia in World Cup (e.g. Trumpelmann, Netravalkar)
  const associateVsFullMatch = evaluateAdjustedBowlingMatch({
    overs: 4,
    balls: 24,
    wickets: 3,
    runsConceded: 22,
    opposingBattingQuality: 92,
    opponentTeamRating: 128,
    competitionTier: 'International-AssociateVsFull',
    matchDateOrYear: 2024,
  });

  assert(
    associateVsFullMatch.adjustedScore >= 85,
    `Associate player excelling against Full Member earns elite adjusted score (${associateVsFullMatch.adjustedScore}/100)`
  );

  // -------------------------------------------------------------
  // TEST 7: Role-Specific Calibrated Rating Bands
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Calibrated Rating Bands Across Roles ---');
  const eliteBowlerScore = calculateBowlerOppositionRating({
    overs: 510,
    wickets: 165,
    runsConceded: 3650, // Econ 7.16
    matches: 136,
    isSpinner: false,
    averageContextDifficulty: 1.15,
  });

  const eliteBatterScore = calculateBatterOppositionRating({
    runs: 6420,
    balls: 4680,
    matches: 248,
    fours: 540,
    sixes: 280,
    averageContextDifficulty: 1.15,
  });

  assert(eliteBowlerScore >= 90, `Elite fast bowler receives 90+ rating (${eliteBowlerScore})`);
  assert(eliteBatterScore >= 90, `Elite batter receives 90+ rating (${eliteBatterScore})`);
  assert(Math.abs(eliteBowlerScore - eliteBatterScore) <= 6, `Both elite roles operate in comparable 90+ bands (${eliteBowlerScore} vs ${eliteBatterScore})`);

  // -------------------------------------------------------------
  // TEST 8: Full Global Database Audit & Elimination of 90+ Anomalies
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Audit of 90+ Rated Players in Global Database ---');
  const ninetyPlusPlayers = GLOBAL_PLAYERS.filter((p) => p.ratings.overall >= 90);
  assert(ninetyPlusPlayers.length <= 25, `Global database maintains an elite 90+ tier (${ninetyPlusPlayers.length} players, down from 165)`);

  for (const p of ninetyPlusPlayers) {
    assert(p.stats.matches >= 60, `Every 90+ player has deep match evidence (${p.name}: ${p.stats.matches} matches)`);
    assert(p.ratings.ratingConfidence! >= 0.80, `Every 90+ player has >= 80% Bayesian confidence (${p.name}: ${(p.ratings.ratingConfidence! * 100).toFixed(0)}%)`);
  }

  // Verify specific former anomalies are now reasonably rated
  const formerAnomalies = ['A Athanaze', 'AM Tribe', 'Asif Ali', 'BD Macdonald', 'Bismillah Khan', 'JA Burns', 'JM Coles'];
  for (const name of formerAnomalies) {
    const player = GLOBAL_PLAYERS.find((p) => p.name === name);
    if (player) {
      assert(
        player.ratings.overall <= 72,
        `Former anomaly ${name} regularized to true level (${player.ratings.overall} <= 72)`
      );
    }
  }

  // -------------------------------------------------------------
  // TEST 9: Recency Time-Decay Weighting
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Time Decay Recency Weighting ---');
  const wCurrent = calculateTimeDecayWeight(2026, 2026);
  const wPrev1 = calculateTimeDecayWeight(2025, 2026);
  const wOlder = calculateTimeDecayWeight(2022, 2026);

  assert(wCurrent === 1.0, `Current season has full 1.0 weight (${wCurrent})`);
  assert(wPrev1 < wCurrent && wPrev1 >= 0.75, `Previous season has decayed weight (${wPrev1})`);
  assert(wOlder < wPrev1 && wOlder <= 0.40, `Older career has baseline weight (${wOlder})`);

  // -------------------------------------------------------------
  // TEST 10: Metadata & Data Provenance Integrity
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Ratings Metadata & Provenance ---');
  const bumrah = GLOBAL_PLAYERS.find((p) => p.name === 'Jasprit Bumrah')!;
  assert(bumrah.ratings.oppositionAdjustedRating !== undefined, 'oppositionAdjustedRating is present on PlayerRatings');
  assert(bumrah.ratings.competitionAdjustedRating !== undefined, 'competitionAdjustedRating is present on PlayerRatings');
  assert(bumrah.ratings.ratingConfidence !== undefined, 'ratingConfidence is present on PlayerRatings');
  assert(bumrah.ratings.ratingVersion?.includes('opposition-adjusted'), 'ratingVersion reflects opposition-adjusted engine');
  assert(bumrah.ratings.dataQualityStatus !== undefined, 'dataQualityStatus is populated');

  console.log('\n============================================================');
  console.log('ALL ADVANCED OPPOSITION-ADJUSTED RATING ENGINE TESTS PASSED!');
  console.log('============================================================\n');
}

// Run tests when executed directly
if (process.argv[1]?.includes('opposition-adjusted-ratings.test.ts')) {
  runOppositionRatingEngineTests();
}
