// ============================================================
// IPL DYNASTY - Match Engine & Tournament Integration Test Suite
// Verifies ML player performance, cricket rules, venue profiles,
// tactical controls, points table NRR, and full end-to-end tournament:
// Auction Squads -> Playing XI -> 70 League Matches -> Playoffs -> Champion!
// ============================================================

import { FRANCHISES } from '../../../data/franchises';
import { PLAYERS } from '../../../data/players';
import { getStadiumProfile, decideToss, IPL_STADIUMS } from '../venues';
import { getPlayerMatchAttributes } from '../ml-match-bridge';
import {
  BATTING_AGGRESSION_MODIFIERS,
  BOWLING_STRATEGY_MODIFIERS,
  getCpuBattingAggression,
  canSubstituteImpactPlayer,
} from '../tactics';
import { calculateLiveWinProbability } from '../win-probability';
import {
  createLiveMatchSession,
  simulateLiveDelivery,
  simulateLiveOver,
  simulateFullMatch,
} from '../../match-engine';
import { generateBestPlayingXI, validatePlayingXI } from '../../squad-engine';
import {
  generateIPLFixtures,
  calculateStandings,
  generatePlayoffFixtures,
  calculateSeasonAwards,
} from '../../tournament-engine';
import { createSeededRandom } from '../../../utils/random';
import type { Fixture, Franchise, Player, PlayerSeasonStats, PlayingXI } from '../../../types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

