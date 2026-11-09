// ============================================================
// IPL DYNASTY - Franchise Scouting & Shortlist Types
// Defines priority tiers, scouting entries, and multi-franchise shortlists.
// ============================================================

import type { PlayerRole, PlayerNationality, PlayerStatus } from './game';

/** Shortlist priority tiers */
export type ShortlistPriority = 'PriorityA' | 'PriorityB' | 'PriorityC' | 'Watchlist';

/** Individual shortlisted player entry with custom GM notes */
export interface ShortlistEntry {
  playerId: string;
  franchiseId: string;
  priority: ShortlistPriority;
  scoutingNotes?: string;
  targetMaxBidLakhs?: number;
  tacticalRoleTag?: string;
  addedTimestamp: number;
}

/** Complete prioritized shortlist for a franchise */
export interface FranchiseShortlist {
  franchiseId: string;
  seasonYear: number;
  entries: Record<string, ShortlistEntry>; // Keyed by playerId
}

/** Filter criteria for scouting room search */
export interface ScoutingFilters {
  searchQuery: string;
  nationality: 'All' | PlayerNationality;
  country: string;
  status: 'All' | PlayerStatus;
  role: 'All' | PlayerRole;
  minOverall: number;
  maxBasePrice: number;
  maxAge: number;
  onlyShortlisted: boolean;
}

