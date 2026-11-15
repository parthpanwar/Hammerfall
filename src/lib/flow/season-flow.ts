// ============================================================
// IPL DYNASTY - Season Flow
// One ordered model of a franchise year. The header, the "How it works"
// guide and step gating all read from here, so the order of play is
// defined in exactly one place.
// ============================================================

import type { AuctionType, GamePhase, GameSettings, GameState } from '@/lib/types/game';

export type ChapterId = 'offseason' | 'auction' | 'season' | 'review';

export interface FlowStep {
  id: string;
  phase: GamePhase;
  chapter: ChapterId;
  label: string;
  /** One line: what this step is. */
  summary: string;
  /** One line: what the player should do here, naming the button that moves on. */
  todo: string;
  /** Whether the trade window is open while on this step. */
  trades: boolean;
  /** Wording used in mini-auction years, where it differs. */
  mini?: { label?: string; summary?: string; todo?: string };
}

export const CHAPTERS: { id: ChapterId; label: string; blurb: string }[] = [
  { id: 'offseason', label: 'Offseason', blurb: 'Keep your core, see who is available and plan your targets.' },
  { id: 'auction', label: 'Auction', blurb: 'Bid live against nine CPU franchises to complete your squad.' },
  { id: 'season', label: 'Season', blurb: 'Pick your XI, play the league and chase a playoff spot.' },
  { id: 'review', label: 'Review', blurb: 'Awards, player progression, retirements — then the next season.' },
];

export const FLOW_STEPS: FlowStep[] = [
  {
    id: 'retain',
    phase: 'Retention',
    chapter: 'offseason',
    label: 'Retentions',
    mini: {
      label: 'Releases',
      summary: 'Mini-auction year: your squad stays together. Choose who to release to free up purse.',
      todo: 'Mark players to release, then press “Confirm releases”.',
    },
    summary: 'Choose which players to keep before the auction. Everyone else is released.',
    todo: 'Add players to your retention slots, then press “Lock retentions”.',
    trades: true,
  },
  {
    id: 'pool',
    phase: 'Registration',
    chapter: 'offseason',
    label: 'Player Pool',
    summary: 'Every released and newly registered player who will enter the auction.',
    todo: 'Browse the pool, then continue to the Scouting room.',
    trades: true,
  },
  {
    id: 'scout',
    phase: 'Scouting',
    chapter: 'offseason',
    label: 'Scouting',
    summary: 'Build your shortlist and set a maximum bid for the players you want.',
    todo: 'Star your targets, then press “Compile auction sets”.',
    trades: true,
  },
  {
    id: 'sets',
    phase: 'ShortlistReveal',
    chapter: 'auction',
    label: 'Auction Sets',
    summary: 'The final auction list, grouped into the sets they will be called in.',
    todo: 'Check when your targets come up, then “Enter the auction floor”.',
    trades: false,
  },
  {
    id: 'auction',
    phase: 'Auction',
    chapter: 'auction',
    label: 'Live Auction',
    mini: { label: 'Mini Auction', summary: 'A short auction with a small pool: released players, the new intake and a few free agents.' },
    summary: 'Lots are called one at a time. Bid, pass, or simulate ahead.',
    todo: 'Bid on your targets. When the hammer falls on the last lot, finalize squads.',
    trades: false,
  },
  {
    id: 'squad',
    phase: 'SquadManagement',
    chapter: 'season',
    label: 'Squad & XI',
    summary: 'Pick your playing XI, batting order, captain and keeper.',
    todo: 'Set your XI, then press “Confirm & Enter Tournament” to start the league.',
    trades: true,
  },
  {
    id: 'league',
    phase: 'Tournament',
    chapter: 'season',
    label: 'League',
    summary: '70 league matches. The top four on the points table reach the playoffs.',
    todo: 'Play or simulate your matches. When the league ends, enter the playoffs.',
    trades: false,
  },
  {
    id: 'playoffs',
    phase: 'Playoffs',
    chapter: 'season',
    label: 'Playoffs',
    summary: 'Qualifier 1, Eliminator, Qualifier 2 and the Final.',
    todo: 'Simulate each knockout in order, then open the Season Review.',
    trades: false,
  },
  {
    id: 'review',
    phase: 'SeasonReview',
    chapter: 'review',
    label: 'Season Review',
    summary: 'Champions, Orange & Purple Caps, MVP and your season recap.',
    todo: 'Review the season, then “Advance” to start the next offseason.',
    trades: true,
  },
];

