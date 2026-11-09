'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { OFFICIAL_AUCTION_SETS } from '@/lib/engines/auction/shortlist-compiler';
import {
  Trophy,
  Sparkles,
  Users,
  Globe,
  Award,
  ChevronRight,
  Flame,
  Star,
  Layers,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import type { RegisteredPlayer } from '@/lib/types/registration';

export function ShortlistRevealModal() {
  const {
    humanFranchiseId,
    franchises,
    finalAuctionPool,
    auctionSets,
    setPhase,
  } = useGameStore();

  const availableSetCodes = Object.keys(auctionSets);
  const [activeSetCode, setActiveSetCode] = useState<string>(
    availableSetCodes[0] || 'M1'
  );

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);

  const indianCount = finalAuctionPool.filter((p) => p.nationality === 'Indian').length;
  const overseasCount = finalAuctionPool.filter((p) => p.nationality === 'Overseas').length;
  const cappedCount = finalAuctionPool.filter((p) => p.status === 'Capped').length;
  const uncappedCount = finalAuctionPool.filter((p) => p.status === 'Uncapped').length;

  const currentSetPlayers = auctionSets[activeSetCode] || auctionSets[availableSetCodes[0]] || [];
  const currentSetDef = OFFICIAL_AUCTION_SETS.find((s) => s.code === activeSetCode);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div
        className="neo-box p-6 rounded-2xl relative overflow-hidden"
        style={{ backgroundColor: theme.cardBg }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-emerald-400 text-black border border-black shadow-[1.5px_1.5px_0px_#000]">
                Pre-Auction Phase 3
              </span>
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                Official BCCI Selection
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Final Auction Pool & Set Reveal
            </h1>
            <p className="text-zinc-300 text-xs sm:text-sm max-w-2xl font-medium">
              Based on the shortlists submitted by all 10 franchises, the BCCI has finalized the official
              auction pool of <span className="text-emerald-400 font-black">{finalAuctionPool.length} cricketers</span> organized
              into 20 sequential auction sets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setPhase('Auction')}
              className="neo-btn flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm uppercase transition-transform shadow-[4px_4px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
            >
              <Flame className="w-5 h-5 stroke-[2.5]" />
              Enter Auction Hall
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase">Shortlisted Pool</div>
          <div className="text-2xl font-black text-white mt-1">{finalAuctionPool.length}</div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">Approved for bidding</div>
        </div>

        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase">Indian Cricketers</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{indianCount}</div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
            {cappedCount} Capped total
          </div>
        </div>

        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase">Overseas Talents</div>
          <div className="text-2xl font-black text-sky-400 mt-1">{overseasCount}</div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
            {uncappedCount} Uncapped total
          </div>
        </div>

        <div className="neo-box p-4 rounded-xl bg-zinc-900 border-[2px] border-black">
          <div className="text-[11px] font-black text-zinc-400 uppercase">Auction Sets</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">20 Sets</div>
          <div className="text-[11px] text-zinc-400 font-medium mt-0.5">M1 through ACCEL</div>
        </div>
      </div>

      {/* Set Selector Tabs */}
      <div className="space-y-3">
        <div className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" /> Select Auction Set to Preview
        </div>

        <div className="flex flex-wrap gap-2">
          {availableSetCodes.map((code) => {
            const count = (auctionSets[code] || []).length;
            const isSelected = activeSetCode === code;

            return (
              <button
                key={code}
                onClick={() => setActiveSetCode(code)}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-amber-400 text-black border-black shadow-[2.5px_2.5px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <span>{code}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    isSelected ? 'bg-black text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Set Header & Table */}
      <div className="neo-box p-5 rounded-2xl bg-zinc-900 border-[2px] border-black shadow-[4px_4px_0px_#000] space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase bg-zinc-800 text-amber-400 border border-zinc-700">
                {currentSetDef?.category}
              </span>
              <h2 className="text-lg font-black text-white uppercase">
                {currentSetDef?.name || activeSetCode}
              </h2>
            </div>
            <div className="text-xs text-zinc-400 font-medium mt-0.5">
              Contains {currentSetPlayers.length} cricketers in order of appearance
            </div>
          </div>

          <button
            onClick={() => setPhase('Auction')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase"
          >
            Start with Set {activeSetCode} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Players List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/60 text-zinc-400 uppercase font-black text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Lot Order</th>
                <th className="py-2.5 px-4">Player</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Country / Status</th>
                <th className="py-2.5 px-3 text-center">OVR</th>
                <th className="py-2.5 px-3 text-right">Base Price</th>
                <th className="py-2.5 px-4 text-center">Franchise Demand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {currentSetPlayers.map((player, idx) => {
                const isShortlistedByHuman = player.shortlistedBy?.includes(humanFranchiseId);

                return (
                  <tr
                    key={player.id}
                    className={`hover:bg-zinc-800/40 transition-colors ${
                      isShortlistedByHuman ? 'bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-zinc-500">
                      #{idx + 1}
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="font-black text-white text-sm">{player.name}</div>
                        {isShortlistedByHuman && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400 text-black border border-black">
                            YOUR TARGET
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        Age {player.age} • Form {player.recentForm}
                      </div>
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
                      {player.ratings.overall}
                    </td>

                    <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                      {formatPrice(player.basePrice)}
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-zinc-800 text-[11px] font-black">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span className="text-white">{player.shortlistCount || 1}</span>
                        <span className="text-zinc-500 font-medium text-[9px]">franchises</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {currentSetPlayers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 font-bold">
                    No players in set {activeSetCode}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

