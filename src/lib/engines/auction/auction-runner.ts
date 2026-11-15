// ============================================================
// IPL DYNASTY - Auction Runner
// Pure, UI-independent driver for the auction state machine.
// Every function forks the session first so React/zustand state is never
// mutated in place (the previous implementation mutated shared franchise
// arrays, which left squads and purses out of sync across screens).
// ============================================================

import type { AuctionSession, Franchise, Player } from '@/lib/types/game';
import {
  nominatePlayer,
  getMinimumBid,
  placeBid,
  processFinalCall,
  simulateAcceleratedCompletion,
} from '@/lib/engines/auction-engine';
import { cpuDecideBid } from '@/lib/engines/cpu-manager';
import { createSeededRandom } from '@/lib/utils/random';
import { formatPrice } from '@/lib/utils';

export interface AuctionStepResult {
  session: AuctionSession;
  message: string;
  lastBidderId: string | null;
}

/** Count overseas players actually on a roster (source of truth for the 8-overseas cap). */
export function countOverseas(players: Player[]): number {
  return players.filter((p) => p.nationality === 'Overseas').length;
}

/** Copy a franchise with its own mutable arrays. */
export function forkFranchise(f: Franchise): Franchise {
  return {
    ...f,
    players: [...f.players],
    auctionPurchases: [...(f.auctionPurchases || [])],
    retainedPlayers: [...(f.retainedPlayers || [])],
    currentOverseasCount: countOverseas(f.players),
  };
}

/** Structural copy of everything the auction engine mutates. */
export function forkSession(s: AuctionSession): AuctionSession {
  return {
    ...s,
    currentLot: s.currentLot ? { ...s.currentLot, bids: [...s.currentLot.bids] } : null,
    franchises: s.franchises.map(forkFranchise),
    soldPlayers: [...s.soldPlayers],
    unsoldPlayers: [...s.unsoldPlayers],
    playerPool: [...s.playerPool],
  };
}

export function isLotOpen(s: AuctionSession): boolean {
  return !!s.currentLot && s.currentLot.state === 'Active';
}

export function isAuctionFinished(s: AuctionSession): boolean {
  return s.state === 'COMPLETED';
}

/**
 * Advance the auction by exactly one beat: nominate the next lot, let one CPU
 * franchise raise, or move the hammer (going once → twice → sold/unsold).
 * Operates on (and returns) a forked session.
 */
export function stepAuction(input: AuctionSession, humanFranchiseId: string, seed?: number): AuctionStepResult {
  const session = forkSession(input);
  const rng = createSeededRandom(seed ?? Math.floor(Math.random() * 1_000_000));

  if (session.state === 'COMPLETED') {
    return { session, message: 'The auction has concluded.', lastBidderId: null };
  }

  if (!session.currentLot || session.currentLot.state !== 'Active') {
    const t = nominatePlayer(session);
    return { session, message: t.message, lastBidderId: null };
  }

  const lot = session.currentLot;
  const minBid = getMinimumBid(session);

  const contenders = session.franchises
    .filter((f) => f.id !== humanFranchiseId && f.id !== lot.currentBidderId)
    .sort(() => rng.next() - 0.5);

  for (const cpu of contenders) {
    const decision = cpuDecideBid(cpu, lot, session, rng);
    if (!decision.bid) continue;
    const res = placeBid(session, cpu.id, minBid);
    if (res.success) {
      return {
        session,
        message: `${cpu.shortName} raise the paddle — ${formatPrice(minBid)}`,
        lastBidderId: cpu.id,
      };
    }
  }

  const t = processFinalCall(session);
  return { session, message: prettifyMessage(t.message, session), lastBidderId: null };
}

/** Human franchise bids the next valid increment. */
export function humanBid(input: AuctionSession, humanFranchiseId: string): AuctionStepResult & { ok: boolean } {
  const session = forkSession(input);
  const amount = getMinimumBid(session);
  const res = placeBid(session, humanFranchiseId, amount);
  return {
    session,
    ok: res.success,
    message: res.success ? `You bid ${formatPrice(amount)}` : res.message,
    lastBidderId: res.success ? humanFranchiseId : null,
  };
}

/** Run CPU bidding until the current lot is sold or unsold. */
export function resolveCurrentLot(input: AuctionSession, humanFranchiseId: string): AuctionStepResult {
  let result: AuctionStepResult = { session: forkSession(input), message: '', lastBidderId: null };
  let guard = 0;
  while (isLotOpen(result.session) && guard++ < 2000) {
    result = stepAuction(result.session, humanFranchiseId);
  }
  return result;
}

/** Resolve `count` lots (the human franchise sits out). */
export function simulateLots(input: AuctionSession, humanFranchiseId: string, count: number): AuctionStepResult {
  let result: AuctionStepResult = { session: forkSession(input), message: '', lastBidderId: null };
  let resolved = 0;
  let guard = 0;
  while (resolved < count && !isAuctionFinished(result.session) && guard++ < 200_000) {
    if (!isLotOpen(result.session)) {
      result = stepAuction(result.session, humanFranchiseId);
      continue;
    }
    result = resolveCurrentLot(result.session, humanFranchiseId);
    resolved++;
  }
  return {
    ...result,
    message: `Simulated ${resolved} lot${resolved === 1 ? '' : 's'}. ${result.message}`,
  };
}

/**
 * Auction every remaining player through real CPU bidding (including the
 * accelerated unsold rounds), then top up any franchise still below the
 * legal 18-man minimum at base price.
 */
export function simulateRemainingAuction(input: AuctionSession, humanFranchiseId: string): AuctionStepResult & {
  autoFilled: number;
} {
  const result = simulateLots(input, humanFranchiseId, Number.MAX_SAFE_INTEGER);
  const session = result.session;
  const fill = simulateAcceleratedCompletion(session);
  return {
    session,
    autoFilled: fill.playersSold,
    lastBidderId: null,
    message:
      fill.playersSold > 0
        ? `Auction complete. ${fill.playersSold} under-strength slots filled at base price.`
        : 'Auction complete. All franchises have legal squads.',
  };
}

/** Close the auction early (e.g. user finishes) ensuring every squad is legal. */
export function finalizeAuction(input: AuctionSession): { session: AuctionSession; autoFilled: number } {
  const session = forkSession(input);
  const fill = simulateAcceleratedCompletion(session);
  return { session, autoFilled: fill.playersSold };
}

function prettifyMessage(message: string, session: AuctionSession): string {
  // Engine messages use raw lakh figures ("1250L"); convert to ₹ Cr / L.
  const lot = session.currentLot;
  if (!lot) return message;
  return message.replace(/(\d+)L\b/g, (_, n) => formatPrice(Number(n)));
}
