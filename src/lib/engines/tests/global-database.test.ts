// ============================================================
// IPL DYNASTY - Global Player Database & Squad Rules Tests
// Comprehensive verification of the 1,250 authentic cricketers,
// registration brackets, CPU shortlists, auction sets, and squad rules.
// ============================================================

import { GLOBAL_PLAYERS } from '@/lib/data/players';
import { FRANCHISES } from '@/lib/data/franchises';
import { OFFICIAL_BASE_PRICES } from '@/lib/types/registration';
import { generateAuctionRegistrationPool } from '@/lib/engines/registration/registration-engine';
import { generateAllFranchiseShortlists } from '@/lib/engines/scouting/cpu-shortlist-generator';
import { compileFinalAuctionPool, OFFICIAL_AUCTION_SETS } from '@/lib/engines/auction/shortlist-compiler';
import { checkAndEnsureAuctionPoolFeasibility } from '@/lib/engines/auction/feasibility-checker';
import { analyzeSquadComposition, canAddPlayerToSquad } from '@/lib/engines/squad-rules';
import { OFFICIAL_IPL_SQUAD_RULES } from '@/lib/types/squad-rules';
import {
  createAuctionSession,
  nominatePlayer,
  placeBid,
  processFinalCall,
  simulateAcceleratedCompletion,
} from '@/lib/engines/auction-engine';
import { cpuDecideBid } from '@/lib/engines/cpu-manager';
import { createSeededRandom } from '@/lib/utils/random';
import type { Franchise, Player } from '@/lib/types/game';

console.log('============================================================');
console.log('RUNNING GLOBAL DATABASE, REGISTRATION & SQUAD RULES TESTS');
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

// -----------------------------------------------------------------------------
// TEST 1: Global Player Database Authenticity & Provenance
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Global Player Database Integrity & Provenance ---');

assert(GLOBAL_PLAYERS.length >= 1000, `Database contains at least 1,000 cricketers (found ${GLOBAL_PLAYERS.length})`);
assert(GLOBAL_PLAYERS.length === 1250, `Database contains exact verified count of 1,250 cricketers`);

// Verify ID uniqueness
const uniqueIds = new Set(GLOBAL_PLAYERS.map((p) => p.id));
assert(uniqueIds.size === GLOBAL_PLAYERS.length, `All ${GLOBAL_PLAYERS.length} player IDs are strictly unique (0 duplicates)`);

// Check Cricsheet IDs presence
const withCricsheet = GLOBAL_PLAYERS.filter((p) => p.cricsheetId && p.cricsheetId.length > 0);
assert(withCricsheet.length >= 1000, `At least 1,000 players possess verified Cricsheet registry IDs (found ${withCricsheet.length})`);

// Check country distribution
const indianPlayers = GLOBAL_PLAYERS.filter((p) => p.nationality === 'Indian');
const overseasPlayers = GLOBAL_PLAYERS.filter((p) => p.nationality === 'Overseas');
assert(indianPlayers.length >= 500, `Sufficient Indian domestic/international player pool (${indianPlayers.length})`);
assert(overseasPlayers.length >= 500, `Sufficient Overseas international player pool (${overseasPlayers.length})`);

// Check valid age bounds
const validAges = GLOBAL_PLAYERS.every((p) => p.age >= 16 && p.age <= 46);
assert(validAges, `All player ages are authentic and within realistic athletic bounds (16-46 years)`);

// -----------------------------------------------------------------------------
// TEST 2: Capped vs Uncapped Classification
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Capped vs Uncapped Classification ---');

const capped = GLOBAL_PLAYERS.filter((p) => p.status === 'Capped');
const uncapped = GLOBAL_PLAYERS.filter((p) => p.status === 'Uncapped');

assert(capped.length >= 400, `Realistic capped player count (found ${capped.length})`);
assert(uncapped.length >= 600, `Robust uncapped grassroots and domestic talent pool (found ${uncapped.length})`);

// Famous players check
const virat = GLOBAL_PLAYERS.find((p) => p.name === 'Virat Kohli');
assert(virat !== undefined && virat.status === 'Capped' && virat.nationality === 'Indian', 'Virat Kohli is classified as Capped Indian');

const bumrah = GLOBAL_PLAYERS.find((p) => p.name === 'Jasprit Bumrah');
assert(bumrah !== undefined && bumrah.status === 'Capped', 'Jasprit Bumrah is classified as Capped');

// -----------------------------------------------------------------------------
// TEST 3: Official Base Price Brackets
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Official Base Price Brackets ---');

