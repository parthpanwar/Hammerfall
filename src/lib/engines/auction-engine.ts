// ============================================================
// IPL DYNASTY - Auction Engine
// Complete auction state machine with validation
// ============================================================

import type {
  AuctionSession,
  AuctionState,
  AuctionLot,
  AuctionBid,
  AuctionPurchase,
  Player,
  Franchise,
  AuctionPace,
  AuctionType,
  SeededRandom,
} from '@/lib/types/game';
import type { DynamicAuctionSequence } from '@/lib/types/auction-set';
import { generateDynamicAuctionSequence } from './auction/dynamic-set-engine';
import { getBidIncrement } from '@/lib/utils/index';

// --- Interfaces ---

export interface AuctionSettings {
  seasonYear: number;
  auctionType: AuctionType;
  pace: AuctionPace;
  totalRounds: number;
  seed?: number;
}

export interface AuctionTransition {
  previousState: AuctionState;
  newState: AuctionState;
  lot: AuctionLot | null;
  message: string;
}

export interface BidResult {
  success: boolean;
  message: string;
  newBid?: number;
}

// --- Constants ---

const MIN_SQUAD_BASE_COST = 20; // 20L minimum per player at auction
const MAX_FINAL_CALL_COUNT = 3; // going once, twice, sold

// --- Session Creation ---

/** Create a new auction session with dynamic sets and intelligent sequencing. */
export function createAuctionSession(
  franchises: Franchise[],
  playerPool: Player[],
  settings: AuctionSettings,
  existingSequence?: DynamicAuctionSequence
): AuctionSession {
  // Filter out retained players from the pool
  let availablePlayers = playerPool.filter(
    (p) => p.isAvailableForAuction && !p.isRetained
  );
  if (availablePlayers.length === 0) {
    availablePlayers = playerPool.filter((p) => !p.isRetained);
  }

  const seed = settings.seed ?? Date.now();
  const sequence = existingSequence || generateDynamicAuctionSequence(availablePlayers, seed);

  // Map players into ordered sequence by sequence.orderedPlayerIds
  const playerMap = new Map(availablePlayers.map((p) => [p.id, p]));
  const orderedPlayers: Player[] = [];
  for (const id of sequence.orderedPlayerIds) {
    const p = playerMap.get(id);
    if (p) orderedPlayers.push(p);
  }
  // Append any remainder players if not covered in sequence
  for (const p of availablePlayers) {
    if (!sequence.assignments[p.id]) {
      orderedPlayers.push(p);
    }
  }

  return {
    id: `auction-${settings.seasonYear}-${Date.now()}`,
    seasonYear: settings.seasonYear,
    auctionType: settings.auctionType,
    state: 'NOMINATION' as AuctionState,
    currentLot: null,
    currentPlayerIndex: -1,
    playerPool: orderedPlayers,
    soldPlayers: [],
    unsoldPlayers: [],
    round: 1,
    totalRounds: settings.totalRounds,
    franchises: franchises.map((f) => ({ ...f })),
    pace: settings.pace,
    isPaused: false,
    humanAutoBidMax: 0,
    auctionSeed: sequence.auctionSeed,
    currentSetIndex: 0,
    sets: sequence.sets,
    setAssignments: sequence.assignments,
  };
}

// --- Nomination ---

