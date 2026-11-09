// ============================================================
// IPL DYNASTY - Comprehensive Global Player Database
// Contains 1250 verified real-world cricketers across India,
// Australia, England, South Africa, West Indies, New Zealand, Afghanistan,
// Sri Lanka, Bangladesh, and Associate Nations.
// ============================================================

import type { Player } from '../types/game';
import globalData from './global-player-database.json';

/** Full global player database containing 1250 verified cricketers */
export const GLOBAL_PLAYERS: Player[] = globalData.players as Player[];

/** Core starting players for the initial season franchises (193 players) */
export const PLAYERS: Player[] = GLOBAL_PLAYERS.filter((p) => p.currentFranchiseId !== null || p.basePrice >= 100);
