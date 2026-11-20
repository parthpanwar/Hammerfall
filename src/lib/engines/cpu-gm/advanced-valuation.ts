// ============================================================
// IPL DYNASTY - Advanced CPU Valuation & Playing XI Optimization
// Evaluates incremental Playing XI improvement, squad depth,
// alternative remaining scarcity, and difficulty scaling.
// ============================================================

import type { Franchise, Player, AuctionSession, CPUDifficulty } from '@/lib/types/game';
import {
  TacticalRole,
  getPlayerTacticalRoles,
  ALL_TACTICAL_ROLES,
  TARGET_ROLE_COVERAGE,
  evaluateTacticalNeed,
} from './tactical-roles';
import {
  getFranchiseActivePersonality,
  GM_PERSONALITY_ARCHETYPES,
} from './personalities';
import type { PlayerIntelligenceDossier } from '../../intelligence/types';
import { generatePlayerIntelligenceDossier } from '../../intelligence/valuation/player-intelligence';
import { analyzeUpcomingPool } from '../auction/dynamic-set-engine';
import { xiGain } from './xi-value';
import { getActiveGMProfile } from './personalities';
import { PROGRESSION_TUNING } from '../career/progression-tuning';
import { auctionProgress, ratingPriceCeiling, auctionMarketValue, iplPedigree, patienceMultiplier, singlePlayerCap, teamWealthFactor } from '../auction/market-value';

/**
 * How much the candidate lifts this squad's best XI (0 = he would not start).
 * Measured with real XI selection (overseas cap of four, a keeper, bowling
 * balance) on selection scores — age, IPL output and youth minutes included — and
 * against the replacement-level Indian still available later in the auction. A
 * 39-year-old overseas opener does not "improve" an XI that has a rising Indian
 * opener; a fifth overseas star who would sit on the bench improves nothing.
 */
export function calculatePlayingXiImprovement(
  franchise: Franchise,
  candidate: Player,
  session?: AuctionSession
): number {
  return Math.min(35, Math.round(xiGain(franchise, candidate, session) * 2.2));
}

/**
 * Calculates squad depth value (insurance against injuries, rotations, tactical flexibility).
 * Diminishing returns apply heavily as squad depth increases.
 */
export function calculateSquadDepthImprovement(
  franchise: Franchise,
  candidate: Player
): number {
  const squad = franchise.players;
  const candidateRoles = getPlayerTacticalRoles(candidate);

  let totalDepthScore = 0;
  for (const role of candidateRoles) {
    const existingCount = squad.filter((p) => getPlayerTacticalRoles(p).includes(role)).length;
    const target = TARGET_ROLE_COVERAGE[role]?.idealSquad || 3;

    if (existingCount < target) {
      const deficit = target - existingCount;
      // 1st backup = 14pts, 2nd backup = 8pts, 3rd backup = 4pts
      if (deficit >= 3) totalDepthScore += 14;
      else if (deficit === 2) totalDepthScore += 8;
      else if (deficit === 1) totalDepthScore += 4;
    } else if (existingCount === target) {
      // Rotation & injury insurance
      totalDepthScore += 3;
    }
  }

  return Math.min(25, Math.round(totalDepthScore / candidateRoles.length));
}

/**
 * Counts and scores alternative un-auctioned players remaining in the pool
 * that can fulfill the same primary tactical roles.
 */
export function evaluateAlternativeOptions(
  candidate: Player,
  session: AuctionSession
): {
  count: number;
  averageRating: number;
  qualityTier: 'Abundant' | 'Moderate' | 'Scarce' | 'Last-Option';
} {
  const remaining = session.playerPool.slice(session.currentPlayerIndex + 1);
  const candidateRoles = getPlayerTacticalRoles(candidate);

  const alternatives = remaining.filter((p) => {
    if (p.id === candidate.id) return false;
    const pRoles = getPlayerTacticalRoles(p);
    return pRoles.some((r) => candidateRoles.includes(r));
  });

  if (alternatives.length === 0) {
    return { count: 0, averageRating: 0, qualityTier: 'Last-Option' };
  }

  const avgRating = Math.round(
    alternatives.reduce((sum, p) => sum + p.ratings.overall, 0) / alternatives.length
  );

  let qualityTier: 'Abundant' | 'Moderate' | 'Scarce' | 'Last-Option' = 'Moderate';
  if (alternatives.length <= 1) qualityTier = 'Last-Option';
  else if (alternatives.length <= 3) qualityTier = 'Scarce';
  else if (alternatives.length <= 6) qualityTier = 'Moderate';
  else qualityTier = 'Abundant';

  return { count: alternatives.length, averageRating: avgRating, qualityTier };
}

