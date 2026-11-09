// ============================================================
// IPL DYNASTY - Tournament Engine
// Fixture generation, Points Table with NRR, Playoffs & Awards
// ============================================================

import type {
  Franchise,
  Player,
  Fixture,
  StandingsEntry,
  MatchResult,
  SeasonAward,
  PlayerSeasonStats,
} from '@/lib/types/game';

/** Generate standard IPL schedule: 14 matches per team across 70 league matches using official group format. */
export function generateIPLFixtures(franchises: Franchise[]): Fixture[] {
  const fixtures: Fixture[] = [];
  const teamIds = franchises.map((f) => f.id);
  const n = teamIds.length;

  if (n < 2) return [];

  // Official IPL 10-team structure (2 groups of 5)
  const groupA = ['mi', 'kkr', 'rr', 'dc', 'lsg'].filter((id) => teamIds.includes(id));
  const groupB = ['csk', 'srh', 'rcb', 'pbks', 'gt'].filter((id) => teamIds.includes(id));

  // If non-standard teams, fallback to round-robin
  if (groupA.length !== 5 || groupB.length !== 5) {
    let matchNum = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const h = franchises[i];
        const a = franchises[j];
        fixtures.push({
          id: `match-${matchNum}`,
          matchNumber: matchNum,
          team1Id: h.id,
          team2Id: a.id,
          venue: h.homeStadium,
          isCompleted: false,
          result: null,
          isPlayoff: false,
        });
        matchNum++;
      }
    }
    return fixtures;
  }

  // Designated cross-group rivals (played twice home & away)
  const crossGroupRivals: [string, string][] = [
    ['mi', 'csk'],
    ['kkr', 'rcb'],
    ['rr', 'pbks'],
    ['dc', 'srh'],
    ['lsg', 'gt'],
  ];

  const matchPairs: [string, string][] = [];

  // 1. Group A home and away (each pair twice: 10 * 2 = 20)
  for (let i = 0; i < groupA.length; i++) {
    for (let j = i + 1; j < groupA.length; j++) {
      matchPairs.push([groupA[i], groupA[j]]);
      matchPairs.push([groupA[j], groupA[i]]);
    }
  }

  // 2. Group B home and away (each pair twice: 10 * 2 = 20)
  for (let i = 0; i < groupB.length; i++) {
    for (let j = i + 1; j < groupB.length; j++) {
      matchPairs.push([groupB[i], groupB[j]]);
      matchPairs.push([groupB[j], groupB[i]]);
    }
  }

  // 3. Cross-group rivals home and away (5 * 2 = 10)
  for (const [a, b] of crossGroupRivals) {
    matchPairs.push([a, b]);
    matchPairs.push([b, a]);
  }

  // 4. Other cross-group pairs once (20 matches)
  for (const a of groupA) {
    for (const b of groupB) {
      if (!crossGroupRivals.some(([rA, rB]) => (rA === a && rB === b) || (rA === b && rB === a))) {
        matchPairs.push([a, b]);
      }
    }
  }

  // Create Fixtures
  for (let m = 0; m < matchPairs.length; m++) {
    const [hId, aId] = matchPairs[m];
    const homeTeam = franchises.find((f) => f.id === hId)!;
    const awayTeam = franchises.find((f) => f.id === aId)!;
    fixtures.push({
      id: `match-${m + 1}`,
      matchNumber: m + 1,
      team1Id: homeTeam.id,
      team2Id: awayTeam.id,
      venue: homeTeam.homeStadium,
      isCompleted: false,
      result: null,
      isPlayoff: false,
    });
  }

  return fixtures;
}

/** Initialize empty standings table for all franchises. */
export function initializeStandings(franchises: Franchise[]): StandingsEntry[] {
  return franchises.map((f, idx) => ({
    franchiseId: f.id,
    position: idx + 1,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    netRunRate: 0.0,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
    isQualified: false,
  }));
}

/** Recalculate standings table given all completed fixtures. */
export function calculateStandings(
  franchises: Franchise[],
  fixtures: Fixture[]
): StandingsEntry[] {
  const standingsMap = new Map<string, StandingsEntry>();

  for (const f of franchises) {
    standingsMap.set(f.id, {
      franchiseId: f.id,
      position: 1,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      netRunRate: 0.0,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
      isQualified: false,
    });
  }

  // Process completed league matches only (exclude playoffs from league table)
  const completedLeague = fixtures.filter((f) => f.isCompleted && f.result && !f.isPlayoff);

  for (const match of completedLeague) {
    const res = match.result;
    if (!res) continue;

    const t1 = standingsMap.get(res.team1Id);
    const t2 = standingsMap.get(res.team2Id);
    if (!t1 || !t2) continue;

    t1.played++;
    t2.played++;

    // Points and W/L
    if (res.winnerId === t1.franchiseId) {
      t1.won++;
      t1.points += 2;
      t2.lost++;
    } else if (res.winnerId === t2.franchiseId) {
      t2.won++;
      t2.points += 2;
      t1.lost++;
    } else {
      t1.tied++;
      t2.tied++;
      t1.points += 1;
      t2.points += 1;
    }

    // Runs and Overs calculation for NRR
    // In T20, if a team is all out, their overs faced are counted as full 20.0 overs
    const t1OversFaced = res.team1Score.wickets >= 10 ? 20.0 : Math.min(20, res.team1Score.overs + res.team1Score.balls / 6);
    const t2OversFaced = res.team2Score.wickets >= 10 ? 20.0 : Math.min(20, res.team2Score.overs + res.team2Score.balls / 6);

    t1.runsScored += res.team1Score.runs;
    t1.oversFaced += t1OversFaced;
    t1.runsConceded += res.team2Score.runs;
    t1.oversBowled += t2OversFaced;

    t2.runsScored += res.team2Score.runs;
    t2.oversFaced += t2OversFaced;
    t2.runsConceded += res.team1Score.runs;
    t2.oversBowled += t1OversFaced;
  }

  // Calculate NRR for each team
  const entries = Array.from(standingsMap.values());
  for (const entry of entries) {
    if (entry.oversFaced > 0 && entry.oversBowled > 0) {
      const runRateFor = entry.runsScored / entry.oversFaced;
      const runRateAgainst = entry.runsConceded / entry.oversBowled;
      entry.netRunRate = Math.round((runRateFor - runRateAgainst) * 1000) / 1000;
    } else {
      entry.netRunRate = 0.0;
    }
  }

  // Sort by Points DESC, then NRR DESC, then Runs Scored DESC
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate;
    return b.runsScored - a.runsScored;
  });

  // Assign positions & check qualification (top 4 if season is far along)
  const isSeasonEnding = completedLeague.length >= 60;
  entries.forEach((e, idx) => {
    e.position = idx + 1;
    e.isQualified = isSeasonEnding && idx < 4;
  });

  return entries;
}

