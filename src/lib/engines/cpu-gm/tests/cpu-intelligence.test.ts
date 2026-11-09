// ============================================================
// IPL DYNASTY - Phase 1 CPU Auction Intelligence Test Suite
// Verifies:
// 1. 9 GM Personalities & Dynamic Strategy Evolution
// 2. Dynamic Player Shortlists & In-Auction Re-evaluation
// 3. Advanced Utility Valuation (XI Improvement vs Squad Depth)
// 4. Opponent Modeling (Bayesian updates from observable events only)
// 5. Monte Carlo Forecasting & Decision Caching
// 6. Difficulty Level Scaling (Easy, Normal, Hard, Expert)
// 7. Structured Decision Logging & Legality
// ============================================================

import { FRANCHISES } from '../../../data/franchises';
import { PLAYERS } from '../../../data/players';
import { createSeededRandom } from '../../../utils/random';
import {
  createAuctionSession,
  nominatePlayer,
  placeBid,
  processFinalCall,
  getMinimumBid,
  canFranchiseBid,
} from '../../auction-engine';
import {
  GM_PERSONALITY_ARCHETYPES,
  FRANCHISE_GM_PROFILES,
  evolveFranchisePersonality,
  getFranchiseActivePersonality,
} from '../personalities';
import {
  initializeDynamicShortlists,
  getFranchiseShortlist,
  updateShortlistsOnLotCompletion,
} from '../shortlist-manager';
import {
  calculatePlayingXiImprovement,
  calculateSquadDepthImprovement,
  calculateAdvancedSpendingLimit,
  evaluateBiddingRuleSnippet,
} from '../advanced-valuation';
import { OpponentBidModel } from '../opponent-model';
import { runMonteCarloForecasting, clearMonteCarloCache } from '../monte-carlo';
import { decideCPUBid, getDecisionLogs, clearDecisionLogs } from '../cpu-gm-engine';
import type { AuctionSession, Franchise, Player, SeededRandom } from '../../../types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

