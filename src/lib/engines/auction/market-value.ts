// ============================================================
// IPL DYNASTY - Auction market value
//
// One price model shared by every CPU general manager:
//
//   value = rating curve × IPL pedigree × market price index
//
// • Rating curve — the same curve real fees follow (86 OVR ≈ ₹20 Cr), so trade
//   and auction valuations agree.
// • IPL pedigree — IPL franchises pay for players who have done it in India.
//   Proven, recent IPL performers earn a premium; overseas names who have never
//   played an IPL match carry a pitch/conditions risk discount (the Kyle Jamieson
//   / Tymal Mills lesson); IPL flops and players who have been out of the league
//   for a few seasons are marked down; young uncapped Indians carry upside.
// • Price index — prices clear the market. When the league holds more money per
//   open slot than the pool is "worth" (every mini auction once the purse grows),
//   prices inflate so the money gets spent, mostly on the best players. A deep
//   mega pool with tight purses deflates them.
// ============================================================

import type { AuctionSession, Franchise, Player } from '@/lib/types/game';
import { getPlayerAuctionCategory } from './dynamic-set-engine';
import { PROGRESSION_TUNING } from '../career/progression-tuning';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type PedigreeTag =
  | 'Proven IPL star'
  | 'IPL regular'
  | 'IPL squad player'
  | 'Out of the IPL'
  | 'IPL flop risk'
  | 'Unproven in India'
  | 'Uncapped prospect'
  | 'Domestic breakout'
  | 'New to the IPL';

export interface Pedigree {
  multiplier: number;
  tag: PedigreeTag;
  /** Seasons since the player was last in an IPL squad (0 = last season). */
  gap: number | null;
  /** IPL output index, −1 (flop) … +1 (dominant); 0 when there is no sample. */
  performance: number;
  proven: boolean;
}

/** How a player has actually performed in the IPL, sample-weighted (−1 … +1). */
export function iplPerformance(p: Player): number {
  const r = p.ipl;
  if (!r || r.matches === 0) return 0;
  const balls = r.strikeRate > 0 ? (r.runs * 100) / r.strikeRate : 0;
  const bat = ((r.strikeRate - 138) / 22) * 0.6 + ((r.battingAvg - 26) / 14) * 0.4;
  const batW = clamp(balls / 240, 0, 1);
  const wkPer4 = r.ballsBowled > 0 ? r.wickets / (r.ballsBowled / 24) : 0;
  const bowl = ((8.9 - r.economy) / 1.0) * 0.6 + ((wkPer4 - 1.1) / 0.5) * 0.4;
  const bowlW = clamp(r.ballsBowled / 300, 0, 1);
  let score: number;
  if (p.role === 'Bowler') score = bowl * bowlW;
  else if (p.role === 'All-Rounder') score = batW + bowlW > 0 ? (bat * batW * batW + bowl * bowlW * bowlW) / (batW + bowlW) : 0;
  else score = bat * batW;
  return clamp(score, -1, 1);
}

/**
 * Overseas slots are scarce: four a match. Teams will not spend one on a player in
 * his mid-thirties unless he is still a current, proven IPL performer.
 */
function overseasAgeFactor(p: Player, settled: boolean): number {
  if (p.nationality !== 'Overseas' || p.age < 33) return 1;
  if (p.age >= 37) return settled ? 0.8 : 0.6;
  if (p.age >= 35) return settled ? 0.9 : 0.72;
  return settled ? 1 : 0.86;
}

/** Fresh off a breakout domestic season (scouts have seen it; the market has not priced it in). */
function domesticBuzz(p: Player, season: number): boolean {
  const d = p.development;
  return !!d && d.trend === 'Domestic breakout' && d.season >= season - 1;
}

/**
 * IPL pedigree for an auction held before `season` (the 2027 auction is in Dec 2026,
 * so "last season" is 2026).
 */
