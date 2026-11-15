// ============================================================
// IPL DYNASTY - Front-office strategy planner
//
// Every CPU franchise starts with its real-world philosophy (MI chase match-
// winners, CSK trust experience, RR back youth…). After each season the front
// office reviews the result and the squad, and keeps or changes course:
//
//   • Champions / finalists stay the course (and refresh the departments that let
//     them down).
//   • Playoff sides mostly keep the plan, or fix their weaker department.
//   • Mid-table sides change something: fix the weak department, get younger, or
//     go hunting value.
//   • Bottom sides tear it up: an old squad rebuilds around youth, a young one adds
//     proven heads, and repeated failure turns a front office aggressive.
//
// Scouting focus (role affinities) is re-derived from the squad every season:
// the roles where this XI is weakest against the league are the ones they chase.
// ============================================================

import type { Franchise, FranchiseStrategy, GMPersonality, StandingsEntry } from '@/lib/types/game';
import { FRANCHISE_GM_PROFILES, type GMPersonalityArchetype } from './personalities';
import { ALL_TACTICAL_ROLES, getPlayerTacticalRoles, type TacticalRole } from './tactical-roles';
import { bestXi } from './xi-value';
import { selectionScore } from '../selection-score';
import { createSeededRandom } from '@/lib/utils/random';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const PLAN_LABEL: Record<GMPersonalityArchetype, string> = {
  'Aggressive spender': 'Go big for match-winners',
  'Value-focused analyst': 'Value hunting',
  'Youth development specialist': 'Rebuild around youth',
  'Experienced-player specialist': 'Back proven experience',
  'Bowling-focused strategist': 'Fix the bowling',
  'Batting-focused strategist': 'Fix the batting',
  'Balanced squad builder': 'Balanced build',
  'Risk-averse general manager': 'Protect the core',
  'Opportunistic bidder': 'Bargain hunting',
};

/** The legacy personality flag other engines read (retention, scouting, toss). */
export const LEGACY_PERSONALITY: Record<GMPersonalityArchetype, GMPersonality> = {
  'Aggressive spender': 'BigSpender',
  'Value-focused analyst': 'ValueHunter',
  'Youth development specialist': 'YouthFocused',
  'Experienced-player specialist': 'PatientBuilder',
  'Bowling-focused strategist': 'BowlingFirst',
  'Batting-focused strategist': 'SuperstarHunter',
  'Balanced squad builder': 'BalancedBuilder',
  'Risk-averse general manager': 'AnalyticsDriven',
  'Opportunistic bidder': 'ValueHunter',
};

/** The franchise's IRL philosophy — its plan until its first season is reviewed. */
export function defaultStrategy(franchiseId: string, season = 0): FranchiseStrategy {
  const prof = FRANCHISE_GM_PROFILES[franchiseId];
  const archetype: GMPersonalityArchetype = prof?.initialArchetype ?? 'Balanced squad builder';
  return {
    archetype,
    plan: PLAN_LABEL[archetype],
    rationale: 'The front office’s long-standing philosophy.',
    roleAffinities: { ...(prof?.roleAffinities ?? {}) } as Record<string, number>,
    domesticPremium: prof?.domesticPremium ?? 1.15,
    starAggression: prof?.starAggression ?? 0.8,
    season,
    history: [],
  };
}

export function activeStrategy(f: Pick<Franchise, 'id' | 'strategy'>): FranchiseStrategy {
  return f.strategy ?? defaultStrategy(f.id);
}

export function strategyArchetype(f: Pick<Franchise, 'id' | 'strategy'>): GMPersonalityArchetype {
  return activeStrategy(f).archetype as GMPersonalityArchetype;
}

// ---------------------------------------------------------------- diagnostics

interface SquadProfile {
  xiAge: number;
  batting: number;
  bowling: number;
  prospects: number;
  roleBest: Partial<Record<TacticalRole, number>>;
  roleCount: Partial<Record<TacticalRole, number>>;
}

