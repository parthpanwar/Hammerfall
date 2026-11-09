// ============================================================
// IPL DYNASTY - CPU General Manager Engine: Tactical Roles
// 11 distinct tactical cricket roles beyond basic 4 positions
// ============================================================

import type { Player, Franchise } from '@/lib/types/game';

export type TacticalRole =
  | 'Opening batter'
  | 'Middle-order anchor'
  | 'Power hitter'
  | 'Finisher'
  | 'Wicketkeeper-batter'
  | 'Pace-bowling all-rounder'
  | 'Spin-bowling all-rounder'
  | 'Powerplay seamer'
  | 'Death-over specialist'
  | 'Wrist spinner'
  | 'Finger spinner';

export const ALL_TACTICAL_ROLES: TacticalRole[] = [
  'Opening batter',
  'Middle-order anchor',
  'Power hitter',
  'Finisher',
  'Wicketkeeper-batter',
  'Pace-bowling all-rounder',
  'Spin-bowling all-rounder',
  'Powerplay seamer',
  'Death-over specialist',
  'Wrist spinner',
  'Finger spinner',
];

/** Ideal coverage counts in a balanced 15-20 player IPL squad. */
export const TARGET_ROLE_COVERAGE: Record<TacticalRole, { idealXI: number; idealSquad: number }> = {
  'Opening batter': { idealXI: 2, idealSquad: 3 },
  'Middle-order anchor': { idealXI: 2, idealSquad: 3 },
  'Power hitter': { idealXI: 3, idealSquad: 4 },
  'Finisher': { idealXI: 2, idealSquad: 3 },
  'Wicketkeeper-batter': { idealXI: 1, idealSquad: 2 },
  'Pace-bowling all-rounder': { idealXI: 1, idealSquad: 2 },
  'Spin-bowling all-rounder': { idealXI: 1, idealSquad: 2 },
  'Powerplay seamer': { idealXI: 2, idealSquad: 3 },
  'Death-over specialist': { idealXI: 2, idealSquad: 3 },
  'Wrist spinner': { idealXI: 1, idealSquad: 2 },
  'Finger spinner': { idealXI: 1, idealSquad: 2 },
};

/** Determine all tactical roles a player can fulfill. A player can fulfill multiple roles. */
export function getPlayerTacticalRoles(player: Player): TacticalRole[] {
  const roles: TacticalRole[] = [];

  const isWK = player.role === 'Wicketkeeper' || player.secondaryRole === 'Wicketkeeper';
  const isSpinner = player.isSpinner ||
    player.bowlingStyle.includes('Spin') ||
    player.bowlingStyle.includes('Break') ||
    player.bowlingStyle.includes('Orthodox') ||
    player.bowlingStyle.includes('Chinaman');

  const isPacer = !isSpinner && player.bowlingStyle !== 'None';

  // 1. Wicketkeeper-batter
  if (isWK) {
    roles.push('Wicketkeeper-batter');
  }

  // 2. Opening batter
  if (player.isOpener || player.preferredBattingPosition <= 2 || (player.role === 'Batter' && player.ratings.batting >= 75)) {
    roles.push('Opening batter');
  }

  // 3. Middle-order anchor
  if (
    (player.role === 'Batter' || isWK) &&
    player.ratings.consistency >= 68 &&
    player.preferredBattingPosition >= 3 &&
    player.preferredBattingPosition <= 5
  ) {
    roles.push('Middle-order anchor');
  }

  // 4. Power hitter
  if (player.ratings.powerHitting >= 78) {
    roles.push('Power hitter');
  }

  // 5. Finisher
  if (
    (player.role === 'Batter' || player.role === 'All-Rounder' || isWK) &&
    player.preferredBattingPosition >= 5 &&
    (player.ratings.powerHitting >= 80 || player.ratings.batting >= 78)
  ) {
    roles.push('Finisher');
  }

  // 6. Pace-bowling all-rounder
  if (player.role === 'All-Rounder' && isPacer) {
    roles.push('Pace-bowling all-rounder');
  }

  // 7. Spin-bowling all-rounder
  if (player.role === 'All-Rounder' && isSpinner) {
    roles.push('Spin-bowling all-rounder');
  }

  // 8. Powerplay seamer
  if (isPacer && (player.isPowerplayBowler || player.ratings.bowling >= 75)) {
    roles.push('Powerplay seamer');
  }

  // 9. Death-over specialist
  if (isPacer && (player.isDeathBowler || (player.ratings.bowling >= 78 && player.ratings.consistency >= 70))) {
    roles.push('Death-over specialist');
  }

  // 10. Wrist spinner
  if (
    isSpinner &&
    (player.bowlingStyle.includes('Leg Break') || player.bowlingStyle.includes('Chinaman'))
  ) {
    roles.push('Wrist spinner');
  }

  // 11. Finger spinner
  if (
    isSpinner &&
    (player.bowlingStyle.includes('Off Break') || player.bowlingStyle.includes('Orthodox'))
  ) {
    roles.push('Finger spinner');
  }

  // Default fallback if no tactical role matched
  if (roles.length === 0) {
    if (player.role === 'Bowler') {
      roles.push(isSpinner ? 'Finger spinner' : 'Powerplay seamer');
    } else {
      roles.push('Middle-order anchor');
    }
  }

  return roles;
}

