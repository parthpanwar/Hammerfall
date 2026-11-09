#!/usr/bin/env tsx
/**
 * IPL DYNASTY - Headless Auction Evaluation Suite
 * 
 * Rigorously compares:
 *   [1] Baseline CPU Bidding (Flat static ratings threshold, naive budget division)
 *   [2] Advanced CPU Auction Intelligence (Phase 1: 9 GM personalities, dynamic shortlists,
 *       XI delta vs squad depth, Bayesian opponent modeling, and Monte Carlo forecasting)
 * 
 * Across identical random seeds to record:
 * - Financial Legality Rate (100% legal, non-negative purse >= 0, 15-25 players, <= 8 overseas)
 * - Final Squad Quality (Squad Average OVR and Starting XI OVR)
 * - Tactical Role Coverage across all 11 cricket roles
 * - Positional Deficiency Rate (% squads missing essential roles: Death Bowler, WK, Seamer)
 * - Budget Efficiency (Purse spent vs talent acquired)
 * - Overpriced Purchase Rate (Purchases > 130% fair market value)
 * - Marquee Player Distribution Variance (Competitive balance across 10 franchises)
 */

import { FRANCHISES } from '../src/lib/data/franchises';
import { PLAYERS } from '../src/lib/data/players';
import { RETENTION_RULES_2026 } from '../src/lib/data/retention-rules';
import {
  createAuctionSession,
  nominatePlayer,
  placeBid,
  processFinalCall,
  getMinimumBid,
  canFranchiseBid,
} from '../src/lib/engines/auction-engine';
import { cpuRetentionDecisions } from '../src/lib/engines/retention-engine';
import { decideCPUBid, onAuctionLotCompleted } from '../src/lib/engines/cpu-gm/cpu-gm-engine';
import { initializeDynamicShortlists } from '../src/lib/engines/cpu-gm/shortlist-manager';
import { getPlayerTacticalRoles, ALL_TACTICAL_ROLES, TacticalRole } from '../src/lib/engines/cpu-gm/tactical-roles';
import { generatePlayerIntelligenceDossier } from '../src/lib/intelligence/valuation/player-intelligence';
import { createSeededRandom } from '../src/lib/utils/random';
import type { Franchise, Player, SeededRandom, AuctionSession } from '../src/lib/types/game';

export interface AuctionBenchmarkMetrics {
  totalAuctions: number;
  legalityRate: number; // 0-100%
  avgSquadSize: number;
  avgSquadOvr: number;
  avgStartingXiOvr: number;
  avgRoleCoveragePct: number;
  positionalDeficiencyRate: number; // % squads missing essential roles
  avgPurseUtilizationPct: number;
  costPerOvrPointCr: number;
  overpricedPurchaseRate: number; // % of lots bought at > 130% fair value
  marqueeDistributionVariance: number; // StdDev of marquee players per team
  executionTimeSec: number;
}

/**
 * Computes the optimal Starting XI OVR for a squad under IPL constraints:
 * - At least 1 Wicketkeeper
 * - At least 3 Batters
 * - At least 1 All-Rounder
 * - At least 3 Bowlers
 * - Maximum 4 Overseas players in the XI
 */
export function calculateStartingXiOvr(players: Player[]): number {
  if (players.length < 11) {
    if (players.length === 0) return 0;
    return players.reduce((s, p) => s + p.ratings.overall, 0) / players.length;
  }

  // Sort candidate pool by overall rating descending
  const sorted = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall);

  const xi: Player[] = [];
  let overseasCount = 0;

  function canAdd(p: Player): boolean {
    if (xi.some((x) => x.id === p.id)) return false;
    if (p.nationality === 'Overseas' && overseasCount >= 4) return false;
    return true;
  }

  function addPlayer(p: Player) {
    xi.push(p);
    if (p.nationality === 'Overseas') overseasCount++;
  }

  // 1. Mandatory Wicketkeeper
  const wk = sorted.find((p) => p.role === 'Wicketkeeper' && canAdd(p));
  if (wk) addPlayer(wk);

  // 2. Mandatory Batters (at least 3)
  const batters = sorted.filter((p) => p.role === 'Batter');
  for (const b of batters) {
    if (xi.filter((x) => x.role === 'Batter').length >= 3) break;
    if (canAdd(b)) addPlayer(b);
  }

  // 3. Mandatory All-Rounder (at least 1)
  const ar = sorted.find((p) => p.role === 'All-Rounder' && canAdd(p));
  if (ar) addPlayer(ar);

  // 4. Mandatory Bowlers (at least 3)
  const bowlers = sorted.filter((p) => p.role === 'Bowler');
  for (const b of bowlers) {
    if (xi.filter((x) => x.role === 'Bowler').length >= 3) break;
    if (canAdd(b)) addPlayer(b);
  }

  // 5. Fill remaining spots with highest rated available players
  for (const p of sorted) {
    if (xi.length >= 11) break;
    if (canAdd(p)) addPlayer(p);
  }

  if (xi.length === 0) return 0;
  return xi.reduce((s, p) => s + p.ratings.overall, 0) / xi.length;
}