/**
 * Advanced Spending Limit Calculator integrating all 4 ML models,
 * Playing XI vs Depth optimization, scarcity, and personality traits.
 */
export function calculateAdvancedSpendingLimit(
  franchise: Franchise,
  player: Player,
  session: AuctionSession,
  dossier: PlayerIntelligenceDossier,
  difficulty: CPUDifficulty = franchise.cpuDifficulty || 'Normal'
): number {
  const targetSquadSize = Math.max(18, franchise.minSquadSize);
  const openSlots = Math.max(1, targetSquadSize - franchise.players.length);
  // Strict legal safety reserve: 20L min per remaining unfilled slot towards legal minimum of 18
  const legalMinSquad = franchise.minSquadSize ?? 18;
  const legalSlotsNeeded = Math.max(0, legalMinSquad - franchise.players.length - 1);
  const reserveNeeded = legalSlotsNeeded * 20;
  const maxAffordable = Math.max(0, franchise.remainingPurse - reserveNeeded);

  // Analyze upcoming auction pool & sets to prevent early overbidding
  const upcomingAnalysis = analyzeUpcomingPool(player, session);
  // Market value (rating × IPL pedigree × price index) and patience for later sets.
  const marketVal = Math.round(auctionMarketValue(player, session) * teamWealthFactor(franchise, session) * strategyFit(franchise, player));
  const patience = patienceMultiplier(player, session);
  const earlyAuctionDiscount = Math.min(upcomingAnalysis.earlyDiscountMultiplier, patience);
  const cap = Math.min(maxAffordable, singlePlayerCap(player, franchise, session.seasonYear));
  void dossier;

  // -------------------------------------------------------------
  // DIFFICULTY: EASY (Simple baseline heuristic, no deep optimization)
  // -------------------------------------------------------------
  if (difficulty === 'Easy') {
    const budgetRatio = franchise.remainingPurse / openSlots;
    const easyLimit = Math.min(marketVal * earlyAuctionDiscount, cap, budgetRatio * 2.4);
    return Math.max(player.basePrice, Math.round(easyLimit / 5) * 5);
  }

  // -------------------------------------------------------------
  // DIFFICULTY: NORMAL / HARD / EXPERT
  // -------------------------------------------------------------
  const personalityType = getFranchiseActivePersonality(session.id, franchise);
  const personality = GM_PERSONALITY_ARCHETYPES[personalityType];

  // 1. Incremental Value: Playing XI vs Squad Depth
  const xiGain = calculatePlayingXiImprovement(franchise, player, session);
  const depthGain = calculateSquadDepthImprovement(franchise, player);
  const alternatives = evaluateAlternativeOptions(player, session);

  // 2. Scarcity Multiplier based on remaining alternatives & upcoming sets
  let scarcityMult = upcomingAnalysis.scarcityFactor;
  if (alternatives.qualityTier === 'Last-Option') scarcityMult = Math.max(scarcityMult, 1.3);
  else if (alternatives.qualityTier === 'Scarce') scarcityMult = Math.max(scarcityMult, 1.15);
  else if (alternatives.qualityTier === 'Abundant') scarcityMult = Math.min(scarcityMult, 0.9);

  // 3. Multi-season value: young players with headroom are worth more over a contract.
  const headroom = Math.max(0, player.ratings.potential - player.ratings.overall);
  const multiSeasonBonus = player.age <= 24 && headroom >= 4 ? 1.06 : player.age >= 35 ? 0.92 : 1.0;

  // 4. Budget discipline: share of the per-slot budget a player of this quality may take.
  const budgetRatio = franchise.remainingPurse / openSlots;
  const ovr = player.ratings.overall;
  const ped = iplPedigree(player, session.seasonYear);
  let Z = 1.6;
  if (ovr >= 88) Z = 4.4;
  else if (ovr >= 85) Z = 3.6;
  else if (ovr >= 81) Z = 2.7;
  else if (ovr >= 76) Z = 2.0;
  if (!ped.proven && player.nationality === 'Overseas') Z *= 0.85;
  Z *= personality.starPremiumMultiplier;

  // Cash pressure: money that is not spent is wasted. A team holding far more per
  // open slot than this player costs pays up for the good ones still on the board.
  const fillTo = session.auctionType === 'Mini' ? 21 : 22;
  const slotsToFill = Math.max(1, fillTo - franchise.players.length);
  const progress = auctionProgress(session);
  const perSlot = franchise.remainingPurse / slotsToFill;
  const pressure = Math.max(0, Math.min(0.5, Math.log2(perSlot / Math.max(60, marketVal)) * 0.12 * (0.5 + progress)));

  // Mega-auction pacing: money left at the end of a mega is wasted. A team holding
  // more per open slot than the remaining players cost bids up, harder as the
  // auction runs out of players.
  const pace = megaSpendPace(franchise, session, reserveNeeded, progress);

  let compositeValuation: number;
  if (xiGain > 0) {
    // Starter: market value, more if he lifts this XI a lot.
    let rawVal = marketVal * (0.85 + Math.min(0.35, xiGain / 100)) * (1 + pressure * 0.6) * scarcityMult * multiSeasonBonus * earlyAuctionDiscount;
    if (ovr < 78 && upcomingAnalysis.betterPlayersRemainingInRole >= 2) {
      rawVal = Math.min(rawVal, marketVal * 1.1);
    }
    compositeValuation = Math.round(rawVal * pace);
  } else {
    // Pure squad depth: strictly bounded to avoid overpaying for backups
    // Mega pacing reaches quality squad players (impact subs, injury cover), never filler.
    const depthPace = ovr >= PROGRESSION_TUNING.market.megaPace.qualityDepthOvr ? pace : 1;
    const depthMax = Math.min(marketVal * (0.7 + pressure) * depthPace, budgetRatio * 1.4 * depthPace) * earlyAuctionDiscount;
    compositeValuation = Math.max(player.basePrice, Math.round(depthMax + depthGain * 6));
  }

  // Back half of a mega: money per open slot goes on the best players still on the
  // board (starters or 76+), up to ~1.3× that per-slot money and never past 2× market.
  if (session.auctionType === 'Mega' && progress >= PROGRESSION_TUNING.market.megaPace.lateFrom && (xiGain > 0 || ovr >= PROGRESSION_TUNING.market.megaPace.qualityDepthOvr)) {
    const P = PROGRESSION_TUNING.market.megaPace;
    const open = Math.max(1, P.fillTo - franchise.players.length);
    const perSlot = Math.max(0, franchise.remainingPurse - reserveNeeded) / open;
    if (isAmongBestRemaining(player, session)) {
      compositeValuation = Math.max(compositeValuation, Math.round(Math.min(perSlot * P.lateSlotShare, marketVal * P.lateMaxOverMarket)));
    }
  }

  // Players past 30 rated 80 or less are bought for what they are now: no bidding
  // war over a former star's name.
  if (player.age >= 30 && ovr <= 80) {
    compositeValuation = Math.min(compositeValuation, Math.round(marketVal * PROGRESSION_TUNING.market.veteranBidCeiling));
  }

  // Prospects who have never played the IPL are punts: nobody gets into a cash-pressure
  // bidding war for an uncapped teenager (wonderkids land ₹1–6 Cr, not ₹15 Cr).
  if (player.status === 'Uncapped' && !(player.ipl && player.ipl.matches > 0)) {
    compositeValuation = Math.min(compositeValuation, Math.round(marketVal * PROGRESSION_TUNING.market.prospectBidCeiling));
  }

  // Expert level: don't overbid when comparable options are plentiful
  if (difficulty === 'Expert' && alternatives.count >= 3 && alternatives.averageRating >= ovr - 3) {
    compositeValuation = Math.min(compositeValuation, Math.round(marketVal * 1.05));
  }

  let spendingLimit = Math.min(compositeValuation, cap, Math.max(player.basePrice, Math.round(budgetRatio * Z)));
  // A team that has just won several lots in a row eases off (budget review, the
  // board's nerves, rivals pricing them in) — no single franchise hoovers up a set.
  spendingLimit = Math.round(spendingLimit * haulDamping(franchise, session, player));
  // Never more than the current rating can justify, whatever the name or the cash in hand.
  spendingLimit = Math.min(spendingLimit, ratingPriceCeiling(player, session));

  // If squad still has fewer than 18 players, prioritize legal roster filling at base price
  let effectiveLimit = spendingLimit;
  if (franchise.players.length < 18 && maxAffordable >= player.basePrice) {
    effectiveLimit = Math.max(effectiveLimit, player.basePrice);
  }

  return Math.min(maxAffordable, Math.max(player.basePrice, Math.round(effectiveLimit / 5) * 5));
}