/** Pick the next player from the pool for nomination. */
export function nominatePlayer(session: AuctionSession): AuctionTransition {
  if (
    session.state !== 'NOMINATION' &&
    session.state !== 'NEXT_PLAYER' &&
    session.state !== 'SOLD' &&
    session.state !== 'UNSOLD'
  ) {
    return {
      previousState: session.state,
      newState: session.state,
      lot: session.currentLot,
      message: `Cannot nominate in state ${session.state}.`,
    };
  }

  session.currentPlayerIndex++;

  // Check if we've exhausted the player pool for this round
  if (session.currentPlayerIndex >= session.playerPool.length) {
    // Check if there are unsold players to recycle for another round
    // If any team still has not reached legal minimum squad of 18, allow accelerated recycling up to round 8
    const hasUnderStrengthTeams = session.franchises.some((f) => f.players.length < (f.minSquadSize ?? 18));
    const canRecycle =
      (session.round < session.totalRounds || (hasUnderStrengthTeams && session.round < 8)) &&
      session.unsoldPlayers.length > 0;

    if (canRecycle) {
      session.round++;
      session.playerPool = [...session.unsoldPlayers];
      session.unsoldPlayers = [];
      session.currentPlayerIndex = 0;
    } else {
      // Auction complete
      session.state = 'COMPLETED';
      session.currentLot = null;
      return {
        previousState: 'NOMINATION',
        newState: 'COMPLETED',
        lot: null,
        message: 'Auction completed. All players have been auctioned.',
      };
    }
  }

  const player = session.playerPool[session.currentPlayerIndex];
  const assignment = session.setAssignments?.[player.id];
  const currentSet = assignment ? session.sets?.find((s) => s.id === assignment.auctionSetId) : undefined;
  const currentSetOrder = currentSet?.order || 1;
  const nextSet = session.sets?.find((s) => s.order === currentSetOrder + 1);

  const lot: AuctionLot = {
    player,
    basePrice: player.basePrice,
    currentBid: player.basePrice,
    currentBidderId: null,
    bids: [],
    state: 'Active',
    finalCallCount: 0,
    round: session.round,
    auctionSetId: assignment?.auctionSetId,
    auctionSetCode: assignment?.auctionSetCode,
    auctionSetName: assignment?.auctionSetName,
    auctionSetCategory: assignment?.auctionSetCategory,
    playerOrderWithinSet: assignment?.playerOrderWithinSet,
    totalInSet: currentSet?.totalCount || 1,
    nextSetName: nextSet?.name,
    nextSetCode: nextSet?.code,
  };

  session.currentLot = lot;
  session.state = 'OPEN_BIDDING';

  const setPrefix = assignment ? `[${assignment.auctionSetCode} • #${assignment.playerOrderWithinSet}/${currentSet?.totalCount || 1}] ` : '';

  return {
    previousState: 'NOMINATION',
    newState: 'OPEN_BIDDING',
    lot,
    message: `${setPrefix}${player.name} is up for auction at base price ${player.basePrice}L.`,
  };
}

// --- Bid Validation ---

/** Get the minimum valid bid for the current lot. */
export function getMinimumBid(session: AuctionSession): number {
  if (!session.currentLot) return 0;
  const lot = session.currentLot;

  if (lot.bids.length === 0) {
    // First bid is at base price
    return lot.basePrice;
  }

  return lot.currentBid + getBidIncrement(lot.currentBid);
}

/** Check if a franchise can legally bid on the current lot. */
export function canFranchiseBid(franchise: Franchise, session: AuctionSession): boolean {
  if (!session.currentLot) return false;

  const lot = session.currentLot;
  const player = lot.player;
  const minBid = getMinimumBid(session);

  // Already the highest bidder
  if (lot.currentBidderId === franchise.id) return false;

  // Check remaining purse
  if (franchise.remainingPurse < minBid) return false;

  // Check max squad size
  if (franchise.players.length >= franchise.maxSquadSize) return false;

  // Check overseas quota
  const maxOverseas = franchise.maxOverseas ?? 8;
  if (player.nationality === 'Overseas' && franchise.currentOverseasCount >= maxOverseas) {
    return false;
  }

  // Check minimum purse needed for remaining squad slots (official IPL minimum is 18 players)
  const legalMinSquad = franchise.minSquadSize ?? 18;
  const slotsNeeded = Math.max(0, legalMinSquad - franchise.players.length - 1); // -1 for this player
  if (slotsNeeded > 0) {
    const minReserve = slotsNeeded * MIN_SQUAD_BASE_COST;
    if (franchise.remainingPurse - minBid < minReserve) return false;
  }

  return true;
}

