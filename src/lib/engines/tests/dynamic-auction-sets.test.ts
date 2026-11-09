// ============================================================
// IPL DYNASTY - Dynamic Auction Sets & Intelligent Sequencing Tests
// Verifies player segregation, rating tiers, marquee selection,
// schedule interleaving, Fisher-Yates per-set shuffling,
// CPU future set awareness, and early overbidding prevention.
// ============================================================

import { GLOBAL_PLAYERS } from '@/lib/data/players';
import { FRANCHISES } from '@/lib/data/franchises';
import {
  generateDynamicAuctionSequence,
  getPlayerAuctionCategory,
  calculateMarqueeScore,
  analyzeUpcomingPool,
  DEFAULT_SET_CONFIG,
} from '@/lib/engines/auction/dynamic-set-engine';
import {
  createAuctionSession,
  nominatePlayer,
  validateBid,
  placeBid,
  simulateAcceleratedCompletion,
} from '@/lib/engines/auction-engine';
import { calculateAdvancedSpendingLimit } from '@/lib/engines/cpu-gm/advanced-valuation';
import { generatePlayerIntelligenceDossier } from '@/lib/intelligence/valuation/player-intelligence';
import type { Franchise, Player, AuctionSession } from '@/lib/types/game';

console.log('============================================================');
console.log('RUNNING DYNAMIC AUCTION SETS & SEQUENCING TESTS');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASSED: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
}

// Prepare sample eligible auction pool of 500 players
const samplePool = GLOBAL_PLAYERS.slice(0, 500);

// -----------------------------------------------------------------------------
// TEST 1: Role Segregation & Categorization
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Player Segregation by Role & Status ---');

for (const player of samplePool.slice(0, 100)) {
  const cat = getPlayerAuctionCategory(player);
  assert(cat !== undefined && cat.length > 0, `Player ${player.name} assigned valid category (${cat})`);

  if (player.status === 'Capped') {
    assert(!cat.startsWith('Uncapped'), `Capped player ${player.name} is not in Uncapped category (got ${cat})`);
  } else {
    assert(cat.startsWith('Uncapped'), `Uncapped player ${player.name} is in Uncapped category (got ${cat})`);
  }
}

// -----------------------------------------------------------------------------
// TEST 2: Marquee Selection & De-duplication
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Marquee Player Selection & Role Set Removal ---');

const testSeed1 = 42819;
const seq1 = generateDynamicAuctionSequence(samplePool, testSeed1, {
  ...DEFAULT_SET_CONFIG,
  marqueeSize: 12,
});

const marqueeSets = seq1.sets.filter((s) => s.category === 'Marquee');
assert(marqueeSets.length === 2, `Marquee players split into 2 sets: M1 and M2 (got ${marqueeSets.length})`);
assert(marqueeSets[0].code === 'M1' && marqueeSets[1].code === 'M2', `Marquee set codes are M1 and M2`);

const marqueePlayerIds = new Set(marqueeSets.flatMap((s) => s.playerIds));
assert(marqueePlayerIds.size === 12, `Selected exactly 12 marquee players`);

// Verify marquee players NEVER appear in normal role sets
const roleSets = seq1.sets.filter((s) => s.category !== 'Marquee');
for (const rSet of roleSets) {
  for (const pid of rSet.playerIds) {
    assert(!marqueePlayerIds.has(pid), `Marquee player ${pid} does not appear in normal role set ${rSet.code}`);
  }
}

// -----------------------------------------------------------------------------
// TEST 3: Completeness & Uniqueness (Every Player Exactly Once)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Pool Completeness & Zero Duplication ---');

assert(seq1.orderedPlayerIds.length === samplePool.length, `Sequence contains all ${samplePool.length} players`);
const uniqueSequenceIds = new Set(seq1.orderedPlayerIds);
assert(uniqueSequenceIds.size === samplePool.length, `Zero duplicate appearances across entire auction (100% unique)`);