/**
 * How well a player fits this window's front-office plan: the roles the scouts are
 * chasing, the premium on Indians, and the plan's youth/experience bias.
 */
export function strategyFit(franchise: Franchise, player: Player): number {
  const profile = getActiveGMProfile(franchise);
  const traits = GM_PERSONALITY_ARCHETYPES[profile.currentArchetype] ?? GM_PERSONALITY_ARCHETYPES['Balanced squad builder'];
  const roles = getPlayerTacticalRoles(player);
  const affinity = Math.max(...roles.map((r) => profile.roleAffinities[r] ?? 1), 0.75);
  let m = 1 + (Math.min(1.6, affinity) - 1) * 0.35;
  if (player.nationality === 'Indian') m *= 1 + (profile.domesticPremium - 1) * 0.3;
  const headroom = player.ratings.potential - player.ratings.overall;
  if (player.age <= 24 && headroom >= 5) m *= 1 + traits.youthBias * 0.15;
  else if (player.age >= 32) m *= 1 - traits.youthBias * 0.12;
  // Youth-first front offices chase the wonderkids and hot prospects.
  if (player.age <= 22 && player.ratings.potential >= 84 && traits.youthBias > 0) m *= 1 + traits.youthBias * (player.ratings.potential >= 88 ? 0.25 : 0.12);
  return Math.max(0.8, Math.min(1.3, m));
}