/** Validate a specific bid amount from a franchise. */
export function validateBid(
  session: AuctionSession,
  franchiseId: string,
  amount: number
): BidResult {
  if (!session.currentLot) {
    return { success: false, message: 'No player is currently up for auction.' };
  }

  if (session.state !== 'OPEN_BIDDING' && session.state !== 'FINAL_CALL') {
    return { success: false, message: `Cannot bid in state ${session.state}.` };
  }

  const franchise = session.franchises.find((f) => f.id === franchiseId);
  if (!franchise) {
    return { success: false, message: 'Franchise not found.' };
  }

  const lot = session.currentLot;
  const player = lot.player;

  // Already highest bidder
  if (lot.currentBidderId === franchiseId) {
    return { success: false, message: 'You are already the highest bidder.' };
  }

  // Bid must be >= minimum
  const minBid = getMinimumBid(session);
  if (amount < minBid) {
    return { success: false, message: `Bid must be at least ${minBid}L.` };
  }

  // Must afford it
  if (amount > franchise.remainingPurse) {
    return { success: false, message: `Insufficient purse. You have ${franchise.remainingPurse}L.` };
  }

  // Max squad check
  const maxSquad = franchise.maxSquadSize ?? 25;
  if (franchise.players.length >= maxSquad) {
    return { success: false, message: `Squad is full (${maxSquad}/${maxSquad}).` };
  }

  // Overseas check
  const maxOverseas = franchise.maxOverseas ?? 8;
  if (player.nationality === 'Overseas' && franchise.currentOverseasCount >= maxOverseas) {
    return { success: false, message: `Overseas quota full (${maxOverseas}/${maxOverseas}).` };
  }

  // Reserve check (official IPL minimum is 18 players)
  const legalMinSquad = franchise.minSquadSize ?? 18;
  const slotsNeeded = Math.max(0, legalMinSquad - franchise.players.length - 1);
  if (slotsNeeded > 0) {
    const minReserve = slotsNeeded * MIN_SQUAD_BASE_COST;
    if (franchise.remainingPurse - amount < minReserve) {
      return {
        success: false,
        message: `Must reserve ${minReserve}L for ${slotsNeeded} remaining squad slots to reach min ${legalMinSquad}.`,
      };
    }
  }

  // Bid must be higher than current
  if (lot.bids.length > 0 && amount <= lot.currentBid) {
    return { success: false, message: `Bid must be higher than current bid of ${lot.currentBid}L.` };
  }

  return { success: true, message: 'Valid bid.' };
}

// --- Bid Placement ---

/** Place a bid on the current lot. */
export function placeBid(
  session: AuctionSession,
  franchiseId: string,
  amount: number
): BidResult {
  const validation = validateBid(session, franchiseId, amount);
  if (!validation.success) return validation;

  const lot = session.currentLot!;

  const bid: AuctionBid = {
    franchiseId,
    amount,
    timestamp: Date.now(),
    isAutomatic: false,
  };

  lot.bids.push(bid);
  lot.currentBid = amount;
  lot.currentBidderId = franchiseId;
  lot.finalCallCount = 0; // Reset final call on new bid

  // If we were in FINAL_CALL state, go back to OPEN_BIDDING
  if (session.state === 'FINAL_CALL') {
    session.state = 'OPEN_BIDDING';
  }

  return {
    success: true,
    message: `Bid placed: ${amount}L by ${franchiseId}.`,
    newBid: amount,
  };
}

/** Pass on the current player (franchise opts out of bidding). */
export function passBid(
  session: AuctionSession,
  franchiseId: string
): BidResult {
  if (!session.currentLot) {
    return { success: false, message: 'No active lot.' };
  }
  if (session.state !== 'OPEN_BIDDING' && session.state !== 'FINAL_CALL') {
    return { success: false, message: `Cannot pass in state ${session.state}.` };
  }

  // Passing is always valid. The engine tracks who has passed externally
  // or via advancing state when no one bids.
  return {
    success: true,
    message: `${franchiseId} passes.`,
  };
}

// --- State Machine ---

/** Process the final call sequence: going once → going twice → sold. */
export function processFinalCall(session: AuctionSession): AuctionTransition {
  if (!session.currentLot) {
    return {
      previousState: session.state,
      newState: session.state,
      lot: null,
      message: 'No active lot.',
    };
  }

  const lot = session.currentLot;
  const prevState = session.state;

  // If no one has bid at all, mark unsold
  if (lot.bids.length === 0) {
    return markUnsold(session);
  }

  lot.finalCallCount++;
  session.state = 'FINAL_CALL';

  if (lot.finalCallCount === 1) {
    return {
      previousState: prevState,
      newState: 'FINAL_CALL',
      lot,
      message: `Going once at ${lot.currentBid}L...`,
    };
  } else if (lot.finalCallCount === 2) {
    return {
      previousState: prevState,
      newState: 'FINAL_CALL',
      lot,
      message: `Going twice at ${lot.currentBid}L...`,
    };
  } else {
    // Final call count >= 3 → SOLD
    return markSold(session);
  }
}

