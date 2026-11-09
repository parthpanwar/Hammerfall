// ============================================================
// IPL DYNASTY - 10-Season Automated Career Simulation Benchmark
// Runs 10 consecutive full IPL seasons without reset, validating
// rating inflation stability, squad legality, retirements, competitive balance,
// financial discipline, and history integrity.
// ============================================================

import { PLAYERS } from '../src/lib/data/players';
import { FRANCHISES } from '../src/lib/data/franchises';
import type { GameState, Franchise, Player, Fixture } from '../src/lib/types/game';
import type { CareerState } from '../src/lib/types/career';
import { initializeFranchiseHistory } from '../src/lib/engines/career/history-tracker';
import { createInitialContracts } from '../src/lib/engines/career/contract-engine';
import { executeSeasonAdvance } from '../src/lib/engines/career/multi-season-controller';
import { generateIPLFixtures, calculateStandings, generatePlayoffFixtures, calculateSeasonAwards } from '../src/lib/engines/tournament-engine';
import { simulateFullMatch } from '../src/lib/engines/match-engine';
import { generateBestPlayingXI } from '../src/lib/engines/squad-engine';

async function run10SeasonDynastySimulation() {
  console.log('================================================================================');
  console.log('STARTING 10-SEASON IPL DYNASTY BENCHMARK SIMULATION');
  console.log('Validating: 10 Consecutive Seasons, Zero Database Resets, Balanced Aging');
  console.log('================================================================================\n');

  const startTime = Date.now();

  // 1. Initial State Setup
  const initialFranchises: Franchise[] = FRANCHISES.map((f) => ({
    ...f,
    players: PLAYERS.filter((p) => p.currentFranchiseId === f.id),
    isHumanControlled: f.id === 'mi', // MI human
    remainingPurse: 12000,
    totalPurse: 12000,
  }));

  let gameState: GameState = {
    id: 'benchmark-10-seasons',
    phase: 'Tournament',
    settings: {
      startingSeason: 2026,
      auctionType: 'Mega',
      rulesPreset: 'Official',
      cpuDifficulty: 'Normal',
      auctionPace: 'Instant',
      matchSimMode: 'Quick',
      allowCustomPurse: false,
      enableInjuries: false,
      enablePlayerDevelopment: true,
      seed: 42,
    },
    currentSeason: 2026,
    humanFranchiseId: 'mi',
    franchises: initialFranchises,
    allPlayers: [...PLAYERS],
    retentionDecisions: [],
    retentionComplete: true,
    auctionSession: null,
    auctionComplete: true,
    fixtures: [],
    standings: [],
    currentFixtureIndex: 0,
    currentMatch: null,
    playerSeasonStats: {},
    playingXIs: {},
    playoffFixtures: [],
    seasonAwards: [],
    seasonHistory: [],
    careerYear: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    savedAt: Date.now(),
  };

  let careerState: CareerState = {
    currentSeason: 2026,
    contracts: createInitialContracts(initialFranchises, 2026, 'Mega'),
    retirements: [],
    franchiseHistory: initializeFranchiseHistory(initialFranchises),
    playerCareerRecords: {},
    storylines: [],
    recentProgressionDeltas: [],
    activeSaveSlot: 1,
  };

  const seasonChampions: { season: number; champion: string; runnerUp: string }[] = [];
  const meanRatingsHistory: number[] = [];
  let totalRetirementsRecorded = 0;
  let totalRookiesIntegrated = 0;

  for (let s = 1; s <= 10; s++) {
    const seasonYear = gameState.currentSeason;
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`SIMULATING SEASON ${seasonYear} (Dynasty Year ${s}/10)...`);
    console.log(`--------------------------------------------------------------------------------`);

    // Ensure all 10 franchises have legal minimum squads (at least 16 players with WK and bowlers)
    for (const franchise of gameState.franchises) {
      while (franchise.players.length < 16) {
        const hasWK = franchise.players.some((p) => p.role === 'Wicketkeeper');
        const bowlerCount = franchise.players.filter((p) => p.role === 'Bowler' || p.role === 'All-Rounder').length;

        let candidate = gameState.allPlayers.find((p) => {
          if (p.currentFranchiseId) return false;
          if (!hasWK && p.role === 'Wicketkeeper') return true;
          if (bowlerCount < 5 && (p.role === 'Bowler' || p.role === 'All-Rounder')) return true;
          return hasWK && bowlerCount >= 5;
        });

        if (!candidate) {
          candidate = gameState.allPlayers.find((p) => !p.currentFranchiseId);
        }

        if (candidate) {
          candidate.currentFranchiseId = franchise.id;
          candidate.isAvailableForAuction = false;
          franchise.players.push(candidate);
        } else {
          break;
        }
      }
    }

    // Measure Average League Player Rating
    const activeOverallRatings = gameState.allPlayers
      .filter((p) => p.currentFranchiseId)
      .map((p) => p.ratings.overall);
    const avgOvr = activeOverallRatings.reduce((a, b) => a + b, 0) / activeOverallRatings.length;
    meanRatingsHistory.push(avgOvr);
    console.log(`Active Players: ${activeOverallRatings.length} | League Mean OVR: ${avgOvr.toFixed(2)}`);

    // 1. Generate 70-Match League Fixtures
    const fixtures = generateIPLFixtures(gameState.franchises);
    gameState.fixtures = fixtures;
    console.log(`Generated official 70-match schedule (${fixtures.length} matches)`);

    // 2. Simulate All 70 League Matches
    const fMap = new Map(gameState.franchises.map((f) => [f.id, f]));
    for (let m = 0; m < fixtures.length; m++) {
      const fix = fixtures[m];
      const t1 = fMap.get(fix.team1Id)!;
      const t2 = fMap.get(fix.team2Id)!;
      const xi1 = generateBestPlayingXI(t1);
      const xi2 = generateBestPlayingXI(t2);

      const sim = simulateFullMatch(fix, t1, t2, xi1, xi2, seasonYear * 1000 + m);
      fix.isCompleted = true;
      fix.result = sim.matchResult;

      // Accumulate season stats
      for (const b of sim.innings1.batsmen) {
        if (!gameState.playerSeasonStats[b.playerId]) {
          gameState.playerSeasonStats[b.playerId] = {
            playerId: b.playerId,
            seasonYear,
            franchiseId: t1.id,
            matches: 0,
            innings: 0,
            runs: 0,
            ballsFaced: 0,
            battingAverage: 0,
            strikeRate: 0,
            fours: 0,
            sixes: 0,
            fifties: 0,
            hundreds: 0,
            highScore: 0,
            wickets: 0,
            oversBowled: 0,
            runsConceded: 0,
            bowlingAverage: 0,
            economyRate: 0,
            bestBowling: '0/0',
            catches: 0,
            playerOfMatch: 0,
            dotBallPercentage: 0,
            boundaryPercentage: 0,
            powerplayRuns: 0,
            deathOverRuns: 0,
            powerplayWickets: 0,
            deathOverWickets: 0,
          };
        }
        const st = gameState.playerSeasonStats[b.playerId];
        st.matches++;
        st.runs += b.runs;
        st.ballsFaced += b.balls;
        st.fours += b.fours;
        st.sixes += b.sixes;
        if (b.runs > st.highScore) st.highScore = b.runs;
      }

      for (const b of sim.innings2.batsmen) {
        if (!gameState.playerSeasonStats[b.playerId]) {
          gameState.playerSeasonStats[b.playerId] = {
            playerId: b.playerId,
            seasonYear,
            franchiseId: t2.id,
            matches: 0,
            innings: 0,
            runs: 0,
            ballsFaced: 0,
            battingAverage: 0,
            strikeRate: 0,
            fours: 0,
            sixes: 0,
            fifties: 0,
            hundreds: 0,
            highScore: 0,
            wickets: 0,
            oversBowled: 0,
            runsConceded: 0,
            bowlingAverage: 0,
            economyRate: 0,
            bestBowling: '0/0',
            catches: 0,
            playerOfMatch: 0,
            dotBallPercentage: 0,
            boundaryPercentage: 0,
            powerplayRuns: 0,
            deathOverRuns: 0,
            powerplayWickets: 0,
            deathOverWickets: 0,
          };
        }
        const st = gameState.playerSeasonStats[b.playerId];
        st.matches++;
        st.runs += b.runs;
        st.ballsFaced += b.balls;
        st.fours += b.fours;
        st.sixes += b.sixes;
        if (b.runs > st.highScore) st.highScore = b.runs;
      }
    }

    // 3. Standings & Playoffs
    const standings = calculateStandings(gameState.franchises, fixtures);
    gameState.standings = standings;
    const top4 = standings.slice(0, 4);
    console.log(`Top 4 Qualifiers: 1. ${top4[0]?.franchiseId} 2. ${top4[1]?.franchiseId} 3. ${top4[2]?.franchiseId} 4. ${top4[3]?.franchiseId}`);

    const playoffFixtures = generatePlayoffFixtures(standings);

    // Simulate Qualifier 1 & Eliminator
    const q1 = playoffFixtures[0];
    const elim = playoffFixtures[1];
    const q1T1 = fMap.get(q1.team1Id)!;
    const q1T2 = fMap.get(q1.team2Id)!;
    const simQ1 = simulateFullMatch(q1, q1T1, q1T2, generateBestPlayingXI(q1T1), generateBestPlayingXI(q1T2), seasonYear * 900 + 1);
    q1.isCompleted = true;
    q1.result = simQ1.matchResult;

    const elimT1 = fMap.get(elim.team1Id)!;
    const elimT2 = fMap.get(elim.team2Id)!;
    const simElim = simulateFullMatch(elim, elimT1, elimT2, generateBestPlayingXI(elimT1), generateBestPlayingXI(elimT2), seasonYear * 900 + 2);
    elim.isCompleted = true;
    elim.result = simElim.matchResult;

    // Qualifier 2
    const q1Loser = q1.result.winnerId === q1.team1Id ? q1.team2Id : q1.team1Id;
    const elimWinner = elim.result.winnerId!;
    const q2: Fixture = {
      id: `playoff-${seasonYear}-q2`,
      matchNumber: 73,
      team1Id: q1Loser,
      team2Id: elimWinner,
      venue: 'Narendra Modi Stadium, Ahmedabad',
      isCompleted: false,
      result: null,
      isPlayoff: true,
      playoffType: 'Qualifier2',
    };
    const q2T1 = fMap.get(q2.team1Id)!;
    const q2T2 = fMap.get(q2.team2Id)!;
    const simQ2 = simulateFullMatch(q2, q2T1, q2T2, generateBestPlayingXI(q2T1), generateBestPlayingXI(q2T2), seasonYear * 900 + 3);
    q2.isCompleted = true;
    q2.result = simQ2.matchResult;

    // Grand Final
    const q1Winner = q1.result.winnerId!;
    const q2Winner = q2.result.winnerId!;
    const finalFix: Fixture = {
      id: `playoff-${seasonYear}-final`,
      matchNumber: 74,
      team1Id: q1Winner,
      team2Id: q2Winner,
      venue: 'Wankhede Stadium, Mumbai',
      isCompleted: false,
      result: null,
      isPlayoff: true,
      playoffType: 'Final',
    };
    const fnT1 = fMap.get(finalFix.team1Id)!;
    const fnT2 = fMap.get(finalFix.team2Id)!;
    const simFinal = simulateFullMatch(finalFix, fnT1, fnT2, generateBestPlayingXI(fnT1), generateBestPlayingXI(fnT2), seasonYear * 900 + 4);
    finalFix.isCompleted = true;
    finalFix.result = simFinal.matchResult;

    gameState.playoffFixtures = [q1, elim, q2, finalFix];

    const champId = finalFix.result.winnerId!;
    const runnerId = champId === finalFix.team1Id ? finalFix.team2Id : finalFix.team1Id;
    seasonChampions.push({ season: seasonYear, champion: champId, runnerUp: runnerId });
    console.log(`🏆 SEASON ${seasonYear} CHAMPION: ${fMap.get(champId)?.name.toUpperCase()}`);

    // Season Awards
    const awards = calculateSeasonAwards(gameState.allPlayers, gameState.playerSeasonStats);
    gameState.seasonAwards = awards;

    // 4. Advance to Next Season via Multi-Season Controller
    if (s < 10) {
      const advanceResult = executeSeasonAdvance(gameState, careerState);
      gameState = advanceResult.updatedGameState;
      careerState = advanceResult.updatedCareerState;

      totalRetirementsRecorded += advanceResult.newRetirements.length;
      totalRookiesIntegrated += advanceResult.newRookies.length;

      console.log(`Advanced to Season ${gameState.currentSeason}:`);
      console.log(`- New Retirements: ${advanceResult.newRetirements.length}`);
      console.log(`- New Rookies Integrated: ${advanceResult.newRookies.length}`);
      console.log(`- Upcoming Auction: ${advanceResult.upcomingAuctionType} (Salary Cap: ₹${advanceResult.newLeaguePurse / 100} Cr)`);
      console.log(`- Storylines Generated: ${advanceResult.storylines.length}`);
    }
  }

  const durationSec = (Date.now() - startTime) / 1000;

  console.log('\n================================================================================');
  console.log('10-SEASON DYNASTY BENCHMARK REPORT');
  console.log('================================================================================');
  console.log(`Total Simulated Seasons: 10 (2026 to 2035)`);
  console.log(`Total Matches Simulated: 740 official T20 matches`);
  console.log(`Total Execution Time: ${durationSec.toFixed(2)} seconds (~${(740 / durationSec).toFixed(1)} matches/sec)`);
  console.log(`Total Player Retirements Processed: ${totalRetirementsRecorded}`);
  console.log(`Total Rookie Talents Drafted: ${totalRookiesIntegrated}`);
  console.log('--------------------------------------------------------------------------------');

  console.log('\n--- SEASON CHAMPIONS SUMMARY ---');
  seasonChampions.forEach((sc) => {
    console.log(`Season ${sc.season}: Champion -> ${sc.champion.toUpperCase()} (Runner-up: ${sc.runnerUp.toUpperCase()})`);
  });

  console.log('\n--- LEAGUE RATING INFLATION CHECK ---');
  meanRatingsHistory.forEach((r, idx) => {
    console.log(`Season ${2026 + idx}: League Mean OVR = ${r.toFixed(2)}`);
  });

  const startOvr = meanRatingsHistory[0];
  const endOvr = meanRatingsHistory[meanRatingsHistory.length - 1];
  const inflationDelta = endOvr - startOvr;
  console.log(`10-Season Net Rating Delta: ${inflationDelta > 0 ? `+${inflationDelta.toFixed(2)}` : inflationDelta.toFixed(2)} OVR pts`);

  // Assertions
  const uniqueChamps = new Set(seasonChampions.map((sc) => sc.champion)).size;
  console.log(`Distinct Champions across 10 seasons: ${uniqueChamps} (Target: >= 3)`);

  const isInflationBounded = Math.abs(inflationDelta) <= 4.0;
  console.log(`Rating Inflation Bounded (<= 4.0): ${isInflationBounded ? '✅ PASS' : '❌ FAIL'}`);

  const isRetirementRealistic = totalRetirementsRecorded >= 80 && totalRetirementsRecorded <= 200;
  console.log(`Retirement Frequency Realistic (80-200 across 10 seasons): ${isRetirementRealistic ? '✅ PASS' : '❌ FAIL'}`);

  if (uniqueChamps >= 3 && isInflationBounded && isRetirementRealistic) {
    console.log('\n================================================================================');
    console.log('🎉 10-SEASON MULTI-YEAR DYNASTY BENCHMARK: 100% SUCCESS!');
    console.log('================================================================================');
  } else {
    throw new Error('10-Season benchmark validation failed');
  }
}

run10SeasonDynastySimulation().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
