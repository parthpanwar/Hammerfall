// ============================================================
// IPL DYNASTY - Trade requests & blockbuster deals
//
// Real IPL trades are rare and usually have a story: a star stuck behind the
// overseas limit, a captain who wants a new start, a veteran chasing one more
// title, a rebuilding side cashing in. Each season a few players "ask to move";
// their franchise then sells for fair value instead of treating them as
// untouchable, which is what makes the occasional superstar trade possible.
// ============================================================

import type { Franchise, Player } from '@/lib/types/game';
import type { TradeProposal, TradeRequest } from '@/lib/types/trade';
import { createSeededRandom } from '@/lib/utils/random';
import { contractSalary, makeProposal, autoBalance, validateTrade, type TradeContext } from './trade-rules';
import { generalTradeValue, selectBestXi, teamTradeValue } from './trade-value';
import { teamDirection, thresholdFor, tradeUtility } from './trade-ai';

interface Candidate {
  player: Player;
  franchiseId: string;
  weight: number;
  reason: string;
}

/**
 * Pick this season's trade requests (2–3 league-wide, at most one per franchise).
 * A genuine superstar (87+) asks to leave in roughly one season in three.
 */
export function generateTradeRequests(franchises: Franchise[], season: number, seed: number, humanId?: string): Record<string, TradeRequest> {
  const rng = createSeededRandom((seed * 31 + season * 7919) >>> 0);
  const ctxLike = { franchises };
  const cands: Candidate[] = [];
  for (const f of franchises) {
    const xi = selectBestXi(f.players, (p) => p.ratings.overall);
    const dir = teamDirection(f, ctxLike);
    const humanDamp = f.id === humanId ? 0.5 : 1;
    for (const p of f.players) {
      const ovr = p.ratings.overall;
      let weight = 0;
      let reason = '';
      if (ovr >= 78 && !xi.includes(p)) {
        weight = 3;
        reason = 'Wants a bigger role — not a guaranteed starter here.';
      } else if (ovr >= 84 && p.age >= 26 && p.age <= 33 && dir === 'Rebuilding') {
        weight = 1.6;
        reason = 'Wants to compete for titles, not sit through a rebuild.';
      } else if (ovr >= 80 && p.age >= 33 && dir !== 'Contending') {
        weight = 1;
        reason = 'Open to a final move to a contender.';
      } else if (ovr >= 80) {
        weight = 0.25;
        reason = 'Looking for a fresh start after a difficult season.';
      }
      if (weight > 0) cands.push({ player: p, franchiseId: f.id, weight: weight * humanDamp, reason });
    }
  }

  const out: Record<string, TradeRequest> = {};
  const usedTeams = new Set<string>();
  const want = 2 + (rng.next() < 0.5 ? 1 : 0);
  const allowSuperstar = rng.next() < 0.33;
  let superstars = 0;
  let guard = 0;
  while (Object.keys(out).length < want && guard++ < 200) {
    const pool = cands.filter(
      (c) => !usedTeams.has(c.franchiseId) && !out[c.player.id] && (c.player.ratings.overall < 87 || (allowSuperstar && superstars === 0))
    );
    if (!pool.length) break;
    const total = pool.reduce((t, c) => t + c.weight, 0);
    let roll = rng.next() * total;
    const pick = pool.find((c) => (roll -= c.weight) <= 0) ?? pool[pool.length - 1];
    if (pick.player.ratings.overall >= 87) superstars++;
    usedTeams.add(pick.franchiseId);
    out[pick.player.id] = { playerId: pick.player.id, franchiseId: pick.franchiseId, season, reason: pick.reason };
  }
  return out;
}

/**
 * Best deal that moves a requested player from `sellerId` to `buyerId`, or null.
 * Sides: [seller, buyer]. The seller wants fair value; the buyer (CPU) must clear
 * its own threshold, or (human) must get stronger.
 */
export function buildRequestDeal(ctx: TradeContext, sellerId: string, buyerId: string, playerId: string): TradeProposal | null {
  const seller = ctx.franchises.find((f) => f.id === sellerId);
  const buyer = ctx.franchises.find((f) => f.id === buyerId);
  const star = seller?.players.find((p) => p.id === playerId);
  if (!seller || !buyer || !star || sellerId === buyerId) return null;
  const buyerIsHuman = buyerId === ctx.humanFranchiseId;
  const sellerValue = (p: Player) => teamTradeValue(p, sellerId, ctx.difficulty, contractSalary(p, buyerId, ctx));
  const buyerCore = new Set(
    [...buyer.players].sort((a, b) => teamTradeValue(b, buyerId, ctx.difficulty) - teamTradeValue(a, buyerId, ctx.difficulty)).slice(0, buyerIsHuman ? 0 : 2).map((p) => p.id)
  );
  const pieces = buyer.players
    .filter((p) => !buyerCore.has(p.id) && !(buyerIsHuman && ctx.trade.humanBlock[p.id] === 'Untouchable'))
    .sort((a, b) => sellerValue(b) - sellerValue(a))
    .slice(0, 7);
  const packages: string[][] = [];
  pieces.forEach((a, i) => {
    packages.push([a.id]);
    pieces.slice(i + 1, i + 4).forEach((b) => packages.push([a.id, b.id]));
  });

  // An overpaid star can move at a reduced fee (both clubs and the player agree).
  const salary = contractSalary(star, sellerId, ctx);
  const fair = generalTradeValue(star, salary).fairValueLakhs;
  const feeOptions: (number | undefined)[] = [undefined];
  if (fair < salary * 0.9) feeOptions.push(Math.max(Math.round((salary * 0.5) / 5) * 5, Math.round(fair / 5) * 5));

  const sellerThr = thresholdFor(ctx, sellerId, ctx.difficulty);
  const buyerThr = thresholdFor(ctx, buyerId, ctx.difficulty);
  let best: { p: TradeProposal; u: number } | null = null;
  for (const pkg of packages) {
    for (const fee of feeOptions) {
      let prop = makeProposal(ctx, sellerId, buyerId, [playerId], pkg, 'cpu');
      if (fee !== undefined) prop = { ...prop, fees: { [playerId]: fee } };
      prop = ctx.trade.rules.matchingMode === 'CashBalanced' ? autoBalance(prop, ctx) : prop;
      if (!validateTrade(prop, ctx).valid) continue;
      const mine = tradeUtility(prop, ctx, 0, ctx.difficulty).utility;
      if (mine < sellerThr) continue;
      const theirs = buyerIsHuman ? tradeUtility(prop, ctx, 1, 'Hard').strengthGain > 0.2 : tradeUtility(prop, ctx, 1, ctx.difficulty).utility >= buyerThr;
      if (!theirs) continue;
      if (!best || mine > best.u) best = { p: prop, u: mine };
    }
  }
  if (!best) return null;
  const req = ctx.trade.tradeRequests?.[playerId];
  const feeNote = best.p.fees?.[playerId] !== undefined ? ` He would move at a renegotiated fee.` : '';
  return {
    ...best.p,
    status: 'SUBMITTED',
    messages: [`${star.name} has asked for a trade (${req?.reason.replace(/\.$/, '').toLowerCase() ?? 'wants a move'}). ${seller.shortName} are listening.${feeNote}`],
  };
}