/** Advance the auction state machine forward. */
export function advanceAuctionState(session: AuctionSession): AuctionTransition {
  const prevState = session.state;

  switch (session.state) {
    case 'NOMINATION':
    case 'NEXT_PLAYER':
      return nominatePlayer(session);

    case 'OPEN_BIDDING':
      // Move to final call if no new bids are expected
      return processFinalCall(session);

    case 'FINAL_CALL':
      return processFinalCall(session);

    case 'SOLD':
    case 'UNSOLD':
      // Move to next player
      session.state = 'NEXT_PLAYER';
      return {
        previousState: prevState,
        newState: 'NEXT_PLAYER',
        lot: session.currentLot,
        message: 'Moving to next player.',
      };

    case 'COMPLETED':
      return {
        previousState: 'COMPLETED',
        newState: 'COMPLETED',
        lot: null,
        message: 'Auction is already completed.',
      };

    case 'PAUSED':
      return {
        previousState: 'PAUSED',
        newState: 'PAUSED',
        lot: session.currentLot,
        message: 'Auction is paused.',
      };

    default:
      return {
        previousState: prevState,
        newState: prevState,
        lot: session.currentLot,
        message: `Unknown state: ${session.state}`,
      };
  }
}

/** Mark the current lot as sold. Updates franchise and player records. */
export function markSold(session: AuctionSession): AuctionTransition {
  if (!session.currentLot || !session.currentLot.currentBidderId) {
    return markUnsold(session);
  }

  const lot = session.currentLot;
  const prevState = session.state;
  const winnerId = lot.currentBidderId!;
  const price = lot.currentBid;
  const player = lot.player;

  // Update lot state
  lot.state = 'Sold';

  // Create purchase record
  const purchase: AuctionPurchase = {
    playerId: player.id,
    playerName: player.name,
    franchiseId: winnerId,
    price,
    basePrice: player.basePrice,
    round: session.round,
    bidCount: lot.bids.length,
    timestamp: Date.now(),
  };

  session.soldPlayers.push(purchase);

  // Update winning franchise
  const franchise = session.franchises.find((f) => f.id === winnerId);
  if (franchise) {
    franchise.remainingPurse -= price;
    franchise.players.push({
      ...player,
      currentFranchiseId: winnerId,
      isSold: true,
      soldPrice: price,
      currentContractValue: price,
    });
    franchise.auctionPurchases.push(purchase);
    if (player.nationality === 'Overseas') {
      franchise.currentOverseasCount++;
    }
  }

  // Update player state
  player.isSold = true;
  player.soldPrice = price;
  player.currentFranchiseId = winnerId;
  player.currentContractValue = price;

  session.state = 'SOLD';

  return {
    previousState: prevState,
    newState: 'SOLD',
    lot,
    message: `SOLD! ${player.name} to ${franchise?.shortName ?? winnerId} for ${price}L. (${lot.bids.length} bids)`,
  };
}

/** Mark the current player as unsold. */
export function markUnsold(session: AuctionSession): AuctionTransition {
  if (!session.currentLot) {
    return {
      previousState: session.state,
      newState: session.state,
      lot: null,
      message: 'No active lot to mark unsold.',
    };
  }

  const lot = session.currentLot;
  const prevState = session.state;
  const player = lot.player;

  lot.state = 'Unsold';
  session.unsoldPlayers.push(player);
  session.state = 'UNSOLD';

  return {
    previousState: prevState,
    newState: 'UNSOLD',
    lot,
    message: `UNSOLD. ${player.name} finds no buyers at base price ${player.basePrice}L.`,
  };
}

// --- Utility Queries ---

/** Get all franchises that can still bid on the current lot. */
export function getEligibleBidders(session: AuctionSession): Franchise[] {
  if (!session.currentLot) return [];
  return session.franchises.filter((f) => canFranchiseBid(f, session));
}

/** Get auction progress percentage. */
export function getAuctionProgress(session: AuctionSession): number {
  const total = session.playerPool.length;
  if (total === 0) return 0;
  const processed = session.soldPlayers.length + session.unsoldPlayers.length;
  return Math.min(100, Math.round((processed / total) * 100));
}

/** Get count of remaining players to be auctioned. */
export function getRemainingPlayers(session: AuctionSession): number {
  return Math.max(0, session.playerPool.length - session.currentPlayerIndex - 1);
}