export function iplPedigree(p: Player, season: number): Pedigree {
  const r = p.ipl;
  const overseas = p.nationality === 'Overseas';
  const youngUncapped = !overseas && p.status === 'Uncapped' && p.age <= 23;
  const lastSquad = r ? Math.max(r.lastSquadSeason ?? 0, r.lastSeason || 0) : 0;
  const gap = lastSquad > 0 ? Math.max(0, season - 1 - lastSquad) : null;

  // Never played an IPL match.
  if (!r || r.matches === 0) {
    let m: number;
    let tag: PedigreeTag;
    if (overseas) {
      // Unknown in Indian conditions. Elite internationals still draw bids, at a discount.
      m = p.ratings.overall >= 86 ? 0.8 : p.ratings.overall >= 80 ? 0.7 : 0.66;
      tag = 'Unproven in India';
      if (gap === 0) m += 0.08; // was in a squad last year without getting a game
    } else if (domesticBuzz(p, season) && !overseas) {
      m = p.age <= 25 ? 1.3 : 1.15;
      tag = 'Domestic breakout';
    } else if (youngUncapped) {
      // The upside is already in the rating curve (headroom); this is the scouting buzz.
      m = PROGRESSION_TUNING.market.prospectPedigree;
      tag = 'Uncapped prospect';
    } else if (p.status === 'Uncapped' && p.age >= 27) {
      m = 0.85; // domestic journeyman the league has already passed over
      tag = 'New to the IPL';
    } else {
      m = gap === 0 ? 1.0 : 0.9;
      tag = 'New to the IPL';
    }
    m *= overseasAgeFactor(p, false);
    return { multiplier: m, tag, gap, performance: 0, proven: false };
  }

  // Teams pay for what a player is doing now: last season counts for more than a
  // decade-old IPL record (a faded star is not bought on his name).
  const career = iplPerformance(p);
  const recent = p.development && p.development.season >= season - 1 && typeof p.development.perf === 'number' ? clamp(p.development.perf, -1, 1) : null;
  const perf = recent === null ? career : clamp(0.4 * career + 0.6 * recent, -1, 1);
  const proven = r.seasons >= 3 || r.matches >= 25;
  const g = gap ?? 9;
  let m = g <= 0 ? 1.1 : g === 1 ? 1.0 : g === 2 ? 0.82 : g === 3 ? 0.68 : 0.55;
  m *= r.matches >= 40 ? 1.08 : r.matches >= 15 ? 1.04 : r.matches < 8 ? 0.95 : 1;
  m *= 1 + (perf < 0 ? 0.28 : 0.16) * perf;
  if (g >= 2 && p.age >= 35) m *= 0.85; // veterans who have drifted out of the league
  if (youngUncapped) m *= 1.15;
  else if (!overseas && p.status === 'Uncapped' && p.age >= 27 && !proven) m *= 0.9;
  if (!overseas && proven && g <= 1) m *= 1.06; // proven Indians: no overseas slot needed
  m *= overseasAgeFactor(p, proven && g <= 1);
  const buzz = !overseas && domesticBuzz(p, season) && r.matches < 15;
  if (buzz) m *= 1.15;
  const M = PROGRESSION_TUNING.market;
  // Fading: dropped 2+ last off-season, or past 33 and no longer elite.
  const d = p.development;
  if (d && d.season >= season - 1 && (d.trend === 'Declining' || d.overallDelta <= -2)) m *= M.decliningDiscount;
  if (p.age >= 33 && p.ratings.overall < 82) m *= M.agingDiscount;
  // Reputation can't carry a merely decent player: the premium needs a current 80+.
  if (p.ratings.overall < 80) m = Math.min(m, M.reputationCapBelow80);

  let tag: PedigreeTag;
  if (g >= 2) tag = 'Out of the IPL';
  else if (perf <= -0.35 && r.matches >= 8) tag = 'IPL flop risk';
  else if (proven && perf >= 0.25) tag = 'Proven IPL star';
  else if (proven) tag = 'IPL regular';
  else if (buzz) tag = 'Domestic breakout';
  else if (youngUncapped) tag = 'Uncapped prospect';
  else tag = 'IPL squad player';

  return { multiplier: clamp(m, overseas && p.age >= 34 ? 0.3 : 0.5, 1.5), tag, gap, performance: perf, proven };
}