/** Screens that sit outside the order of play (opened from the toolbar). */
export const SIDE_PAGES: Partial<Record<GamePhase, string>> = {
  TradeCenter: 'Trade Center',
  CareerDashboard: 'Franchise Office',
  CareerHistory: 'Franchise Office',
  Standings: 'Points Table',
  Transactions: 'League Transactions',
};

export const stepByPhase = (phase: GamePhase | null | undefined) => FLOW_STEPS.find((s) => s.phase === phase);

export type StepStatus = 'done' | 'current' | 'open' | 'locked';

export type FlowInput = Pick<
  GameState,
  | 'phase'
  | 'retentionComplete'
  | 'registrationPool'
  | 'auctionSession'
  | 'auctionComplete'
  | 'fixtures'
  | 'playoffFixtures'
  | 'seasonAwards'
> & { lastActivePhase: GamePhase | null; mini?: boolean };

export interface FlowView {
  /** Steps with this season's wording (mega vs mini auction). */
  steps: FlowStep[];
  /** The step the player is working on (also when viewing a side page). */
  current: FlowStep;
  currentIndex: number;
  /** Set when the visible screen is a side page rather than a step. */
  sidePage: string | null;
  statuses: StepStatus[];
  /** Furthest step the season has reached. */
  reachedIndex: number;
  next: FlowStep | null;
}

/** Furthest step reached, inferred purely from game data. */
function reachedFromData(s: FlowInput): number {
  const idx = (id: string) => FLOW_STEPS.findIndex((x) => x.id === id);
  const finalDone = s.playoffFixtures.some((f) => f.playoffType === 'Final' && f.isCompleted);
  if (finalDone || s.seasonAwards.length > 0) return idx('review');
  if (s.playoffFixtures.length > 0) return idx('playoffs');
  if (s.fixtures.length > 0) return idx('league');
  if (s.auctionComplete) return idx('squad');
  // A new season keeps last year's pool around until retentions are locked.
  if (!s.retentionComplete) return idx('retain');
  if (s.auctionSession) return idx('sets');
  if (s.registrationPool.length > 0) return idx('pool');
  return idx('retain');
}

export function getFlowView(s: FlowInput): FlowView {
  const dataReached = reachedFromData(s);
  const onStep = stepByPhase(s.phase);
  const remembered = stepByPhase(s.lastActivePhase);
  const current = onStep ?? remembered ?? FLOW_STEPS[dataReached];
  const currentIndex = FLOW_STEPS.indexOf(current);
  const reachedIndex = Math.max(dataReached, currentIndex);

  const statuses: StepStatus[] = FLOW_STEPS.map((step, i) => {
    if (i === currentIndex) return 'current';
    if (i < currentIndex) return canRevisit(step, s) ? 'open' : 'done';
    return i <= reachedIndex && canRevisit(step, s) ? 'open' : 'locked';
  });

  const steps = stepsFor(!!s.mini);
  return {
    steps,
    current: steps[currentIndex],
    currentIndex,
    sidePage: onStep ? null : SIDE_PAGES[s.phase] ?? null,
    statuses,
    reachedIndex,
    next: steps[currentIndex + 1] ?? null,
  };
}