const officialSet = new Set<number>(OFFICIAL_BASE_PRICES);
const allPricesValid = GLOBAL_PLAYERS.every((p) => officialSet.has(p.basePrice as any));
assert(allPricesValid, `All 1,250 players belong strictly to official IPL base price brackets (20L - 200L)`);

// Elite players in 200L bracket
const topBracket = GLOBAL_PLAYERS.filter((p) => p.basePrice === 200);
assert(topBracket.length >= 15, `Marquee players populate 200L bracket (${topBracket.length} found)`);

// Uncapped players in 20L - 50L bracket
const uncappedPricesValid = uncapped.every((p) => p.basePrice <= 50);
assert(uncappedPricesValid, `Uncapped cricketers conform to official IPL base price ceiling of <= 50L`);

// -----------------------------------------------------------------------------
// TEST 4: Pre-Auction Registration & Shortlisting Engine
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Pre-Auction Registration & CPU Shortlists ---');

const retainedIds = new Set<string>(
  GLOBAL_PLAYERS.filter((p) => p.currentFranchiseId !== null).slice(0, 40).map((p) => p.id)
);

const { registeredPlayers, summary } = generateAuctionRegistrationPool(GLOBAL_PLAYERS, retainedIds);
assert(registeredPlayers.length === GLOBAL_PLAYERS.length - retainedIds.size, `Registration pool properly excludes retained players (${registeredPlayers.length} registered)`);
assert(summary.totalRegistered === registeredPlayers.length, `Summary matches pool count`);

// Generate shortlists for all 10 franchises
const franchiseShortlists = generateAllFranchiseShortlists(FRANCHISES, registeredPlayers);
assert(Object.keys(franchiseShortlists).length === 10, `Generated independent shortlists for all 10 franchises`);

// Verify shortlist depth and priority tiers per CPU
for (const franchise of FRANCHISES) {
  const list = franchiseShortlists[franchise.id];
  const entries = Object.values(list.entries);
  assert(entries.length >= 50 && entries.length <= 100, `${franchise.name} maintains healthy target list (${entries.length} targets)`);

  const priorityA = entries.filter((e) => e.priority === 'PriorityA');
  assert(priorityA.length >= 8 && priorityA.length <= 18, `${franchise.name} has focused Priority A targets (${priorityA.length})`);
}

// -----------------------------------------------------------------------------
// TEST 5: Final Auction Pool Compiler & Set Allocation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Final Auction Pool Compiler & Sets ---');

const compilation = compileFinalAuctionPool(registeredPlayers, franchiseShortlists, 500);
assert(compilation.finalAuctionPool.length >= 400 && compilation.finalAuctionPool.length <= 600, `Auction pool successfully compiled around target size (${compilation.finalAuctionPool.length} players)`);

// Verify 20 official auction sets
const setCodes = Object.keys(compilation.auctionSets);
assert(setCodes.length >= 15, `Organized into official auction sets (${setCodes.length} sets generated)`);
assert(compilation.auctionSets['M1'] && compilation.auctionSets['M1'].length > 0, `Marquee Set 1 (M1) successfully populated`);
assert(compilation.auctionSets['M2'] && compilation.auctionSets['M2'].length > 0, `Marquee Set 2 (M2) successfully populated`);

// Verify M1 contains highest rated players
const m1Players = compilation.auctionSets['M1'];
const m1MinOvr = Math.min(...m1Players.map((p) => p.ratings.overall));
assert(m1MinOvr >= 80, `Marquee Set 1 players have elite rating (min OVR: ${m1MinOvr})`);

// -----------------------------------------------------------------------------
// TEST 6: Feasibility Checker & Guaranteed Domestic Supply
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Pre-Auction Feasibility Checker ---');

const feasibility = checkAndEnsureAuctionPoolFeasibility(
  FRANCHISES,
  compilation.finalAuctionPool,
  registeredPlayers,
  OFFICIAL_IPL_SQUAD_RULES
);

assert(feasibility.isFeasible, `Feasibility check confirms all 10 franchises can legally build squads`);
assert(feasibility.totalDomesticSupply >= feasibility.totalMinDomesticNeeded, `Total domestic supply (${feasibility.totalDomesticSupply}) exceeds minimum league demand (${feasibility.totalMinDomesticNeeded})`);

// -----------------------------------------------------------------------------
// TEST 7: Official IPL Squad Constraints (18-25 Players, Max 8 Overseas)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 7: Squad Composition & Legality Rules ---');