/** Calculate current tactical role coverage for a squad. */
export function getSquadRoleCoverage(squad: Player[]): Record<TacticalRole, number> {
  const coverage: Record<TacticalRole, number> = {
    'Opening batter': 0,
    'Middle-order anchor': 0,
    'Power hitter': 0,
    'Finisher': 0,
    'Wicketkeeper-batter': 0,
    'Pace-bowling all-rounder': 0,
    'Spin-bowling all-rounder': 0,
    'Powerplay seamer': 0,
    'Death-over specialist': 0,
    'Wrist spinner': 0,
    'Finger spinner': 0,
  };

  for (const player of squad) {
    const roles = getPlayerTacticalRoles(player);
    for (const role of roles) {
      coverage[role]++;
    }
  }

  return coverage;
}

/** Evaluate how urgently a franchise needs a specific player's tactical roles (0 to 100). */
export function evaluateTacticalNeed(franchise: Franchise, player: Player): number {
  const coverage = getSquadRoleCoverage(franchise.players);
  const playerRoles = getPlayerTacticalRoles(player);

  let totalDeficit = 0;
  let maxDeficit = 0;

  for (const role of playerRoles) {
    const target = TARGET_ROLE_COVERAGE[role].idealSquad;
    const current = coverage[role] || 0;
    const deficit = Math.max(0, target - current);

    // Critical shortage: 0 of a core role (WK, Death-over, Opening batter, etc.)
    let severity = deficit / target;
    if (current === 0) {
      severity *= (role === 'Wicketkeeper-batter' || role === 'Death-over specialist' ? 1.6 : 1.3);
    }

    const deficitScore = severity * 100;
    totalDeficit += deficitScore;
    if (deficitScore > maxDeficit) maxDeficit = deficitScore;
  }

  // Overseas check
  if (player.nationality === 'Overseas') {
    const overseasInSquad = franchise.players.filter((p) => p.nationality === 'Overseas').length;
    if (overseasInSquad >= franchise.maxOverseas) {
      return 0; // cannot sign overseas
    }
    if (overseasInSquad >= franchise.maxOverseas - 1) {
      maxDeficit *= 0.7; // nearly full on overseas, be selective
    }
  }

  // Combine max single role deficit with average deficit
  const avgDeficit = playerRoles.length > 0 ? totalDeficit / playerRoles.length : 0;
  const needScore = Math.min(100, Math.round(maxDeficit * 0.65 + avgDeficit * 0.35));

  return needScore;
}

