'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { SquadCompositionView } from '@/components/squad/SquadCompositionView';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import {
  Users,
  Search,
  Filter,
  Star,
  Bookmark,
  Sparkles,
  ArrowRight,
  Shield,
  Trash2,
  DollarSign,
  ChevronRight,
  Info,
  Check,
  Award,
} from 'lucide-react';
import type { Player } from '@/lib/types/game';
import type { ShortlistPriority } from '@/lib/types/scouting';

export function FranchiseScoutingRoom() {
  const {
    humanFranchiseId,
    franchises,
    registrationPool,
    franchiseShortlists,
    updateHumanShortlist,
    removeHumanShortlist,
    compileAuctionPool,
    setPhase,
    squadRules,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'human' | 'scout' | 'cpu'>('human');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedNationality, setSelectedNationality] = useState('All');
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);

  const humanList = franchiseShortlists[humanFranchiseId] || {
    franchiseId: humanFranchiseId,
    seasonYear: 2026,
    entries: {},
  };

  const shortlistEntries = Object.values(humanList.entries);
  const priorityA = shortlistEntries.filter((e) => e.priority === 'PriorityA');
  const priorityB = shortlistEntries.filter((e) => e.priority === 'PriorityB');
  const priorityC = shortlistEntries.filter((e) => e.priority === 'PriorityC');
  const watchlist = shortlistEntries.filter((e) => e.priority === 'Watchlist');

  // Filter for registration pool search
  const filteredPool = registrationPool.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.country.toLowerCase().includes(q)) return false;
    }
    if (selectedRole !== 'All' && p.role !== selectedRole) return false;
    if (selectedNationality !== 'All' && p.nationality !== selectedNationality) return false;
    return true;
  });

  const getPlayerById = (id: string) => registrationPool.find((p) => p.id === id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div
        className="neo-box p-6 rounded-2xl relative overflow-hidden"
        style={{ backgroundColor: theme.cardBg }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-amber-400 text-black border border-black shadow-[1.5px_1.5px_0px_#000]">
                Pre-Auction Phase 2
              </span>
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                {humanFranchise?.name} War Room
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Scouting Room & Shortlists
            </h1>
            <p className="text-zinc-300 text-xs sm:text-sm max-w-2xl font-medium">
              Curate your franchise target board. Set priority tiers, target spending limits, and scouting
              notes. The auction pool compiler incorporates all franchise shortlists to select the final 500
              players.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPhase('Registration')}
              className="neo-btn px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs uppercase"
            >
              Registration Summary
            </button>
            <button
              onClick={() => compileAuctionPool()}
              className="neo-btn flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase transition-transform shadow-[3px_3px_0px_#000]"
            >
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              Compile Official Auction Sets
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Squad Constraints Widget */}
      {humanFranchise && (
        <SquadCompositionView franchise={humanFranchise} rules={squadRules} />
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('human')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border-[1.5px] ${
            activeTab === 'human'
              ? 'bg-amber-400 text-black border-black shadow-[2px_2px_0px_#000]'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          My Shortlist ({shortlistEntries.length})
        </button>

        <button
          onClick={() => setActiveTab('scout')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border-[1.5px] ${
            activeTab === 'scout'
              ? 'bg-amber-400 text-black border-black shadow-[2px_2px_0px_#000]'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Search Registered Cricketers ({registrationPool.length})
        </button>

        <button
          onClick={() => setActiveTab('cpu')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border-[1.5px] ${
            activeTab === 'cpu'
              ? 'bg-amber-400 text-black border-black shadow-[2px_2px_0px_#000]'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          CPU Competitor Intelligence (9 Teams)
        </button>
      </div>

      {/* TAB 1: Human Shortlist */}
      {activeTab === 'human' && (
        <div className="space-y-6">
          {shortlistEntries.length === 0 ? (
            <div className="neo-box p-8 rounded-xl bg-zinc-900 text-center space-y-3">
              <Bookmark className="w-10 h-10 text-zinc-500 mx-auto" />
              <h3 className="text-base font-black text-white uppercase">Your Shortlist is Empty</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Explore the registration pool to tag marquee targets, middle-order anchors, fast bowlers, or
                high-potential uncapped gems.
              </p>
              <button
                onClick={() => setActiveTab('scout')}
                className="px-4 py-2 rounded-xl bg-amber-400 text-black font-black text-xs uppercase"
              >
                Browse Registration Pool
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Priority A */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <h3 className="font-black text-white text-sm uppercase">
                      Priority A: Core Marquee Targets ({priorityA.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-zinc-400">Must-have primary targets</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {priorityA.map((entry) => {
                    const player = getPlayerById(entry.playerId);
                    if (!player) return null;
                    return (
                      <ShortlistCard
                        key={entry.playerId}
                        entry={entry}
                        player={player}
                        onInspect={() => setScoutingPlayer(player)}
                        onRemove={() => removeHumanShortlist(entry.playerId)}
                        onPriorityChange={(p) => updateHumanShortlist(entry.playerId, p, entry.scoutingNotes, entry.targetMaxBidLakhs)}
                      />
                    );
                  })}
                  {priorityA.length === 0 && (
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-500 font-bold col-span-full">
                      No Priority A targets added yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Priority B */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <h3 className="font-black text-white text-sm uppercase">
                      Priority B: Secondary Targets & Fallbacks ({priorityB.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-zinc-400">Valuable squad additions</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {priorityB.map((entry) => {
                    const player = getPlayerById(entry.playerId);
                    if (!player) return null;
                    return (
                      <ShortlistCard
                        key={entry.playerId}
                        entry={entry}
                        player={player}
                        onInspect={() => setScoutingPlayer(player)}
                        onRemove={() => removeHumanShortlist(entry.playerId)}
                        onPriorityChange={(p) => updateHumanShortlist(entry.playerId, p, entry.scoutingNotes, entry.targetMaxBidLakhs)}
                      />
                    );
                  })}
                  {priorityB.length === 0 && (
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-500 font-bold col-span-full">
                      No Priority B targets added yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Priority C & Watchlist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-sky-400" />
                    <h3 className="font-black text-white text-sm uppercase">
                      Priority C: Budget & Depth ({priorityC.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {priorityC.map((entry) => {
                      const player = getPlayerById(entry.playerId);
                      if (!player) return null;
                      return (
                        <ShortlistCardCompact
                          key={entry.playerId}
                          entry={entry}
                          player={player}
                          onInspect={() => setScoutingPlayer(player)}
                          onRemove={() => removeHumanShortlist(entry.playerId)}
                        />
                      );
                    })}
                    {priorityC.length === 0 && (
                      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-500 font-bold">
                        No depth targets in Priority C.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-400" />
                    <h3 className="font-black text-white text-sm uppercase">
                      Watchlist ({watchlist.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {watchlist.map((entry) => {
                      const player = getPlayerById(entry.playerId);
                      if (!player) return null;
                      return (
                        <ShortlistCardCompact
                          key={entry.playerId}
                          entry={entry}
                          player={player}
                          onInspect={() => setScoutingPlayer(player)}
                          onRemove={() => removeHumanShortlist(entry.playerId)}
                        />
                      );
                    })}
                    {watchlist.length === 0 && (
                      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-500 font-bold">
                        No players on watchlist.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Scout Registration Pool */}
      {activeTab === 'scout' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-900 border-[2px] border-black flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search registered cricketer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white"
              >
                <option value="All">All Roles</option>
                <option value="Batter">Batter</option>
                <option value="Bowler">Bowler</option>
                <option value="All-Rounder">All-Rounder</option>
                <option value="Wicketkeeper">Wicketkeeper</option>
              </select>

              <select
                value={selectedNationality}
                onChange={(e) => setSelectedNationality(e.target.value)}
                className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs font-bold text-white"
              >
                <option value="All">All Nationalities</option>
                <option value="Indian">Indian Only</option>
                <option value="Overseas">Overseas Only</option>
              </select>
            </div>
          </div>

          <div className="neo-box rounded-xl bg-zinc-900 border-[2px] border-black overflow-hidden shadow-[4px_4px_0px_#000]">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-black/90 backdrop-blur border-b border-zinc-800 text-zinc-400 uppercase font-black text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Country / Status</th>
                    <th className="py-3 px-3 text-center">OVR</th>
                    <th className="py-3 px-3 text-right">Base Price</th>
                    <th className="py-3 px-3 text-center">Current Shortlist</th>
                    <th className="py-3 px-4 text-center">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium">
                  {filteredPool.slice(0, 80).map((player) => {
                    const existingEntry = humanList.entries[player.id];
                    return (
                      <tr key={player.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => setScoutingPlayer(player)}
                            className="text-left group"
                          >
                            <div className="font-black text-white text-sm group-hover:text-amber-400 transition-colors">
                              {player.name}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Age {player.age} • Form {player.recentForm}
                            </div>
                          </button>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-zinc-800 border border-zinc-700 text-zinc-300">
                            {player.role}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-bold text-zinc-200">{player.country}</span> •{' '}
                          <span className="text-zinc-400 text-[10px]">{player.status}</span>
                        </td>

                        <td className="py-2.5 px-3 text-center font-black text-amber-400 text-sm">
                          <div>{player.ratings.overall}</div>
                          {player.ratings.ratingConfidence !== undefined && (
                            <div className="text-[9px] text-zinc-500 font-bold" title={`Bayesian Evidence Confidence: ${Math.round(player.ratings.ratingConfidence * 100)}%`}>
                              {Math.round(player.ratings.ratingConfidence * 100)}% conf
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                          {formatPrice(player.basePrice)}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {existingEntry ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                existingEntry.priority === 'PriorityA'
                                  ? 'bg-red-950/60 text-red-400 border-red-500/40'
                                  : existingEntry.priority === 'PriorityB'
                                  ? 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                              }`}
                            >
                              {existingEntry.priority}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => updateHumanShortlist(player.id, 'PriorityA')}
                              title="Add to Priority A"
                              className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                                existingEntry?.priority === 'PriorityA'
                                  ? 'bg-red-500 text-black border-black'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-red-400 border-zinc-700'
                              }`}
                            >
                              A
                            </button>
                            <button
                              onClick={() => updateHumanShortlist(player.id, 'PriorityB')}
                              title="Add to Priority B"
                              className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                                existingEntry?.priority === 'PriorityB'
                                  ? 'bg-amber-400 text-black border-black'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border-zinc-700'
                              }`}
                            >
                              B
                            </button>
                            <button
                              onClick={() => updateHumanShortlist(player.id, 'PriorityC')}
                              title="Add to Priority C"
                              className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                                existingEntry?.priority === 'PriorityC'
                                  ? 'bg-sky-400 text-black border-black'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-sky-400 border-zinc-700'
                              }`}
                            >
                              C
                            </button>
                            {existingEntry && (
                              <button
                                onClick={() => removeHumanShortlist(player.id)}
                                title="Remove from shortlist"
                                className="p-1 rounded bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700"
                              >
                                <Trash2 className="w-3 h-3" />
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
          </div>
        </div>
      )}

      {/* TAB 3: CPU Competitor Intelligence */}
      {activeTab === 'cpu' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-400 font-medium">
            Review the scouting focus and shortlisted targets generated by the other 9 franchise general
            managers based on their squad deficits and GM strategic personalities.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {franchises
              .filter((f) => f.id !== humanFranchiseId)
              .map((cpuFranchise) => {
                const list = franchiseShortlists[cpuFranchise.id];
                const entries = list ? Object.values(list.entries) : [];
                const topPicks = entries.filter((e) => e.priority === 'PriorityA').slice(0, 5);

                return (
                  <div
                    key={cpuFranchise.id}
                    className="p-4 rounded-xl bg-zinc-900 border-[2px] border-black space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000]"
                          style={{
                            backgroundColor: cpuFranchise.colors.primary,
                            color: cpuFranchise.colors.text,
                          }}
                        >
                          {cpuFranchise.abbreviation}
                        </div>
                        <div>
                          <div className="font-black text-white text-xs uppercase">
                            {cpuFranchise.name}
                          </div>
                          <div className="text-[10px] text-amber-400 font-bold">
                            {cpuFranchise.gmPersonality || 'BalancedBuilder'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-black/60 text-zinc-300">
                        {entries.length} targets
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                        Priority A Targets
                      </div>
                      <div className="space-y-1">
                        {topPicks.map((entry) => {
                          const p = getPlayerById(entry.playerId);
                          if (!p) return null;
                          return (
                            <div
                              key={p.id}
                              className="flex items-center justify-between text-xs p-1.5 rounded bg-black/40 border border-zinc-800"
                            >
                              <span className="font-bold text-zinc-200">{p.name}</span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                {p.role} • OVR {p.ratings.overall}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

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

// Subcomponents for cards
function ShortlistCard({
  entry,
  player,
  onInspect,
  onRemove,
  onPriorityChange,
}: {
  entry: any;
  player: Player;
  onInspect: () => void;
  onRemove: () => void;
  onPriorityChange: (p: ShortlistPriority) => void;
}) {
  return (
    <div className="p-3.5 rounded-xl bg-zinc-900 border-[2px] border-black shadow-[3px_3px_0px_#000] space-y-2.5">
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={onInspect}
            className="font-black text-white text-sm hover:text-amber-400 transition-colors text-left"
          >
            {player.name}
          </button>
          <div className="text-[11px] text-zinc-400 font-medium">
            {player.role} • {player.country} ({player.status})
          </div>
        </div>

        <div className="text-right">
          <div className="font-black text-amber-400 text-sm flex items-center justify-end gap-1">
            {player.ratings.overall} OVR
            {player.ratings.ratingConfidence !== undefined && (
              <span className="text-[9px] text-zinc-500 font-bold">({Math.round(player.ratings.ratingConfidence * 100)}%)</span>
            )}
          </div>
          <div className="font-bold text-emerald-400 text-[11px]">{formatPrice(player.basePrice)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold bg-black/50 p-1.5 rounded-lg border border-zinc-800">
        <div>BAT: <span className="text-white">{player.ratings.batting}</span></div>
        <div>BOWL: <span className="text-white">{player.ratings.bowling}</span></div>
        <div>FORM: <span className="text-emerald-400">{player.recentForm}</span></div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-zinc-500 font-bold uppercase">Tier:</span>
          {(['PriorityA', 'PriorityB', 'PriorityC'] as ShortlistPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => onPriorityChange(p)}
              className={`px-1.5 py-0.5 rounded font-black text-[9px] ${
                entry.priority === p ? 'bg-amber-400 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {p.replace('Priority', '')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onInspect}
            className="text-[10px] font-black uppercase text-zinc-300 hover:text-white"
          >
            Inspect
          </button>
          <button
            onClick={onRemove}
            className="text-zinc-500 hover:text-red-400"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortlistCardCompact({
  entry,
  player,
  onInspect,
  onRemove,
}: {
  entry: any;
  player: Player;
  onInspect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-2">
        <button
          onClick={onInspect}
          className="font-bold text-white text-xs hover:text-amber-400 text-left"
        >
          {player.name}
        </button>
        <span className="text-[10px] text-zinc-500">
          {player.role} • OVR {player.ratings.overall}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="font-bold text-emerald-400 text-xs">{formatPrice(player.basePrice)}</span>
        <button
          onClick={onRemove}
          className="text-zinc-500 hover:text-red-400"
          title="Remove"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