function profileSquad(f: Franchise): SquadProfile {
  const xi = bestXi(f.players);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 60);
  const top = (xs: number[], n: number) => avg([...xs].sort((a, b) => b - a).slice(0, n));
  const bat = f.players.filter((p) => p.role !== 'Bowler').map((p) => (p.role === 'All-Rounder' ? p.ratings.batting : selectionScore(p)));
  const bowl = f.players.filter((p) => p.role === 'Bowler' || p.role === 'All-Rounder').map((p) => (p.role === 'Bowler' ? selectionScore(p) : p.ratings.bowling));
  const roleBest: SquadProfile['roleBest'] = {};
  const roleCount: SquadProfile['roleCount'] = {};
  for (const p of f.players) {
    const s = selectionScore(p);
    for (const r of getPlayerTacticalRoles(p)) {
      roleBest[r] = Math.max(roleBest[r] ?? 0, s);
      roleCount[r] = (roleCount[r] ?? 0) + 1;
    }
  }
  return {
    xiAge: avg(xi.map((p) => p.age)),
    batting: top(bat, 6),
    bowling: top(bowl, 5),
    prospects: f.players.filter((p) => p.nationality === 'Indian' && p.age <= 23 && p.ratings.potential >= 80).length,
    roleBest,
    roleCount,
  };
}

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export interface LeagueStrategyContext {
  profiles: Map<string, SquadProfile>;
  battingRank: Map<string, number>;
  bowlingRank: Map<string, number>;
  ageRank: Map<string, number>; // 1 = oldest XI
  roleLeagueBest: Partial<Record<TacticalRole, number>>;
}

export function buildLeagueContext(franchises: Franchise[]): LeagueStrategyContext {
  const profiles = new Map(franchises.map((f) => [f.id, profileSquad(f)]));
  const rank = (key: 'batting' | 'bowling' | 'xiAge') => {
    const ids = [...profiles.entries()].sort((a, b) => b[1][key] - a[1][key]).map(([id]) => id);
    return new Map(ids.map((id, i) => [id, i + 1]));
  };
  const roleLeagueBest: LeagueStrategyContext['roleLeagueBest'] = {};
  for (const r of ALL_TACTICAL_ROLES) {
    const vals = [...profiles.values()].map((p) => p.roleBest[r] ?? 60);
    roleLeagueBest[r] = vals.reduce((t, x) => t + x, 0) / Math.max(1, vals.length);
  }
  return { profiles, battingRank: rank('batting'), bowlingRank: rank('bowling'), ageRank: rank('xiAge'), roleLeagueBest };
}

// ---------------------------------------------------------------- planning

export interface StrategyReview {
  franchiseId: string;
  from: GMPersonalityArchetype;
  to: GMPersonalityArchetype;
  changed: boolean;
  strategy: FranchiseStrategy;
}

/**
 * Review a finished season and draw up the plan for the next auction window.
 * `squad` should be the squad going into that window (after ageing/development).
 */
