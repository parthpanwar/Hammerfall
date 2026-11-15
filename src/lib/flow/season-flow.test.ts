// ============================================================
// IPL DYNASTY - Season flow tests (order of play, gating, side pages,
// stats accumulation and trade-window timing).
// ============================================================

import { FLOW_STEPS, getFlowView, auctionTypeFor, type FlowInput } from './season-flow';
import { useGameStore, buildTradeWorld } from '../store/game-store';
import { isWindowOpen } from '../engines/trade/trade-rules';
import type { Fixture } from '../types/game';

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  passed++;
  console.log(`✅ PASSED: ${msg}`);
}

const fx = (over: Partial<Fixture> = {}): Fixture => ({
  id: Math.random().toString(36),
  matchNumber: 1,
  team1Id: 'mi',
  team2Id: 'csk',
  venue: 'Wankhede',
  isCompleted: false,
  result: null,
  isPlayoff: false,
  ...over,
});

const base: FlowInput = {
  phase: 'Retention',
  lastActivePhase: 'Retention',
  retentionComplete: false,
  registrationPool: [],
  auctionSession: null,
  auctionComplete: false,
  fixtures: [],
  playoffFixtures: [],
  seasonAwards: [],
};
const idx = (id: string) => FLOW_STEPS.findIndex((s) => s.id === id);
// Only the fields the flow reads; cast keeps the test free of full fixtures.
const pool = [{}] as unknown as FlowInput['registrationPool'];
const session = {} as unknown as FlowInput['auctionSession'];

console.log('\n=== 1. Order of play ===');
assert(FLOW_STEPS.length === 9, 'nine steps per season');
assert(
  FLOW_STEPS.map((s) => s.phase).join('>') === 'Retention>Registration>Scouting>ShortlistReveal>Auction>SquadManagement>Tournament>Playoffs>SeasonReview',
  'steps run Retention → Pool → Scouting → Sets → Auction → Squad → League → Playoffs → Review'
);

console.log('\n=== 2. Gating ===');
let v = getFlowView(base);
assert(v.current.id === 'retain' && v.statuses.slice(1).every((s) => s === 'locked'), 'fresh season: only Retentions is reachable');

v = getFlowView({ ...base, phase: 'Scouting', lastActivePhase: 'Scouting', retentionComplete: true, registrationPool: pool, auctionSession: session });
assert(v.statuses[idx('pool')] === 'open', 'Scouting: can step back to the Player Pool');
assert(v.statuses[idx('sets')] === 'open', 'Scouting: compiled sets can be reopened');
assert(v.statuses[idx('auction')] === 'locked' && v.statuses[idx('league')] === 'locked', 'Scouting: auction and league stay locked');

v = getFlowView({ ...base, phase: 'Auction', lastActivePhase: 'Auction', retentionComplete: true, registrationPool: pool, auctionSession: session });
assert(v.statuses[idx('pool')] === 'done' && v.statuses[idx('scout')] === 'done', 'during the auction, planning screens are closed');

v = getFlowView({ ...base, phase: 'SquadManagement', lastActivePhase: 'SquadManagement', retentionComplete: true, registrationPool: pool, auctionSession: session, auctionComplete: true });
assert(v.statuses[idx('league')] === 'locked', 'league stays locked until the XI is confirmed (no fixtures)');
assert(v.statuses[idx('scout')] === 'done', 'no going back to scouting after the auction');

v = getFlowView({ ...base, phase: 'Tournament', lastActivePhase: 'Tournament', retentionComplete: true, auctionComplete: true, fixtures: [fx()] });
assert(v.statuses[idx('squad')] === 'open', 'mid-league: Squad & XI can be reopened');
assert(v.statuses[idx('playoffs')] === 'locked', 'mid-league: playoffs locked');

console.log('\n=== 3. New season does not leak last year ===');
v = getFlowView({ ...base, registrationPool: pool });
assert(v.current.id === 'retain' && v.statuses[idx('pool')] === 'locked', 'stale pool from last season does not unlock the Player Pool');

console.log('\n=== 4. Side pages keep your place ===');
v = getFlowView({ ...base, phase: 'TradeCenter', lastActivePhase: 'Scouting', retentionComplete: true, registrationPool: pool });
assert(v.sidePage === 'Trade Center' && v.current.id === 'scout', 'Trade Center remembers the step you came from');
v = getFlowView({ ...base, phase: 'CareerDashboard', lastActivePhase: 'Tournament', auctionComplete: true, retentionComplete: true, fixtures: [fx()] });
assert(v.sidePage === 'Franchise Office' && v.current.id === 'league', 'Franchise Office keeps the league as current step');

console.log('\n=== 5. Auction type per season ===');
const settings = { auctionType: 'Mega' as const, startingSeason: 2026 };
assert(auctionTypeFor(2026, settings) === 'Mega', 'year 1 is the mega auction');
assert(auctionTypeFor(2027, settings) === 'Mini' && auctionTypeFor(2028, settings) === 'Mini', 'years 2 and 3 are mini auctions');
assert(getFlowView({ ...base, mini: true }).current.label === 'Releases', 'mini years call step 1 "Releases"');

console.log('\n=== 6. Season stats accumulate ===');
const st = useGameStore.getState();
st.updatePlayerSeasonStats('p-test', { runs: 40, ballsFaced: 30, fours: 4 });
st.updatePlayerSeasonStats('p-test', { runs: 60, ballsFaced: 35, sixes: 2 });
st.updatePlayerSeasonStats('p-test', { oversBowled: 4, wickets: 2, runsConceded: 30 });
const ps = useGameStore.getState().playerSeasonStats['p-test'];
assert(ps.runs === 100 && ps.ballsFaced === 65, `runs add up across matches (got ${ps.runs})`);
assert(ps.innings === 2 && ps.fifties === 1 && ps.highScore === 60, 'innings, fifties and high score tracked');
assert(ps.wickets === 2 && Math.abs(ps.economyRate - 7.5) < 1e-9, 'bowling totals and economy tracked');

console.log('\n=== 7. Trade window reopens after the Final ===');
const world = (fixtures: Fixture[], playoffFixtures: Fixture[]) =>
  buildTradeWorld({ ...useGameStore.getState(), phase: 'SeasonReview', fixtures, playoffFixtures, auctionComplete: true });
assert(!isWindowOpen(world([fx({ isCompleted: true })], [])).open, 'closed once a league match has been played');
assert(
  isWindowOpen(world([fx({ isCompleted: true })], [fx({ isPlayoff: true, playoffType: 'Final', isCompleted: true })])).open,
  'open again at Season Review once the Final is played'
);

console.log(`\n🎉 Season flow: ${passed} assertions passed`);
