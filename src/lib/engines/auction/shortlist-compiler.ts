// ============================================================
// IPL DYNASTY - Final Auction Pool Compiler & Set Generator
// Compiles franchise shortlists, scores player demand, enforces role and
// nationality diversity, and organizes the final 400–600 players into official auction sets.
// ============================================================

import type { RegisteredPlayer } from '@/lib/types/registration';
import type { FranchiseShortlist } from '@/lib/types/scouting';

export interface AuctionSetDefinition {
  code: string;
  name: string;
  category: 'Marquee' | 'Capped' | 'Uncapped' | 'Accelerated';
  role?: string;
  order: number;
}

export const OFFICIAL_AUCTION_SETS: AuctionSetDefinition[] = [
  { code: 'M1', name: 'Marquee Players Set 1', category: 'Marquee', order: 1 },
  { code: 'M2', name: 'Marquee Players Set 2', category: 'Marquee', order: 2 },
  { code: 'BA1', name: 'Capped Batters Set 1', category: 'Capped', role: 'Batter', order: 3 },
  { code: 'AL1', name: 'Capped All-Rounders Set 1', category: 'Capped', role: 'All-Rounder', order: 4 },
  { code: 'WK1', name: 'Capped Wicketkeepers Set 1', category: 'Capped', role: 'Wicketkeeper', order: 5 },
  { code: 'FA1', name: 'Capped Fast Bowlers Set 1', category: 'Capped', role: 'Bowler', order: 6 },
  { code: 'SP1', name: 'Capped Spinners Set 1', category: 'Capped', role: 'Bowler', order: 7 },
  { code: 'UBA1', name: 'Uncapped Batters Set 1', category: 'Uncapped', role: 'Batter', order: 8 },
  { code: 'UAL1', name: 'Uncapped All-Rounders Set 1', category: 'Uncapped', role: 'All-Rounder', order: 9 },
  { code: 'UWK1', name: 'Uncapped Wicketkeepers Set 1', category: 'Uncapped', role: 'Wicketkeeper', order: 10 },
  { code: 'UFA1', name: 'Uncapped Fast Bowlers Set 1', category: 'Uncapped', role: 'Bowler', order: 11 },
  { code: 'USP1', name: 'Uncapped Spinners Set 1', category: 'Uncapped', role: 'Bowler', order: 12 },
  { code: 'BA2', name: 'Capped Batters Set 2', category: 'Capped', role: 'Batter', order: 13 },
  { code: 'AL2', name: 'Capped All-Rounders Set 2', category: 'Capped', role: 'All-Rounder', order: 14 },
  { code: 'FA2', name: 'Capped Fast Bowlers Set 2', category: 'Capped', role: 'Bowler', order: 15 },
  { code: 'SP2', name: 'Capped Spinners Set 2', category: 'Capped', role: 'Bowler', order: 16 },
  { code: 'UBA2', name: 'Uncapped Batters Set 2', category: 'Uncapped', role: 'Batter', order: 17 },
  { code: 'UAL2', name: 'Uncapped All-Rounders Set 2', category: 'Uncapped', role: 'All-Rounder', order: 18 },
  { code: 'UFA2', name: 'Uncapped Fast Bowlers Set 2', category: 'Uncapped', role: 'Bowler', order: 19 },
  { code: 'ACCEL', name: 'Accelerated Auction Pool', category: 'Accelerated', order: 20 },
];

export interface CompilationResult {
  finalAuctionPool: RegisteredPlayer[];
  auctionSets: Record<string, RegisteredPlayer[]>;
  totalShortlisted: number;
  indianCount: number;
  overseasCount: number;
  cappedCount: number;
  uncappedCount: number;
}

/**
 * Compiles all franchise shortlists into the final official auction pool.
 */