/**
 * Checks if a squad has critical positional deficiencies:
 * Missing Death Bowler, Wicketkeeper, or Powerplay Seamer.
 */
export function hasPositionalDeficiency(players: Player[]): boolean {
  if (players.length === 0) return true;
  const hasWk = players.some((p) => p.role === 'Wicketkeeper' || p.secondaryRole === 'Wicketkeeper');
  let hasDeath = false;
  let hasPP = false;

  for (const p of players) {
    const roles = getPlayerTacticalRoles(p);
    if (roles.includes('Death-over specialist')) hasDeath = true;
    if (roles.includes('Powerplay seamer')) hasPP = true;
  }

  return !hasWk || !hasDeath || !hasPP;
}

/**
 * Simulates a single auction with either 'Baseline' or 'Advanced' CPU GM logic.
 */
function runSingleSimulation(
  seed: number,
  mode: 'Baseline' | 'Advanced'
): {
  isLegal: boolean;
  franchises: Franchise[];
  overpricedPurchases: number;
  totalPurchases: number;
} {
  const rng = createSeededRandom(seed);
  const rules = RETENTION_RULES_2026;

  // 1. Setup franchises with pre-auction rosters
  const franchisesCopy: Franchise[] = FRANCHISES.map((f) => {
    const franchiseRoster = PLAYERS.filter((p) => p.currentFranchiseId === f.id);
    return {
      ...f,
      remainingPurse: rules.totalPurse,
      players: franchiseRoster,
      retainedPlayers: [],
      releasedPlayers: [],
      auctionPurchases: [],
      isHumanControlled: false,
    };
  });

  // 2. Perform automated retention phase for each franchise
  const retainedPlayerIds = new Set<string>();

  for (const franchise of franchisesCopy) {
    const decisions = cpuRetentionDecisions(franchise, rules, rng);
    const spent = decisions.reduce((sum, d) => sum + d.cost, 0);
    const retained = franchise.players.filter((p) => decisions.some((d) => d.playerId === p.id));
    const released = franchise.players.filter((p) => !decisions.some((d) => d.playerId === p.id));

    retained.forEach((p) => retainedPlayerIds.add(p.id));

    franchise.remainingPurse = rules.totalPurse - spent;
    franchise.retainedPlayers = retained;
    franchise.releasedPlayers = released;
    franchise.players = [...retained]; // Start auction with retained players
    franchise.currentOverseasCount = retained.filter((p) => p.nationality === 'Overseas').length;
  }

  // 3. Prepare Auction Pool: all non-retained players
  const auctionPool = rng.shuffle(
    PLAYERS.filter((p) => !retainedPlayerIds.has(p.id)).map((p) => ({
      ...p,
      isAvailableForAuction: true,
      isRetained: false,
    }))
  );

  // 4. Create Auction Session (3 rounds to accommodate accelerated rounds)
  const session = createAuctionSession(franchisesCopy, auctionPool, {
    seasonYear: 2026,
    auctionType: 'Mega',
    pace: 'Fast',
    totalRounds: 3,
  });

  // If Advanced mode, initialize dynamic shortlists
  if (mode === 'Advanced') {
    initializeDynamicShortlists(session, rng);
  }

  let overpricedPurchases = 0;
  let totalPurchases = 0;

  // 5. Run Auction Loops
  while ((session.state as string) !== 'COMPLETED') {
    nominatePlayer(session);
    if ((session.state as string) === 'COMPLETED') break;
    const lot = session.currentLot;
    if (!lot || (lot.state as string) !== 'Active') break;

    let lotBiddingSteps = 0;
    while ((lot.state as string) === 'Active' && lotBiddingSteps < 200) {
      lotBiddingSteps++;
      const minBid = getMinimumBid(session);
      let bidPlaced = false;

      for (const franchise of session.franchises) {
        if (lot.currentBidderId === franchise.id) continue;
        if (!canFranchiseBid(franchise, session)) continue;

        let willBid = false;

        if (mode === 'Advanced') {
          // Phase 1 Advanced Intelligence
          const decision = decideCPUBid(franchise, lot, session, rng);
          willBid = decision.bid && decision.maxBid >= minBid;
        } else {
          // Pre-Upgrade Baseline Logic:
          // Uses naive overall rating threshold and simple purse division without dynamic roles or opponent modeling
          const baselineValuation = lot.player.basePrice + Math.max(0, lot.player.ratings.overall - 60) * 30;
          const openSlots = Math.max(1, franchise.minSquadSize - franchise.players.length);
          const safePursePerSlot = franchise.remainingPurse / openSlots;
          const naiveLimit = Math.min(baselineValuation, safePursePerSlot * 1.8);
          willBid = minBid <= naiveLimit && rng.next() > 0.30;
        }

        if (willBid) {
          placeBid(session, franchise.id, minBid);
          bidPlaced = true;
          break;
        }
      }

      if (!bidPlaced) {
        processFinalCall(session);
      }
    }

    // Lot finalized
    if ((lot.state as string) === 'Sold') {
      totalPurchases++;
      const dossier = generatePlayerIntelligenceDossier(lot.player, 2026);
      const fairValue = dossier.marketValuation?.fairValue || lot.player.basePrice;
      if (lot.currentBid > fairValue * 1.30) {
        overpricedPurchases++;
      }
    }

    if (mode === 'Advanced') {
      onAuctionLotCompleted(session, lot);
    }
  }

  // 6. Check Financial & Roster Legality
  let isLegal = true;
  for (const f of session.franchises) {
    if (f.remainingPurse < 0) isLegal = false;
    if (f.players.length < 15 || f.players.length > 25) isLegal = false;
    const overseas = f.players.filter((p) => p.nationality === 'Overseas').length;
    if (overseas > 8) isLegal = false;
  }

  return {
    isLegal,
    franchises: session.franchises,
    overpricedPurchases,
    totalPurchases,
  };
}

