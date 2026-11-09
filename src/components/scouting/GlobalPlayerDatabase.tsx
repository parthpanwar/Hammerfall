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
} from 'lucide-react';
import type { Player } from '@/lib/types/game';
import type { ShortlistPriority } from '@/lib/types/scouting';

interface GlobalPlayerDatabaseProps {
  onClose?: () => void;
}

export function GlobalPlayerDatabase({ onClose }: GlobalPlayerDatabaseProps) {
  const {
    allPlayers,
    humanFranchiseId,
    franchiseShortlists,
    updateHumanShortlist,
    removeHumanShortlist,
  } = useGameStore();

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
      <div className="neo-box p-5 rounded-2xl bg-zinc-900 border-[2px] border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              Global Player Registry
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-black border border-black">
              {allPlayers.length} Cricketers
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            100% authentic cricketers reconciled with Cricsheet registries, BCCI master lists, and international
            T20 league appearances.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs uppercase"
          >
            Close
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-zinc-900 border-[2px] border-black space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across 1,250 verified cricketers by name or Cricsheet ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none"
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
              className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none"
            >
              <option value="All">All Nationalities</option>
              <option value="Indian">Indian (623)</option>
              <option value="Overseas">Overseas (627)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Capped">Capped (471)</option>
              <option value="Uncapped">Uncapped (779)</option>
            </select>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none"
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

        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
          <div>
            Showing <span className="text-white font-black">{filteredPlayers.length}</span> matching cricketers
          </div>
          <div className="text-zinc-500">
            Click table headers to sort • Click row to inspect analytics
          </div>
        </div>
      </div>

      {/* Players Table */}
      <div className="neo-box rounded-xl bg-zinc-900 border-[2px] border-black overflow-hidden shadow-[4px_4px_0px_#000]">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-black/95 backdrop-blur border-b border-zinc-800 text-zinc-400 uppercase font-black text-[10px] tracking-wider z-10">
              <tr>
                <th className="py-3 px-4">Player / Cricsheet ID</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Country</th>
                <th className="py-3 px-3">Status</th>
                <th
                  onClick={() => handleSort('overall')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    OVR <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('batting')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    BAT <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('bowling')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    BOWL <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('form')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    Form <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('basePrice')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1">
                    Base Price <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Shortlist Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {filteredPlayers.slice(0, 150).map((player) => {
                const entry = humanList[player.id];
                return (
                  <tr
                    key={player.id}
                    onClick={() => setScoutingPlayer(player)}
                    className="hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-black text-white text-sm">{player.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {player.cricsheetId || player.id} • Age {player.age}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {player.role}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-bold text-zinc-200">
                      {player.country}
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          player.status === 'Capped'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {player.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-black text-amber-400 text-sm">
                      {player.ratings.overall}
                    </td>
                    <td className="py-2.5 px-3 text-center text-zinc-300 font-bold">
                      {player.ratings.batting}
                    </td>
                    <td className="py-2.5 px-3 text-center text-zinc-300 font-bold">
                      {player.ratings.bowling}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span
                        className={
                          player.recentForm >= 75
                            ? 'text-emerald-400'
                            : player.recentForm >= 50
                            ? 'text-zinc-300'
                            : 'text-zinc-500'
                        }
                      >
                        {player.recentForm}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                      {formatPrice(player.basePrice)}
                    </td>

                    <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateHumanShortlist(player.id, 'PriorityA')}
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            entry?.priority === 'PriorityA'
                              ? 'bg-red-500 text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          A
                        </button>
                        <button
                          onClick={() => updateHumanShortlist(player.id, 'PriorityB')}
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            entry?.priority === 'PriorityB'
                              ? 'bg-amber-400 text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          B
                        </button>
                        <button
                          onClick={() => updateHumanShortlist(player.id, 'PriorityC')}
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            entry?.priority === 'PriorityC'
                              ? 'bg-sky-400 text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          C
                        </button>
                        {entry && (
                          <button
                            onClick={() => removeHumanShortlist(player.id)}
                            className="px-1.5 py-0.5 rounded text-[9px] text-zinc-500 hover:text-red-400 font-bold"
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
          <div className="p-3 bg-black/60 text-center text-xs text-zinc-400 font-bold border-t border-zinc-800">
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

