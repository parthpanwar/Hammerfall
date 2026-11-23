// ============================================================
// IPL DYNASTY - Long-Term CPU Franchise Career AI
// Manages CPU season post-mortems, intelligent releases before mini-auctions,
// retention picks before mega-auctions, and dynamic GM persona shifts.
// ============================================================

import type { Franchise, Player, PlayerSeasonStats, StandingsEntry, AuctionType, RetentionDecision, GMPersonality } from '@/lib/types/game';
import type { PlayerContract } from '@/lib/types/career';
import { calculateFranchiseUpcomingPurse, releasePlayerFromFranchise } from './contract-engine';
import { RETENTION_RULES_2026 } from '@/lib/data/retention-rules';
import { getRetentionCost } from '@/lib/engines/retention-engine';
import { isOverpaidContract } from '../auction/market-value';
import { seasonPerformance } from './player-progression';
import { isOverseasGroomer } from '../squad-tiers';
import { hashString } from './dev-rng';

/**
 * Mini-auction releases by league finish. Real IPL sides refresh before every
 * mini: the champions trim a few, the bottom sides clear out 6–9.
 */
export const MINI_RELEASES = {
  byFinish: [
    { maxPos: 1, count: [3, 5] as [number, number] },
    { maxPos: 4, count: [4, 6] as [number, number] },
    { maxPos: 7, count: [5, 7] as [number, number] },
    { maxPos: 10, count: [6, 9] as [number, number] },
  ],
  /** Never trim below this many before the auction. */
  minKept: 15,
  /** An expensive contract (₹ lakhs) that didn't deliver goes, whatever his rating. */
  bigContract: 400,
  /** Go into a mini with at most this many overseas, so there's a slot for the big names. */
  maxOverseasKept: 6,
};

export interface CpuSeasonPostMortem {
  franchiseId: string;
  seasonPosition: number;
  isChampion: boolean;
  isPlayoffQualifier: boolean;
  squadDiagnosis: 'Contender' | 'PlayoffBubble' | 'RebuildNeeded';
  adjustedGMPersonality: GMPersonality;
  recommendedReleases: string[]; // Player IDs
  targetNeeds: string[]; // Tactical roles to acquire
}

/**
 * Conducts season review and strategic planning for a CPU franchise.
 */
export function evaluateCpuSeasonAndPlan(
  franchise: Franchise,
  standings: StandingsEntry[],
  seasonYear: number,
  isChampion: boolean,
  seasonStats?: Record<string, PlayerSeasonStats>
): CpuSeasonPostMortem {
  const standing = standings.find((s) => s.franchiseId === franchise.id);
  const position = standing?.position || 5;
  const isPlayoffQualifier = position <= 4;

  let squadDiagnosis: CpuSeasonPostMortem['squadDiagnosis'] = 'PlayoffBubble';
  let adjustedPersonality = franchise.gmPersonality;

  if (isChampion || position === 1) {
    squadDiagnosis = 'Contender';
    // Champions stay confident, focusing on value and core continuity
    adjustedPersonality = 'BalancedBuilder';
  } else if (position <= 4) {
    squadDiagnosis = 'PlayoffBubble';
    adjustedPersonality = 'AnalyticsDriven';
  } else if (position >= 8) {
    squadDiagnosis = 'RebuildNeeded';
    // Bottom-finish franchises shift to aggressive rebuild or youth investment
    adjustedPersonality = position === 10 ? 'Aggressive' : 'YouthFocused';
  }

  // Release candidates: judged on what they did last season against what they cost.
  const recommendedReleases = seasonStats
    ? pickMiniReleases(franchise, position, seasonYear, seasonStats)
    : legacyReleases(franchise, squadDiagnosis, seasonYear);

  // Identify positional needs
  const targetNeeds: string[] = [];
  const pacers = franchise.players.filter((p) => p.role === 'Bowler' && !p.isSpinner).length;
  const spinners = franchise.players.filter((p) => p.isSpinner).length;
  const openers = franchise.players.filter((p) => p.isOpener).length;

  if (pacers < 3) targetNeeds.push('Death-over specialist');
  if (spinners < 2) targetNeeds.push('Wrist spinner');
  if (openers < 2) targetNeeds.push('Opening batter');

  return {
    franchiseId: franchise.id,
    seasonPosition: position,
    isChampion,
    isPlayoffQualifier,
    squadDiagnosis,
    adjustedGMPersonality: adjustedPersonality,
    recommendedReleases,
    targetNeeds,
  };
}

