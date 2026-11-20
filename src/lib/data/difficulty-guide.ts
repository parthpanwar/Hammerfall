// Plain-language guide to the CPU difficulty levels. Each line describes what the
// CPU general managers actually do at that level (see cpu-gm/advanced-valuation.ts,
// trade/trade-ai.ts and retention-engine.ts).

import type { CPUDifficulty } from '@/lib/types/game';

export interface DifficultyGuide {
  id: CPUDifficulty;
  /** One line for the picker tile. */
  short: string;
  /** What the CPU GMs do, in the auction, in trades and at retentions. */
  auction: string;
  trades: string;
  retentions: string;
  /** A concrete example of how it feels to play. */
  example: string;
}

export const DIFFICULTY_GUIDE: DifficultyGuide[] = [
  {
    id: 'Easy',
    short: 'Bargains everywhere. Good for learning the auction.',
    auction: 'GMs bid up to a player’s market value and stop. They ignore what their XI needs and how many similar players are still to come.',
    trades: 'They judge players by OVR alone and accept deals that are only roughly fair.',
    retentions: 'Retention choices are loose: they sometimes keep the wrong players and let good ones go to the pool.',
    example: 'A rival with no fast bowler still stops at market value for an 84 OVR quick, so a bid just over market usually wins him.',
  },
  {
    id: 'Normal',
    short: 'Realistic bidding wars. The intended experience.',
    auction: 'GMs pay more for players who improve their XI, for roles that are running out in the pool, and for young players with growth. They spend harder late on when they have money left.',
    trades: 'They weigh role fit and contract cost, and want to come out slightly ahead.',
    retentions: 'They keep sensible cores with some variety between franchises.',
    example: 'With only two good spinners left in the pool, the next one goes for 15–30% over his usual price.',
  },
  {
    id: 'Hard',
    short: 'Smart, needs-driven rivals who protect their stars.',
    auction: 'Everything in Normal, plus: for big lots GMs simulate how the rest of the auction will play out before setting a limit.',
    trades: 'They value potential and the cost of replacing a player, and refuse to give up core players cheaply.',
    retentions: 'They keep the right players more consistently.',
    example: 'Offer two 75 OVR players for a rival’s 86 OVR captain and they say no: losing him would cost more than the pair is worth.',
  },
  {
    id: 'Expert',
    short: 'Budget-perfect GMs. Few bargains, every crore counts.',
    auction: 'Everything in Hard, with twice as many simulations. When three or more similar players are still to come, GMs refuse to overpay and wait.',
    trades: 'They model the risk in each deal and avoid uncertain ones. Franchise stars are close to untouchable.',
    retentions: 'Almost no mistakes: they keep their best value players.',
    example: 'With three 80 OVR openers still to come, nobody goes more than about 5% over market for the first. You win by planning around the auction sets.',
  },
];

export const difficultyGuide = (id: CPUDifficulty) => DIFFICULTY_GUIDE.find((d) => d.id === id)!;
