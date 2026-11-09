// ============================================================
// IPL DYNASTY - Dynamic League Storylines Generator
// Procedurally generates authentic media headlines and storylines
// grounded strictly in verified simulated match, tournament, and career facts.
// ============================================================

import type { Franchise, Player, StandingsEntry, SeasonAward, PlayerSeasonStats } from '@/lib/types/game';
import type { LeagueStoryline, FranchiseCareerRecord, RetirementRecord } from '@/lib/types/career';

/**
 * Generates verified league storylines following a completed season.
 */
export function generateSeasonStorylines(
  seasonYear: number,
  franchises: Franchise[],
  standings: StandingsEntry[],
  seasonAwards: SeasonAward[],
  seasonStats: Record<string, PlayerSeasonStats>,
  players: Player[],
  championId: string,
  runnerUpId: string,
  franchiseHistory: Record<string, FranchiseCareerRecord>,
  retirements: RetirementRecord[]
): LeagueStoryline[] {
  const storylines: LeagueStoryline[] = [];
  const champ = franchises.find((f) => f.id === championId);
  const runner = franchises.find((f) => f.id === runnerUpId);
  const champHistory = franchiseHistory[championId];

  // 1. Championship Storyline
  if (champ && runner) {
    const titles = champHistory ? champHistory.championships + 1 : 1;
    let headline = '';
    let summary = '';

    if (titles === 1) {
      headline = `${champ.name.toUpperCase()} CROWNED FIRST-TIME IPL CHAMPIONS!`;
      summary = `History made in Season ${seasonYear} as ${champ.name} lift their maiden IPL trophy after defeating ${runner.name} in an unforgettable Grand Final.`;
    } else {
      headline = `${champ.name.toUpperCase()} REIGN SUPREME: CLAIM TITLE NUMBER ${titles}!`;
      summary = `${champ.name} reinforce their dynasty status, triumphing over ${runner.name} in the IPL ${seasonYear} Championship Final.`;
    }

    storylines.push({
      id: `story_${seasonYear}_champ`,
      season: seasonYear,
      headline,
      summary,
      category: 'Championship',
      involvedPlayerIds: [],
      involvedFranchiseIds: [championId, runnerUpId],
      timestamp: Date.now(),
    });
  }

  // 2. Breakout Youngster Storyline
  const youngPerformers = players.filter((p) => {
    const stats = seasonStats[p.id];
    return p.age <= 23 && stats && (stats.runs >= 400 || stats.wickets >= 14);
  });

  if (youngPerformers.length > 0) {
    const topYoungster = youngPerformers.sort((a, b) => {
      const statsA = seasonStats[a.id];
      const statsB = seasonStats[b.id];
      const scoreA = (statsA?.runs || 0) + (statsA?.wickets || 0) * 20;
      const scoreB = (statsB?.runs || 0) + (statsB?.wickets || 0) * 20;
      return scoreB - scoreA;
    })[0];

    const stats = seasonStats[topYoungster.id]!;
    const f = franchises.find((fr) => fr.id === topYoungster.currentFranchiseId);

    const headline = `BREAKTHROUGH STAR: ${topYoungster.name.toUpperCase()} (AGE ${topYoungster.age}) STUNS THE IPL`;
    const summary = `${topYoungster.name} announces himself on the global stage with an electric season for ${f?.name || 'his team'}, racking up ${stats.runs > 0 ? `${stats.runs} runs` : ''}${stats.runs > 0 && stats.wickets > 0 ? ' and ' : ''}${stats.wickets > 0 ? `${stats.wickets} wickets` : ''}.`;

    storylines.push({
      id: `story_${seasonYear}_breakout`,
      season: seasonYear,
      headline,
      summary,
      category: 'Breakout',
      involvedPlayerIds: [topYoungster.id],
      involvedFranchiseIds: topYoungster.currentFranchiseId ? [topYoungster.currentFranchiseId] : [],
      timestamp: Date.now(),
    });
  }

  // 3. Veteran Defying Father Time Storyline
  const eliteVeterans = players.filter((p) => {
    const stats = seasonStats[p.id];
    return p.age >= 36 && stats && (stats.runs >= 450 || stats.wickets >= 16);
  });

  if (eliteVeterans.length > 0) {
    const vet = eliteVeterans[0];
    const stats = seasonStats[vet.id]!;
    const f = franchises.find((fr) => fr.id === vet.currentFranchiseId);

    const headline = `AGELESS MASTER: ${vet.name.toUpperCase()} (AGE ${vet.age}) ROLLS BACK THE YEARS`;

    storylines.push({
      id: `story_${seasonYear}_veteran`,
      season: seasonYear,
      headline,
      summary: `At ${vet.age} years of age, ${vet.name} rolled back the years with a masterclass campaign for ${f?.shortName || 'his side'}, proving class is permanent.`,
      category: 'VeteranForm',
      involvedPlayerIds: [vet.id],
      involvedFranchiseIds: vet.currentFranchiseId ? [vet.currentFranchiseId] : [],
      timestamp: Date.now(),
    });
  }

  // 4. Wooden Spoon Rebuild Storyline
  const lastPlace = standings.find((s) => s.position === 10);
  if (lastPlace) {
    const woodenSpoonTeam = franchises.find((f) => f.id === lastPlace.franchiseId);
    if (woodenSpoonTeam) {
      storylines.push({
        id: `story_${seasonYear}_rebuild`,
        season: seasonYear,
        headline: `INSPECTION & OVERHAUL: ${woodenSpoonTeam.name.toUpperCase()} ENTER SQUAD REBUILD`,
        summary: `Following a difficult 10th-place campaign (${lastPlace.won} wins, ${lastPlace.lost} losses), ${woodenSpoonTeam.name} management vows sweeping changes heading into the upcoming auction.`,
        category: 'Rebuild',
        involvedPlayerIds: [],
        involvedFranchiseIds: [woodenSpoonTeam.id],
        timestamp: Date.now(),
      });
    }
  }

  // 5. High-Profile Retirement Storyline
  const hallOfFameRetirements = retirements.filter((r) => r.hallOfFame);
  if (hallOfFameRetirements.length > 0) {
    const legend = hallOfFameRetirements[0];
    storylines.push({
      id: `story_${seasonYear}_farewell`,
      season: seasonYear,
      headline: `END OF AN ERA: ${legend.playerName.toUpperCase()} CALLS TIME ON LEGENDARY CAREER`,
      summary: `Cricket bids farewell to an icon as ${legend.playerName} announces retirement after ${legend.careerMatches} matches, ${legend.careerRuns} career runs, and ${legend.careerWickets} wickets.`,
      category: 'Retirement',
      involvedPlayerIds: [legend.playerId],
      involvedFranchiseIds: [legend.lastFranchiseId],
      timestamp: Date.now(),
    });
  }

  return storylines;
}