/**
 * Auction price curve (lakhs). Steeper than the trade curve: in an auction the
 * top of the market (85+) takes a big share of the money and solid 75–80 players
 * are plentiful. Calibrated to recent IPL auctions: 88 ≈ ₹24 Cr, 85 ≈ ₹14 Cr,
 * 82 ≈ ₹8 Cr, 78 ≈ ₹4 Cr, 74 ≈ ₹2 Cr, 70 ≈ ₹80 L. Youth upside counts less than
 * in trades — an auction buys this season first.
 */
export function auctionRatingValue(p: Player): number {
  const ovr = p.ratings.overall;
  const headroom = Math.max(0, p.ratings.potential - ovr);
  // Headroom counts, but an auction buys this season first: a 17-year-old 75/92 is a
  // ₹3–6 Cr punt, not a ₹10 Cr one.
  const youth = PROGRESSION_TUNING.market.youth.find((r) => p.age <= r.maxAge)?.weight ?? 0;
  const decline = p.age >= 37 ? 5 : p.age >= 35 ? 3 : p.age >= 33 ? 1 : 0;
  const eff = ovr + headroom * youth - decline;
  return Math.round(clamp(34 * Math.exp((eff - 64) / 5.6) - 20, 20, 4000));
}

const baseCache = new Map<string, number>();

/** Value before market conditions (lakhs). */
export function baseMarketValue(p: Player, season: number): number {
  const key = `${p.id}:${season}:${p.ratings.overall}:${p.ratings.potential}:${p.age}:${p.ipl?.matches ?? -1}:${p.ipl?.lastSquadSeason ?? 0}:${p.development?.trend ?? ''}${p.development?.season ?? ''}:${p.status}`;
  const hit = baseCache.get(key);
  if (hit !== undefined) return hit;
  const ped = iplPedigree(p, season);
  // Last season's IPL breakouts: teams chase the player everyone just watched.
  // (Domestic breakouts carry their own premium in the pedigree.)
  const bump = p.development?.trend === 'Breakout' && p.development.season >= season - 1 ? PROGRESSION_TUNING.market.breakoutBump : 1;
  const v = Math.max(p.basePrice, Math.round(auctionRatingValue(p) * ped.multiplier * bump));
  if (baseCache.size > 20000) baseCache.clear();
  baseCache.set(key, v);
  return v;
}

/** Spots each franchise will realistically fill in this auction. */
function demandSlots(f: Franchise, mega: boolean): number {
  const target = mega ? 22 : 21;
  return clamp(Math.max(f.minSquadSize - f.players.length, target - f.players.length), 0, f.maxSquadSize - f.players.length);
}

/**
 * Market price index: money the league will spend ÷ what the players it needs are
 * worth at base value. >1 inflates prices (cash-rich minis), <1 deflates them.
 */
export function computePriceIndex(franchises: Franchise[], pool: Player[], season: number, mega: boolean): number {
  const slots = franchises.reduce((t, f) => t + demandSlots(f, mega), 0);
  if (slots <= 0) return 1;
  const money = franchises.reduce((t, f) => t + Math.max(0, f.remainingPurse - demandSlots(f, mega) * 20), 0);
  // Teams spend most of what they hold; a sliver stays back for trades and top-ups.
  const spendable = money * 0.95;
  const values = pool.map((p) => baseMarketValue(p, season)).sort((a, b) => b - a);
  // Teams pay full value for the starters they target (~half their slots) and fill
  // the rest of the squad near the floor of the market.
  const starters = Math.ceil(slots * 0.4);
  const worth =
    values.slice(0, starters).reduce((t, v) => t + v, 0) +
    values.slice(starters, slots).reduce((t, v) => t + Math.max(20, v * 0.3), 0) +
    Math.max(0, slots - values.length) * 20;
  if (worth <= 0) return 1;
  // A mega room never deflates below list value: the purse has to be spent there
  // (unspent mega money is wasted), and teams fill 23–25 spots, not 40% of them.
  const floor = mega ? PROGRESSION_TUNING.market.megaIndexFloor : 0.3;
  return Math.round(clamp(spendable / worth, floor, 3.2) * 100) / 100;
}