/** Steps that can be reopened without breaking the season (no undo of decisions). */
function canRevisit(step: FlowStep, s: FlowInput): boolean {
  const auctionLive = !!s.auctionSession && !s.auctionComplete;
  switch (step.id) {
    case 'pool':
    case 'scout':
      // Before the final list is published, planning screens stay open.
      return s.retentionComplete && s.registrationPool.length > 0 && !s.auctionComplete && s.phase !== 'Auction';
    case 'sets':
      return s.retentionComplete && auctionLive && s.phase === 'Scouting';
    case 'squad':
      return s.auctionComplete;
    case 'league':
      return s.fixtures.length > 0;
    case 'playoffs':
      return s.playoffFixtures.length > 0;
    case 'review':
      return s.seasonAwards.length > 0;
    default:
      return false;
  }
}

// ------------------------------------------------------------
// Campaign cycles
//
// IPL seasons are named by the year they are played; the auction for a season is
// held late in the PREVIOUS year (the IPL 2025 mega auction was in Nov 2024).
//
//  * Custom cycle ('custom'): your own 3-season cycle — mega auction before year 1,
//    mini auctions before years 2 and 3.
//  * Real IPL cycle ('irl'): mirrors the real calendar. Mega auctions for IPL 2025,
//    2028, 2031…; everything in between is a mini auction. The campaign joins the
//    live cycle at IPL 2027 (its last mini year) and plays through the next full
//    cycle (2028 mega, 2029-30 mini).
// ------------------------------------------------------------

export type CycleMode = 'custom' | 'irl';

/** First season of a real mega cycle (IPL 2025, auction Nov 2024). */
export const IRL_MEGA_ANCHOR = 2025;
/** Seasons in a custom campaign. */
export const CAMPAIGN_SEASONS = 3;
/** Real-cycle campaigns run until the end of the next full cycle after the start. */
export const IRL_END_SEASON = 2030;

type CycleSettings = Pick<GameSettings, 'auctionType' | 'startingSeason'> & { cycleMode?: CycleMode };

export const cycleModeOf = (settings: CycleSettings): CycleMode => settings.cycleMode ?? 'custom';

/** Number of seasons this campaign runs for. */
export function campaignLength(settings: CycleSettings): number {
  return cycleModeOf(settings) === 'irl' ? Math.max(1, IRL_END_SEASON - settings.startingSeason + 1) : CAMPAIGN_SEASONS;
}

/** 1-based year of the campaign. */
export function campaignYear(season: number, settings: CycleSettings): number {
  return season - settings.startingSeason + 1;
}

export function isFinalSeason(season: number, settings: CycleSettings): boolean {
  return campaignYear(season, settings) >= campaignLength(settings);
}

/** Real IPL: mega every 3 seasons from IPL 2025. */
export function irlAuctionType(season: number): AuctionType {
  return (((season - IRL_MEGA_ANCHOR) % 3) + 3) % 3 === 0 ? 'Mega' : 'Mini';
}

/** Auction type that precedes a season. */
export function auctionTypeFor(season: number, settings: CycleSettings): AuctionType {
  if (cycleModeOf(settings) === 'irl') return irlAuctionType(season);
  return campaignYear(season, settings) <= 1 ? 'Mega' : 'Mini';
}

/** The calendar year the auction for a season is held in (late in the previous year). */
export const auctionYearFor = (season: number) => season - 1;

/** e.g. "IPL 2027 · Mini auction (Dec 2026)". */
export function seasonLabel(season: number, settings: CycleSettings): string {
  const type = auctionTypeFor(season, settings);
  return `IPL ${season} · ${type} auction (${type === 'Mega' ? 'Nov' : 'Dec'} ${auctionYearFor(season)})`;
}

/** Steps with mini-year wording applied. */
export function stepsFor(mini: boolean): FlowStep[] {
  if (!mini) return FLOW_STEPS;
  return FLOW_STEPS.map((st) => (st.mini ? { ...st, ...st.mini } : st));
}
