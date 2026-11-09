'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { FRANCHISES } from '@/lib/data/franchises';
import { GLOBAL_PLAYERS, PLAYERS } from '@/lib/data/players';
import { Trophy, Shield, Zap, Sparkles, ChevronRight, Play, Flame, Layers } from 'lucide-react';
import type { CPUDifficulty, AuctionPace } from '@/lib/types/game';
import { getTeamTheme, TEAM_THEMES } from '@/lib/theme/team-themes';

export function MainMenu() {
  const { id: savedGameId, humanFranchiseId, currentSeason, phase, setPhase, initializeGame } = useGameStore();

  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('mi');
  const [difficulty, setDifficulty] = useState<CPUDifficulty>('Normal');
  const [auctionPace, setAuctionPace] = useState<AuctionPace>('Normal');

  const selectedTeam = FRANCHISES.find((f) => f.id === selectedFranchiseId) || FRANCHISES[0];
  const selectedTheme = getTeamTheme(selectedFranchiseId);
  const teamPlayers = PLAYERS.filter((p) => p.currentFranchiseId === selectedFranchiseId);
  const starPlayers = [...teamPlayers].sort((a, b) => b.ratings.overall - a.ratings.overall).slice(0, 4);

  const handleStartNewGame = () => {
    initializeGame(
      {
        startingSeason: 2026,
        auctionType: 'Mega',
        rulesPreset: 'Official',
        cpuDifficulty: difficulty,
        auctionPace,
        matchSimMode: 'Detailed',
        allowCustomPurse: false,
        enableInjuries: false,
        enablePlayerDevelopment: true,
        seed: Math.floor(Math.random() * 1000000),
      },
      selectedFranchiseId,
      FRANCHISES,
      GLOBAL_PLAYERS
    );
  };

  const handleContinue = () => {
    if (phase && phase !== 'MainMenu') {
      return;
    }
    setPhase('Retention');
  };

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col justify-between p-4 sm:p-8"
      style={{
        backgroundColor: selectedTheme.surface,
      }}
    >
      {/* Top Banner / Ticker */}
      <div className="max-w-6xl mx-auto w-full pt-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-black text-white neo-badge text-xs">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>IPL 2026 OFFICIAL MEGA AUCTION EDITION</span>
          </div>

          {/* Quick Resume Button if save exists */}
          {savedGameId && humanFranchiseId && (
            <button
              onClick={handleContinue}
              className="neo-btn flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-400 text-black text-xs font-black uppercase tracking-wider"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              Resume Saved Dynasty ({FRANCHISES.find((f) => f.id === humanFranchiseId)?.abbreviation} • S{currentSeason})
            </button>
          )}
        </div>

        {/* Hero Neo Title */}
        <div className="p-6 sm:p-8 rounded-2xl neo-box-lg bg-zinc-950 text-left relative overflow-hidden">
          {/* Accent jersey stripe at right */}
          <div
            className="absolute top-0 right-0 w-32 h-full opacity-30 transform skew-x-12 translate-x-8"
            style={{ backgroundColor: selectedTheme.primary }}
          />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="neo-badge px-2.5 py-0.5 rounded bg-amber-400 text-black text-[11px]">
                  SEASON 2026
                </span>
                <span className="neo-badge px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                  10 FRANCHISES • 193 PLAYERS
                </span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter text-white">
                IPL <span style={{ color: selectedTheme.accent }}>DYNASTY</span>
              </h1>
              <p className="mt-2 text-zinc-300 max-w-xl text-xs sm:text-sm font-medium">
                High-stakes auction strategy, Monte Carlo AI bidding models, tactical player optimization, and realistic ball-by-ball IPL match simulation.
              </p>
            </div>

            {/* Selected Franchise Crest */}
            <div
              className="neo-box p-4 rounded-xl flex items-center gap-3.5 self-start sm:self-auto"
              style={{
                backgroundColor: selectedTheme.cardBg,
              }}
            >
              <div
                className="w-14 h-14 rounded-xl border-[2.5px] border-black flex items-center justify-center font-black text-2xl shadow-[3px_3px_0px_#000]"
                style={{
                  backgroundColor: selectedTheme.primary,
                  color: selectedTheme.textLight,
                }}
              >
                {selectedTeam.abbreviation}
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Selected Franchise</div>
                <div className="text-base font-black text-white">{selectedTeam.name}</div>
                <div className="text-xs font-bold" style={{ color: selectedTheme.accent }}>
                  "{selectedTheme.tagline}"
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Franchise Selection Grid (Neo-Brutalist Asset Cards) */}
      <div className="max-w-6xl mx-auto w-full flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-white" />
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              SELECT YOUR FRANCHISE (CLICK TO PREVIEW THEME)
            </h2>
          </div>
          <span className="neo-badge px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[10px]">
            10 OFFICIAL TEAMS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-6">
          {FRANCHISES.map((franchise) => {
            const isSelected = franchise.id === selectedFranchiseId;
            const theme = getTeamTheme(franchise.id);

            return (
              <button
                key={franchise.id}
                onClick={() => setSelectedFranchiseId(franchise.id)}
                className={`neo-btn p-3 rounded-xl text-left flex flex-col justify-between h-30 relative overflow-hidden transition-all ${
                  isSelected
                    ? 'translate-x-[-2px] translate-y-[-2px] ring-2 ring-white'
                    : 'opacity-90 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isSelected ? theme.cardBg : '#12151c',
                  borderColor: '#000000',
                  boxShadow: isSelected ? `5px 5px 0px #000000` : '3px 3px 0px #000000',
                }}
              >
                {/* Jersey top accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-2"
                  style={{ backgroundColor: theme.primary }}
                />

                <div className="flex items-center justify-between mt-1">
                  <span
                    className="w-9 h-9 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_#000]"
                    style={{
                      backgroundColor: theme.primary,
                      color: theme.textLight,
                    }}
                  >
                    {franchise.abbreviation}
                  </span>

                  {isSelected && (
                    <span
                      className="neo-badge text-[9px] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]"
                      style={{
                        backgroundColor: theme.secondary,
                        color: '#000000',
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>

                <div>
                  <div className="font-black text-xs text-white leading-tight line-clamp-1">
                    {franchise.name}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-bold truncate">
                    {franchise.city}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Franchise Spotlight Card */}
        {selectedTeam && (
          <div
            className="neo-box rounded-2xl p-5 sm:p-6 mb-6 relative overflow-hidden"
            style={{
              backgroundColor: selectedTheme.cardBg,
            }}
          >
            {/* Header row with Jersey Theme Info */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between pb-5 border-b-2 border-black">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl border-[3px] border-black flex items-center justify-center font-black text-2xl shadow-[4px_4px_0px_#000]"
                  style={{
                    backgroundColor: selectedTheme.primary,
                    color: selectedTheme.textLight,
                  }}
                >
                  {selectedTeam.abbreviation}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black uppercase text-white tracking-tight">
                      {selectedTeam.name}
                    </h3>
                    <span
                      className="neo-badge text-[10px] px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: selectedTheme.secondary,
                        color: '#000000',
                      }}
                    >
                      {selectedTeam.city}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 font-semibold mt-0.5">
                    🏟️ {selectedTeam.homeStadium}
                  </p>
                </div>
              </div>

              {/* Neo Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="neo-badge px-3 py-1.5 rounded-lg bg-black text-white text-xs">
                  PHILOSOPHY: <span className="text-amber-400">{selectedTeam.gmPersonality}</span>
                </div>
                <div className="neo-badge px-3 py-1.5 rounded-lg bg-emerald-400 text-black text-xs font-black">
                  STARTING PURSE: ₹120.00 CR
                </div>
              </div>
            </div>

            {/* Marquee Players Preview */}
            <div className="pt-4">
              <div className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                KEY ROSTER TALENT & STARTS
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {starPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="neo-box-sm p-2.5 rounded-xl bg-zinc-950 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-black text-xs text-white leading-tight truncate">
                        {player.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-bold">
                        {player.role} • {player.nationality === 'Overseas' ? '✈️ OS' : 'IND'}
                      </div>
                    </div>
                    <div
                      className="neo-badge px-1.5 py-0.5 rounded text-[11px] font-black"
                      style={{
                        backgroundColor: selectedTheme.primary,
                        color: selectedTheme.textLight,
                      }}
                    >
                      {player.ratings.overall}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Campaign Settings & Launch */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Difficulty */}
          <div className="neo-box p-4 rounded-xl bg-zinc-950">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block mb-2.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              AI Bidding Intelligence
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['Easy', 'Normal', 'Hard', 'Expert'] as CPUDifficulty[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`neo-btn py-1.5 text-xs rounded-lg font-black uppercase transition-all ${
                    difficulty === level
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400 mt-2.5 font-medium leading-relaxed">
              {difficulty === 'Easy' && 'Generous budget margins, CPUs bid conservatively.'}
              {difficulty === 'Normal' && 'Authentic franchise strategy with squad role balance.'}
              {difficulty === 'Hard' && 'Ruthless AI bidding wars & Monte Carlo price forecasting.'}
              {difficulty === 'Expert' && 'Multi-agent opponent modeling and dynamic utility bidding.'}
            </p>
          </div>

          {/* Auction Pace */}
          <div className="neo-box p-4 rounded-xl bg-zinc-950">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Auction Room Pace
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Normal', 'Fast', 'Instant'] as AuctionPace[]).map((pace) => (
                <button
                  key={pace}
                  onClick={() => setAuctionPace(pace)}
                  className={`neo-btn py-1.5 text-xs rounded-lg font-black uppercase transition-all ${
                    auctionPace === pace
                      ? 'bg-sky-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {pace}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400 mt-2.5 font-medium leading-relaxed">
              Adjustable anytime during live gavel bidding in the Auction Hall.
            </p>
          </div>

          {/* Launch Button */}
          <div className="neo-box p-4 rounded-xl bg-zinc-950 flex flex-col justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-white mb-1">
                IPL 2026 OFFICIAL RULES
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                Max 6 Retentions • ₹120.00 Cr Purse • RTM System
              </div>
            </div>

            <button
              onClick={handleStartNewGame}
              className="neo-btn w-full mt-3 py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-transform"
              style={{
                backgroundColor: selectedTheme.primary,
                color: selectedTheme.textLight,
                borderColor: '#000000',
              }}
            >
              <span>ENTER {selectedTeam.abbreviation} DYNASTY</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-zinc-500 py-3 border-t-2 border-black font-bold">
        IPL DYNASTY — NEO-BRUTALIST CRICKET MANAGEMENT PLATFORM
      </footer>
    </div>
  );
}