/**
 * Executes automated pre-auction decisions for a CPU franchise.
 * - In Mini Auctions: releases 2-4 underperforming players, replenishing purse.
 * - In Mega Auctions: picks top 4-6 retentions adhering to rules.
 */
export function executeCpuPreAuctionDecisions(
  franchise: Franchise,
  auctionType: AuctionType,
  contracts: Record<string, PlayerContract>,
  postMortem: CpuSeasonPostMortem,
  seasonYear: number
): {
  updatedFranchise: Franchise;
  updatedContracts: Record<string, PlayerContract>;
  releasedPlayers: Player[];
  retentionDecisions: RetentionDecision[];
} {
  let currentFranchise = { ...franchise, gmPersonality: postMortem.adjustedGMPersonality };
  let currentContracts = { ...contracts };
  const releasedPlayers: Player[] = [];
  const retentionDecisions: RetentionDecision[] = [];

  if (auctionType === 'Mini') {
    // Mini Auction: execute releases
    for (const playerId of postMortem.recommendedReleases) {
      const { updatedFranchise, updatedContracts, releasedPlayer } = releasePlayerFromFranchise(
        currentFranchise,
        playerId,
        currentContracts
      );
      if (releasedPlayer) {
        currentFranchise = updatedFranchise;
        currentContracts = updatedContracts;
        releasedPlayers.push(releasedPlayer);
      }
    }

    // Update remaining purse
    const { remainingPurse } = calculateFranchiseUpcomingPurse(
      currentFranchise,
      currentFranchise.players,
      seasonYear,
      currentFranchise.totalPurse || undefined
    );
    currentFranchise.remainingPurse = remainingPurse;
  } else {
    // Mega Auction: select up to 4-6 retentions
    // Sort players by quality, youth potential, and star impact
    const retentionCandidates = [...currentFranchise.players].sort((a, b) => {
      const scoreA = a.ratings.overall * 1.5 + (a.age <= 26 ? 10 : 0) + (a.ratings.potential * 0.5);
      const scoreB = b.ratings.overall * 1.5 + (b.age <= 26 ? 10 : 0) + (b.ratings.potential * 0.5);
      return scoreB - scoreA;
    });

    const maxRetain = Math.min(RETENTION_RULES_2026.maxRetentions, 5); // Retain top 4-5
    const retainedPlayersList: Player[] = [];

    for (let slot = 1; slot <= maxRetain && slot <= retentionCandidates.length; slot++) {
      const candidate = retentionCandidates[slot - 1];
      // Only retain high-tier players (78+ OVR)
      if (candidate.ratings.overall < 78) break;

      const cost = getRetentionCost(slot, RETENTION_RULES_2026);
      retentionDecisions.push({
        franchiseId: currentFranchise.id,
        playerId: candidate.id,
        playerName: candidate.name,
        retentionNumber: slot,
        cost,
        isRTM: false,
      });

      const retainedPlayer = { ...candidate, isRetained: true, retentionCost: cost };
      retainedPlayersList.push(retainedPlayer);
    }

    // Non-retained players are released into the mega auction pool
    for (const p of currentFranchise.players) {
      if (!retainedPlayersList.some((rp) => rp.id === p.id)) {
        const released = { ...p, isRetained: false, isSold: false, isAvailableForAuction: true, currentFranchiseId: null };
        releasedPlayers.push(released);
      }
    }

    // Set franchise players to only retained players
    currentFranchise.players = retainedPlayersList;
    currentFranchise.retainedPlayers = retainedPlayersList;

    const totalSpent = retentionDecisions.reduce((sum, r) => sum + r.cost, 0);
    // The season's (grown) league purse — set by the season rollover — not the 2026 rule book's.
    const leaguePurse = franchise.totalPurse || RETENTION_RULES_2026.totalPurse;
    currentFranchise.totalPurse = leaguePurse;
    currentFranchise.remainingPurse = Math.max(0, leaguePurse - totalSpent);
  }

  return {
    updatedFranchise: currentFranchise,
    updatedContracts: currentContracts,
    releasedPlayers,
    retentionDecisions,
  };
}


