'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { getTeamTheme } from '@/lib/theme/team-themes';
import {
  Users,
  Globe,
  Award,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  DollarSign,
  Shield,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import type { Player } from '@/lib/types/game';
import type { RegisteredPlayer } from '@/lib/types/registration';

export function RegistrationDashboard() {
  const {
    humanFranchiseId,
    franchises,
    registrationPool,
    registrationSummary,
    setPhase,
    compileAuctionPool,
  } = useGameStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedPrice, setSelectedPrice] = useState<number | 'All'>('All');
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);

  const summary = registrationSummary || {
    totalRegistered: registrationPool.length,
    indianCount: registrationPool.filter((p) => p.nationality === 'Indian').length,
    overseasCount: registrationPool.filter((p) => p.nationality === 'Overseas').length,
    cappedIndianCount: registrationPool.filter((p) => p.nationality === 'Indian' && p.status === 'Capped').length,
    uncappedIndianCount: registrationPool.filter((p) => p.nationality === 'Indian' && p.status === 'Uncapped').length,
    cappedOverseasCount: registrationPool.filter((p) => p.nationality === 'Overseas' && p.status === 'Capped').length,
    uncappedOverseasCount: registrationPool.filter((p) => p.nationality === 'Overseas' && p.status === 'Uncapped').length,
    byCountry: {},
    byRole: { Batter: 0, Bowler: 0, 'All-Rounder': 0, Wicketkeeper: 0 },
    byBasePrice: {},
  };

  // Filter registered players
  const filteredPlayers = registrationPool.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchAlt = p.alternateNames?.some((alt) => alt.toLowerCase().includes(q));
      const matchId = p.cricsheetId?.toLowerCase().includes(q);
      if (!matchName && !matchAlt && !matchId) return false;
    }
    if (selectedCountry !== 'All' && p.country !== selectedCountry) return false;
    if (selectedRole !== 'All' && p.role !== selectedRole) return false;
    if (selectedStatus !== 'All' && p.status !== selectedStatus) return false;
    if (selectedPrice !== 'All' && p.basePrice !== selectedPrice) return false;
    return true;
  });

  const countries = Array.from(new Set(registrationPool.map((p) => p.country))).sort();
  const basePrices = [200, 150, 100, 75, 50, 40, 30, 20];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Stage Introduction & Call to Actions */}
      <div
        className="neo-box p-6 rounded-2xl relative overflow-hidden"
        style={{ backgroundColor: theme.cardBg }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-amber-400 text-black border border-black shadow-[1.5px_1.5px_0px_#000]">
                Pre-Auction Phase 1
              </span>
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                Official Player Pool
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Player Auction Registration Hub
            </h1>
            <p className="text-zinc-300 text-xs sm:text-sm max-w-2xl font-medium">
              A total of <span className="text-amber-400 font-black">{summary.totalRegistered} authentic cricketers</span> have
              officially registered across India and international boards. Scout talents, set franchise targets,
              and compile the final auction sets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPhase('Scouting')}
              className="neo-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-black font-black text-xs uppercase transition-transform shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
              style={{ backgroundColor: theme.secondary || '#D1AB3E' }}
            >
              <Users className="w-4 h-4 stroke-[2.5]" />
              Open Scouting Room
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              onClick={() => compileAuctionPool()}
              className="neo-btn flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase transition-transform shadow-[3px_3px_0px_#000]"
            >
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              Compile & Start Auction
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase flex items-center justify-between">
            <span>Total Registered</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">{summary.totalRegistered}</div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
            Cricketers in pool
          </div>
        </div>

        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase flex items-center justify-between">
            <span>Indian Players</span>
            <span className="text-xs">🇮🇳</span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{summary.indianCount}</div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
            {summary.cappedIndianCount} Capped • {summary.uncappedIndianCount} Uncapped
          </div>
        </div>

        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase flex items-center justify-between">
            <span>Overseas Players</span>
            <Globe className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 mt-1">{summary.overseasCount}</div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
            {summary.cappedOverseasCount} Capped • {summary.uncappedOverseasCount} Uncapped
          </div>
        </div>

        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase flex items-center justify-between">
            <span>Top Tier (₹2 Cr)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {registrationPool.filter((p) => p.basePrice === 200).length}
          </div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
            Marquee / Maximum tier
          </div>
        </div>
      </div>

      {/* Base Price Tier & Role Distribution Pill Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Base Price Brackets */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border-[2px] border-black space-y-2.5">
          <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Official Base Price Distribution
          </div>
          <div className="flex flex-wrap gap-2">
            {basePrices.map((price) => {
              const count = registrationPool.filter((p) => p.basePrice === price).length;
              return (
                <button
                  key={price}
                  onClick={() => setSelectedPrice(selectedPrice === price ? 'All' : price)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black border transition-all flex items-center gap-1.5 ${
                    selectedPrice === price
                      ? 'bg-emerald-500 text-black border-black shadow-[2px_2px_0px_#000]'
                      : 'bg-black/40 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span>{formatPrice(price)}</span>
                  <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] text-white">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tactical Role Spread */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border-[2px] border-black space-y-2.5">
          <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-amber-400" /> Role Distribution
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper'] as const).map((role) => {
              const count = registrationPool.filter((p) => p.role === role).length;
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(selectedRole === role ? 'All' : role)}
                  className={`p-2 rounded-lg border transition-all ${
                    selectedRole === role
                      ? 'bg-amber-400 text-black border-black shadow-[2px_2px_0px_#000]'
                      : 'bg-black/40 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase truncate">{role}</div>
                  <div className="text-base font-black mt-0.5">{count}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="p-4 rounded-xl bg-zinc-900 border-[2px] border-black space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by player name, Cricsheet ID, or board alternate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-400"
            >
              <option value="All">All Statuses</option>
              <option value="Capped">Capped Only</option>
              <option value="Uncapped">Uncapped Only</option>
            </select>

            {/* Country Filter */}
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-400"
            >
              <option value="All">All Countries ({countries.length})</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {(searchQuery || selectedRole !== 'All' || selectedStatus !== 'All' || selectedCountry !== 'All' || selectedPrice !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRole('All');
                  setSelectedStatus('All');
                  setSelectedCountry('All');
                  setSelectedPrice('All');
                }}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black uppercase"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        <div className="text-[11px] text-zinc-400 font-medium">
          Showing <span className="text-white font-black">{filteredPlayers.length}</span> of {registrationPool.length} registered cricketers
        </div>
      </div>

      {/* Registered Players Table */}
      <div className="neo-box rounded-xl bg-zinc-900 border-[2px] border-black overflow-hidden shadow-[4px_4px_0px_#000]">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-black/90 backdrop-blur border-b border-zinc-800 text-zinc-400 uppercase font-black text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Country / Status</th>
                <th className="py-3 px-3 text-center">OVR</th>
                <th className="py-3 px-3 text-center">BAT</th>
                <th className="py-3 px-3 text-center">BOWL</th>
                <th className="py-3 px-3 text-center">Form</th>
                <th className="py-3 px-3 text-right">Base Price</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {filteredPlayers.slice(0, 100).map((player) => (
                <tr
                  key={player.id}
                  className="hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  onClick={() => setScoutingPlayer(player)}
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

                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-200">{player.country}</span>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                          player.status === 'Capped'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {player.status}
                      </span>
                    </div>
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
                    <button
                      onClick={() => setScoutingPlayer(player)}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-black uppercase border border-zinc-700"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPlayers.length > 100 && (
          <div className="p-2.5 bg-black/60 text-center text-xs text-zinc-400 font-bold border-t border-zinc-800">
            Showing top 100 matches of {filteredPlayers.length}. Refine search query or filters to narrow results.
          </div>
        )}
      </div>

      {/* Player Scouting Modal */}
      {scoutingPlayer && (
        <PlayerScoutingModal
          player={scoutingPlayer}
          onClose={() => setScoutingPlayer(null)}
        />
      )}
    </div>
  );
}

