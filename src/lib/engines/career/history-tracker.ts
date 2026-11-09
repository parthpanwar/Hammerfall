// ============================================================
// IPL DYNASTY - Franchise & Player Career History Tracker
// Preserves every season's full rosters, standings, team records,
// and player lifetime achievements across the entire dynasty.
// ============================================================

import type { Franchise, Player, StandingsEntry, SeasonAward, MatchResult, PlayerSeasonStats } from '@/lib/types/game';
import type { FranchiseCareerRecord, HistoricalSquadRoster, PlayerCareerRecord } from '@/lib/types/career';

/**
 * Initializes career history records for all franchises.
 */
export function initializeFranchiseHistory(franchises: Franchise[]): Record<string, FranchiseCareerRecord> {
  const history: Record<string, FranchiseCareerRecord> = {};

  for (const f of franchises) {
    history[f.id] = {
      franchiseId: f.id,
      championships: 0,
      finalsAppearances: 0,
      playoffAppearances: 0,
      allTimeWins: 0,
      allTimeLosses: 0,
      allTimeTies: 0,
      highestScore: { runs: 0, wickets: 0, againstFranchiseId: '', season: 0 },
      lowestScore: { runs: 999, wickets: 10, againstFranchiseId: '', season: 0 },
      recordPurchase: { playerId: '', playerName: '', priceLakhs: 0, season: 0 },
      seasonHistory: [],
      franchiseLegends: [],
    };
  }

  return history;
}

/**
 * Updates franchise career history records at the end of a completed IPL season.
 */
export function recordSeasonForFranchises(
  existingHistory: Record<string, FranchiseCareerRecord>,
  franchises: Franchise[],
  standings: StandingsEntry[],
  championId: string,
  runnerUpId: string,
  seasonYear: number,
  seasonStats: Record<string, PlayerSeasonStats>
): Record<string, FranchiseCareerRecord> {
  const updated = { ...existingHistory };

  for (const franchise of franchises) {
    const standing = standings.find((s) => s.franchiseId === franchise.id);
    const prev = updated[franchise.id] || {
      franchiseId: franchise.id,
      championships: 0,
      finalsAppearances: 0,
      playoffAppearances: 0,
      allTimeWins: 0,
      allTimeLosses: 0,
      allTimeTies: 0,
      highestScore: { runs: 0, wickets: 0, againstFranchiseId: '', season: 0 },
      lowestScore: { runs: 999, wickets: 10, againstFranchiseId: '', season: 0 },
      recordPurchase: { playerId: '', playerName: '', priceLakhs: 0, season: 0 },
      seasonHistory: [],
      franchiseLegends: [],
    };

    const isChamp = franchise.id === championId;
    const isRunner = franchise.id === runnerUpId;
    const isPlayoff = (standing?.position || 10) <= 4;

    const wins = standing?.won || 0;
    const losses = standing?.lost || 0;
    const ties = standing?.tied || 0;

    // Snapshot complete roster for this historical season
    const rosterSnapshot: HistoricalSquadRoster = {
      season: seasonYear,
      franchiseId: franchise.id,
      position: standing?.position || 10,
      wins,
      losses,
      nrr: standing?.netRunRate || 0,
      isChampion: isChamp,
      isRunnerUp: isRunner,
      captainPlayerId: franchise.players[0]?.id || '',
      playerIds: franchise.players.map((p) => p.id),
      playerSummaries: franchise.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        role: p.role,
        salaryLakhs: p.soldPrice || p.currentContractValue || p.basePrice,
        seasonRuns: seasonStats[p.id]?.runs || 0,
        seasonWickets: seasonStats[p.id]?.wickets || 0,
      })),
    };

    // Check for record purchases
    let recordPurchase = { ...prev.recordPurchase };
    for (const p of franchise.players) {
      const price = p.soldPrice || 0;
      if (price > recordPurchase.priceLakhs) {
        recordPurchase = {
          playerId: p.id,
          playerName: p.name,
          priceLakhs: price,
          season: seasonYear,
        };
      }
    }

    updated[franchise.id] = {
      ...prev,
      championships: prev.championships + (isChamp ? 1 : 0),
      finalsAppearances: prev.finalsAppearances + (isChamp || isRunner ? 1 : 0),
      playoffAppearances: prev.playoffAppearances + (isPlayoff ? 1 : 0),
      allTimeWins: prev.allTimeWins + wins,
      allTimeLosses: prev.allTimeLosses + losses,
      allTimeTies: prev.allTimeTies + ties,
      recordPurchase,
      seasonHistory: [...prev.seasonHistory, rosterSnapshot],
    };
  }

  return updated;
}

/**
 * Updates individual player lifetime career records after a season completes.
 */
export function recordSeasonForPlayers(
  existingRecords: Record<string, PlayerCareerRecord>,
  players: Player[],
  seasonStats: Record<string, PlayerSeasonStats>,
  seasonAwards: SeasonAward[],
  championId: string,
  seasonYear: number
): Record<string, PlayerCareerRecord> {
  const updatedRecords = { ...existingRecords };

  for (const player of players) {
    const stats = seasonStats[player.id];
    const prev = updatedRecords[player.id] || {
      playerId: player.id,
      playerName: player.name,
      isGenerated: player.id.startsWith('gen_'),
      debutSeason: seasonYear,
      careerMatches: player.stats.matches,
      careerRuns: player.stats.runs,
      careerWickets: player.stats.wickets,
      careerFifties: player.stats.fifties,
      careerHundreds: player.stats.hundreds,
      highScore: player.stats.highScore,
      bestBowling: player.stats.bestBowling,
      titlesWon: [],
      awardsWon: [],
      franchisesPlayedFor: player.currentFranchiseId ? [player.currentFranchiseId] : [],
      ratingsTimeline: [],
      auctionHistory: [],
      isRetired: false,
    };

    const isTitleWinner = player.currentFranchiseId === championId;
    const playerAwards = seasonAwards.filter((a) => a.playerId === player.id);

    const franchisesPlayed = new Set(prev.franchisesPlayedFor);
    if (player.currentFranchiseId) {
      franchisesPlayed.add(player.currentFranchiseId);
    }

    const simMatches = stats ? stats.matches : 0;
    const simRuns = stats ? stats.runs : 0;
    const simWickets = stats ? stats.wickets : 0;
    const simFifties = stats ? stats.fifties : 0;
    const simHundreds = stats ? stats.hundreds : 0;

    // Timeline entry
    const timelineEntry = {
      season: seasonYear,
      age: player.age,
      overall: player.ratings.overall,
      batting: player.ratings.batting,
      bowling: player.ratings.bowling,
      potential: player.ratings.potential,
    };

    updatedRecords[player.id] = {
      ...prev,
      careerMatches: prev.careerMatches + simMatches,
      careerRuns: prev.careerRuns + simRuns,
      careerWickets: prev.careerWickets + simWickets,
      careerFifties: prev.careerFifties + simFifties,
      careerHundreds: prev.careerHundreds + simHundreds,
      highScore: stats && stats.highScore > prev.highScore ? stats.highScore : prev.highScore,
      titlesWon: isTitleWinner && !prev.titlesWon.includes(seasonYear) ? [...prev.titlesWon, seasonYear] : prev.titlesWon,
      awardsWon: [...prev.awardsWon, ...playerAwards],
      franchisesPlayedFor: Array.from(franchisesPlayed),
      ratingsTimeline: [...prev.ratingsTimeline, timelineEntry],
    };
  }

  return updatedRecords;
}

