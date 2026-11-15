'use client';

import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import {
  Search,
  Filter,
  Users,
  Globe,
  Award,
  ArrowUpDown,
  Star,
  ExternalLink,
  ChevronRight,
  Database,
  X,
} from 'lucide-react';
import type { Player } from '@/lib/types/game';
import type { ShortlistPriority } from '@/lib/types/scouting';

interface GlobalPlayerDatabaseProps {
  onClose?: () => void;
  isOpen?: boolean;
  players?: Player[];
}

export function GlobalPlayerDatabase({ onClose, isOpen = true, players }: GlobalPlayerDatabaseProps) {
  const {
    allPlayers,
    humanFranchiseId,
    franchiseShortlists,
    updateHumanShortlist,
    removeHumanShortlist,
  } = useGameStore();

  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [nationalityFilter, setNationalityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'overall' | 'batting' | 'bowling' | 'form' | 'basePrice' | 'age'>('overall');
  const [sortAsc, setSortAsc] = useState(false);
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  const theme = getTeamTheme(humanFranchiseId);
  const humanList = franchiseShortlists[humanFranchiseId]?.entries || {};

  const countries = useMemo(() => {
    return Array.from(new Set(allPlayers.map((p) => p.country))).sort();
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    return allPlayers.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchAlt = p.alternateNames?.some((alt) => alt.toLowerCase().includes(q));
        const matchId = p.cricsheetId?.toLowerCase().includes(q);
        if (!matchName && !matchAlt && !matchId) return false;
      }
      if (roleFilter !== 'All' && p.role !== roleFilter) return false;
      if (nationalityFilter !== 'All' && p.nationality !== nationalityFilter) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (countryFilter !== 'All' && p.country !== countryFilter) return false;
      return true;
    }).sort((a, b) => {
      let diff = 0;
      if (sortBy === 'overall') diff = b.ratings.overall - a.ratings.overall;
      else if (sortBy === 'batting') diff = b.ratings.batting - a.ratings.batting;
      else if (sortBy === 'bowling') diff = b.ratings.bowling - a.ratings.bowling;
      else if (sortBy === 'form') diff = b.recentForm - a.recentForm;
      else if (sortBy === 'basePrice') diff = b.basePrice - a.basePrice;
      else if (sortBy === 'age') diff = a.age - b.age;
      return sortAsc ? -diff : diff;
    });
  }, [allPlayers, searchQuery, roleFilter, nationalityFilter, statusFilter, countryFilter, sortBy, sortAsc]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="terminal-card p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--m-accent-ink)]" />
            <h2 className="text-xl font-bold text-[var(--m-text)] uppercase tracking-tight font-heading">
              Global Player Registry
            </h2>
            <span className="telemetry-badge-sm bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30">
              {allPlayers.length} Cricketers
            </span>
          </div>
          <p className="text-xs text-[var(--m-dim)] max-w-xl font-medium">
            100% authentic cricketers reconciled with Cricsheet registries, BCCI master lists, and international
            T20 league appearances.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--m-raised)] hover:bg-[var(--m-line)] text-[var(--m-text)] font-bold text-xs uppercase border border-[var(--m-line)] transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="terminal-card p-4 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--m-dim)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across 1,250 verified cricketers by name or Cricsheet ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="terminal-input w-full pl-9 pr-4 py-2 rounded-lg text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="terminal-input px-3 py-2 rounded-lg text-xs cursor-pointer"
            >
              <option value="All">All Roles</option>
              <option value="Batter">Batter</option>
              <option value="Bowler">Bowler</option>
              <option value="All-Rounder">All-Rounder</option>
              <option value="Wicketkeeper">Wicketkeeper</option>
            </select>

            <select
              value={nationalityFilter}
              onChange={(e) => setNationalityFilter(e.target.value)}
              className="terminal-input px-3 py-2 rounded-lg text-xs cursor-pointer"
            >
              <option value="All">All Nationalities</option>
              <option value="Indian">Indian (623)</option>
              <option value="Overseas">Overseas (627)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="terminal-input px-3 py-2 rounded-lg text-xs cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Capped">Capped (471)</option>
              <option value="Uncapped">Uncapped (779)</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="terminal-input px-3 py-2 rounded-lg text-xs cursor-pointer"
            >
              <option value="All">All Countries ({countries.length})</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--m-dim)] font-medium">
          <div>
            Showing <span className="text-[var(--m-text)] font-bold">{filteredPlayers.length}</span> matching cricketers
          </div>
          <div className="text-[var(--m-dim)]/70">
            Click table headers to sort • Click row to inspect dossier
          </div>
        </div>
      </div>

      {/* Players Table */}
      <div className="terminal-card rounded-xl overflow-hidden border border-[var(--m-line)]">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[var(--m-panel)] border-b border-[var(--m-line)] text-[var(--m-dim)] uppercase font-bold text-[10px] tracking-wider z-10">
              <tr>
                <th className="py-3 px-4">Player / Cricsheet ID</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Country</th>
                <th className="py-3 px-3">Status</th>
                <th
                  onClick={() => handleSort('overall')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[var(--m-text)]"
                >
                  <div className="flex items-center justify-center gap-1">
                    OVR <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('batting')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[var(--m-text)]"
                >
                  <div className="flex items-center justify-center gap-1">
                    BAT <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('bowling')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[var(--m-text)]"
                >
                  <div className="flex items-center justify-center gap-1">
                    BOWL <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('form')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[var(--m-text)]"
                >
                  <div className="flex items-center justify-center gap-1">
                    Form <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('basePrice')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--m-text)]"
                >
                  <div className="flex items-center justify-end gap-1">
                    Base Price <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Shortlist Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--m-line)]/60">
              {filteredPlayers.slice(0, 150).map((player, idx) => {
                const entry = humanList[player.id];
                return (
                  <tr
                    key={player.id}
                    onClick={() => setScoutingPlayer(player)}
                    className={`hover:bg-[var(--m-raised)] transition-colors cursor-pointer ${
                      idx % 2 === 0 ? 'bg-[var(--m-panel)]' : 'bg-[var(--m-panel)]'
                    }`}
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-[var(--m-text)] text-sm">{player.name}</div>
                      <div className="text-[10px] text-[var(--m-dim)] font-mono">
                        {player.cricsheetId || player.id} • Age {player.age}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="telemetry-badge-sm bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-dim)]">
                        {player.role}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-semibold text-[var(--m-text)]">
                      {player.country}
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          player.status === 'Capped'
                            ? 'bg-[var(--m-gold)]/15 text-[var(--m-gold)] border border-[var(--m-gold)]/30'
                            : 'bg-[var(--m-raised)] text-[var(--m-dim)] border border-[var(--m-line)]'
                        }`}
                      >
                        {player.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-bold text-[var(--m-gold)] text-sm tabular-nums">
                      {player.ratings.overall}
                    </td>
                    <td className="py-2.5 px-3 text-center text-[var(--m-text)] font-medium tabular-nums">
                      {player.ratings.batting}
                    </td>
                    <td className="py-2.5 px-3 text-center text-[var(--m-text)] font-medium tabular-nums">
                      {player.ratings.bowling}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold tabular-nums">
                      <span
                        className={
                          player.recentForm >= 75
                            ? 'text-[var(--m-green)]'
                            : player.recentForm >= 50
                            ? 'text-[var(--m-text)]'
                            : 'text-[var(--m-dim)]'
                        }
                      >
                        {player.recentForm}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--m-green)]">
                      {formatPrice(player.basePrice)}
                    </td>

                    <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateHumanShortlist(player.id, 'PriorityA')}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                            entry?.priority === 'PriorityA'
                              ? 'bg-[var(--m-red)] text-white'
                              : 'bg-[var(--m-raised)] text-[var(--m-dim)] hover:text-[var(--m-text)]'
                          }`}
                        >
                          A
                        </button>
                        <button
                          onClick={() => updateHumanShortlist(player.id, 'PriorityB')}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                            entry?.priority === 'PriorityB'
                              ? 'bg-[var(--m-gold)] text-white font-extrabold'
                              : 'bg-[var(--m-raised)] text-[var(--m-dim)] hover:text-[var(--m-text)]'
                          }`}
                        >
                          B
                        </button>
                        <button
                          onClick={() => updateHumanShortlist(player.id, 'PriorityC')}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${
                            entry?.priority === 'PriorityC'
                              ? 'bg-[var(--m-accent-ink)] text-white'
                              : 'bg-[var(--m-raised)] text-[var(--m-dim)] hover:text-[var(--m-text)]'
                          }`}
                        >
                          C
                        </button>
                        {entry && (
                          <button
                            onClick={() => removeHumanShortlist(player.id)}
                            className="px-1.5 py-0.5 rounded text-[9px] text-[var(--m-dim)] hover:text-[var(--m-red)] font-bold transition-colors"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredPlayers.length > 150 && (
          <div className="p-3 bg-[var(--m-panel)] text-center text-xs text-[var(--m-dim)] font-medium border-t border-[var(--m-line)]">
            Showing top 150 matches of {filteredPlayers.length}. Refine search queries or filters to view others.
          </div>
        )}
      </div>

      {scoutingPlayer && (
        <PlayerScoutingModal
          player={scoutingPlayer}
          onClose={() => setScoutingPlayer(null)}
        />
      )}
    </div>
  );
}