// Check assignment records integrity
for (const player of samplePool) {
  const assignment = seq1.assignments[player.id];
  assert(assignment !== undefined, `Assignment record exists for ${player.name}`);
  assert(assignment.globalAuctionOrder >= 1 && assignment.globalAuctionOrder <= samplePool.length, `Valid global auction order (${assignment.globalAuctionOrder})`);
  assert(assignment.playerOrderWithinSet >= 1, `Valid order within set (${assignment.playerOrderWithinSet})`);
}

// -----------------------------------------------------------------------------
// TEST 4: Rating-Based Tiers (Earlier Tiers Have Higher Ratings)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Rating Tiers Hierarchy ---');

// Check Batsmen tiers: BAT1 vs BAT2
const bat1 = seq1.sets.find((s) => s.code === 'BAT1');
const bat2 = seq1.sets.find((s) => s.code === 'BAT2');

if (bat1 && bat2) {
  const bat1Ratings = bat1.playerIds.map((id) => samplePool.find((p) => p.id === id)!.ratings.overall);
  const bat2Ratings = bat2.playerIds.map((id) => samplePool.find((p) => p.id === id)!.ratings.overall);

  const avgBat1 = bat1Ratings.reduce((a, b) => a + b, 0) / bat1Ratings.length;
  const avgBat2 = bat2Ratings.reduce((a, b) => a + b, 0) / bat2Ratings.length;

  assert(avgBat1 > avgBat2, `BAT1 average rating (${avgBat1.toFixed(1)}) is strictly higher than BAT2 (${avgBat2.toFixed(1)})`);
  const minBat1 = Math.min(...bat1Ratings);
  const maxBat2 = Math.max(...bat2Ratings);
  assert(minBat1 >= maxBat2, `Lowest rated BAT1 player (${minBat1}) >= highest rated BAT2 player (${maxBat2})`);
}

// Check Fast Bowler tiers: FB1 vs FB2
const fb1 = seq1.sets.find((s) => s.code === 'FB1');
const fb2 = seq1.sets.find((s) => s.code === 'FB2');

if (fb1 && fb2) {
  const fb1Ratings = fb1.playerIds.map((id) => samplePool.find((p) => p.id === id)!.ratings.overall);
  const fb2Ratings = fb2.playerIds.map((id) => samplePool.find((p) => p.id === id)!.ratings.overall);

  const avgFb1 = fb1Ratings.reduce((a, b) => a + b, 0) / fb1Ratings.length;
  const avgFb2 = fb2Ratings.reduce((a, b) => a + b, 0) / fb2Ratings.length;

  assert(avgFb1 > avgFb2, `FB1 average rating (${avgFb1.toFixed(1)}) is strictly higher than FB2 (${avgFb2.toFixed(1)})`);
}

// -----------------------------------------------------------------------------
// TEST 5: Randomized Player Order Within Sets Across Seeds
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Fisher-Yates Randomization Within Sets ---');

const testSeed2 = 98765;
const seq2 = generateDynamicAuctionSequence(samplePool, testSeed2, {
  ...DEFAULT_SET_CONFIG,
  marqueeSize: 12,
});

// Sets should have same player memberships for identical player pool (deterministic tiers)
// BUT internal ordering within sets must differ!
const m1Seed1 = seq1.sets.find((s) => s.code === 'M1')!;
const m1Seed2 = seq2.sets.find((s) => s.code === 'M1')!;

assert(m1Seed1.playerIds.length === m1Seed2.playerIds.length, `M1 set has identical capacity across seeds (${m1Seed1.playerIds.length})`);

// Player memberships must match
const setMembers1 = new Set(m1Seed1.playerIds);
const setMembers2 = new Set(m1Seed2.playerIds);
assert([...setMembers1].every((id) => setMembers2.has(id)), `M1 contains identical marquee players across seeds`);