/** Generate the standard IPL Playoff fixtures based on final regular season standings. */
export function generatePlayoffFixtures(standings: StandingsEntry[]): Fixture[] {
  if (standings.length < 4) return [];

  const top1 = standings[0].franchiseId;
  const top2 = standings[1].franchiseId;
  const top3 = standings[2].franchiseId;
  const top4 = standings[3].franchiseId;

  return [
    {
      id: 'playoff-q1',
      matchNumber: 71,
      team1Id: top1,
      team2Id: top2,
      venue: 'Narendra Modi Stadium, Ahmedabad',
      isCompleted: false,
      result: null,
      isPlayoff: true,
      playoffType: 'Qualifier1',
    },
    {
      id: 'playoff-elim',
      matchNumber: 72,
      team1Id: top3,
      team2Id: top4,
      venue: 'Narendra Modi Stadium, Ahmedabad',
      isCompleted: false,
      result: null,
      isPlayoff: true,
      playoffType: 'Eliminator',
    },
  ];
}

/** Calculate post-season awards: Orange Cap, Purple Cap, MVP, Emerging Player. */
export function calculateSeasonAwards(
  players: Player[],
  stats: Record<string, PlayerSeasonStats>
): SeasonAward[] {
  const awards: SeasonAward[] = [];
  const statList = Object.values(stats);

  if (statList.length === 0) return awards;

  // 1. Orange Cap (Most Runs)
  const topRunScorer = [...statList].sort((a, b) => b.runs - a.runs)[0];
  if (topRunScorer && topRunScorer.runs > 0) {
    const player = players.find((p) => p.id === topRunScorer.playerId);
    awards.push({
      type: 'OrangeCap',
      playerId: topRunScorer.playerId,
      playerName: player?.name || topRunScorer.playerId,
      franchiseId: topRunScorer.franchiseId,
      value: topRunScorer.runs,
    });
  }

  // 2. Purple Cap (Most Wickets)
  const topWicketTaker = [...statList].sort((a, b) => b.wickets - a.wickets)[0];
  if (topWicketTaker && topWicketTaker.wickets > 0) {
    const player = players.find((p) => p.id === topWicketTaker.playerId);
    awards.push({
      type: 'PurpleCap',
      playerId: topWicketTaker.playerId,
      playerName: player?.name || topWicketTaker.playerId,
      franchiseId: topWicketTaker.franchiseId,
      value: topWicketTaker.wickets,
    });
  }

  // 3. MVP (Combined Impact Score)
  const mvpCandidate = [...statList].sort((a, b) => {
    const scoreA = a.runs * 1.0 + a.sixes * 2.0 + a.wickets * 20.0 + a.catches * 5.0;
    const scoreB = b.runs * 1.0 + b.sixes * 2.0 + b.wickets * 20.0 + b.catches * 5.0;
    return scoreB - scoreA;
  })[0];

  if (mvpCandidate) {
    const player = players.find((p) => p.id === mvpCandidate.playerId);
    const impactVal = Math.round(mvpCandidate.runs + mvpCandidate.wickets * 20);
    awards.push({
      type: 'MVP',
      playerId: mvpCandidate.playerId,
      playerName: player?.name || mvpCandidate.playerId,
      franchiseId: mvpCandidate.franchiseId,
      value: impactVal,
    });
  }

  // 4. Emerging Player (Young uncapped Indian player with best performance)
  const youngTalent = statList.filter((s) => {
    const p = players.find((pl) => pl.id === s.playerId);
    return p && p.nationality === 'Indian' && p.age <= 25;
  });

  if (youngTalent.length > 0) {
    const bestYoung = youngTalent.sort((a, b) => (b.runs + b.wickets * 20) - (a.runs + a.wickets * 20))[0];
    const player = players.find((p) => p.id === bestYoung.playerId);
    awards.push({
      type: 'EmergingPlayer',
      playerId: bestYoung.playerId,
      playerName: player?.name || bestYoung.playerId,
      franchiseId: bestYoung.franchiseId,
      value: bestYoung.runs + bestYoung.wickets * 20,
    });
  }

  return awards;
}

