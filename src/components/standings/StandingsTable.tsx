'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { Trophy } from 'lucide-react';
import { getTeamTheme } from '@/lib/theme/team-themes';

export function StandingsTable() {
  const { standings, franchises, humanFranchiseId } = useGameStore();
  const humanTheme = getTeamTheme(humanFranchiseId);

  return (
    <div className="neo-box p-5 rounded-2xl bg-zinc-950">
      <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-black">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]"
            style={{
              backgroundColor: humanTheme.primary,
              color: humanTheme.textLight,
            }}
          >
            <Trophy className="w-4 h-4 stroke-[2.5]" />
          </div>
          <h3 className="font-black text-base uppercase text-white tracking-tight">
            IPL 2026 POINTS TABLE
          </h3>
        </div>
        <div className="neo-badge px-2.5 py-1 rounded bg-black text-emerald-400 text-xs">
          TOP 4 QUALIFY FOR PLAYOFFS
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b-2 border-black text-zinc-400 font-black uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3">POS</th>
              <th className="py-2.5 px-3">TEAM</th>
              <th className="py-2.5 px-3 text-center">P</th>
              <th className="py-2.5 px-3 text-center">W</th>
              <th className="py-2.5 px-3 text-center">L</th>
              <th className="py-2.5 px-3 text-center">NRR</th>
              <th className="py-2.5 px-3 text-right">PTS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 font-bold">
            {standings.map((entry, idx) => {
              const team = franchises.find((f) => f.id === entry.franchiseId);
              const fTheme = getTeamTheme(entry.franchiseId);
              const isHuman = entry.franchiseId === humanFranchiseId;
              const isTop4 = idx < 4;

              return (
                <tr
                  key={entry.franchiseId}
                  className={`transition-all ${
                    isHuman
                      ? 'bg-zinc-900 text-white font-black'
                      : 'hover:bg-zinc-900/60 text-zinc-300'
                  } ${idx === 3 ? 'border-b-2 border-emerald-500' : ''}`}
                >
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-black border-2 border-black ${
                        isTop4
                          ? 'bg-emerald-400 text-black shadow-[1.5px_1.5px_0px_#000]'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 rounded-lg border-2 border-black flex items-center justify-center font-black text-[10px] shadow-[1.5px_1.5px_0px_#000]"
                        style={{
                          backgroundColor: fTheme.primary,
                          color: fTheme.textLight,
                        }}
                      >
                        {team?.abbreviation}
                      </span>
                      <span className="font-black text-xs text-white truncate max-w-[150px]">
                        {team?.name}
                      </span>
                      {isHuman && (
                        <span className="neo-badge text-[9px] px-1.5 py-0.2 rounded bg-amber-400 text-black font-black">
                          YOU
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-center text-zinc-400 font-black">{entry.played}</td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-black">{entry.won}</td>
                  <td className="py-3 px-3 text-center text-red-400 font-black">{entry.lost}</td>
                  <td
                    className={`py-3 px-3 text-center font-mono font-black ${
                      entry.netRunRate > 0
                        ? 'text-emerald-400'
                        : entry.netRunRate < 0
                        ? 'text-red-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {entry.netRunRate > 0 ? `+${entry.netRunRate.toFixed(3)}` : entry.netRunRate.toFixed(3)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="neo-badge px-2.5 py-0.5 rounded bg-black text-amber-400 text-xs font-black">
                      {entry.points}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