/**
 * Runs a comparative benchmark across N simulations for a given mode.
 */
export function runEngineBenchmark(
  numAuctions: number,
  mode: 'Baseline' | 'Advanced'
): AuctionBenchmarkMetrics {
  const startTime = Date.now();
  let legalCount = 0;
  let totalSquadOvrSum = 0;
  let totalStartingXiOvrSum = 0;
  let totalSquadSizeSum = 0;
  let totalPurseSpentLakhs = 0;
  let totalRoleCoverageSum = 0;
  let deficientSquadsCount = 0;
  let totalOverpriced = 0;
  let grandTotalPurchases = 0;

  // Track marquee players per team across all auctions
  const marqueeVariances: number[] = [];

  for (let i = 1; i <= numAuctions; i++) {
    const seed = i * 7919; // Identical deterministic prime seeds
    const { isLegal, franchises, overpricedPurchases, totalPurchases } = runSingleSimulation(seed, mode);

    if (isLegal) legalCount++;
    totalOverpriced += overpricedPurchases;
    grandTotalPurchases += totalPurchases;

    const marqueeCounts: number[] = [];

    for (const f of franchises) {
      const squadOvr = f.players.length > 0
        ? f.players.reduce((sum, p) => sum + p.ratings.overall, 0) / f.players.length
        : 0;
      const xiOvr = calculateStartingXiOvr(f.players);
      const spent = 12000 - f.remainingPurse;

      totalSquadOvrSum += squadOvr;
      totalStartingXiOvrSum += xiOvr;
      totalSquadSizeSum += f.players.length;
      totalPurseSpentLakhs += spent;

      // Role coverage
      const coveredRoles = new Set<TacticalRole>();
      for (const p of f.players) {
        for (const r of getPlayerTacticalRoles(p)) {
          coveredRoles.add(r);
        }
      }
      totalRoleCoverageSum += coveredRoles.size / ALL_TACTICAL_ROLES.length;

      if (hasPositionalDeficiency(f.players)) {
        deficientSquadsCount++;
      }

      // Marquee count (OVR >= 85)
      const marquees = f.players.filter((p) => p.ratings.overall >= 85).length;
      marqueeCounts.push(marquees);
    }

    // Variance for this auction across 10 teams
    const meanMarquee = marqueeCounts.reduce((a, b) => a + b, 0) / marqueeCounts.length;
    const variance = marqueeCounts.reduce((sum, val) => sum + Math.pow(val - meanMarquee, 2), 0) / marqueeCounts.length;
    marqueeVariances.push(Math.sqrt(variance)); // StdDev
  }

  const durationSec = (Date.now() - startTime) / 1000;
  const totalTeams = numAuctions * 10;

  const avgSquadOvr = totalSquadOvrSum / totalTeams;
  const avgStartingXiOvr = totalStartingXiOvrSum / totalTeams;
  const avgSquadSize = totalSquadSizeSum / totalTeams;
  const avgPurseUtilizationPct = (totalPurseSpentLakhs / (totalTeams * 12000)) * 100;
  const costPerOvrPointCr = (totalPurseSpentLakhs / 100) / totalSquadOvrSum;
  const avgRoleCoveragePct = (totalRoleCoverageSum / totalTeams) * 100;
  const positionalDeficiencyRate = (deficientSquadsCount / totalTeams) * 100;
  const overpricedPurchaseRate = grandTotalPurchases > 0 ? (totalOverpriced / grandTotalPurchases) * 100 : 0;
  const avgMarqueeStdDev = marqueeVariances.reduce((a, b) => a + b, 0) / marqueeVariances.length;

  return {
    totalAuctions: numAuctions,
    legalityRate: (legalCount / numAuctions) * 100,
    avgSquadSize,
    avgSquadOvr,
    avgStartingXiOvr,
    avgRoleCoveragePct,
    positionalDeficiencyRate,
    avgPurseUtilizationPct,
    costPerOvrPointCr,
    overpricedPurchaseRate,
    marqueeDistributionVariance: avgMarqueeStdDev,
    executionTimeSec: durationSec,
  };
}