export function runMatchTournamentTestSuite() {
  console.log('\n============================================================');
  console.log('RUNNING PHASE 2 MATCH SIMULATION & TOURNAMENT TESTS');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // TEST 1: ML Performance Attributes & Matchup Affinity
  // -------------------------------------------------------------
  console.log('--- TEST 1: ML Performance Attributes & Matchup Affinity ---');
  const bumrah = PLAYERS.find((p) => p.name.includes('Bumrah')) || PLAYERS.find((p) => p.role === 'Bowler')!;
  const travisHead = PLAYERS.find((p) => p.name.includes('Head')) || PLAYERS.find((p) => p.role === 'Batter')!;

  const bumrahAttrs = getPlayerMatchAttributes(bumrah);
  const headAttrs = getPlayerMatchAttributes(travisHead);

  assert(bumrahAttrs.isPacer, `Jasprit Bumrah is correctly identified as a Pacer`);
  assert(bumrahAttrs.expectedEconomy <= 8.2, `Bumrah has elite ML projected economy (${bumrahAttrs.expectedEconomy} <= 8.2)`);
  assert(bumrahAttrs.deathBowlingRating >= 85, `Bumrah death bowling rating is elite (${bumrahAttrs.deathBowlingRating} >= 85)`);

  assert(headAttrs.expectedStrikeRate >= 145, `Travis Head has high ML projected strike rate (${headAttrs.expectedStrikeRate} >= 145)`);
  assert(headAttrs.boundaryTendency >= 0.12, `Head has high boundary tendency (${headAttrs.boundaryTendency.toFixed(3)} >= 0.12)`);
  assert(headAttrs.powerplayBattingRating >= 80, `Head excels in Powerplay batting (${headAttrs.powerplayBattingRating} >= 80)`);

  // -------------------------------------------------------------
  // TEST 2: Cricket Laws & Delivery Legitimacy
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Cricket Laws & Delivery Legitimacy ---');
  const mi = { ...FRANCHISES[0], players: PLAYERS.filter((p) => p.currentFranchiseId === FRANCHISES[0].id) };
  const csk = { ...FRANCHISES[1], players: PLAYERS.filter((p) => p.currentFranchiseId === FRANCHISES[1].id) };
  const xiMI = generateBestPlayingXI(mi);
  const xiCSK = generateBestPlayingXI(csk);

  const fixtureSample: Fixture = {
    id: 'test-fixture-1',
    matchNumber: 1,
    team1Id: mi.id,
    team2Id: csk.id,
    venue: mi.homeStadium,
    isCompleted: false,
    result: null,
    isPlayoff: false,
  };

  const session = createLiveMatchSession(fixtureSample, mi, csk, xiMI, xiCSK, 42);
  assert(session.currentInningsIndex === 1, `Match session initializes in 1st innings`);
  assert(session.innings1.batsmen.length === 11, `Innings 1 contains 11 batsmen`);

  // Step 6 legal balls
  let legalBallsCount = 0;
  for (let b = 0; b < 10; b++) {
    if (session.innings1.currentOver >= 1) break;
    const { ballEvent } = simulateLiveDelivery(session);
    if (ballEvent && ballEvent.isLegal) legalBallsCount++;
  }
  assert(session.innings1.currentOver >= 1, `1 full over completed after 6 legal deliveries`);
  assert(session.innings1.score.overs >= 1, `Team score reflects 1 completed over`);

  // Bowler max 4 overs validation in full match
  const fullSim = simulateFullMatch(fixtureSample, mi, csk, xiMI, xiCSK, 12345);
  for (const b of [...fullSim.innings1.bowlers, ...fullSim.innings2.bowlers]) {
    assert(b.overs <= 4, `Bowler ${b.playerName} bowled legal quota (${b.overs} <= 4 overs)`);
  }
  assert(fullSim.innings1.bowlers.length >= 5, `At least 5 bowling options used in Innings 1`);
  assert(fullSim.innings2.bowlers.length >= 5, `At least 5 bowling options used in Innings 2`);

  // -------------------------------------------------------------
  // TEST 3: Stadium Environments & Probabilistic Toss AI
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Stadium Environments & Probabilistic Toss AI ---');
  assert(Object.keys(IPL_STADIUMS).length === 10, `All 10 IPL Stadiums configured with detailed profiles`);

  const wankhede = getStadiumProfile('Wankhede Stadium, Mumbai');
  const chepauk = getStadiumProfile('MA Chidambaram Stadium, Chennai');
  assert(wankhede.parScore >= 180, `Wankhede is high-scoring venue (par ${wankhede.parScore} >= 180)`);
  assert(wankhede.dewFactor >= 0.30, `Wankhede has heavy evening dew factor (${wankhede.dewFactor})`);
  assert(chepauk.spinAssistance >= 0.25, `Chepauk has strong spin assistance (${chepauk.spinAssistance})`);

  const rng = createSeededRandom(999);
  const tossWankhede = decideToss(mi, csk, wankhede, 'Flat Track', rng);
  assert(tossWankhede.decision === 'Bowl', `Captain at Wankhede with dew chooses to bowl first`);

  const tossChepauk = decideToss(csk, mi, chepauk, 'Turning Dustbowl', rng);
  assert(tossChepauk.decision === 'Bat', `Captain at Chepauk on a turning dustbowl chooses to bat first`);

  // -------------------------------------------------------------
  // TEST 4: Human Tactical Controls Influence Probabilities
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Human Tactical Controls Influence Probabilities ---');
  const anchorTactics = BATTING_AGGRESSION_MODIFIERS['Anchor'];
  const blitzTactics = BATTING_AGGRESSION_MODIFIERS['Blitz'];

  assert(blitzTactics.boundaryProbMultiplier > anchorTactics.boundaryProbMultiplier, `Blitz aggression has higher boundary multiplier (${blitzTactics.boundaryProbMultiplier} vs ${anchorTactics.boundaryProbMultiplier})`);
  assert(blitzTactics.dismissalProbMultiplier > anchorTactics.dismissalProbMultiplier, `Blitz aggression carries higher dismissal risk (${blitzTactics.dismissalProbMultiplier} vs ${anchorTactics.dismissalProbMultiplier})`);

  const yorkerTactics = BOWLING_STRATEGY_MODIFIERS['Yorker'];
  const stockTactics = BOWLING_STRATEGY_MODIFIERS['Stock'];
  assert(yorkerTactics.dismissalProbMultiplier > stockTactics.dismissalProbMultiplier, `Yorker bowling tactic increases dismissal chances (${yorkerTactics.dismissalProbMultiplier} vs ${stockTactics.dismissalProbMultiplier})`);
  assert(yorkerTactics.boundaryProbMultiplier < stockTactics.boundaryProbMultiplier, `Yorker reduces boundary probability (${yorkerTactics.boundaryProbMultiplier} < ${stockTactics.boundaryProbMultiplier})`);

  // Adaptive CPU aggression
  const aggDesperate = getCpuBattingAggression(17, 3, 195, 140); // Need 55 off 18 balls
  assert(aggDesperate === 'Blitz' || aggDesperate === 'Attack', `CPU switches to Blitz/Attack under high Required Run Rate (got ${aggDesperate})`);

  const aggCoasting = getCpuBattingAggression(17, 2, 140, 130); // Need 10 off 18 balls
  assert(aggCoasting === 'Anchor', `CPU coasts with Anchor when comfortably ahead in chase (got ${aggCoasting})`);

  // -------------------------------------------------------------
  // TEST 5: Impact Player Rules & Substitutions
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Impact Player Rules & Substitutions ---');
  const indianSub = PLAYERS.find((p) => p.nationality === 'Indian' && p.role === 'Bowler')!;
  const overseasSub = PLAYERS.find((p) => p.nationality === 'Overseas')!;

  const check1 = canSubstituteImpactPlayer(false, true, mi, 4, overseasSub);
  assert(!check1.allowed, `Rejected 5th overseas player substitution when 4 overseas already playing`);

  const check2 = canSubstituteImpactPlayer(false, true, mi, 4, indianSub);
  assert(check2.allowed, `Permitted legal Indian Impact Player substitution`);

  const check3 = canSubstituteImpactPlayer(false, false, mi, 3, indianSub);
  assert(!check3.allowed, `Rejected illegal substitution mid-over`);

  // -------------------------------------------------------------
  // TEST 6: Real-Time Win Probability Meter
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Real-Time Win Probability Meter ---');
  // Chasing team needs 8 runs off 18 balls with 8 wickets in hand
  const winProbEasy = calculateLiveWinProbability(2, 17, 0, 150, 2, 158, wankhede);
  assert(winProbEasy.battingTeamWinPct >= 85, `Chasing team with low target has dominant win probability (${winProbEasy.battingTeamWinPct}% >= 85%)`);

  // Chasing team needs 60 runs off 18 balls with 7 wickets lost
  const winProbDesperate = calculateLiveWinProbability(2, 17, 0, 120, 7, 180, wankhede);
  assert(winProbDesperate.battingTeamWinPct <= 15, `Chasing team in dire collapse has low win probability (${winProbDesperate.battingTeamWinPct}% <= 15%)`);

  // -------------------------------------------------------------
  // TEST 7: Full End-to-End Tournament Simulation
  // Auction Squads -> Playing XI -> 70 League Matches -> Points Table -> Playoffs -> Champion!
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Full End-to-End Tournament Simulation ---');
  const franchisesTournament: Franchise[] = FRANCHISES.map((f) => ({
    ...f,
    players: PLAYERS.filter((p) => p.currentFranchiseId === f.id),
  }));

  // Generate Playing XIs
  const playingXIsMap: Record<string, PlayingXI> = {};
  for (const f of franchisesTournament) {
    const xi = generateBestPlayingXI(f);
    const val = validatePlayingXI(xi, f.players);
    assert(val.valid, `${f.name} Playing XI is 100% legal (${xi.players.length} players, ${f.players.filter((p) => p.nationality === 'Overseas' && xi.players.includes(p.id)).length} overseas)`);
    playingXIsMap[f.id] = xi;
  }

  // 1. Generate 70 League Fixtures
  const fixtures = generateIPLFixtures(franchisesTournament);
  assert(fixtures.length === 70, `Generated official 70-match IPL league schedule (got ${fixtures.length})`);

  // 2. Simulate All 70 League Matches
  const playerStats: Record<string, PlayerSeasonStats> = {};
  for (let m = 0; m < fixtures.length; m++) {
    const fix = fixtures[m];
    const t1 = franchisesTournament.find((f) => f.id === fix.team1Id)!;
    const t2 = franchisesTournament.find((f) => f.id === fix.team2Id)!;
    const xi1 = playingXIsMap[t1.id];
    const xi2 = playingXIsMap[t2.id];

    const matchSim = simulateFullMatch(fix, t1, t2, xi1, xi2, m * 1009);
    fix.isCompleted = true;
    fix.result = matchSim.matchResult;

    // Accumulate stats
    for (const b of [...matchSim.innings1.batsmen, ...matchSim.innings2.batsmen]) {
      if (b.balls > 0) {
        if (!playerStats[b.playerId]) {
          playerStats[b.playerId] = {
            playerId: b.playerId,
            seasonYear: 2026,
            franchiseId: t1.players.some((p) => p.id === b.playerId) ? t1.id : t2.id,
            matches: 0,
            innings: 0,
            runs: 0,
            ballsFaced: 0,
            fours: 0,
            sixes: 0,
            highScore: 0,
            strikeRate: 0,
            battingAverage: 0,
            fifties: 0,
            hundreds: 0,
            oversBowled: 0,
            wickets: 0,
            runsConceded: 0,
            economyRate: 0,
            bowlingAverage: 0,
            bestBowling: '0/0',
            playerOfMatch: 0,
            catches: 0,
            dotBallPercentage: 0,
            boundaryPercentage: 0,
            powerplayRuns: 0,
            deathOverRuns: 0,
            powerplayWickets: 0,
            deathOverWickets: 0,
          };
        }
        const s = playerStats[b.playerId];
        s.matches++;
        s.innings++;
        s.runs += b.runs;
        s.ballsFaced += b.balls;
        s.fours += b.fours;
        s.sixes += b.sixes;
      }
    }
    for (const b of [...matchSim.innings1.bowlers, ...matchSim.innings2.bowlers]) {
      if (b.overs > 0) {
        if (!playerStats[b.playerId]) {
          playerStats[b.playerId] = {
            playerId: b.playerId,
            seasonYear: 2026,
            franchiseId: t1.players.some((p) => p.id === b.playerId) ? t1.id : t2.id,
            matches: 1,
            innings: 0,
            runs: 0,
            ballsFaced: 0,
            fours: 0,
            sixes: 0,
            highScore: 0,
            strikeRate: 0,
            battingAverage: 0,
            fifties: 0,
            hundreds: 0,
            oversBowled: 0,
            wickets: 0,
            runsConceded: 0,
            economyRate: 0,
            bowlingAverage: 0,
            bestBowling: '0/0',
            playerOfMatch: 0,
            catches: 0,
            dotBallPercentage: 0,
            boundaryPercentage: 0,
            powerplayRuns: 0,
            deathOverRuns: 0,
            powerplayWickets: 0,
            deathOverWickets: 0,
          };
        }
        const s = playerStats[b.playerId];
        s.oversBowled += b.overs;
        s.wickets += b.wickets;
        s.runsConceded += b.runs;
      }
    }
  }

  // 3. Compute Standings Table & Net Run Rate
  const standings = calculateStandings(franchisesTournament, fixtures);
  assert(standings.length === 10, `Points table has all 10 franchises`);
  assert(standings.every((s) => s.played === 14), `All 10 franchises played exactly 14 league matches`);

  // Verify NRR correctness: Total league NRR must sum to 0.00 (within floating point precision)
  const totalNrr = standings.reduce((sum, s) => sum + s.netRunRate, 0);
  assert(Math.abs(totalNrr) < 0.1, `League Net Run Rate sums to zero (conservation of runs/overs: ${totalNrr.toFixed(3)})`);

  // Verify Top 4 Qualification
  const top4 = standings.slice(0, 4);
  assert(top4.every((s) => s.isQualified), `Top 4 franchises qualify for playoffs`);

  // 4. Simulate Playoffs (Qualifier 1, Eliminator, Qualifier 2, Final)
  const playoffFixtures = generatePlayoffFixtures(standings);
  assert(playoffFixtures.length === 2, `Playoff initial fixtures: Qualifier 1 and Eliminator generated`);

  // Qualifier 1 (1st vs 2nd)
  const q1 = playoffFixtures[0];
  const q1Team1 = franchisesTournament.find((f) => f.id === q1.team1Id)!;
  const q1Team2 = franchisesTournament.find((f) => f.id === q1.team2Id)!;
  const simQ1 = simulateFullMatch(q1, q1Team1, q1Team2, playingXIsMap[q1Team1.id], playingXIsMap[q1Team2.id], 7101);
  q1.isCompleted = true;
  q1.result = simQ1.matchResult;
  const finalist1Id = simQ1.matchResult.winnerId!;
  const loserQ1Id = finalist1Id === q1.team1Id ? q1.team2Id : q1.team1Id;
  assert(!!finalist1Id, `Qualifier 1 winner advances directly to Final (${finalist1Id})`);

  // Eliminator (3rd vs 4th)
  const elim = playoffFixtures[1];
  const elimTeam1 = franchisesTournament.find((f) => f.id === elim.team1Id)!;
  const elimTeam2 = franchisesTournament.find((f) => f.id === elim.team2Id)!;
  const simElim = simulateFullMatch(elim, elimTeam1, elimTeam2, playingXIsMap[elimTeam1.id], playingXIsMap[elimTeam2.id], 7202);
  elim.isCompleted = true;
  elim.result = simElim.matchResult;
  const winnerElimId = simElim.matchResult.winnerId!;
  assert(!!winnerElimId, `Eliminator winner advances to Qualifier 2 (${winnerElimId})`);

  // Qualifier 2 (Loser Q1 vs Winner Eliminator)
  const q2Team1 = franchisesTournament.find((f) => f.id === loserQ1Id)!;
  const q2Team2 = franchisesTournament.find((f) => f.id === winnerElimId)!;
  const q2Fixture: Fixture = {
    id: 'playoff-q2',
    matchNumber: 73,
    team1Id: q2Team1.id,
    team2Id: q2Team2.id,
    venue: 'MA Chidambaram Stadium, Chennai',
    isCompleted: false,
    result: null,
    isPlayoff: true,
    playoffType: 'Qualifier2',
  };
  const simQ2 = simulateFullMatch(q2Fixture, q2Team1, q2Team2, playingXIsMap[q2Team1.id], playingXIsMap[q2Team2.id], 7303);
  q2Fixture.isCompleted = true;
  q2Fixture.result = simQ2.matchResult;
  const finalist2Id = simQ2.matchResult.winnerId!;
  assert(!!finalist2Id, `Qualifier 2 winner advances to Final (${finalist2Id})`);

  // IPL Final (Winner Q1 vs Winner Q2)
  const finalTeam1 = franchisesTournament.find((f) => f.id === finalist1Id)!;
  const finalTeam2 = franchisesTournament.find((f) => f.id === finalist2Id)!;
  const finalFixture: Fixture = {
    id: 'playoff-final',
    matchNumber: 74,
    team1Id: finalTeam1.id,
    team2Id: finalTeam2.id,
    venue: 'Narendra Modi Stadium, Ahmedabad',
    isCompleted: false,
    result: null,
    isPlayoff: true,
    playoffType: 'Final',
  };
  const simFinal = simulateFullMatch(finalFixture, finalTeam1, finalTeam2, playingXIsMap[finalTeam1.id], playingXIsMap[finalTeam2.id], 7404);
  finalFixture.isCompleted = true;
  finalFixture.result = simFinal.matchResult;
  const championId = simFinal.matchResult.winnerId!;
  const champion = franchisesTournament.find((f) => f.id === championId)!;

  assert(!!championId, `🏆 IPL CHAMPION CROWNED: ${champion.name}!`);

  // 5. Calculate Season Awards
  const awards = calculateSeasonAwards(PLAYERS, playerStats);
  const orangeCap = awards.find((a) => a.type === 'OrangeCap');
  const purpleCap = awards.find((a) => a.type === 'PurpleCap');
  const mvp = awards.find((a) => a.type === 'MVP');

  assert(!!orangeCap && orangeCap.value > 0, `Orange Cap awarded: ${orangeCap?.playerName} (${orangeCap?.value} runs)`);
  assert(!!purpleCap && purpleCap.value > 0, `Purple Cap awarded: ${purpleCap?.playerName} (${purpleCap?.value} wickets)`);
  assert(!!mvp, `MVP awarded: ${mvp?.playerName} (Impact Value: ${mvp?.value})`);

  console.log('\n============================================================');
  console.log('ALL 7 PHASE 2 MATCH SIMULATION & TOURNAMENT TESTS PASSED!');
  console.log('============================================================\n');
}

// Execute when invoked directly
if (process.argv[1]?.includes('match-tournament.test')) {
  runMatchTournamentTestSuite();
}
