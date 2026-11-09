// ============================================================
// IPL DYNASTY - Player Intelligence Test Suite
// Verifies Bayesian shrinkage, aging exemptions, young potential,
// zero data leakage, role valuations, and auction financial legality.
// ============================================================

import { PLAYERS } from '../../data/players';
import { FRANCHISES } from '../../data/franchises';
import {
  generatePlayerIntelligenceDossier,
  evaluateFranchiseFit,
} from '../valuation/player-intelligence';
import {
  applyBayesianShrinkage,
  T20_GLOBAL_PRIORS,
} from '../features/feature-extractor';
import { calculateAgeTrajectory } from '../models/age-curve';
import { getPlayerHistoricalRecord } from '../cricsheet/cricsheet-dataset';
import {
  createAuctionSession,
  nominatePlayer,
  placeBid,
  processFinalCall,
} from '../../engines/auction-engine';
import {
  decideCPUBid,
  calculateSpendingLimit,
} from '../../engines/cpu-gm/cpu-gm-engine';
import { createSeededRandom } from '../../utils/random';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

export function runPlayerIntelligenceTests() {
  console.log('\n============================================================');
  console.log('RUNNING DATA-DRIVEN PLAYER INTELLIGENCE ENGINE TESTS');
  console.log('============================================================\n');

  // --- Test 1: Small Samples & Bayesian Shrinkage ---
  console.log('--- TEST 1: Small Samples & Bayesian Shrinkage ---');
  const smallSampleBalls = 15;
  const smallSampleRuns = 45; // 300.0 Raw SR!
  const rawSR = (smallSampleRuns / smallSampleBalls) * 100;
  const shrunk = applyBayesianShrinkage(
    rawSR,
    smallSampleBalls,
    T20_GLOBAL_PRIORS.battingStrikeRate,
    T20_GLOBAL_PRIORS.battingPseudoCountBalls
  );

  assert(rawSR === 300, `Raw SR calculated correctly as 300 (got ${rawSR})`);
  assert(
    shrunk.shrunkValue < 160 && shrunk.shrunkValue > 130,
    `Bayesian shrinkage regularizes extreme 300 SR toward prior of 130 (got ${shrunk.shrunkValue.toFixed(1)})`
  );
  assert(
    shrunk.weight < 0.20,
    `Sample weight is appropriately small for 15 balls (${(shrunk.weight * 100).toFixed(1)}%)`
  );

  // --- Test 2: Over-35 Aging Players Exemption ---
  console.log('\n--- TEST 2: Over-35 Aging Players Exemption ---');
  const rohit = PLAYERS.find((p) => p.id === 'rohit-sharma')!;
  const bumrah = PLAYERS.find((p) => p.id === 'jasprit-bumrah')!;
  const rohitAge = calculateAgeTrajectory(rohit, 82);

  assert(rohit.age >= 35, `Rohit Sharma is in master veteran tier (age ${rohit.age})`);
  assert(rohitAge.isOver35Exempt, 'Rohit Sharma qualifies for over-35 veteran exemption');
  assert(
    rohitAge.ageFactorModifier >= -0.015,
    `No blunt rating penalties applied solely for age > 35 (modifier: ${rohitAge.ageFactorModifier})`
  );

  const rohitDossier = generatePlayerIntelligenceDossier(rohit);
  assert(
    rohitDossier.projection.overallImpactScore >= 72,
    `Rohit maintains high projected impact score (${rohitDossier.projection.overallImpactScore}/100)`
  );

  const kohli = PLAYERS.find((p) => p.id === 'virat-kohli')!;
  const kohliDossier = generatePlayerIntelligenceDossier(kohli);
  assert(
    kohliDossier.ageProfile.isOver35Exempt && kohliDossier.projection.overallImpactScore >= 90,
    `Virat Kohli (age 37) retains elite masterclass impact score (${kohliDossier.projection.overallImpactScore}/100)`
  );

  // --- Test 3: Rising Young Players Potential Trajectory ---
  console.log('\n--- TEST 3: Rising Young Players Potential ---');
  const youngTalent = PLAYERS.find((p) => p.age <= 23) || PLAYERS.find((p) => p.id === 'dewald-brevis')!;
  const youngAge = calculateAgeTrajectory(youngTalent, 88);

  assert(
    youngAge.careerPhase === 'Emerging',
    `Young player (${youngTalent.name}, age ${youngTalent.age}) classified as Emerging (got ${youngAge.careerPhase})`
  );
  assert(
    youngAge.ageFactorModifier > 0,
    `Young talent receives positive development trajectory (modifier: +${youngAge.ageFactorModifier})`
  );
  assert(
    youngAge.expectedLongevitySeasons >= 10,
    `Projected career longevity reflects youth (${youngAge.expectedLongevitySeasons} seasons)`
  );

  // --- Test 4: Role-Specific Valuations ---
  console.log('\n--- TEST 4: Role-Specific Valuation ---');
  const bumrahDossier = generatePlayerIntelligenceDossier(bumrah);
  const head = PLAYERS.find((p) => p.id === 'travis-head')!;
  const headDossier = generatePlayerIntelligenceDossier(head);

  assert(
    bumrahDossier.tacticalRoleScores['Death-over specialist'] >= 85,
    `Bumrah death bowling proficiency is elite (${bumrahDossier.tacticalRoleScores['Death-over specialist']}/100)`
  );
  assert(
    headDossier.tacticalRoleScores['Opening batter'] >= 85,
    `Travis Head opening batter proficiency is elite (${headDossier.tacticalRoleScores['Opening batter']}/100)`
  );
  assert(
    headDossier.tacticalRoleScores['Death-over specialist'] <= 40,
    `Head is appropriately not scored as a death bowler (${headDossier.tacticalRoleScores['Death-over specialist']})`
  );

  // --- Test 5: Zero Future-Season Data Leakage ---
  console.log('\n--- TEST 5: Zero Future-Season Data Leakage ---');
  const testKohli = PLAYERS.find((p) => p.id === 'virat-kohli')!;
  const kohliRecord2024 = getPlayerHistoricalRecord(testKohli, 2024);
  const kohliRecord2025 = getPlayerHistoricalRecord(testKohli, 2025);

  const has2025In2024Cutoff = kohliRecord2024.battingSeasons.some((s) => s.season > 2024);
  assert(!has2025In2024Cutoff, 'CutoffYear 2024 strictly excludes 2025 season (0 data leakage)');
  assert(
    kohliRecord2025.battingSeasons.some((s) => s.season === 2025),
    'CutoffYear 2025 includes 2025 season'
  );

  // --- Test 6: Valuation Adjustment After Alternative Purchase ---
  console.log('\n--- TEST 6: Valuation Adjustment After Alternative Purchase ---');
  const csk = { ...FRANCHISES.find((f) => f.id === 'csk')!, players: [] };
  const mockSession = createAuctionSession(FRANCHISES, PLAYERS.slice(0, 20), {
    seasonYear: 2026,
    auctionType: 'Mega',
    pace: 'Normal',
    totalRounds: 3,
  });

  const deathBowler1 = bumrah;
  const deathBowler2 = PLAYERS.find((p) => p.id === 'matheesha-pathirana')!;

  const initialLimit = calculateSpendingLimit(csk, deathBowler2, mockSession);
  
  // Now simulate CSK acquiring deathBowler1
  const cskWithBowler = {
    ...csk,
    players: [deathBowler1],
    remainingPurse: csk.remainingPurse - 1800,
  };
  const updatedLimit = calculateSpendingLimit(cskWithBowler, deathBowler2, mockSession);

  assert(
    updatedLimit < initialLimit,
    `Spending limit on 2nd death bowler dynamically decreases after buying 1st (${initialLimit}L -> ${updatedLimit}L)`
  );

  // --- Test 7: Simulated Auction Legal Squads & Budget Discipline ---
  console.log('\n--- TEST 7: Automated Auction Simulation Financial Legality ---');
  const testPool = PLAYERS.slice(0, 30);
  const testFranchises = FRANCHISES.map((f) => ({
    ...f,
    remainingPurse: 12000,
    players: [],
  }));
  const testSession = createAuctionSession(testFranchises, testPool, {
    seasonYear: 2026,
    auctionType: 'Mega',
    pace: 'Instant',
    totalRounds: 1,
  });

  const rng = createSeededRandom(42);
  let steps = 0;
  while (testSession.currentPlayerIndex < testSession.playerPool.length && steps < 500) {
    if (!testSession.currentLot || testSession.currentLot.state === 'Sold' || testSession.currentLot.state === 'Unsold') {
      nominatePlayer(testSession);
    } else {
      const lot = testSession.currentLot;
      let bidPlaced = false;
      for (const franchise of testSession.franchises) {
        const decision = decideCPUBid(franchise, lot, testSession, rng);
        if (decision.bid) {
          const res = placeBid(testSession, franchise.id, (lot.currentBid || lot.basePrice) + 20);
          if (res.success) {
            bidPlaced = true;
            break;
          }
        }
      }
      if (!bidPlaced) {
        processFinalCall(testSession);
      }
    }
    steps++;
  }

  // Verify financial legality for all franchises
  for (const f of testSession.franchises) {
    assert(f.remainingPurse >= 0, `${f.name} remaining purse is legal and non-negative (${f.remainingPurse}L)`);
    assert(f.players.length <= f.maxSquadSize, `${f.name} squad size within legal maximum (${f.players.length}/${f.maxSquadSize})`);
  }

  console.log('\n============================================================');
  console.log('ALL 7 DATA-DRIVEN PLAYER INTELLIGENCE ENGINE TESTS PASSED!');
  console.log('============================================================\n');
}

// Run immediately if executed via CLI
runPlayerIntelligenceTests();
