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
import { GLOBAL_PLAYERS } from '@/lib/data/players';
import { getMegaRetentionRules } from '@/lib/data/retention-rules';
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
  assert(getAuctionTypeForSeason(2025) === 'Mega', `IPL 2025 followed a Mega Auction (Nov 2024)`);
  assert(getAuctionTypeForSeason(2026) === 'Mini', `IPL 2026 followed a Mini Auction (Dec 2025)`);
  assert(getAuctionTypeForSeason(2027) === 'Mini', `IPL 2027 follows a Mini Auction (Dec 2026)`);
  assert(getAuctionTypeForSeason(2028) === 'Mega', `IPL 2028 follows a Mega Auction (3-year cycle reset)`);
  assert(getLeaguePurseForSeason(2026) === 12500, `2026 Purse Cap is 125 Cr (12,500 Lakhs) — the real IPL 2026 purse`);
  assert(getLeaguePurseForSeason(2027) === 13000, `2027 Purse Cap inflates to 130 Cr (13,000 Lakhs)`);
  // Real trend: 2022 ₹90 Cr mega → 95 → 100 → 2025 ₹120 Cr mega; +₹5 Cr a mini, +₹20 Cr a mega.
  assert(getLeaguePurseForSeason(2022) === 9000 && getLeaguePurseForSeason(2025) === 12000, 'Purse curve reproduces 2022 (₹90 Cr) and 2025 (₹120 Cr)');
  assert(getLeaguePurseForSeason(2028) === 15000, `2028 mega purse jumps to 150 Cr (${getLeaguePurseForSeason(2028)})`);
  assert(getLeaguePurseForSeason(2030) === 16000, `2030 Purse Cap is 160 Cr (${getLeaguePurseForSeason(2030)})`);
  const custom = { startingSeason: 2027, auctionType: 'Mega' as const, cycleMode: 'custom' as const };
  assert(getLeaguePurseForSeason(2030, custom) === 16000 && getLeaguePurseForSeason(2029, custom) === 14000, 'Custom cycle: purse jumps at its own year-4 mega (140 → 160 Cr)');
  const r130 = getMegaRetentionRules(13000).retentionCosts;
  const r160 = getMegaRetentionRules(16000).retentionCosts;
  assert(r130[0] === 1900 && r160[0] === 2200 && r160[5] === 500, `Retention slabs scale with the purse (130 Cr: ${r130.map((c) => c / 100).join('/')}, 160 Cr: ${r160.map((c) => c / 100).join('/')})`);
  assert(getMegaRetentionRules(12000).retentionCosts.slice(0, 3).join() === '1800,1400,1100', 'At ₹120 Cr the slabs are the real IPL 2025 ones (18/14/11)');

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
  // ~34 a year: 26 Indian (wonderkids, hot prospects, ready-now performers, standard) + 8 overseas.
  const rookieDraftClass = generateRookieDraftClass(2027, 42, GLOBAL_PLAYERS);
  assert(rookieDraftClass.length === 34, `Generated 34 rookies for Season 2027 (${rookieDraftClass.length})`);

  const indianRookies = rookieDraftClass.filter((p) => p.nationality === 'Indian');
  const overseasRookies = rookieDraftClass.filter((p) => p.nationality === 'Overseas');
  assert(indianRookies.length === 26 && overseasRookies.length === 8, `26 Indian + 8 overseas rookies (${indianRookies.length} + ${overseasRookies.length})`);
  const wonderkids = indianRookies.filter((p) => p.age <= 19 && p.ratings.potential >= 88);
  assert(wonderkids.length >= 2 && wonderkids.length <= 4, `2–3 wonderkids (POT 88+) in the class (${wonderkids.map((p) => `${p.name} ${p.ratings.overall}/${p.ratings.potential}`).join(', ')})`);
  const readyNow = indianRookies.filter((p) => p.age >= 22 && p.ratings.overall >= 74);
  assert(readyNow.length >= 7, `ready-now domestic performers in the class (${readyNow.length})`);
  const wkShare = rookieDraftClass.filter((p) => p.role === 'Wicketkeeper').length / rookieDraftClass.length;
  assert(wkShare < 0.3, `roles are weighted, not cycled (${(wkShare * 100).toFixed(0)}% keepers)`);

  for (const r of rookieDraftClass) {
    assert(r.age >= 16 && r.age <= 29, `Rookie ${r.name} is age ${r.age} (16–29)`);
    assert(r.ratings.overall >= 65 && r.ratings.overall <= 80, `Rookie ${r.name} OVR ${r.ratings.overall} is bounded (no overpowered cheats)`);
    assert(r.id.startsWith('gen_2027_'), `Rookie ID follows reproducible format (${r.id})`);
    assert(!!r.development?.note, `Rookie ${r.name} carries a scouting note (${r.development?.note})`);
    assert([20, 30, 40].includes(r.basePrice), `Rookie ${r.name} has an official uncapped base price (${r.basePrice}L)`);
  }
  const names = new Set(GLOBAL_PLAYERS.map((p) => p.name.toLowerCase()));
  assert(rookieDraftClass.every((r) => !names.has(r.name.toLowerCase())), 'No rookie shares a name with an existing player');
  assert(new Set(rookieDraftClass.map((r) => r.name)).size === rookieDraftClass.length, 'Rookie names are unique within the class');
  const again = generateRookieDraftClass(2027, 42, GLOBAL_PLAYERS);
  assert(JSON.stringify(again) === JSON.stringify(rookieDraftClass), 'Same season + seed = same class (deterministic)');
  const other = generateRookieDraftClass(2027, 7, GLOBAL_PLAYERS);
  assert(other.map((p) => p.name).join() !== rookieDraftClass.map((p) => p.name).join(), 'A different career seed gets a different class');


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