const slotCostCache = new Map<string, number>();

/** What an open squad slot will cost from here: mean market value of the best players still to come, one per open slot league-wide. */
function expectedSlotCost(session: AuctionSession): number {
  const key = `${session.id}:${session.round}:${session.currentPlayerIndex}`;
  const hit = slotCostCache.get(key);
  if (hit !== undefined) return hit;
  const fillTo = PROGRESSION_TUNING.market.megaPace.fillTo;
  const open = session.franchises.reduce((t, f) => t + Math.max(0, fillTo - f.players.length), 0);
  const values = session.playerPool
    .slice(Math.max(0, session.currentPlayerIndex + 1))
    .map((p) => auctionMarketValue(p, session))
    .sort((a, b) => b - a)
    .slice(0, Math.max(1, open));
  const cost = Math.max(20, (values.reduce((t, v) => t + v, 0) + Math.max(0, open - values.length) * 20) / Math.max(1, open));
  if (slotCostCache.size > 2000) slotCostCache.clear();
  slotCostCache.set(key, cost);
  return cost;
}

const bestCache = new Map<string, number>();

/** Is this player among the best still to come (top half of the league's open slots, by market value)? */
function isAmongBestRemaining(player: Player, session: AuctionSession): boolean {
  const key = `${session.id}:${session.round}:${session.currentPlayerIndex}`;
  let cut = bestCache.get(key);
  if (cut === undefined) {
    const fillTo = PROGRESSION_TUNING.market.megaPace.fillTo;
    const open = session.franchises.reduce((t, f) => t + Math.max(0, fillTo - f.players.length), 0);
    const values = session.playerPool
      .slice(Math.max(0, session.currentPlayerIndex))
      .map((p) => auctionMarketValue(p, session))
      .sort((a, b) => b - a);
    cut = values[Math.min(values.length - 1, Math.max(0, Math.floor(open * PROGRESSION_TUNING.market.megaPace.bestRemainingShare)))] ?? 0;
    if (bestCache.size > 2000) bestCache.clear();
    bestCache.set(key, cut);
  }
  return auctionMarketValue(player, session) >= cut;
}

