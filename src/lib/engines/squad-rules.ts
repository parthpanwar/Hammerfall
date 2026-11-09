// ============================================================
// IPL DYNASTY - Official IPL Squad Constraints & Rules Engine
// Validates 18 to 25 squad sizes, maximum 8 overseas, and capped/uncapped quotas.
// ============================================================

import type { Franchise, Player } from '@/lib/types/game';
import type { SquadRules, SquadComposition } from '@/lib/types/squad-rules';
import { OFFICIAL_IPL_SQUAD_RULES } from '@/lib/types/squad-rules';

/**
 * Computes deep squad composition analytics and validates against official rules.
 */
export function analyzeSquadComposition(
  franchise: Franchise,
  rules: SquadRules = OFFICIAL_IPL_SQUAD_RULES
): SquadComposition {
  const players = franchise.players;
  const totalPlayers = players.length;

  let indianPlayers = 0;
  let overseasPlayers = 0;
  let cappedIndian = 0;
  let uncappedIndian = 0;
  let cappedOverseas = 0;
  let uncappedOverseas = 0;

  let batters = 0;
  let bowlers = 0;
  let allRounders = 0;
  let wicketkeepers = 0;

  for (const p of players) {
    const isOverseas = p.nationality === 'Overseas';
    const isCapped = p.status === 'Capped';

    if (isOverseas) {
      overseasPlayers++;
      if (isCapped) cappedOverseas++;
      else uncappedOverseas++;
    } else {
      indianPlayers++;
      if (isCapped) cappedIndian++;
      else uncappedIndian++;
    }

    if (p.role === 'Batter') batters++;
    else if (p.role === 'Bowler') bowlers++;
    else if (p.role === 'All-Rounder') allRounders++;
    else if (p.role === 'Wicketkeeper') wicketkeepers++;
  }

  const remainingSquadSlots = Math.max(0, rules.maxSquadSize - totalPlayers);
  const minSlotsNeeded = Math.max(0, rules.minSquadSize - totalPlayers);
  const remainingOverseasSlots = Math.max(0, rules.maxOverseas - overseasPlayers);

  const validationErrors: string[] = [];

  // Squad size checks
  if (totalPlayers < rules.minSquadSize) {
    validationErrors.push(`Squad size (${totalPlayers}) is below legal minimum of ${rules.minSquadSize}.`);
  }
  if (totalPlayers > rules.maxSquadSize) {
    validationErrors.push(`Squad size (${totalPlayers}) exceeds legal maximum of ${rules.maxSquadSize}.`);
  }

  // Overseas checks: maximum 8 (not mandatory, 0-8 is legal)
  if (overseasPlayers > rules.maxOverseas) {
    validationErrors.push(`Overseas player count (${overseasPlayers}) exceeds official limit of ${rules.maxOverseas}.`);
  }
  if (rules.requireExactOverseas && overseasPlayers !== rules.maxOverseas) {
    validationErrors.push(`Custom rule requires exactly ${rules.maxOverseas} overseas players (currently ${overseasPlayers}).`);
  }

  // Financial solvency check
  if (franchise.remainingPurse < 0) {
    validationErrors.push(`Remaining purse is negative (overspent by ₹${Math.abs(franchise.remainingPurse)} Lakhs).`);
  }

  const isLegal = validationErrors.length === 0;

  return {
    franchiseId: franchise.id,
    franchiseName: franchise.name,
    totalPlayers,
    indianPlayers,
    overseasPlayers,
    cappedIndian,
    uncappedIndian,
    cappedOverseas,
    uncappedOverseas,
    batters,
    bowlers,
    allRounders,
    wicketkeepers,
    remainingPurse: franchise.remainingPurse,
    remainingSquadSlots,
    minSlotsNeeded,
    remainingOverseasSlots,
    isLegal,
    validationErrors,
  };
}

/**
 * Checks if a specific player can legally be added to a franchise squad.
 */
export function canAddPlayerToSquad(
  franchise: Franchise,
  player: Player,
  rules: SquadRules = OFFICIAL_IPL_SQUAD_RULES
): { canAdd: boolean; reason?: string } {
  if (franchise.players.length >= rules.maxSquadSize) {
    return { canAdd: false, reason: `Maximum squad size (${rules.maxSquadSize}) reached.` };
  }

  if (player.nationality === 'Overseas') {
    const currentOverseas = franchise.players.filter((p) => p.nationality === 'Overseas').length;
    if (currentOverseas >= rules.maxOverseas) {
      return { canAdd: false, reason: `Maximum overseas limit (${rules.maxOverseas}) reached.` };
    }
  }

  return { canAdd: true };
}

