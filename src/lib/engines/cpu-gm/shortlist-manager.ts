// ============================================================
// IPL DYNASTY - Dynamic Player Shortlist & In-Auction Re-evaluation
// Generates prioritized shortlists, tracks budget allocation per role,
// and continuously adjusts target lists as rival purchases unfold.
// ============================================================

import type { Franchise, Player, AuctionSession, AuctionLot, SeededRandom } from '@/lib/types/game';
import {
  TacticalRole,
  getPlayerTacticalRoles,
  ALL_TACTICAL_ROLES,
  TARGET_ROLE_COVERAGE,
} from './tactical-roles';
import {
  FRANCHISE_GM_PROFILES,
  GM_PERSONALITY_ARCHETYPES,
  getFranchiseActivePersonality,
  evolveFranchisePersonality,
} from './personalities';
import { generatePlayerIntelligenceDossier } from '../../intelligence/valuation/player-intelligence';

export interface TargetPlayerEntry {
  playerId: string;
  playerName: string;
  primaryRole: TacticalRole;
  targetMaxBid: number; // in Lakhs
  priorityRank: number; // 1 = highest priority
  isAcquired: boolean;
  alternativePlayerIds: string[];
}

export interface CpuFranchiseShortlist {
  franchiseId: string;
  primaryTargets: TargetPlayerEntry[];
  fallbackTargetsByRole: Record<TacticalRole, string[]>;
  roleBudgets: Record<TacticalRole, number>; // in Lakhs
  promotedAlternatives: TargetPlayerEntry[];
  lastUpdatedIndex: number;
}

// Global in-memory storage for active session shortlists
const sessionShortlists: Map<string, Map<string, CpuFranchiseShortlist>> = new Map();

/** Get a franchise's current dynamic shortlist. */
export function getFranchiseShortlist(sessionId: string, franchiseId: string): CpuFranchiseShortlist {
  let sessionMap = sessionShortlists.get(sessionId);
  if (!sessionMap) {
    sessionMap = new Map();
    sessionShortlists.set(sessionId, sessionMap);
  }

  let list = sessionMap.get(franchiseId);
  if (!list) {
    list = {
      franchiseId,
      primaryTargets: [],
      fallbackTargetsByRole: {} as any,
      roleBudgets: {} as any,
      promotedAlternatives: [],
      lastUpdatedIndex: -1,
    };
    for (const r of ALL_TACTICAL_ROLES) {
      list.fallbackTargetsByRole[r] = [];
      list.roleBudgets[r] = 500;
    }
    sessionMap.set(franchiseId, list);
  }

  return list;
}

/**
 * Initializes private shortlists and role budget plans for all franchises before auction begins.
 */
export function initializeDynamicShortlists(session: AuctionSession, rng: SeededRandom) {
  let sessionMap = sessionShortlists.get(session.id);
  if (!sessionMap) {
    sessionMap = new Map();
    sessionShortlists.set(session.id, sessionMap);
  }

  const pool = session.playerPool;

  for (const franchise of session.franchises) {
    const profile = FRANCHISE_GM_PROFILES[franchise.id];
    const personality = GM_PERSONALITY_ARCHETYPES[profile?.initialArchetype || 'Balanced squad builder'];

    // Group available players by tactical role
    const candidatesByRole: Record<TacticalRole, { player: Player; score: number }[]> = {} as any;
    for (const r of ALL_TACTICAL_ROLES) {
      candidatesByRole[r] = [];
    }

    // Score all available players for this franchise
    const scoredPlayers = pool.map((p) => {
      const dossier = generatePlayerIntelligenceDossier(p);
      const roles = getPlayerTacticalRoles(p);
      let score = dossier.projection.overallImpactScore;

      // Role affinities
      if (profile) {
        for (const r of roles) {
          score *= (profile.roleAffinities[r] || 1.0);
        }
        if (p.nationality === 'Indian') {
          score *= profile.domesticPremium;
        }
      }

      // Personality bias
      if (personality.youthBias > 0 && p.age <= 24) {
        score *= (1.0 + personality.youthBias * 0.15);
      } else if (personality.youthBias < 0 && (p.age >= 34 || dossier.ageProfile.isOver35Exempt)) {
        score *= (1.0 + Math.abs(personality.youthBias) * 0.15);
      }

      // Add to each applicable role bucket
      for (const r of roles) {
        candidatesByRole[r].push({ player: p, score });
      }

      return { player: p, score, dossier, roles };
    });

    // Sort role buckets descending by score
    for (const r of ALL_TACTICAL_ROLES) {
      candidatesByRole[r].sort((a, b) => b.score - a.score);
    }

    // Allocate purse across roles (Total 12,000L)
    const roleBudgets: Record<TacticalRole, number> = {} as any;
    const baseBudgetRatio = franchise.remainingPurse / 11;

    for (const r of ALL_TACTICAL_ROLES) {
      const affinity = profile?.roleAffinities[r] || 1.0;
      roleBudgets[r] = Math.round(baseBudgetRatio * affinity);
    }

    // Select top 10-14 primary targets across highest-priority roles
    scoredPlayers.sort((a, b) => b.score - a.score);
    const topCandidates = scoredPlayers.slice(0, 14);

    const primaryTargets: TargetPlayerEntry[] = [];
    const fallbackTargetsByRole: Record<TacticalRole, string[]> = {} as any;

    for (const r of ALL_TACTICAL_ROLES) {
      const rolePool = candidatesByRole[r];
      // Select contingency fallbacks outside of primary top targets
      const nonPrimary = rolePool.filter((c) => !topCandidates.some((tc) => tc.player.id === c.player.id));
      fallbackTargetsByRole[r] = nonPrimary.slice(0, 6).map((c) => c.player.id);
    }

    topCandidates.forEach((c, idx) => {
      const primaryRole = c.roles[0] || 'Middle-order anchor';
      const alts = fallbackTargetsByRole[primaryRole] || [];

      primaryTargets.push({
        playerId: c.player.id,
        playerName: c.player.name,
        primaryRole,
        targetMaxBid: Math.min(2700, Math.round(c.dossier.marketValuation.fairValue * personality.starPremiumMultiplier)),
        priorityRank: idx + 1,
        isAcquired: false,
        alternativePlayerIds: alts.slice(0, 3),
      });
    });

    const shortlist: CpuFranchiseShortlist = {
      franchiseId: franchise.id,
      primaryTargets,
      fallbackTargetsByRole,
      roleBudgets,
      promotedAlternatives: [],
      lastUpdatedIndex: session.currentPlayerIndex,
    };

    sessionMap.set(franchise.id, shortlist);
  }
}

