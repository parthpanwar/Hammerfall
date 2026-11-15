'use client';

import React from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { Panel, TeamCrest, Empty } from '@/components/mynba/primitives';

export function StandingsTable() {
  const { standings, franchises, humanFranchiseId, currentSeason } = useGameStore();

  return (
    <Panel
      title={`Points table ${currentSeason}`}
      right={<span className="text-xs text-[var(--m-faint)]">Top 4 reach the playoffs</span>}
      bodyClassName="p-0"
    >
      {standings.length === 0 ? (
        <Empty title="No table yet" hint="The table appears once you confirm your XI and the league begins." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left m-label !text-[0.62rem] border-b border-[var(--m-line)]">
              <th className="py-2.5 pl-4 w-10">#</th>
              <th className="py-2.5">Team</th>
              <th className="py-2.5 text-center w-10">P</th>
              <th className="py-2.5 text-center w-10">W</th>
              <th className="py-2.5 text-center w-10">L</th>
              <th className="py-2.5 text-right w-20 hidden sm:table-cell">NRR</th>
              <th className="py-2.5 pr-4 text-right w-14">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry, idx) => {
              const team = franchises.find((f) => f.id === entry.franchiseId);
              const isHuman = entry.franchiseId === humanFranchiseId;
              return (
                <tr
                  key={entry.franchiseId}
                  className={`${isHuman ? 'bg-ink/[0.06]' : ''} ${
                    idx === 3 ? 'border-b border-[var(--m-green)]/50' : 'border-b border-[var(--m-line)]/50'
                  }`}
                >
                  <td className={`py-2.5 pl-4 font-display font-extrabold tabular-nums ${idx < 4 ? 'text-[var(--m-green)]' : 'text-[var(--m-faint)]'}`}>
                    {idx + 1}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TeamCrest franchiseId={entry.franchiseId} size="xs" />
                      <span className={`truncate ${isHuman ? 'font-semibold' : ''}`}>{team?.name}</span>
                      {isHuman && <span className="m-label !text-[0.55rem] !text-[var(--m-text)]">You</span>}
                    </div>
                  </td>
                  <td className="py-2.5 text-center tabular-nums text-[var(--m-dim)]">{entry.played}</td>
                  <td className="py-2.5 text-center tabular-nums">{entry.won}</td>
                  <td className="py-2.5 text-center tabular-nums text-[var(--m-dim)]">{entry.lost}</td>
                  <td className="py-2.5 text-right tabular-nums text-[var(--m-dim)] hidden sm:table-cell">
                    {entry.netRunRate > 0 ? '+' : ''}
                    {entry.netRunRate.toFixed(3)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-display font-extrabold text-base tabular-nums">{entry.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
