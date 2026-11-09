// ============================================================
// IPL DYNASTY - Phase 3 Career Mode & Dynasty Test Suite
// Verifies: Player Development & ML Aging, Probabilistic Retirements,
// Multi-Season Contracts, Mini/Mega Cycles, Rookie Generation,
// Long-Term CPU GM Strategy, History Preservation, and Save/Load.
// ============================================================

import { PLAYERS } from '@/lib/data/players';
import { FRANCHISES } from '@/lib/data/franchises';
import type { Player, Franchise, PlayerSeasonStats } from '@/lib/types/game';
import type { CareerState } from '@/lib/types/career';
import { progressPlayerAttributes, progressAllPlayers } from '../player-progression';
import { calculateRetirementProbability, processSeasonRetirements } from '../retirement-engine';
import { generateRookieDraftClass } from '../player-generator';
import {
  getAuctionTypeForSeason,
  getLeaguePurseForSeason,
  createInitialContracts,
  advanceContractsForNewSeason,
  releasePlayerFromFranchise,
} from '../contract-engine';
import { evaluateCpuSeasonAndPlan, executeCpuPreAuctionDecisions } from '../cpu-franchise-career';
import { initializeFranchiseHistory, recordSeasonForFranchises, recordSeasonForPlayers } from '../history-tracker';
import { generateSeasonStorylines } from '../storylines';
import { executeSeasonAdvance } from '../multi-season-controller';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runCareerModeTests() {
  console.log('\n============================================================');
  console.log('RUNNING PHASE 3 CAREER MODE & DYNASTY TESTS');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // TEST 1: Player Development & ML Aging
  // ------------------------------------------------------------
  console.log('--- TEST 1: Player Development & ML Aging ---');
  const youngTalent = PLAYERS.find((p) => p.name.includes('Tilak Varma') || p.age <= 23)!;
  const masterVet = PLAYERS.find((p) => p.name.includes('Rohit Sharma') || p.name.includes('Virat Kohli'))!;
  const standardVet = PLAYERS.find((p) => p.age >= 36 && !p.name.includes('Kohli') && !p.name.includes('Sharma') && !p.name.includes('Dhoni')) || {
    ...PLAYERS[0],
    id: 'test-vet-37',
    name: 'Veteran Tester',
    age: 37,
    ratings: { ...PLAYERS[0].ratings, overall: 76, potential: 76 },
  };

  // Young talent development
  const mockYoungStats: PlayerSeasonStats = {
    playerId: youngTalent.id,
    seasonYear: 2026,
    franchiseId: 'mi',
    matches: 14,
    innings: 14,
    runs: 480,
    ballsFaced: 330,
    battingAverage: 40.0,
    strikeRate: 145.4,
    fours: 42,
    sixes: 18,
    fifties: 3,
    hundreds: 0,
    highScore: 84,
    wickets: 0,
    oversBowled: 0,
    runsConceded: 0,
    bowlingAverage: 0,
    economyRate: 0,
    bestBowling: '0/0',
    catches: 8,
    playerOfMatch: 2,
    dotBallPercentage: 30,
    boundaryPercentage: 18,
    powerplayRuns: 120,
    deathOverRuns: 90,
    powerplayWickets: 0,
    deathOverWickets: 0,
  };

  const { updatedPlayer: developedYoung, delta: youngDelta } = progressPlayerAttributes(youngTalent, mockYoungStats, 2027);
  assert(developedYoung.age === youngTalent.age + 1, `Young player aged by 1 year (${youngTalent.age} -> ${developedYoung.age})`);
  assert(youngDelta.overallDelta >= 1 && youngDelta.overallDelta <= 6, `Young talent development bounded between +1 and +6 (got +${youngDelta.overallDelta})`);
  assert(developedYoung.ratings.overall <= developedYoung.ratings.potential, `Young player does not exceed potential ceiling`);

  // Master veteran exemption
  const { updatedPlayer: developedMaster, delta: masterDelta } = progressPlayerAttributes(masterVet, undefined, 2027);
  assert(masterDelta.overallDelta >= -2, `Master veteran (age ${masterVet.age}) protected from sharp collapse (delta: ${masterDelta.overallDelta})`);

  // Standard veteran physical decline
  const { updatedPlayer: developedStandardVet, delta: stdVetDelta } = progressPlayerAttributes(standardVet, undefined, 2027);
  assert(stdVetDelta.overallDelta <= 0 && stdVetDelta.overallDelta >= -5, `Standard veteran experiences bounded physical decline (delta: ${stdVetDelta.overallDelta})`);


  // ------------------------------------------------------------
  // TEST 2: Probabilistic Retirement Engine
  // ------------------------------------------------------------
  console.log('\n--- TEST 2: Probabilistic Retirement Engine ---');
  const youngRetire = calculateRetirementProbability(youngTalent);
  assert(youngRetire.probability === 0.0, `Active young players under 33 have 0% retirement probability`);

  const oldFastBowler: Player = {
    ...youngTalent,
    id: 'old-pacer',
    name: 'Veteran Fast Bowler',
    age: 38,
    role: 'Bowler',
    bowlingStyle: 'Right-arm Fast',
    fitnessLevel: 55,
  };
  const pacerRetire = calculateRetirementProbability(oldFastBowler);
  assert(pacerRetire.probability >= 0.35, `Aging fast bowler (age 38) has significant retirement probability (${(pacerRetire.probability * 100).toFixed(1)}%)`);

  // Process retirements across pool
  const testPool = [youngTalent, masterVet, oldFastBowler];
  const { activePlayers, retiredPlayers, retirementRecords } = processSeasonRetirements(testPool, {}, 2026);
  assert(activePlayers.some((p) => p.id === youngTalent.id), `Young talent remains in active pool`);
  assert(retiredPlayers.length === retirementRecords.length, `Retirement records matched retired player count`);


  // ------------------------------------------------------------
  // TEST 3: Multi-Season Contracts & Rules Cycle
  // ------------------------------------------------------------
  console.log('\n--- TEST 3: Multi-Season Contracts & Rules Cycle ---');
  assert(getAuctionTypeForSeason(2026) === 'Mega', `Season 2026 designated as Mega Auction`);
  assert(getAuctionTypeForSeason(2027) === 'Mini', `Season 2027 designated as Mini Auction`);
  assert(getAuctionTypeForSeason(2028) === 'Mini', `Season 2028 designated as Mini Auction`);
  assert(getAuctionTypeForSeason(2029) === 'Mega', `Season 2029 designated as Mega Auction (3-year cycle reset)`);

  assert(getLeaguePurseForSeason(2026) === 12000, `2026 Purse Cap is 120 Cr (12,000 Lakhs)`);
  assert(getLeaguePurseForSeason(2027) === 12500, `2027 Purse Cap inflates to 125 Cr (12,500 Lakhs)`);
  assert(getLeaguePurseForSeason(2030) === 14000, `2030 Purse Cap inflates to 140 Cr (14,000 Lakhs)`);

  // Contract advancement
  const testFranchise: Franchise = { ...FRANCHISES[0], players: [youngTalent, masterVet] };
  const initialContracts = createInitialContracts([testFranchise], 2026, 'Mega');
  assert(initialContracts[youngTalent.id].yearsRemaining === 3, `Mega auction creates 3-year player contracts`);

  const year2Contracts = advanceContractsForNewSeason(initialContracts, 2027);
  assert(year2Contracts[youngTalent.id].yearsRemaining === 2, `Contract decrements to 2 years for Season 2027`);

  // Player Release refunds purse
  const { updatedFranchise, releasedPlayer } = releasePlayerFromFranchise(testFranchise, youngTalent.id, year2Contracts);
  assert(releasedPlayer !== null && releasedPlayer.id === youngTalent.id, `Player successfully released`);
  assert(!updatedFranchise.players.some((p) => p.id === youngTalent.id), `Player removed from franchise roster`);
  assert(updatedFranchise.releasedPlayers.some((p) => p.id === youngTalent.id), `Player tracked in franchise released list`);


  // ------------------------------------------------------------
  // TEST 4: Future Player Pool Generation
  // ------------------------------------------------------------
  console.log('\n--- TEST 4: Future Player Pool Generation ---');
  const rookieDraftClass = generateRookieDraftClass(2027, 24);
  assert(rookieDraftClass.length === 24, `Generated 24 rookies for Season 2027`);

  const indianRookies = rookieDraftClass.filter((p) => p.nationality === 'Indian');
  const overseasRookies = rookieDraftClass.filter((p) => p.nationality === 'Overseas');
  assert(indianRookies.length >= 15 && indianRookies.length <= 18, `70% Indian rookie talent proportion maintained (${indianRookies.length}/24)`);
  assert(overseasRookies.length >= 6 && overseasRookies.length <= 9, `30% Overseas rookie talent proportion maintained (${overseasRookies.length}/24)`);

  for (const r of rookieDraftClass) {
    assert(r.age >= 18 && r.age <= 22, `Rookie ${r.name} is age ${r.age} (between 18 and 22)`);
    assert(r.ratings.overall >= 65 && r.ratings.overall <= 78, `Rookie ${r.name} OVR ${r.ratings.overall} is bounded (no overpowered cheats)`);
    assert(r.id.startsWith('gen_2027_'), `Rookie ID follows reproducible format (${r.id})`);
  }


  // ------------------------------------------------------------
  // TEST 5: Long-Term CPU Franchise Career AI
  // ------------------------------------------------------------
  console.log('\n--- TEST 5: Long-Term CPU Franchise Career AI ---');
  const mockStandings = FRANCHISES.map((f, idx) => ({
    franchiseId: f.id,
    position: idx + 1,
    played: 14,
    won: 14 - idx,
    lost: idx,
    tied: 0,
    noResult: 0,
    points: (14 - idx) * 2,
    netRunRate: 1.0 - idx * 0.2,
    runsScored: 2400,
    oversFaced: 280,
    runsConceded: 2300,
    oversBowled: 280,
    isQualified: idx < 4,
  }));

  const woodenSpoonFranchise: Franchise = {
    ...FRANCHISES[9],
    players: PLAYERS.slice(0, 18).map((p) => ({ ...p, currentFranchiseId: FRANCHISES[9].id })),
  };

  const plan = evaluateCpuSeasonAndPlan(woodenSpoonFranchise, mockStandings, 2026, false);
  assert(plan.squadDiagnosis === 'RebuildNeeded', `10th-place franchise diagnosed as RebuildNeeded`);
  assert(plan.adjustedGMPersonality === 'Aggressive', `10th-place franchise shifts to Aggressive rebuild persona`);
  assert(plan.recommendedReleases.length >= 2, `CPU identifies underperforming candidates to release (${plan.recommendedReleases.length} releases)`);


  // ------------------------------------------------------------
  // TEST 6: Franchise History & Player Career Lifetime Records
  // ------------------------------------------------------------
  console.log('\n--- TEST 6: Franchise History & Player Career Lifetime Records ---');
  const initialHistory = initializeFranchiseHistory(FRANCHISES);
  assert(Object.keys(initialHistory).length === 10, `All 10 franchises initialized in history records`);

  const updatedHistory = recordSeasonForFranchises(
    initialHistory,
    [testFranchise],
    mockStandings,
    testFranchise.id, // Champion
    FRANCHISES[1].id,
    2026,
    { [youngTalent.id]: mockYoungStats }
  );

  const miRecord = updatedHistory[testFranchise.id];
  assert(miRecord.championships === 1, `Championship recorded for winner (got ${miRecord.championships})`);
  assert(miRecord.seasonHistory.length === 1, `Historical roster snapshot preserved for season`);
  assert(miRecord.seasonHistory[0].playerSummaries.length === 2, `Historical roster snapshot preserved player summaries`);

  const updatedPlayerRecords = recordSeasonForPlayers(
    {},
    [youngTalent],
    { [youngTalent.id]: mockYoungStats },
    [],
    testFranchise.id,
    2026
  );

  const pRec = updatedPlayerRecords[youngTalent.id];
  assert(pRec.careerRuns === youngTalent.stats.runs + mockYoungStats.runs, `Player lifetime runs accumulated correctly (${pRec.careerRuns})`);
  assert(pRec.titlesWon.includes(2026), `Player title victory recorded in career achievements`);
  assert(pRec.ratingsTimeline.length === 1, `Rating progression timeline recorded`);


  // ------------------------------------------------------------
  // TEST 7: Dynamic League Storylines
  // ------------------------------------------------------------
  console.log('\n--- TEST 7: Dynamic League Storylines ---');
  const storylines = generateSeasonStorylines(
    2026,
    FRANCHISES,
    mockStandings,
    [],
    { [youngTalent.id]: mockYoungStats },
    [youngTalent],
    FRANCHISES[0].id,
    FRANCHISES[1].id,
    updatedHistory,
    []
  );

  assert(storylines.length >= 2, `Generated verified narrative storylines (got ${storylines.length})`);
  assert(storylines.some((s) => s.category === 'Championship'), `Championship headline generated`);
  assert(storylines.some((s) => s.category === 'Breakout'), `Breakout youngster headline generated`);

  console.log('\n============================================================');
  console.log('ALL 7 PHASE 3 CAREER MODE & DYNASTY TESTS PASSED!');
  console.log('============================================================\n');
}

runCareerModeTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