// Order within set must differ!
const orderMatch = m1Seed1.playerIds.every((id, idx) => id === m1Seed2.playerIds[idx]);
assert(!orderMatch, `Order of players in M1 differs between Seed ${testSeed1} and Seed ${testSeed2}`);

// -----------------------------------------------------------------------------
// TEST 6: Seed Reproducibility
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Identical Seed Sequence Reproducibility ---');

const seq1Clone = generateDynamicAuctionSequence(samplePool, testSeed1, {
  ...DEFAULT_SET_CONFIG,
  marqueeSize: 12,
});

assert(
  JSON.stringify(seq1.orderedPlayerIds) === JSON.stringify(seq1Clone.orderedPlayerIds),
  `Identical seed (${testSeed1}) produces 100% byte-for-byte identical player nomination order`
);

// -----------------------------------------------------------------------------
// TEST 7: Interleaved Scheduling (No Role Clumping)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 7: Interleaved Auction Schedule ---');

const setCodes = seq1.sets.map((s) => s.code);
assert(setCodes[0] === 'M1' && setCodes[1] === 'M2', `Marquee sets appear first`);

// Verify uncapped sets are integrated in schedule rather than dumped all at the end
const firstUncappedIndex = seq1.sets.findIndex((s) => s.isUncapped);
assert(
  firstUncappedIndex >= 5 && firstUncappedIndex < seq1.sets.length - 5,
  `Uncapped sets appear midway through the schedule (index ${firstUncappedIndex} of ${seq1.sets.length})`
);

// Verify role rotation: no consecutive duplicate role categories during main auction phases
let consecutiveDuplicates = 0;
const mainAuctionSets = seq1.sets.slice(2, 25); // Skip marquee sets (M1, M2)
for (let i = 1; i < mainAuctionSets.length; i++) {
  if (mainAuctionSets[i].category === mainAuctionSets[i - 1].category) {
    consecutiveDuplicates++;
  }
}
assert(consecutiveDuplicates === 0, `Roles rotate evenly without consecutive identical categories across main schedule (0 duplicates)`);

// -----------------------------------------------------------------------------
// TEST 8: Set Size Balancing (No Empty or Tiny Sets)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 8: Set Size Balancing ---');

const allSetsBalanced = seq1.sets.every((s) => s.totalCount >= 5);
assert(allSetsBalanced, `All sets contain at least 5 players (no empty or micro sets)`);

// -----------------------------------------------------------------------------
// TEST 9: Early-Auction Overbidding Prevention & Future Set Awareness
// -----------------------------------------------------------------------------
console.log('\n--- TEST 9: Early Overbidding Prevention ---');

// Mock session with dynamic sets
const mockFranchise: Franchise = {
  ...FRANCHISES[0],
  players: [],
  remainingPurse: 12000,
  currentOverseasCount: 0,
};

// Create a mock player with average rating (OVR 68) appearing in BAT1
const averageBatter: Player = {
  ...samplePool[0],
  id: 'avg-batter-test',
  name: 'Average Batter',
  role: 'Batter',
  isSpinner: false,
  status: 'Capped',
  ratings: {
    batting: 68,
    bowling: 20,
    fielding: 60,
    powerHitting: 65,
    consistency: 60,
    t20Adaptability: 65,
    potential: 70,
    overall: 68,
  },
  basePrice: 50,
  estimatedMarketValue: 120,
};

// Mock a pool where 10 better batters (OVR 82-88) follow in upcoming sets
const starBatters: Player[] = Array.from({ length: 10 }, (_, i) => ({
  ...samplePool[0],
  id: `star-bat-${i}`,
  name: `Star Batter ${i}`,
  role: 'Batter',
  isSpinner: false,
  status: 'Capped',
  ratings: {
    batting: 85,
    bowling: 20,
    fielding: 75,
    powerHitting: 85,
    consistency: 80,
    t20Adaptability: 85,
    potential: 85,
    overall: 85,
  },
  basePrice: 200,
  estimatedMarketValue: 1200,
}));