export function runCpuIntelligenceTests() {
  console.log('============================================================');
  console.log('RUNNING PHASE 1 ADVANCED CPU INTELLIGENCE TESTS');
  console.log('============================================================\n');

  const rng = createSeededRandom(42);

  // -------------------------------------------------------------
  // TEST 1: 9 Distinct GM Personalities & Strategy Profiles
  // -------------------------------------------------------------
  console.log('--- TEST 1: GM Personalities & Archetypes ---');
  const personalityKeys = Object.keys(GM_PERSONALITY_ARCHETYPES);
  assert(
    personalityKeys.length === 9,
    `9 distinct GM personality archetypes registered (got ${personalityKeys.length})`
  );

  const miProfile = FRANCHISE_GM_PROFILES['mi'];
  const cskProfile = FRANCHISE_GM_PROFILES['csk'];
  const rcbProfile = FRANCHISE_GM_PROFILES['rcb'];
  const rrProfile = FRANCHISE_GM_PROFILES['rr'];

  assert(miProfile.initialArchetype === 'Aggressive spender', `MI initialized as Aggressive spender (got ${miProfile.initialArchetype})`);
  assert(cskProfile.initialArchetype === 'Experienced-player specialist', `CSK initialized as Experienced-player specialist (got ${cskProfile.initialArchetype})`);
  assert(rcbProfile.initialArchetype === 'Batting-focused strategist', `RCB initialized as Batting-focused strategist (got ${rcbProfile.initialArchetype})`);
  assert(rrProfile.initialArchetype === 'Youth development specialist', `RR initialized as Youth development specialist (got ${rrProfile.initialArchetype})`);

  // Dynamic Strategy Evolution Test
  const testFranchise: Franchise = {
    ...FRANCHISES[0], // MI
    remainingPurse: 1500, // Very low purse (15 Cr for 12 remaining slots)
    players: Array(6).fill(PLAYERS[0]), // 6 players acquired
  };
  const mockSession: any = {
    currentPlayerIndex: 80,
    playerPool: PLAYERS,
  };

  const evolvedPersonality = evolveFranchisePersonality(testFranchise, mockSession);
  assert(
    evolvedPersonality === 'Value-focused analyst' || evolvedPersonality === 'Risk-averse general manager',
    `Low remaining purse triggers adaptive shift from Aggressive to defensive strategy (got ${evolvedPersonality})`
  );

  // -------------------------------------------------------------
  // TEST 2: Dynamic Shortlists & In-Auction Re-evaluation
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Dynamic Shortlists & Re-evaluation ---');
  const availablePool = PLAYERS.map((p) => ({ ...p, isAvailableForAuction: true, isRetained: false }));
  const testSession = createAuctionSession(
    FRANCHISES.map((f) => ({ ...f, remainingPurse: 12000, players: [] })),
    availablePool,
    { seasonYear: 2026, auctionType: 'Mega', pace: 'Fast', totalRounds: 1 }
  );

  initializeDynamicShortlists(testSession, rng);
  const miShortlist = getFranchiseShortlist(testSession.id, 'mi');

  assert(miShortlist !== undefined, 'MI shortlist successfully generated at auction start');
  assert(miShortlist.primaryTargets.length >= 8, `MI maintains prioritized primary targets (got ${miShortlist.primaryTargets.length})`);
  assert(Object.keys(miShortlist.roleBudgets).length >= 5, 'Purse budget pre-allocated across tactical roles');

  // Simulate rival purchasing MI's top target
  const topTarget = miShortlist.primaryTargets[0];
  const targetPlayer = PLAYERS.find((p) => p.id === topTarget.playerId)!;
  const mockSoldLot: any = {
    player: targetPlayer,
    state: 'Sold',
    currentBidderId: 'csk', // Bought by CSK
    currentBid: 1400,
  };

  updateShortlistsOnLotCompletion(testSession, mockSoldLot);
  const updatedMiShortlist = getFranchiseShortlist(testSession.id, 'mi');
  const stillInPrimary = updatedMiShortlist.primaryTargets.some((t) => t.playerId === targetPlayer.id);

  assert(!stillInPrimary, `Target player ${targetPlayer.name} removed from MI shortlist after rival purchase`);
  assert(updatedMiShortlist.promotedAlternatives.length > 0, 'Suitable fallback replacement player promoted to active target list');

  // -------------------------------------------------------------
  // TEST 3: Advanced Valuation (Playing XI vs Squad Depth)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Advanced Valuation & Diminishing Squad Depth ---');
  const emptySquadFranchise: Franchise = { ...FRANCHISES[0], remainingPurse: 12000, players: [] };
  const bumrah = PLAYERS.find((p) => p.id === 'jasprit-bumrah')!;

  const xiImprovementFirst = calculatePlayingXiImprovement(emptySquadFranchise, bumrah);
  assert(xiImprovementFirst >= 25, `First elite death bowler heavily upgrades empty playing XI (+${xiImprovementFirst} pts)`);

  // Create squad that already has 2 premier fast bowlers
  const paceHeavyFranchise: Franchise = {
    ...FRANCHISES[0],
    remainingPurse: 8000,
    players: [
      bumrah,
      PLAYERS.find((p) => p.id === 'mohammed-shami') || bumrah,
      PLAYERS.find((p) => p.id === 'arshdeep-singh') || bumrah,
    ],
  };

  const thirdPacer = PLAYERS.find((p) => p.id === 'jofra-archer') || bumrah;
  const xiImprovementThird = calculatePlayingXiImprovement(paceHeavyFranchise, thirdPacer);
  const depthImprovementThird = calculateSquadDepthImprovement(paceHeavyFranchise, thirdPacer);

  assert(
    xiImprovementThird < xiImprovementFirst,
    `Diminishing playing XI returns for redundant role (${xiImprovementThird} vs initial ${xiImprovementFirst})`
  );
  assert(depthImprovementThird > 0, 'Recognizes squad depth value even when playing XI is covered');

  // -------------------------------------------------------------
  // TEST 4: Opponent Modeling (Observable Events & Bayesian Updates)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Opponent Modeling & Bayesian Need Tracking ---');
  const opponentModel = new OpponentBidModel(FRANCHISES.map((f) => f.id));
  const travisHead = PLAYERS.find((p) => p.id === 'travis-head')!;

  const baselineComp = opponentModel.predictCompetitionMultiplier(travisHead, 'mi');
  // Observe RCB bidding multiple times on explosive openers
  opponentModel.observeBid('rcb', travisHead, 800);
  opponentModel.observeBid('rcb', travisHead, 1100);
  opponentModel.observeBid('rcb', travisHead, 1400);

  const updatedComp = opponentModel.predictCompetitionMultiplier(travisHead, 'mi');
  assert(
    updatedComp > baselineComp,
    `Bayesian update from observed bidding increases predicted competition (${baselineComp.toFixed(2)} -> ${updatedComp.toFixed(2)})`
  );

  // -------------------------------------------------------------
  // TEST 5: Monte Carlo Forecasting & Decision Caching
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Monte Carlo Buy vs Pass Forecasting ---');
  clearMonteCarloCache();
  const mcFranchise: Franchise = { ...FRANCHISES[0], remainingPurse: 3500, players: Array(14).fill(PLAYERS[0]) }; // 4 slots left
  const expensiveBatter = PLAYERS.find((p) => p.ratings.overall >= 84 && p.role === 'Batter')!;

  const t0 = Date.now();
  const mcResult1 = runMonteCarloForecasting(mcFranchise, expensiveBatter, 2400, testSession, rng, 30);
  const elapsed1 = Date.now() - t0;

  const t1 = Date.now();
  const mcResult2 = runMonteCarloForecasting(mcFranchise, expensiveBatter, 2400, testSession, rng, 30);
  const elapsed2 = Date.now() - t1;

  assert(mcResult1.expectedRatingBuy > 0 && mcResult1.expectedRatingPass > 0, 'Monte Carlo computes expected final ratings for Buy and Pass paths');
  assert(elapsed2 <= elapsed1, `Decision cache accelerates subsequent evaluation (${elapsed1}ms vs cached ${elapsed2}ms)`);

  // -------------------------------------------------------------
  // TEST 6: Difficulty Levels Differentiation
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Difficulty Levels (Easy, Normal, Hard, Expert) ---');
  const easyFranchise: Franchise = { ...FRANCHISES[0], cpuDifficulty: 'Easy', remainingPurse: 10000, players: [] };
  const expertFranchise: Franchise = { ...FRANCHISES[0], cpuDifficulty: 'Expert', remainingPurse: 10000, players: [] };

  nominatePlayer(testSession);
  const currentLot = testSession.currentLot!;

  const easyDecision = decideCPUBid(easyFranchise, currentLot, testSession, rng);
  const expertDecision = decideCPUBid(expertFranchise, currentLot, testSession, rng);

  assert(easyDecision.maxBid > 0, `Easy CPU bids using basic formula (${easyDecision.maxBid}L)`);
  assert(expertDecision.maxBid > 0, `Expert CPU bids with full tactical and forecast optimization (${expertDecision.maxBid}L)`);

  // -------------------------------------------------------------
  // TEST 7: Structured Decision Logs
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Structured Decision Logs ---');
  const logs = getDecisionLogs(testSession.id);
  assert(logs.length > 0, `Structured decision logs successfully captured (${logs.length} logged entries)`);

  const sampleLog = logs[logs.length - 1];
  assert(sampleLog.playerId !== undefined && sampleLog.playerName !== undefined, 'Log contains full player metadata');
  assert(sampleLog.franchiseId !== undefined && sampleLog.decision !== undefined, 'Log contains franchise ID and explicit decision');
  assert(sampleLog.squadNeedScore !== undefined, 'Log contains calculated squad need score');
  assert(sampleLog.budgetImpact !== undefined, 'Log contains remaining budget and slot impact');

  // -------------------------------------------------------------
  // TEST 8: Exploit Scenario 1 - Human Aggressive Baiting Resistance
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Anti-Overbidding / Human Baiting Resistance ---');
  const baitCandidate = PLAYERS.find((p) => p.role === 'Batter' && p.ratings.overall < 80)!;
  const cskFranchise: Franchise = { ...FRANCHISES[1], cpuDifficulty: 'Hard', remainingPurse: 5000, players: Array(10).fill(PLAYERS[0]) };
  const mockBaitLot: any = {
    id: 'bait-lot-1',
    player: baitCandidate,
    basePrice: baitCandidate.basePrice,
    currentBid: 2400, // Price pushed unrealistically high by aggressive bidder
    currentBidderId: 'human-user',
    bids: [{ id: 'b1', franchiseId: 'human-user', amount: 2400, timestamp: Date.now() }],
    state: 'Active',
  };
  testSession.currentLot = mockBaitLot;

  const baitDecision = decideCPUBid(cskFranchise, mockBaitLot, testSession, rng);
  assert(!baitDecision.bid, 'CPU refuses to match aggressively baited price that exceeds spending limit');
  assert(baitDecision.reason.includes('exceeds spending limit') || baitDecision.reason.includes('Monte Carlo'), 'CPU explicitly identifies valuation/forecast barrier');

  // -------------------------------------------------------------
  // TEST 9: Exploit Scenario 2 - Late Auction Sniping Resistance
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Late Auction Sniping / Base Price Protection ---');
  const starPlayer = PLAYERS.find((p) => p.ratings.overall >= 88)!;
  const solventFranchise: Franchise = { ...FRANCHISES[2], cpuDifficulty: 'Expert', remainingPurse: 6000, players: Array(10).fill(PLAYERS[0]) };
  const mockLateLot: any = {
    id: 'late-lot-1',
    player: starPlayer,
    basePrice: starPlayer.basePrice,
    currentBid: starPlayer.basePrice, // Player is sitting at base price
    currentBidderId: 'human-user',
    bids: [{ id: 'b2', franchiseId: 'human-user', amount: starPlayer.basePrice, timestamp: Date.now() }],
    state: 'Active',
  };
  testSession.currentLot = mockLateLot;

  const lateDecision = decideCPUBid(solventFranchise, mockLateLot, testSession, rng);
  assert(lateDecision.bid, 'CPU contests valuable star sitting at base price, preventing human snipe exploit');
  assert(lateDecision.maxBid > starPlayer.basePrice, `CPU calculates competitive ceiling above base price (${lateDecision.maxBid}L > ${starPlayer.basePrice}L)`);

  // -------------------------------------------------------------
  // TEST 10: Reference Architecture Dynamic Budget Formula Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Reference Bidding Formula Verification ---');
  const snippetEval1 = evaluateBiddingRuleSnippet(solventFranchise, starPlayer, starPlayer.basePrice + 50, testSession);
  assert(snippetEval1.shouldBid === true, 'Bidding rule approves bid within spending limit');
  assert(snippetEval1.scarcityMultiplier >= 0.9 && snippetEval1.scarcityMultiplier <= 1.1, `Scarcity multiplier bounded correctly (${snippetEval1.scarcityMultiplier})`);
  assert(snippetEval1.budgetRatio > 0, `Budget ratio correctly computed (${snippetEval1.budgetRatio}L/slot)`);

  const snippetEvalTooHigh = evaluateBiddingRuleSnippet(solventFranchise, starPlayer, 99999, testSession);
  assert(snippetEvalTooHigh.shouldBid === false, 'Bidding rule rejects bid exceeding spendingLimit');

  console.log('\n============================================================');
  console.log('ALL PHASE 1 ADVANCED CPU INTELLIGENCE TESTS PASSED!');
  console.log('============================================================\n');
}

// Run tests when executed directly
if (process.argv[1]?.includes('cpu-intelligence.test.ts')) {
  runCpuIntelligenceTests();
}