export function planNextStrategy(
  squad: Franchise,
  standings: StandingsEntry[],
  season: number,
  result: { champion: boolean; finalist: boolean },
  ctx: LeagueStrategyContext,
  seed: number
): StrategyReview {
  const prev = activeStrategy(squad);
  const from = prev.archetype as GMPersonalityArchetype;
  const rng = createSeededRandom(seed + season * 101 + squad.id.split('').reduce((t, c) => t + c.charCodeAt(0), 0));
  const pos = standings.find((s) => s.franchiseId === squad.id)?.position ?? 5;
  const prof = ctx.profiles.get(squad.id) ?? profileSquad(squad);
  const batRank = ctx.battingRank.get(squad.id) ?? 5;
  const bowlRank = ctx.bowlingRank.get(squad.id) ?? 5;
  const ageRank = ctx.ageRank.get(squad.id) ?? 5;
  const finishes = [...prev.history.map((h) => h.finish ?? 5), pos];
  let badRun = 0;
  for (let i = finishes.length - 1; i >= 0 && finishes[i] >= 6; i--) badRun++;

  const weakDept: GMPersonalityArchetype | null =
    bowlRank >= 7 && bowlRank > batRank ? 'Bowling-focused strategist' : batRank >= 7 && batRank > bowlRank ? 'Batting-focused strategist' : null;
  const old = prof.xiAge >= 31 || (ageRank <= 2 && prof.xiAge >= 29.5);
  const pick = (xs: GMPersonalityArchetype[]) => xs[Math.floor(rng.next() * xs.length)];
  const finishText = result.champion ? 'Won the title' : result.finalist ? 'Reached the final' : `Finished ${ordinal(pos)}`;

  let to: GMPersonalityArchetype = from;
  let why: string;
  if (result.champion || result.finalist || pos <= 2) {
    why = `${finishText} — the plan worked, so the front office stays the course.`;
    if (weakDept && rng.next() < 0.25) {
      to = weakDept;
      why = `${finishText}, but the ${to === 'Bowling-focused strategist' ? 'attack' : 'batting'} ranked ${ordinal(to === 'Bowling-focused strategist' ? bowlRank : batRank)} — patching it up.`;
    }
  } else if (pos <= 4) {
    if (weakDept && rng.next() < 0.6) {
      to = weakDept;
      why = `${finishText}; the ${to === 'Bowling-focused strategist' ? 'bowling' : 'batting'} (${ordinal(to === 'Bowling-focused strategist' ? bowlRank : batRank)} in the league) held them back.`;
    } else if (rng.next() < 0.7) {
      why = `${finishText} — close enough to keep the plan.`;
    } else {
      to = pick(['Balanced squad builder', 'Opportunistic bidder', 'Value-focused analyst'].filter((a) => a !== from) as GMPersonalityArchetype[]);
      why = `${finishText}; a tweak to find the last few percent.`;
    }
  } else if (pos <= 7 && rng.next() < 0.4) {
    why = `${finishText} — the owners back the plan for one more year.`;
  } else if (pos <= 7) {
    if (weakDept && weakDept !== from) {
      to = weakDept;
      why = `${finishText} with the ${ordinal(weakDept === 'Bowling-focused strategist' ? bowlRank : batRank)}-ranked ${weakDept === 'Bowling-focused strategist' ? 'attack' : 'batting'} — that department gets the money.`;
    } else if (old && from !== 'Youth development specialist') {
      to = 'Youth development specialist';
      why = `${finishText} with one of the oldest XIs (avg ${prof.xiAge.toFixed(1)}) — time to get younger.`;
    } else {
      to = pick(['Value-focused analyst', 'Opportunistic bidder', 'Balanced squad builder'].filter((a) => a !== from) as GMPersonalityArchetype[]);
      why = `${finishText}; the old approach is dropped for a smarter, value-led auction.`;
    }
  } else {
    if (old && from !== 'Youth development specialist') {
      to = 'Youth development specialist';
      why = `${finishText} with an ageing XI (avg ${prof.xiAge.toFixed(1)}) — a full rebuild around young Indian talent.`;
    } else if (badRun >= 2) {
      to = 'Aggressive spender';
      why = `${badRun} poor seasons in a row — the owners open the chequebook for proven match-winners.`;
    } else if (prof.prospects >= 3 && from !== 'Experienced-player specialist') {
      to = 'Experienced-player specialist';
      why = `${finishText}; plenty of young talent but no know-how — adding proven IPL heads around them.`;
    } else if (weakDept && weakDept !== from) {
      to = weakDept;
      why = `${finishText}; the ${weakDept === 'Bowling-focused strategist' ? 'attack' : 'batting'} was the league's ${ordinal(weakDept === 'Bowling-focused strategist' ? bowlRank : batRank)}-best — rebuilding it.`;
    } else {
      to = pick(['Aggressive spender', 'Youth development specialist', 'Opportunistic bidder'].filter((a) => a !== from) as GMPersonalityArchetype[]);
      why = `${finishText} — the front office rips up the old plan.`;
    }
  }

  // Scouting focus: chase the roles where this squad is furthest behind the league.
  const roleAffinities: Record<string, number> = {};
  for (const r of ALL_TACTICAL_ROLES) {
    const gap = (ctx.roleLeagueBest[r] ?? 70) - (prof.roleBest[r] ?? 55);
    let a = 1 + clamp(gap / 12, -0.25, 0.45);
    if ((prof.roleCount[r] ?? 0) === 0) a += 0.15;
    if (to === 'Bowling-focused strategist' && /bowl|spinner|seamer|Death/i.test(r)) a += 0.15;
    if (to === 'Batting-focused strategist' && /bat|hitter|Finisher|anchor|Opening/i.test(r)) a += 0.15;
    a = Math.round(clamp(a, 0.75, 1.6) * 100) / 100;
    if (Math.abs(a - 1) >= 0.1) roleAffinities[r] = a;
  }

  const domesticPremium = to === 'Youth development specialist' ? 1.3 : to === 'Experienced-player specialist' ? 1.1 : 1.18;
  const starAggression = to === 'Aggressive spender' ? 0.95 : to === 'Risk-averse general manager' ? 0.6 : to === 'Value-focused analyst' ? 0.7 : 0.8;

  const strategy: FranchiseStrategy = {
    archetype: to,
    plan: PLAN_LABEL[to],
    rationale: why,
    roleAffinities,
    domesticPremium,
    starAggression,
    season: season + 1,
    history: [...prev.history, { season, archetype: from, plan: prev.plan, finish: pos }].slice(-6),
  };
  return { franchiseId: squad.id, from, to, changed: to !== from, strategy };
}