/**
 * How far through the auction we are (0 … 1). The accelerated rounds (2, 3) re-run
 * the unsold players from index 0, so they count as the end of the auction.
 */
export function auctionProgress(session: Pick<AuctionSession, 'round' | 'currentPlayerIndex' | 'playerPool'>): number {
  if ((session.round ?? 1) >= 2) return 1;
  return session.playerPool.length ? Math.min(1, session.currentPlayerIndex / session.playerPool.length) : 1;
}

const indexCache = new Map<string, number>();

/**
 * Live price index: recomputed as the auction moves, from the money still in the
 * room against the players still to come. Teams that sit on cash late find the
 * remaining good players get dearer; a room that spent big early cools down.
 */
export function sessionPriceIndex(session: AuctionSession): number {
  const key = `${session.id}:${session.round}:${session.currentPlayerIndex}`;
  const hit = indexCache.get(key);
  if (hit !== undefined) return hit;
  const remaining = session.playerPool.slice(Math.max(0, session.currentPlayerIndex));
  const mega = session.auctionType === 'Mega';
  const open = session.priceIndex ?? computePriceIndex(session.franchises, session.playerPool, session.seasonYear, mega);
  // The room can heat up or cool down, but not run away from its opening level.
  const live = clamp(computePriceIndex(session.franchises, remaining, session.seasonYear, mega), open * 0.8, open * 1.4);
  if (indexCache.size > 5000) indexCache.clear();
  indexCache.set(key, live);
  return live;
}

/**
 * What the market will pay for a player in this auction (lakhs). Inflation lands
 * hardest on the best players — that is where surplus money chases in real minis.
 */
/**
 * How much of the market's inflation reaches this player. Surplus money chases
 * proven names; an uncapped kid who has never played an IPL game is a punt that
 * teams price on talent, not on how much cash is left over.
 */
function inflationWeight(p: Player, value: number): number {
  void value;
  const M = PROGRESSION_TUNING.market;
  // Surplus money chases current quality, not price tags or reputations.
  const ovr = p.ratings.overall;
  let w = M.inflationByOvr.find((r) => ovr >= r.minOvr)?.weight ?? 0.25;
  if (p.age >= 32 && ovr < 84) w *= M.veteranInflation;
  const unproven = p.status === 'Uncapped' && !(p.ipl && p.ipl.matches > 0);
  return unproven ? w * M.unprovenInflation : w;
}

export function auctionMarketValue(p: Player, session: Pick<AuctionSession, 'seasonYear' | 'auctionType' | 'id' | 'priceIndex' | 'franchises' | 'playerPool'>): number {
  const base = baseMarketValue(p, session.seasonYear);
  const idx = sessionPriceIndex(session as AuctionSession);
  return Math.max(p.basePrice, Math.round((base * Math.pow(idx, inflationWeight(p, base))) / 5) * 5);
}

/**
 * Hard ceiling on any CPU bid (lakhs): the rating curve's price for a player a few
 * points better than he is NOW, with this player's share of the room's inflation.
 * A former 82 now rated 74 is priced as a 74 — never ₹18 Cr. Youngsters keep their
 * headroom allowance through the curve; the elite are effectively uncapped.
 */
export function ratingPriceCeiling(p: Player, session: Pick<AuctionSession, 'seasonYear' | 'auctionType' | 'id' | 'priceIndex' | 'franchises' | 'playerPool'>): number {
  const T = PROGRESSION_TUNING.market;
  const lifted = { ...p, ratings: { ...p.ratings, overall: p.ratings.overall + T.ceilingOvrMargin } };
  const base = auctionRatingValue(lifted);
  const idx = Math.max(1, sessionPriceIndex(session as AuctionSession));
  return Math.max(p.basePrice, Math.round(base * Math.pow(idx, inflationWeight(p, base)) * T.ceilingMultiplier));
}