/** Get a summary of the current auction state. */
export function getAuctionSummary(session: AuctionSession): {
  state: AuctionState;
  round: number;
  sold: number;
  unsold: number;
  remaining: number;
  totalSpent: number;
  currentPlayer: string | null;
  currentBid: number;
  highestBidder: string | null;
} {
  return {
    state: session.state,
    round: session.round,
    sold: session.soldPlayers.length,
    unsold: session.unsoldPlayers.length,
    remaining: getRemainingPlayers(session),
    totalSpent: session.soldPlayers.reduce((sum, p) => sum + p.price, 0),
    currentPlayer: session.currentLot?.player.name ?? null,
    currentBid: session.currentLot?.currentBid ?? 0,
    highestBidder: session.currentLot?.currentBidderId ?? null,
  };
}

/**
 * Automatically simulates accelerated bidding on remaining unsold players
 * and optional fallback domestic players to guarantee all 10 franchises reach
 * the official legal squad minimum (18) within financial and overseas limits.
 */
export function simulateAcceleratedCompletion(
  session: AuctionSession,
  fallbackPool?: Player[]
): {
  completed: boolean;
  playersSold: number;
  underStrengthFranchises: string[];
} {
  let soldCount = 0;
  const pool = [...session.unsoldPlayers, ...(fallbackPool || [])];
  const usedPlayerIds = new Set<string>(session.soldPlayers.map((p) => p.playerId));

  // Sort candidate pool: lowest base price first to maximize affordability
  pool.sort((a, b) => a.basePrice - b.basePrice || b.ratings.overall - a.ratings.overall);

  // Iteratively satisfy franchises needing slots to reach 18
  for (let pass = 0; pass < 30; pass++) {
    const underStrength = session.franchises.filter(
      (f) => f.players.length < (f.minSquadSize ?? 18)
    );
    if (underStrength.length === 0) break;

    // Pick franchise with greatest deficit
    underStrength.sort(
      (a, b) =>
        (b.minSquadSize ?? 18) - b.players.length - ((a.minSquadSize ?? 18) - a.players.length)
    );

    let progressInPass = false;

    for (const franchise of underStrength) {
      const needed = (franchise.minSquadSize ?? 18) - franchise.players.length;
      if (needed <= 0) continue;

      // Find first legal player for this franchise
      const candidateIndex = pool.findIndex((p) => {
        if (usedPlayerIds.has(p.id)) return false;
        if (p.nationality === 'Overseas' && franchise.currentOverseasCount >= (franchise.maxOverseas ?? 8)) {
          return false;
        }
        if (franchise.remainingPurse < p.basePrice) return false;
        // Check reserve if more slots needed after this
        const slotsAfter = needed - 1;
        if (slotsAfter > 0 && franchise.remainingPurse - p.basePrice < slotsAfter * MIN_SQUAD_BASE_COST) {
          return false;
        }
        return true;
      });

      if (candidateIndex !== -1) {
        const candidate = pool[candidateIndex];
        usedPlayerIds.add(candidate.id);

        const purchase: AuctionPurchase = {
          playerId: candidate.id,
          playerName: candidate.name,
          franchiseId: franchise.id,
          price: candidate.basePrice,
          basePrice: candidate.basePrice,
          round: session.round,
          bidCount: 1,
          timestamp: Date.now(),
        };

        session.soldPlayers.push(purchase);
        franchise.remainingPurse -= candidate.basePrice;
        franchise.players.push({
          ...candidate,
          currentFranchiseId: franchise.id,
          isSold: true,
          soldPrice: candidate.basePrice,
          currentContractValue: candidate.basePrice,
        });
        franchise.auctionPurchases.push(purchase);
        if (candidate.nationality === 'Overseas') {
          franchise.currentOverseasCount++;
        }

        candidate.isSold = true;
        candidate.soldPrice = candidate.basePrice;
        candidate.currentFranchiseId = franchise.id;

        soldCount++;
        progressInPass = true;
      }
    }

    if (!progressInPass) break;
  }

  const remainingUnderStrength = session.franchises
    .filter((f) => f.players.length < (f.minSquadSize ?? 18))
    .map((f) => f.id);

  session.state = 'COMPLETED';
  session.currentLot = null;

  return {
    completed: remainingUnderStrength.length === 0,
    playersSold: soldCount,
    underStrengthFranchises: remainingUnderStrength,
  };
}
