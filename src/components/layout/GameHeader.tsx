'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { Trophy, Users, Calendar, Award, Save, Home, Sparkles, Shield, Database, Search } from 'lucide-react';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { GlobalPlayerDatabase } from '@/components/scouting/GlobalPlayerDatabase';

export function GameHeader() {
  const {
    phase,
    setPhase,
    humanFranchiseId,
    franchises,
    currentSeason,
    saveGame,
  } = useGameStore();

  const [showGlobalDb, setShowGlobalDb] = useState(false);

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);

  const phaseNames: Record<string, string> = {
    MainMenu: 'Main Menu',
    Retention: 'Pre-Auction Retentions',
    RetentionResults: 'Retention Reveals',
    Registration: 'Player Registration',
    Scouting: 'Scouting Room',
    ShortlistReveal: 'Final Auction Sets',
    Auction: 'IPL Mega Auction',
    AuctionResults: 'Auction Recap',
    SquadManagement: 'Playing XI & Squad',
    Tournament: 'IPL Tournament',
    Match: 'Live Match',
    Standings: 'Points Table',
    Playoffs: 'IPL Playoffs',
    SeasonReview: 'Season Awards',
    CareerDashboard: 'Dynasty Career',
    CareerHistory: 'Dynasty Career',
  };

  const navItems = [
    { phase: 'SquadManagement', label: 'Squad & XI', icon: Users },
    { phase: 'Tournament', label: 'Fixtures & Hub', icon: Calendar },
    { phase: 'Standings', label: 'Points Table', icon: Trophy },
    { phase: 'CareerDashboard', label: 'Dynasty Hub', icon: Shield },
    { phase: 'SeasonReview', label: 'Awards', icon: Award },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b-[2.5px] border-black bg-zinc-950/95 backdrop-blur-md shadow-[0_4px_0px_#000000]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Left: Brand & Team Identity */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl font-black text-xl border-[2.5px] border-black shadow-[3px_3px_0px_#000] tracking-tighter transition-transform active:translate-x-[1px] active:translate-y-[1px]"
            style={{
              backgroundColor: theme.primary,
              color: theme.textLight,
            }}
          >
            {humanFranchise?.abbreviation || 'IPL'}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base tracking-wide uppercase">
                {humanFranchise?.name || 'IPL DYNASTY'}
              </span>
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase border-[1.5px] border-black shadow-[1.5px_1.5px_0px_#000]"
                style={{
                  backgroundColor: theme.secondary,
                  color: '#000000',
                }}
              >
                S{currentSeason}
              </span>
            </div>
            
            <div className="text-xs text-zinc-300 flex items-center gap-2 mt-0.5 font-medium">
              <span className="text-zinc-400 font-bold">{phaseNames[phase] || phase}</span>
              {humanFranchise && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/30">
                    Purse: {formatPrice(humanFranchise.remainingPurse)}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-300 font-bold">
                    Squad: <span className="text-white font-black">{humanFranchise.players.length}</span>/25
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Neo-Brutalist In-Game Nav (if game is active) */}
        {phase !== 'MainMenu' && phase !== 'Retention' && phase !== 'Auction' && (
          <nav className="hidden md:flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border-[2px] border-black shadow-[3px_3px_0px_#000]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = phase === item.phase;
              return (
                <button
                  key={item.phase}
                  onClick={() => setPhase(item.phase as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border-[1.5px] ${
                    isActive
                      ? 'border-black text-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                  }`}
                  style={{
                    backgroundColor: isActive ? theme.primary : 'transparent',
                    color: isActive ? theme.textLight : undefined,
                  }}
                >
                  <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          {phase !== 'MainMenu' && (
            <button
              onClick={() => setShowGlobalDb(true)}
              className="neo-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase border-[1.5px] border-black shadow-[2px_2px_0px_#000]"
              title="Search all 1,250 registered cricketers"
            >
              <Database className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Registry</span> (1,250)
            </button>
          )}

          {phase !== 'MainMenu' && (
            <button
              onClick={() => {
                saveGame();
                alert('Dynasty saved successfully!');
              }}
              className="neo-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black uppercase"
            >
              <Save className="w-3.5 h-3.5 text-zinc-300 stroke-[2.5]" />
              Save
            </button>
          )}

          <button
            onClick={() => {
              if (phase === 'MainMenu' || confirm('Return to Main Menu? Unsaved progress will be lost.')) {
                setPhase('MainMenu');
              }
            }}
            className="neo-btn flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase"
          >
            <Home className="w-3.5 h-3.5 stroke-[2.5]" />
            Menu
          </button>
        </div>
      </div>

      {/* Global Registry Modal */}
      {showGlobalDb && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6">
            <GlobalPlayerDatabase onClose={() => setShowGlobalDb(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