const testFranchise: Franchise = {
  ...FRANCHISES[0],
  players: [],
  currentOverseasCount: 0,
  remainingPurse: 12000,
};

// 0 players -> Deficit (needs 18)
let comp = analyzeSquadComposition(testFranchise, OFFICIAL_IPL_SQUAD_RULES);
assert(!comp.isLegal, `Empty squad is flagged as illegal`);
assert(comp.minSlotsNeeded === 18, `Empty squad correctly requires 18 slots to become legal`);

// Add 18 Indian players -> Legal!
const dummyIndians: Player[] = registeredPlayers
  .filter((p) => p.nationality === 'Indian')
  .slice(0, 18);
testFranchise.players = [...dummyIndians];
comp = analyzeSquadComposition(testFranchise, OFFICIAL_IPL_SQUAD_RULES);
assert(comp.isLegal, `Squad of 18 Indian players is completely legal`);
assert(comp.minSlotsNeeded === 0, `No more mandatory slots needed`);

// Add 8 overseas players -> 26 players (> 25) -> Illegal!
const dummyOverseas: Player[] = registeredPlayers
  .filter((p) => p.nationality === 'Overseas')
  .slice(0, 8);
testFranchise.players = [...dummyIndians, ...dummyOverseas];
testFranchise.currentOverseasCount = 8;
comp = analyzeSquadComposition(testFranchise, OFFICIAL_IPL_SQUAD_RULES);
assert(!comp.isLegal, `Squad with 26 players exceeds maximum ceiling of 25`);

// Trim back to 25 with 8 overseas -> Legal!
testFranchise.players = [...dummyIndians.slice(0, 17), ...dummyOverseas];
comp = analyzeSquadComposition(testFranchise, OFFICIAL_IPL_SQUAD_RULES);
assert(comp.isLegal, `Squad of 25 players with 8 overseas is fully legal`);

// Attempt to add 9th overseas player via canAddPlayerToSquad
const candidateOverseas = dummyOverseas[0];
const canAdd9th = canAddPlayerToSquad(testFranchise, candidateOverseas, OFFICIAL_IPL_SQUAD_RULES);
assert(!canAdd9th.allowed, `9th overseas player is strictly prohibited (${canAdd9th.reason})`);

// -----------------------------------------------------------------------------
// TEST 8: Full Headless Auction Simulation with Squad Completion Guarantee
// -----------------------------------------------------------------------------
console.log('\n--- TEST 8: Headless Multi-Franchise Auction Simulation ---');

// Fresh franchises with 0 players and 120Cr purse
const simFranchises: Franchise[] = FRANCHISES.map((f) => ({
  ...f,
  players: [],
  auctionPurchases: [],
  remainingPurse: 12000,
  currentOverseasCount: 0,
}));

const auctionSession = createAuctionSession(
  simFranchises,
  compilation.finalAuctionPool,
  {
    seasonYear: 2026,
    auctionType: 'Mega',
    pace: 'Instant',
    totalRounds: 3,
  }
);

// Execute accelerated completion to guarantee all 10 franchises reach >= 18 legal players
const accelResult = simulateAcceleratedCompletion(auctionSession, registeredPlayers);

assert(accelResult.completed, `Accelerated completion successfully filled all franchise squad deficits`);
assert(accelResult.underStrengthFranchises.length === 0, `0 franchises remain under-strength`);

// Verify final squad legality across ALL 10 franchises
for (const franchise of auctionSession.franchises) {
  const squadComp = analyzeSquadComposition(franchise, OFFICIAL_IPL_SQUAD_RULES);
  assert(
    squadComp.isLegal,
    `${franchise.name}: Legal squad verified (${squadComp.totalPlayers} players, ${squadComp.overseasPlayers} overseas, purse: ₹${franchise.remainingPurse}L)`
  );
  assert(
    franchise.players.length >= 18 && franchise.players.length <= 25,
    `${franchise.name}: Squad size (${franchise.players.length}) strictly satisfies 18-25 constraint`
  );
  assert(
    franchise.currentOverseasCount <= 8,
    `${franchise.name}: Overseas count (${franchise.currentOverseasCount}) does not exceed 8`
  );
  assert(
    franchise.remainingPurse >= 0,
    `${franchise.name}: Remaining purse (₹${franchise.remainingPurse}L) is non-negative`
  );
}

console.log('\n============================================================');
console.log(`ALL ${passedTests}/${totalTests} GLOBAL DATABASE & SQUAD CONSTRAINTS TESTS PASSED!`);
console.log('============================================================');