const mockAuctionSession: AuctionSession = {
  id: 'test-auction-upcoming',
  seasonYear: 2026,
  auctionType: 'Mega',
  state: 'OPEN_BIDDING',
  currentLot: null,
  currentPlayerIndex: 0,
  playerPool: [averageBatter, ...starBatters],
  soldPlayers: [],
  unsoldPlayers: [],
  round: 1,
  totalRounds: 3,
  franchises: [mockFranchise],
  pace: 'Instant',
  isPaused: false,
  humanAutoBidMax: 0,
  sets: seq1.sets,
  setAssignments: seq1.assignments,
};

const upcomingAnalysis = analyzeUpcomingPool(averageBatter, mockAuctionSession);
assert(upcomingAnalysis.betterPlayersRemainingInRole >= 10, `CPU detects 10 better batters remaining in upcoming pool`);
assert(upcomingAnalysis.earlyDiscountMultiplier < 0.85, `CPU applies early discount multiplier (${upcomingAnalysis.earlyDiscountMultiplier.toFixed(2)}) on average batter`);

const dossier = generatePlayerIntelligenceDossier(averageBatter);
const spendingLimit = calculateAdvancedSpendingLimit(mockFranchise, averageBatter, mockAuctionSession, dossier);

assert(
  spendingLimit <= 200,
  `CPU rationally caps bid on average early batter at ₹${spendingLimit}L despite having ₹12,000L purse`
);

// -----------------------------------------------------------------------------
// TEST 10: Squad Completion Reserve Guarantee
// -----------------------------------------------------------------------------
console.log('\n--- TEST 10: Budget Reserve Enforcement ---');

const lowPurseFranchise: Franchise = {
  ...FRANCHISES[1],
  players: Array.from({ length: 12 }, (_, i) => samplePool[i]), // 12 players, needs 6 more for 18
  remainingPurse: 150, // Only 150L left
  currentOverseasCount: 2,
};

// Reserve needed for 5 more slots after this: 5 * 20L = 100L. Max bid = 150 - 100 = 50L.
const expensivePlayer = samplePool.find((p) => p.basePrice >= 100)!;
const testSession: AuctionSession = {
  ...mockAuctionSession,
  franchises: [lowPurseFranchise],
};

const validation = validateBid(testSession, lowPurseFranchise.id, 100);
assert(!validation.success, `Bid of 100L is rejected because team must reserve budget for remaining squad slots`);

// -----------------------------------------------------------------------------
// TEST 11: End-to-End Auction Session with Dynamic Set Metadata
// -----------------------------------------------------------------------------
console.log('\n--- TEST 11: End-to-End Session with Lot Set Metadata ---');

const activeSession = createAuctionSession(FRANCHISES, samplePool.slice(0, 50), {
  seasonYear: 2026,
  auctionType: 'Mega',
  pace: 'Instant',
  totalRounds: 3,
  seed: 554433,
});

assert(activeSession.sets !== undefined && activeSession.sets.length > 0, `Session initialized with dynamic sets`);
assert(activeSession.auctionSeed === 554433, `Session preserved auctionSeed`);

// Nominate Lot 1
const trans1 = nominatePlayer(activeSession);
const lot1 = activeSession.currentLot!;

assert(lot1 !== null, `Lot 1 nominated`);
assert(lot1.auctionSetCode === 'M1', `Lot 1 is in Marquee Set 1 (M1)`);
assert(lot1.playerOrderWithinSet === 1, `Lot 1 has playerOrderWithinSet = 1`);
assert(lot1.totalInSet! > 0, `Lot 1 contains totalInSet count`);
assert(trans1.message.includes('[M1'), `Nomination message displays set code prefix`);

console.log('\n============================================================');
console.log(`ALL ${passedTests}/${totalTests} DYNAMIC AUCTION SETS & SEQUENCING TESTS PASSED!`);
console.log('============================================================');