/**
 * Called after every auction lot finishes (Sold or Unsold).
 * Re-evaluates shortlists, promotes alternatives, and rebalances role budgets.
 */
export function updateShortlistsOnLotCompletion(
  session: AuctionSession,
  completedLot: AuctionLot
) {
  const sessionMap = sessionShortlists.get(session.id);
  if (!sessionMap) return;

  const player = completedLot.player;
  const buyerId = completedLot.currentBidderId;
  const isSold = completedLot.state === 'Sold' && buyerId !== null;

  for (const franchise of session.franchises) {
    const shortlist = sessionMap.get(franchise.id);
    if (!shortlist) continue;

    shortlist.lastUpdatedIndex = session.currentPlayerIndex;

    // Check if the sold player was on this franchise's target list
    const targetIdx = shortlist.primaryTargets.findIndex((t) => t.playerId === player.id);

    if (isSold && buyerId === franchise.id) {
      // 1. THIS CPU BOUGHT THE PLAYER
      if (targetIdx !== -1) {
        shortlist.primaryTargets[targetIdx].isAcquired = true;
      }

      // Deduct price from role budget
      const roles = getPlayerTacticalRoles(player);
      for (const r of roles) {
        if (shortlist.roleBudgets[r]) {
          shortlist.roleBudgets[r] = Math.max(0, shortlist.roleBudgets[r] - completedLot.currentBid);
        }
      }

      // Check if dynamic personality should adapt
      evolveFranchisePersonality(franchise, session);
    } else if (isSold && buyerId !== franchise.id && targetIdx !== -1) {
      // 2. RIVAL BOUGHT THIS CPU'S TARGET PLAYER
      const missedTarget = shortlist.primaryTargets[targetIdx];
      // Remove from primary targets
      shortlist.primaryTargets.splice(targetIdx, 1);

      // Find best un-auctioned replacement from fallbacks
      const fallbackIds = shortlist.fallbackTargetsByRole[missedTarget.primaryRole] || [];
      const remainingUnauctioned = session.playerPool.slice(session.currentPlayerIndex + 1);

      const replacementPlayer = remainingUnauctioned.find((p) =>
        fallbackIds.includes(p.id) &&
        !shortlist.primaryTargets.some((t) => t.playerId === p.id) &&
        !shortlist.promotedAlternatives.some((t) => t.playerId === p.id)
      );

      if (replacementPlayer) {
        const dossier = generatePlayerIntelligenceDossier(replacementPlayer);
        const promoted: TargetPlayerEntry = {
          playerId: replacementPlayer.id,
          playerName: replacementPlayer.name,
          primaryRole: missedTarget.primaryRole,
          targetMaxBid: Math.min(2400, Math.round(dossier.marketValuation.fairValue * 1.1)),
          priorityRank: missedTarget.priorityRank,
          isAcquired: false,
          alternativePlayerIds: [],
        };
        shortlist.promotedAlternatives.push(promoted);
      }

      // Reallocate missed budget across remaining target roles
      const remainingTargets = shortlist.primaryTargets.filter((t) => !t.isAcquired);
      if (remainingTargets.length > 0) {
        const bonusPerTarget = Math.round(missedTarget.targetMaxBid * 0.25 / remainingTargets.length);
        for (const target of remainingTargets) {
          target.targetMaxBid += bonusPerTarget;
        }
      }
    }
  }
}