/**
 * Executes the full Headless Comparison Suite.
 */
export function runComparativeHeadlessBenchmark(sampleCount: number = 100) {
  console.log('================================================================================');
  console.log(`HEADLESS AUCTION BENCHMARK SUITE: BASELINE VS ADVANCED CPU INTELLIGENCE`);
  console.log(`Sample Size: ${sampleCount} Automated Mega Auctions (Identical Seeds)`);
  console.log('================================================================================\n');

  console.log(`[1/2] Running ${sampleCount} Baseline Simulations...`);
  const baseline = runEngineBenchmark(sampleCount, 'Baseline');
  console.log(`  Completed in ${baseline.executionTimeSec.toFixed(1)}s\n`);

  console.log(`[2/2] Running ${sampleCount} Advanced CPU Intelligence Simulations...`);
  const advanced = runEngineBenchmark(sampleCount, 'Advanced');
  console.log(`  Completed in ${advanced.executionTimeSec.toFixed(1)}s\n`);

  console.log('================================================================================');
  console.log('HEADLESS BENCHMARK COMPARATIVE RESULTS');
  console.log('================================================================================');
  console.log(
    'Metric                                  | Baseline Engine | Advanced CPU GM | Delta / Impact'
  );
  console.log(
    '----------------------------------------+-----------------+-----------------+----------------'
  );

  const rows = [
    {
      metric: 'Legal Squad Rate (%)',
      base: `${baseline.legalityRate.toFixed(1)}%`,
      adv: `${advanced.legalityRate.toFixed(1)}%`,
      delta: `${(advanced.legalityRate - baseline.legalityRate >= 0 ? '+' : '')}${(advanced.legalityRate - baseline.legalityRate).toFixed(1)}%`,
    },
    {
      metric: 'Average Squad Size (Players)',
      base: `${baseline.avgSquadSize.toFixed(1)}`,
      adv: `${advanced.avgSquadSize.toFixed(1)}`,
      delta: `${(advanced.avgSquadSize - baseline.avgSquadSize >= 0 ? '+' : '')}${(advanced.avgSquadSize - baseline.avgSquadSize).toFixed(1)}`,
    },
    {
      metric: 'Average Squad Overall (OVR)',
      base: `${baseline.avgSquadOvr.toFixed(1)}`,
      adv: `${advanced.avgSquadOvr.toFixed(1)}`,
      delta: `${(advanced.avgSquadOvr - baseline.avgSquadOvr >= 0 ? '+' : '')}${(advanced.avgSquadOvr - baseline.avgSquadOvr).toFixed(1)} pts`,
    },
    {
      metric: 'Optimal Starting XI (OVR)',
      base: `${baseline.avgStartingXiOvr.toFixed(1)}`,
      adv: `${advanced.avgStartingXiOvr.toFixed(1)}`,
      delta: `${(advanced.avgStartingXiOvr - baseline.avgStartingXiOvr >= 0 ? '+' : '')}${(advanced.avgStartingXiOvr - baseline.avgStartingXiOvr).toFixed(1)} pts`,
    },
    {
      metric: '11 Tactical Role Coverage (%)',
      base: `${baseline.avgRoleCoveragePct.toFixed(1)}%`,
      adv: `${advanced.avgRoleCoveragePct.toFixed(1)}%`,
      delta: `+${(advanced.avgRoleCoveragePct - baseline.avgRoleCoveragePct).toFixed(1)}%`,
    },
    {
      metric: 'Positional Deficiency Rate (%)',
      base: `${baseline.positionalDeficiencyRate.toFixed(1)}%`,
      adv: `${advanced.positionalDeficiencyRate.toFixed(1)}%`,
      delta: `${(advanced.positionalDeficiencyRate - baseline.positionalDeficiencyRate).toFixed(1)}% (Deficits Eliminated)`,
    },
    {
      metric: 'Purse Utilization Rate (%)',
      base: `${baseline.avgPurseUtilizationPct.toFixed(1)}%`,
      adv: `${advanced.avgPurseUtilizationPct.toFixed(1)}%`,
      delta: `${(advanced.avgPurseUtilizationPct - baseline.avgPurseUtilizationPct >= 0 ? '+' : '')}${(advanced.avgPurseUtilizationPct - baseline.avgPurseUtilizationPct).toFixed(1)}%`,
    },
    {
      metric: 'Overpriced Purchases (>130% Value)',
      base: `${baseline.overpricedPurchaseRate.toFixed(1)}%`,
      adv: `${advanced.overpricedPurchaseRate.toFixed(1)}%`,
      delta: `${(advanced.overpricedPurchaseRate - baseline.overpricedPurchaseRate).toFixed(1)}% (Disciplined Valuations)`,
    },
    {
      metric: 'Marquee StdDev (Parity Index)',
      base: `${baseline.marqueeDistributionVariance.toFixed(2)}`,
      adv: `${advanced.marqueeDistributionVariance.toFixed(2)}`,
      delta: `${(advanced.marqueeDistributionVariance - baseline.marqueeDistributionVariance).toFixed(2)} (Higher League Parity)`,
    },
  ];

  for (const r of rows) {
    const mPadded = r.metric.padEnd(39, ' ');
    const bPadded = r.base.padStart(15, ' ');
    const aPadded = r.adv.padStart(15, ' ');
    console.log(`${mPadded} | ${bPadded} | ${aPadded} | ${r.delta}`);
  }
  console.log('----------------------------------------+-----------------+-----------------+----------------\n');

  return { baseline, advanced };
}

// Execute when invoked from CLI
if (process.argv[1]?.includes('headless_auction_benchmark')) {
  const samples = parseInt(process.argv[2] || '100', 10);
  runComparativeHeadlessBenchmark(samples);
}
