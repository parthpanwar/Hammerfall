// ============================================================
// IPL DYNASTY - Squad & Lineup Engine
// Handles Playing XI selection, validation, CPU lineups & Impact Player
// ============================================================

import type { Franchise, Player, PlayingXI } from '@/lib/types/game';

export interface SquadValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Validate a chosen Playing XI for a franchise. */
export function validatePlayingXI(xi: PlayingXI, squad: Player[]): SquadValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const playerMap = new Map(squad.map((p) => [p.id, p]));

  // Check 11 players selected
  if (xi.players.length !== 11) {
    errors.push(`Playing XI must have exactly 11 players (currently ${xi.players.length}).`);
  }

  // Check duplicates
  const uniqueIds = new Set(xi.players);
  if (uniqueIds.size !== xi.players.length) {
    errors.push('Playing XI cannot contain duplicate players.');
  }

  // Check players belong to squad
  for (const id of xi.players) {
    if (!playerMap.has(id)) {
      errors.push(`Player with ID ${id} is not in the squad.`);
    }
  }

  const selectedPlayers = xi.players.map((id) => playerMap.get(id)).filter((p): p is Player => !!p);

  // Check Overseas limit (maximum 4 in playing XI)
  const overseasCount = selectedPlayers.filter((p) => p.nationality === 'Overseas').length;
  if (overseasCount > 4) {
    errors.push(`Maximum 4 overseas players allowed in Playing XI (currently ${overseasCount}).`);
  }

  // Check Captain
  if (!xi.captain || !xi.players.includes(xi.captain)) {
    errors.push('A valid Captain must be selected from the Playing XI.');
  }

  // Check Wicketkeeper
  if (!xi.wicketkeeper || !xi.players.includes(xi.wicketkeeper)) {
    errors.push('A valid Wicketkeeper must be selected from the Playing XI.');
  } else {
    const wk = playerMap.get(xi.wicketkeeper);
    if (wk && wk.role !== 'Wicketkeeper' && wk.secondaryRole !== 'Wicketkeeper') {
      warnings.push(`${wk.name} is designated as Wicketkeeper but is naturally a ${wk.role}.`);
    }
  }

  // Check Bowling Options (minimum 5 viable bowlers required to bowl 20 overs)
  const bowlingOptions = selectedPlayers.filter(
    (p) => p.role === 'Bowler' || p.role === 'All-Rounder' || p.ratings.bowling >= 60
  );
  if (bowlingOptions.length < 5) {
    errors.push(`Playing XI must have at least 5 bowling options (currently ${bowlingOptions.length}).`);
  } else if (bowlingOptions.length === 5) {
    warnings.push('Only 5 bowling options selected. If one has an off day, no 6th bowler is available.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Automatically select the best Playing XI for a franchise. */
export function generateBestPlayingXI(franchise: Franchise): PlayingXI {
  const squad = [...franchise.players];
  if (squad.length < 11) {
    // If fewer than 11 players, return whatever is available
    return {
      franchiseId: franchise.id,
      players: squad.map((p) => p.id),
      captain: squad[0]?.id || '',
      wicketkeeper: squad.find((p) => p.role === 'Wicketkeeper')?.id || squad[0]?.id || '',
    };
  }

  // 1. Pick best Wicketkeeper (prefer Indian to conserve overseas slot if possible)
  const wicketkeepers = squad
    .filter((p) => p.role === 'Wicketkeeper' || p.secondaryRole === 'Wicketkeeper')
    .sort((a, b) => b.ratings.overall - a.ratings.overall);

  const bestWK = wicketkeepers[0] || squad.reduce((best, p) => (p.ratings.fielding > best.ratings.fielding ? p : best), squad[0]);

  // 2. Separate into roles
  const batters = squad.filter(
    (p) => p.id !== bestWK.id && (p.role === 'Batter' || (p.role === 'Wicketkeeper' && p.id !== bestWK.id))
  );
  const allRounders = squad.filter((p) => p.id !== bestWK.id && p.role === 'All-Rounder');
  const bowlers = squad.filter((p) => p.id !== bestWK.id && p.role === 'Bowler');

  // Sort candidates by overall rating
  batters.sort((a, b) => b.ratings.overall - a.ratings.overall);
  allRounders.sort((a, b) => b.ratings.overall - a.ratings.overall);
  bowlers.sort((a, b) => b.ratings.overall - a.ratings.overall);

  // Target team structure:
  // 1 WK (selected)
  // 3-4 Specialist Batters
  // 2-3 All-Rounders
  // 4 Specialist Bowlers (with at least 1 spinner and 2 pacers)
  const selected: Player[] = [bestWK];
  let overseasCount = bestWK.nationality === 'Overseas' ? 1 : 0;

  const tryAdd = (p: Player | undefined): boolean => {
    if (!p) return false;
    if (selected.some((s) => s.id === p.id)) return false;
    if (p.nationality === 'Overseas' && overseasCount >= 4) return false;
    selected.push(p);
    if (p.nationality === 'Overseas') overseasCount++;
    return true;
  };

  // Add 4 top bowlers (ensure balance of pace and spin)
  const spinners = bowlers.filter((b) => b.isSpinner);
  const pacers = bowlers.filter((b) => !b.isSpinner);

  let bowlersAdded = 0;
  // Try 1 top spinner
  for (const s of spinners) {
    if (tryAdd(s)) {
      bowlersAdded++;
      break;
    }
  }

  // Try 2 top pacers
  for (const p of pacers) {
    if (bowlersAdded >= 3) break;
    if (tryAdd(p)) bowlersAdded++;
  }

  // Fill up to 4 bowlers
  for (const b of bowlers) {
    if (bowlersAdded >= 4) break;
    if (tryAdd(b)) bowlersAdded++;
  }

  // Add 2 all-rounders
  let arAdded = 0;
  for (const ar of allRounders) {
    if (arAdded >= 2) break;
    if (tryAdd(ar)) arAdded++;
  }

  // Add 4 top batters
  let battersAdded = 0;
  for (const b of batters) {
    if (selected.length >= 11) break;
    if (tryAdd(b)) battersAdded++;
  }

  // If still under 11, add best remaining players respecting overseas limit
  const remaining = squad
    .filter((p) => !selected.some((s) => s.id === p.id))
    .sort((a, b) => b.ratings.overall - a.ratings.overall);

  for (const p of remaining) {
    if (selected.length >= 11) break;
    tryAdd(p);
  }

  // If still under 11 (due to overseas limit), fill with any domestic players
  if (selected.length < 11) {
    for (const p of remaining) {
      if (selected.length >= 11) break;
      if (!selected.some((s) => s.id === p.id)) {
        selected.push(p);
      }
    }
  }

  // Sort batting order: Openers -> Top order -> Middle order -> All-rounders -> Bowlers
  const orderedXI = [...selected].sort((a, b) => {
    const getPosPriority = (p: Player) => {
      if (p.isOpener) return 1;
      if (p.preferredBattingPosition) return p.preferredBattingPosition;
      if (p.role === 'Batter') return 3;
      if (p.role === 'Wicketkeeper') return 4;
      if (p.role === 'All-Rounder') return 7;
      return 10;
    };
    return getPosPriority(a) - getPosPriority(b);
  });

  // Choose captain: highest overall or experienced leader
  const captainCandidate = [...orderedXI].sort((a, b) => {
    const capScoreA = a.ratings.consistency * 0.4 + a.ratings.overall * 0.4 + (a.age >= 28 ? 20 : 0);
    const capScoreB = b.ratings.consistency * 0.4 + b.ratings.overall * 0.4 + (b.age >= 28 ? 20 : 0);
    return capScoreB - capScoreA;
  })[0];

  // Pick impact player from bench
  const bench = squad.filter((p) => !orderedXI.some((o) => o.id === p.id));
  const impactCandidate = bench.find((p) => p.ratings.overall >= 75) || bench[0];

  return {
    franchiseId: franchise.id,
    players: orderedXI.map((p) => p.id),
    captain: captainCandidate?.id || orderedXI[0]?.id || '',
    wicketkeeper: bestWK.id,
    impactPlayer: impactCandidate?.id,
  };
}