/** What the market thinks he is worth, without the base-price floor (lakhs). */
export function unflooredMarketValue(p: Player, session: AuctionSession): number {
  const raw = auctionRatingValue(p) * iplPedigree(p, session.seasonYear).multiplier;
  return Math.round(raw * Math.pow(sessionPriceIndex(session), inflationWeight(p, raw)));
}

/**
 * Patience discount for spending early: if comparable, proven players in the same
 * category are still to come, don't blow the purse on this one — especially when
 * this one is unproven in Indian conditions. Elite proven players are exempt.
 */
export function patienceMultiplier(p: Player, session: AuctionSession): number {
  const ped = iplPedigree(p, session.seasonYear);
  if (p.ratings.overall >= 87 && ped.proven) return 1;
  const cat = getPlayerAuctionCategory(p);
  const mine = baseMarketValue(p, session.seasonYear);
  const later = session.playerPool.slice(session.currentPlayerIndex + 1);
  let comparable = 0;
  for (const q of later) {
    if (q.id === p.id || getPlayerAuctionCategory(q) !== cat) continue;
    if (q.ratings.overall < p.ratings.overall - 2) continue;
    const qp = iplPedigree(q, session.seasonYear);
    if (qp.multiplier >= 0.95 && baseMarketValue(q, session.seasonYear) >= mine * 0.8) comparable++;
  }
  let m = 1 - Math.min(0.25, comparable * 0.06);
  if (ped.tag === 'Unproven in India' && comparable >= 1) m *= 0.88;
  return m;
}

/** The most a single player should cost relative to the purse (real IPL record ≈ 22%). */
export function singlePlayerCap(p: Player, f: Franchise, season: number): number {
  const ped = iplPedigree(p, season);
  const settled = ped.proven && (ped.gap ?? 9) <= 1;
  const share = p.ratings.overall >= 86 && settled ? 0.24 : p.ratings.overall >= 82 && settled ? 0.2 : settled || ped.tag === 'Uncapped prospect' ? 0.14 : 0.1;
  // Nobody commits a fifth of the purse to a player in his mid-thirties.
  const ageShare = p.age >= 36 ? 0.09 : p.age >= 34 ? 0.12 : 1;
  // Three or more seasons out of the league: a punt, never a headline signing.
  if ((ped.gap ?? 0) >= 3) return Math.round(f.totalPurse * Math.min(0.06, ageShare));
  return Math.round(f.totalPurse * Math.min(share, ageShare));
}

/**
 * Cash-rich teams push harder. A franchise holding more money per open slot than
 * the room average will go further for the players it wants (and a stretched one
 * less far) — that is what turns late-auction leftovers into bidding wars.
 */
export function teamWealthFactor(f: Franchise, session: AuctionSession): number {
  const mega = session.auctionType === 'Mega';
  const perSlot = (x: Franchise) => x.remainingPurse / Math.max(1, demandSlots(x, mega));
  const active = session.franchises.filter((x) => demandSlots(x, mega) > 0);
  if (!active.length || demandSlots(f, mega) === 0) return 1;
  const avg = active.reduce((t, x) => t + perSlot(x), 0) / active.length;
  if (avg <= 0) return 1;
  return clamp(Math.sqrt(perSlot(f) / avg), 0.88, 1.22);
}

/**
 * A contract the market would no longer pay: salary well above what this player
 * would fetch in the next auction. Real franchises cut these before a mini auction
 * (that is how Venkatesh Iyer, Maxwell or Pant-type deals come back to the pool).
 */
export function isOverpaidContract(p: Player, salaryLakhs: number, season: number): boolean {
  if (salaryLakhs < 500 || p.age < 24) return false;
  return salaryLakhs >= 1.7 * baseMarketValue(p, season);
}
