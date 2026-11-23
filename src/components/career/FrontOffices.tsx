'use client';

// Front offices: every CPU franchise's current auction plan and why it was chosen,
// plus the league's development watch (breakouts, domestic breakouts, India
// call-ups and busts from the last off-season).

import React from 'react';
import type { Franchise, Player } from '@/lib/types/game';
import { activeStrategy } from '@/lib/engines/cpu-gm/strategy-planner';
import { Panel, TeamCrest, teamVars } from '@/components/mynba/primitives';

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export function FrontOfficesPanel({ franchises, humanFranchiseId }: { franchises: Franchise[]; humanFranchiseId: string }) {
  const cpu = franchises.filter((f) => f.id !== humanFranchiseId);
  return (
    <Panel title="Front offices" right={<span className="text-xs text-[var(--m-dim)]">Plans are reviewed after every season</span>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cpu.map((f) => {
          const st = activeStrategy(f);
          const focus = Object.entries(st.roleAffinities)
            .filter(([, v]) => v > 1.05)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([r]) => r);
          const last = st.history[st.history.length - 1];
          const changed = !!last && last.archetype !== st.archetype;
          return (
            <div key={f.id} className="border border-[var(--m-line)] rounded-[3px] p-4" style={teamVars(f.id)}>
              <div className="flex items-center gap-3">
                <TeamCrest franchiseId={f.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{f.name}</div>
                  <div className="m-display text-xl leading-tight" style={{ color: 'var(--team-ink)' }}>
                    {st.plan}
                  </div>
                </div>
                {changed && <span className="m-chip" style={{ color: 'var(--m-gold)' }}>New plan</span>}
              </div>
              <p className="text-xs text-[var(--m-dim)] mt-2 leading-relaxed">{st.rationale}</p>
              {focus.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {focus.map((r) => (
                    <span key={r} className="m-chip text-[10px]">{r}</span>
                  ))}
                </div>
              )}
              {st.history.length > 0 && (
                <div className="text-[11px] text-[var(--m-faint)] mt-2">
                  {st.history
                    .slice(-3)
                    .map((h) => `${h.season}: ${h.plan}${h.finish ? ` (${ordinal(h.finish)})` : ''}`)
                    .join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const TREND_TONE: Record<string, string> = {
  Breakout: 'var(--m-green)',
  Resurgence: 'var(--m-green)',
  'Domestic breakout': 'var(--m-purple)',
  Bust: 'var(--m-red)',
  Stalled: 'var(--m-gold)',
};

/** League-wide development watch for the season about to start. */
export function DevelopmentWatch({ players, franchises, season }: { players: Player[]; franchises: Franchise[]; season: number }) {
  const owner = new Map<string, string>();
  for (const f of franchises) for (const p of f.players) owner.set(p.id, f.shortName);
  const fresh = players.filter((p) => p.development && p.development.season === season);
  const groups: { title: string; items: Player[] }[] = [
    { title: 'India call-ups', items: fresh.filter((p) => p.development!.callUp) },
    { title: 'Breakouts', items: fresh.filter((p) => p.development!.trend === 'Breakout').sort((a, b) => b.development!.overallDelta - a.development!.overallDelta) },
    { title: 'Resurgences', items: fresh.filter((p) => p.development!.trend === 'Resurgence').sort((a, b) => b.development!.overallDelta - a.development!.overallDelta) },
    { title: 'Domestic breakouts (auction gems)', items: fresh.filter((p) => p.development!.trend === 'Domestic breakout') },
    { title: 'Busts & stalled prospects', items: fresh.filter((p) => p.development!.trend === 'Bust' || (p.development!.trend === 'Stalled' && p.ratings.potential >= 78)) },
  ];
  if (!fresh.length) {
    return (
      <Panel title="Development watch">
        <p className="text-sm text-[var(--m-dim)]">Breakouts, busts and India call-ups appear here after each season is completed.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Development watch" right={<span className="text-xs text-[var(--m-dim)]">Off-season before {season}</span>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="text-xs uppercase tracking-wide text-[var(--m-dim)] mb-2">{g.title}</div>
            {g.items.length === 0 && <div className="text-xs text-[var(--m-faint)]">None this year.</div>}
            <ul className="space-y-1.5">
              {g.items.slice(0, 8).map((p) => {
                const d = p.development!;
                const c = TREND_TONE[d.trend] ?? 'var(--m-ink)';
                return (
                  <li key={p.id} className="text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-[var(--m-text)]">{p.name}</span>
                      <span className="text-[var(--m-faint)]">{p.age} · {owner.get(p.id) ?? 'Free agent'}</span>
                      <span className="ml-auto tabular-nums" style={{ color: c }}>
                        {p.ratings.overall} OVR ({d.overallDelta >= 0 ? '+' : ''}{d.overallDelta}) · POT {p.ratings.potential} ({d.potentialDelta >= 0 ? '+' : ''}{d.potentialDelta})
                      </span>
                    </div>
                    <div className="text-[var(--m-dim)]">{d.note}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
