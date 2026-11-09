'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { Trophy, Award, Flame, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { SeasonTransitionModal } from '@/components/career/SeasonTransitionModal';

export function SeasonReview() {
  const {
    currentSeason,
    seasonAwards,
    seasonHistory,
    advanceSeason,
    setPhase,
    humanFranchiseId,
  } = useGameStore();

  const [isTransitionOpen, setIsTransitionOpen] = useState(false);

  const orangeCap = seasonAwards.find((a) => a.type === 'OrangeCap');
  const purpleCap = seasonAwards.find((a) => a.type === 'PurpleCap');
  const mvp = seasonAwards.find((a) => a.type === 'MVP');
  const emerging = seasonAwards.find((a) => a.type === 'EmergingPlayer');

  const humanTheme = getTeamTheme(humanFranchiseId);

  const handleNextSeason = () => {
    setIsTransitionOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <span className="neo-badge px-3 py-1 rounded bg-amber-400 text-black text-xs font-black inline-block">
          SEASON {currentSeason} WRAP-UP
        </span>
        <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          IPL DYNASTY HONORS & AWARDS
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 font-medium max-w-lg mx-auto">
          Celebrating individual brilliance and collective milestones from this unforgettable season of cricket.
        </p>
      </div>

      {/* Awards Showcase Grid (Neo-Brutalist Trophy Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Orange Cap */}
        <div className="neo-box p-5 rounded-2xl bg-zinc-950 text-center">
          <div className="w-12 h-12 rounded-xl border-2 border-black bg-orange-500 text-black flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_#000]">
            <Flame className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="neo-badge px-2 py-0.5 rounded bg-orange-500 text-black text-[10px] inline-block">
            ORANGE CAP
          </div>
          <div className="text-lg font-black text-white mt-2 truncate">
            {orangeCap?.playerName || 'Virat Kohli'}
          </div>
          <div className="text-3xl font-black text-orange-400 my-1">
            {orangeCap?.value || 684} <span className="text-xs font-bold text-zinc-400">runs</span>
          </div>
          <p className="text-[11px] text-zinc-400 font-bold mt-1">Leading tournament run-scorer</p>
        </div>

        {/* Purple Cap */}
        <div className="neo-box p-5 rounded-2xl bg-zinc-950 text-center">
          <div className="w-12 h-12 rounded-xl border-2 border-black bg-purple-500 text-white flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_#000]">
            <Zap className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="neo-badge px-2 py-0.5 rounded bg-purple-500 text-white text-[10px] inline-block">
            PURPLE CAP
          </div>
          <div className="text-lg font-black text-white mt-2 truncate">
            {purpleCap?.playerName || 'Jasprit Bumrah'}
          </div>
          <div className="text-3xl font-black text-purple-400 my-1">
            {purpleCap?.value || 24} <span className="text-xs font-bold text-zinc-400">wickets</span>
          </div>
          <p className="text-[11px] text-zinc-400 font-bold mt-1">Most prolific wicket-taker</p>
        </div>

        {/* Tournament MVP */}
        <div className="neo-box p-5 rounded-2xl bg-zinc-950 text-center">
          <div className="w-12 h-12 rounded-xl border-2 border-black bg-amber-400 text-black flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_#000]">
            <Award className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="neo-badge px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] inline-block">
            MOST VALUABLE PLAYER
          </div>
          <div className="text-lg font-black text-white mt-2 truncate">
            {mvp?.playerName || 'Sunil Narine'}
          </div>
          <div className="text-3xl font-black text-amber-400 my-1">
            {mvp?.value || 840} <span className="text-xs font-bold text-zinc-400">pts</span>
          </div>
          <p className="text-[11px] text-zinc-400 font-bold mt-1">Highest all-round impact rating</p>
        </div>

        {/* Emerging Player */}
        <div className="neo-box p-5 rounded-2xl bg-zinc-950 text-center">
          <div className="w-12 h-12 rounded-xl border-2 border-black bg-emerald-400 text-black flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_#000]">
            <Trophy className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="neo-badge px-2 py-0.5 rounded bg-emerald-400 text-black text-[10px] inline-block">
            EMERGING SENSATION
          </div>
          <div className="text-lg font-black text-white mt-2 truncate">
            {emerging?.playerName || 'Nitish Kumar Reddy'}
          </div>
          <div className="text-2xl font-black text-emerald-400 my-2">
            BREAKTHROUGH
          </div>
          <p className="text-[11px] text-zinc-400 font-bold mt-1">Outstanding young talent</p>
        </div>
      </div>

      {/* Dynasty Multi-Season History */}
      {seasonHistory.length > 0 && (
        <div className="neo-box p-5 rounded-2xl bg-zinc-950">
          <h3 className="font-black text-sm uppercase text-white mb-3 flex items-center gap-2 pb-2 border-b-2 border-black">
            <Trophy className="w-4 h-4 text-amber-400 stroke-[2.5]" /> DYNASTY HALL OF CHAMPIONS
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b-2 border-black text-zinc-400 font-black uppercase text-[11px]">
                  <th className="py-2.5 px-3">YEAR</th>
                  <th className="py-2.5 px-3">CHAMPIONS</th>
                  <th className="py-2.5 px-3">RUNNERS-UP</th>
                  <th className="py-2.5 px-3">ORANGE CAP</th>
                  <th className="py-2.5 px-3">PURPLE CAP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 font-bold">
                {seasonHistory.map((s) => (
                  <tr key={s.year} className="hover:bg-zinc-900">
                    <td className="py-2.5 px-3 font-black text-amber-400">{s.year}</td>
                    <td className="py-2.5 px-3 font-black text-white">{s.championId}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{s.runnerUpId}</td>
                    <td className="py-2.5 px-3 text-orange-400 font-black">{s.orangeCapPlayer}</td>
                    <td className="py-2.5 px-3 text-purple-400 font-black">{s.purpleCapPlayer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advance to Next Season Button */}
      <div className="text-center pt-4">
        <button
          onClick={handleNextSeason}
          className="neo-btn px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center gap-2 mx-auto"
          style={{
            backgroundColor: humanTheme.primary,
            color: humanTheme.textLight,
          }}
        >
          <span>ADVANCE TO SEASON {currentSeason + 1}</span>
          <ArrowRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>

      {/* Season Transition Wizard Modal */}
      <SeasonTransitionModal
        isOpen={isTransitionOpen}
        onClose={() => setIsTransitionOpen(false)}
      />
    </div>
  );
}