export function compileFinalAuctionPool(
  registrationPool: RegisteredPlayer[],
  shortlists: Record<string, FranchiseShortlist>,
  targetPoolSize: number = 500
): CompilationResult {
  // 1. Calculate franchise demand score for each registered player
  const playerDemandMap: Record<string, { count: number; franchises: string[]; score: number }> = {};

  for (const p of registrationPool) {
    playerDemandMap[p.id] = { count: 0, franchises: [], score: 0 };
  }

  for (const [franchiseId, shortlist] of Object.entries(shortlists)) {
    for (const [playerId, entry] of Object.entries(shortlist.entries)) {
      if (!playerDemandMap[playerId]) {
        playerDemandMap[playerId] = { count: 0, franchises: [], score: 0 };
      }
      playerDemandMap[playerId].count++;
      playerDemandMap[playerId].franchises.push(franchiseId);

      // Score weight by priority
      let weight = 1;
      if (entry.priority === 'PriorityA') weight = 4;
      else if (entry.priority === 'PriorityB') weight = 2.5;
      else if (entry.priority === 'PriorityC') weight = 1.5;
      playerDemandMap[playerId].score += weight;
    }
  }

  // 2. Score and sort candidates
  const scoredCandidates = registrationPool.map((p) => {
    const demand = playerDemandMap[p.id] || { count: 0, franchises: [], score: 0 };
    // Base composite score: franchise interest + overall rating + scarcity
    let compositeScore = demand.score * 10.0 + p.ratings.overall * 0.5;

    // Guaranteed inclusion for high-profile stars
    if (p.ratings.overall >= 84 || demand.count >= 2) {
      compositeScore += 100;
    }

    return {
      player: {
        ...p,
        shortlistCount: demand.count,
        shortlistedBy: demand.franchises,
      },
      compositeScore,
    };
  });

  scoredCandidates.sort((a, b) => b.compositeScore - a.compositeScore);

  // 3. Select top candidates respecting Indian/Overseas balance
  // Target: ~55-60% Indian players to guarantee minimum domestic squad requirements (at least 10-17 Indians/squad)
  const selectedPlayers: RegisteredPlayer[] = [];
  const selectedIds = new Set<string>();

  const maxOverseasInPool = Math.round(targetPoolSize * 0.42); // at most ~42% overseas
  let overseasSelected = 0;

  for (const item of scoredCandidates) {
    if (selectedPlayers.length >= targetPoolSize) break;
    const p = item.player;

    if (p.nationality === 'Overseas' && overseasSelected >= maxOverseasInPool) {
      continue; // Skip excess overseas to preserve domestic depth
    }

    p.finalShortlistSelected = true;
    selectedPlayers.push(p);
    selectedIds.add(p.id);
    if (p.nationality === 'Overseas') overseasSelected++;
  }

  // If still below targetPoolSize, fill with remaining domestic players
  if (selectedPlayers.length < targetPoolSize) {
    for (const item of scoredCandidates) {
      if (selectedPlayers.length >= targetPoolSize) break;
      const p = item.player;
      if (!selectedIds.has(p.id)) {
        p.finalShortlistSelected = true;
        selectedPlayers.push(p);
        selectedIds.add(p.id);
      }
    }
  }

  // 4. Assign Official Auction Sets
  const sets: Record<string, RegisteredPlayer[]> = {};
  for (const setDef of OFFICIAL_AUCTION_SETS) {
    sets[setDef.code] = [];
  }

  // Separate candidates for sets
  const marqueeCandidates = selectedPlayers
    .filter((p) => p.status === 'Capped' && (p.ratings.overall >= 86 || p.basePrice === 200))
    .sort((a, b) => b.ratings.overall - a.ratings.overall);

  const assignedSetPlayers = new Set<string>();

  // Marquee Set 1 (Top 6 superstars)
  for (let i = 0; i < 6 && i < marqueeCandidates.length; i++) {
    const p = marqueeCandidates[i];
    p.auctionSet = 'M1';
    sets['M1'].push(p);
    assignedSetPlayers.add(p.id);
  }

  // Marquee Set 2 (Next 6 marquee stars)
  for (let i = 6; i < 12 && i < marqueeCandidates.length; i++) {
    const p = marqueeCandidates[i];
    p.auctionSet = 'M2';
    sets['M2'].push(p);
    assignedSetPlayers.add(p.id);
  }

  // Assign remaining players to role sets
  for (const p of selectedPlayers) {
    if (assignedSetPlayers.has(p.id)) continue;

    const isCapped = p.status === 'Capped';
    const isSpinner = p.isSpinner;
    const isPacer = p.role === 'Bowler' && !p.isSpinner;

    let targetSet = 'ACCEL';

    if (isCapped) {
      if (p.role === 'Batter') {
        targetSet = sets['BA1'].length < 10 ? 'BA1' : 'BA2';
      } else if (p.role === 'All-Rounder') {
        targetSet = sets['AL1'].length < 10 ? 'AL1' : 'AL2';
      } else if (p.role === 'Wicketkeeper') {
        targetSet = sets['WK1'].length < 8 ? 'WK1' : 'ACCEL';
      } else if (isPacer) {
        targetSet = sets['FA1'].length < 10 ? 'FA1' : 'FA2';
      } else if (isSpinner) {
        targetSet = sets['SP1'].length < 10 ? 'SP1' : 'SP2';
      }
    } else {
      // Uncapped sets
      if (p.role === 'Batter') {
        targetSet = sets['UBA1'].length < 10 ? 'UBA1' : 'UBA2';
      } else if (p.role === 'All-Rounder') {
        targetSet = sets['UAL1'].length < 10 ? 'UAL1' : 'UAL2';
      } else if (p.role === 'Wicketkeeper') {
        targetSet = sets['UWK1'].length < 8 ? 'UWK1' : 'ACCEL';
      } else if (isPacer) {
        targetSet = sets['UFA1'].length < 10 ? 'UFA1' : 'UFA2';
      } else if (isSpinner) {
        targetSet = sets['USP1'].length < 10 ? 'USP1' : 'ACCEL';
      }
    }

    if (!sets[targetSet]) {
      targetSet = 'ACCEL';
    }

    p.auctionSet = targetSet;
    sets[targetSet].push(p);
    assignedSetPlayers.add(p.id);
  }

  // 5. Final order assignment across sets
  let orderIndex = 1;
  const orderedPool: RegisteredPlayer[] = [];

  for (const setDef of OFFICIAL_AUCTION_SETS) {
    const setList = sets[setDef.code];
    // Sort within set by overall rating descending
    setList.sort((a, b) => b.ratings.overall - a.ratings.overall);
    for (const p of setList) {
      p.auctionOrder = orderIndex++;
      orderedPool.push(p);
    }
  }

  const indianCount = orderedPool.filter((p) => p.nationality === 'Indian').length;
  const overseasCount = orderedPool.filter((p) => p.nationality === 'Overseas').length;
  const cappedCount = orderedPool.filter((p) => p.status === 'Capped').length;
  const uncappedCount = orderedPool.filter((p) => p.status === 'Uncapped').length;

  return {
    finalAuctionPool: orderedPool,
    auctionSets: sets,
    totalShortlisted: orderedPool.length,
    indianCount,
    overseasCount,
    cappedCount,
    uncappedCount,
  };
}