/** ≥ 1: how much harder this team bids in a mega so its purse actually gets spent. */
export function megaSpendPace(franchise: Franchise, session: AuctionSession, reserve: number, progress: number): number {
  if (session.auctionType !== 'Mega') return 1;
  const P = PROGRESSION_TUNING.market.megaPace;
  const open = Math.max(1, P.fillTo - franchise.players.length);
  const perSlot = Math.max(0, franchise.remainingPurse - reserve) / open;
  const ratio = perSlot / expectedSlotCost(session);
  const ratioPace = ratio <= 1 ? 1 : 1 + (Math.min(P.maxBoost, Math.pow(ratio, P.exponent)) - 1) * (0.4 + 0.6 * clamp01(progress));
  // Spending schedule: stars come first, so a team should have spent about
  // progress^0.75 of its auction money by now. Falling behind means bidding harder
  // while good players are still on the board.
  const spent = session.soldPlayers.filter((x) => x.franchiseId === franchise.id).reduce((t, x) => t + x.price, 0);
  const budget = franchise.remainingPurse + spent - reserve;
  if (budget <= 0) return ratioPace;
  const target = budget * P.targetSpend * Math.pow(clamp01(progress), P.scheduleExponent);
  const lag = (target - spent) / budget;
  const lagPace = 1 + Math.max(0, Math.min(P.maxBoost - 1, lag * P.lagGain));
  return Math.max(ratioPace, lagPace);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Eases a franchise off after it has won 3+ of the last 6 lots (elite players exempt). */
export function haulDamping(franchise: Franchise, session: AuctionSession, player: Player): number {
  if (player.ratings.overall >= 86) return 1;
  const recent = session.soldPlayers.slice(-6);
  const wins = recent.filter((s) => s.franchiseId === franchise.id).length;
  const last2 = recent.slice(-2).every((s) => s.franchiseId === franchise.id) && recent.length >= 2;
  if (wins >= 4) return 0.7;
  if (wins >= 3 || last2) return 0.85;
  return 1;
}

/**
 * Exact implementation of the reference architecture bidding rule snippet (Image 4):
 *
 * const scarcityMultiplier = 0.9 + 0.2 * scarcity;
 * const valuation = player.marketValue * qualityFactor * needMultiplier * scarcityMultiplier * cpu.aggression;
 * const budgetRatio = cpu.purse / Math.max(cpu.openSlots, 1);
 * const spendingLimit = Math.min(valuation, maxAffordable, budgetRatio * Z);
 * return nextBid <= spendingLimit;
 */
export function evaluateBiddingRuleSnippet(
  franchise: Franchise,
  player: Player,
  nextBid: number,
  session: AuctionSession,
  dossier?: PlayerIntelligenceDossier
): {
  shouldBid: boolean;
  spendingLimit: number;
  valuation: number;
  budgetRatio: number;
  scarcityMultiplier: number;
} {
  const pDossier = dossier || generatePlayerIntelligenceDossier(player);
  const personalityType = getFranchiseActivePersonality(session.id, franchise);
  const personality = GM_PERSONALITY_ARCHETYPES[personalityType];

  // 1. Scarcity Multiplier: 0.9 + 0.2 * scarcity
  const remaining = session.playerPool.slice(session.currentPlayerIndex + 1);
  const candidateRoles = getPlayerTacticalRoles(player);
  let minOptions = 999;
  for (const role of candidateRoles) {
    const left = remaining.filter((p) => getPlayerTacticalRoles(p).includes(role)).length;
    if (left < minOptions) minOptions = left;
  }
  const scarcity = minOptions <= 1 ? 1.0 : minOptions <= 3 ? 0.75 : minOptions <= 6 ? 0.45 : 0.15;
  const scarcityMultiplier = 0.9 + 0.2 * scarcity;

  // 2. Valuation Factors
  const marketValue = pDossier.marketValuation.fairValue;
  const qualityFactor = Math.min(1.4, Math.max(0.7, pDossier.projection.overallImpactScore / 75));
  const tacticalNeed = evaluateTacticalNeed(franchise, player);
  const needMultiplier = Math.min(1.5, Math.max(0.6, 0.7 + (tacticalNeed / 100) * 0.8));
  const aggression = personality.starPremiumMultiplier;

  const valuation = Math.round(
    marketValue * qualityFactor * needMultiplier * scarcityMultiplier * aggression
  );

  // 3. Dynamic Budget Discipline
  const targetSquadSize = Math.max(18, franchise.minSquadSize);
  const openSlots = Math.max(1, targetSquadSize - franchise.players.length);
  const reserveNeeded = Math.max(0, targetSquadSize - franchise.players.length - 1) * 20;
  const maxAffordable = Math.max(0, franchise.remainingPurse - reserveNeeded);
  const budgetRatio = franchise.remainingPurse / Math.max(openSlots, 1);

  const impact = pDossier.projection.overallImpactScore;
  let Z = 1.6;
  if (impact >= 90) Z = 4.2;
  else if (impact >= 85) Z = 3.4;
  else if (impact >= 80) Z = 2.6;
  else if (impact >= 75) Z = 2.0;
  Z *= personality.starPremiumMultiplier;

  const spendingLimit = Math.min(
    valuation,
    maxAffordable,
    Math.max(player.basePrice, Math.round(budgetRatio * Z))
  );

  return {
    shouldBid: nextBid <= spendingLimit,
    spendingLimit: Math.round(spendingLimit / 5) * 5,
    valuation,
    budgetRatio: Math.round(budgetRatio),
    scarcityMultiplier,
  };
}