const salaryOf = (p: Player) => p.soldPrice || p.currentContractValue || p.basePrice;

/**
 * Who a franchise lets go before a mini auction. Last season's output against
 * salary decides it, not the rating: a ₹10 Cr player who didn't deliver is
 * released; a ₹30 L squad player who did his job stays. Cornerstones who are
 * still producing, and young prospects on small deals, are kept.
 */
function pickMiniReleases(franchise: Franchise, position: number, season: number, stats: Record<string, PlayerSeasonStats>): string[] {
  const M = MINI_RELEASES;
  const [lo, hi] = M.byFinish.find((r) => position <= r.maxPos)?.count ?? [5, 7];
  const target = lo + (hashString(`${franchise.id}:release:${season}`) % (hi - lo + 1));
  const room = Math.max(0, franchise.players.length - M.minKept);

  const scored = franchise.players
    .map((p) => {
      const st = stats[p.id];
      const m = st?.matches ?? 0;
      const perf = seasonPerformance(p, st);
      // A paid player who didn't play is a bad sign; one who played a little is unproven.
      const evidence = perf ?? (m === 0 ? -0.7 : -0.35);
      const cr = salaryOf(p) / 100;
      const cornerstone = p.ratings.overall >= 88 && p.age <= 34 && evidence > -0.5;
      const prospect = p.age <= 23 && p.ratings.potential - p.ratings.overall >= 5 && cr < 6;
      const groomer = isOverseasGroomer(p) && cr < 4;
      if (cornerstone || prospect || groomer) return { p, score: -Infinity, flop: false };
      const score = (0.35 - evidence) * (1 + cr / 3) + (p.age >= 34 ? 0.4 : 0) + (p.ratings.overall < 70 ? 0.3 : 0);
      return { p, score, flop: salaryOf(p) >= M.bigContract && evidence <= -0.1 };
    })
    .filter((x) => x.score > 0.4)
    .sort((a, b) => Number(b.flop) - Number(a.flop) || b.score - a.score);

  // Every expensive flop goes (up to two over the plan), then the rest of the plan.
  const flops = scored.filter((x) => x.flop).slice(0, target + 2);
  const others = scored.filter((x) => !x.flop).slice(0, Math.max(0, target - flops.length));
  const out = [...flops, ...others].slice(0, room).map((x) => x.p.id);

  // Free overseas slots for the mini: let go of overseas players who barely played
  // (young internationals being groomed stay).
  const keptOs = franchise.players
    .filter((p) => p.nationality === 'Overseas' && !out.includes(p.id))
    .sort((a, b) => (stats[a.id]?.matches ?? 0) - (stats[b.id]?.matches ?? 0) || a.ratings.overall - b.ratings.overall);
  for (const p of keptOs) {
    if (franchise.players.length - out.length <= M.minKept) break;
    if (franchise.players.filter((x) => x.nationality === 'Overseas' && !out.includes(x.id)).length <= M.maxOverseasKept) break;
    if ((stats[p.id]?.matches ?? 0) >= 7 || isOverseasGroomer(p)) continue;
    out.push(p.id);
  }
  return out;
}

/** Without season stats (tests, old callers): value-for-money releases. */
function legacyReleases(franchise: Franchise, squadDiagnosis: CpuSeasonPostMortem['squadDiagnosis'], seasonYear: number): string[] {
  const out: string[] = [];
  const sorted = [...franchise.players].sort((a, b) => a.ratings.overall / Math.max(20, salaryOf(a)) - b.ratings.overall / Math.max(20, salaryOf(b)));
  const target = squadDiagnosis === 'RebuildNeeded' ? 4 : squadDiagnosis === 'PlayoffBubble' ? 3 : 2;
  for (const player of sorted) {
    if (out.length >= target) break;
    if (player.ratings.overall >= 88 && player.age <= 38) continue;
    const price = salaryOf(player);
    if (
      (price >= 800 && player.ratings.overall <= 76) ||
      (player.age >= 36 && player.ratings.overall <= 75) ||
      player.ratings.overall <= 68 ||
      (isOverpaidContract(player, price, seasonYear + 1) && player.ratings.overall < 86)
    )
      out.push(player.id);
  }
  return out;
}
