'use client';

// ============================================================
// IPL DYNASTY — League Squads viewer
// Browse every franchise's squad (yours and the 9 CPU teams) with
// purse, slots, overseas count, role balance and how each player
// was acquired. Reads live franchise data, so it updates after
// every hammer during the auction.
// ============================================================

import React, { useMemo, useState } from 'react';
import type { Franchise, Player, RetentionDecision } from '@/lib/types/game';
import { formatPrice } from '@/lib/utils';
import { OvrBadge, OverseasTag, RoleTag, TeamCrest, teamVars, Empty } from './primitives';

const ROLE_ORDER: Player['role'][] = ['Batter', 'Wicketkeeper', 'All-Rounder', 'Bowler'];
const ROLE_LABEL: Record<Player['role'], string> = {
  Batter: 'Batters',
  Wicketkeeper: 'Wicketkeepers',
  'All-Rounder': 'All-rounders',
  Bowler: 'Bowlers',
};
/** Rough balanced-squad targets used for the "needs" read-out. */
const ROLE_TARGET: Record<Player['role'], number> = { Batter: 6, Wicketkeeper: 2, 'All-Rounder': 5, Bowler: 7 };

export function bestXiOvr(players: Player[]): number {
  const top = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall).slice(0, 11);
  return top.length ? Math.round(top.reduce((s, p) => s + p.ratings.overall, 0) / top.length) : 0;
}

export function SquadsViewer({
  franchises,
  humanFranchiseId,
  retentionDecisions,
  selectedId,
  onSelect,
  highlightPlayerId,
  compact = false,
}: {
  franchises: Franchise[];
  humanFranchiseId: string;
  retentionDecisions: RetentionDecision[];
  selectedId: string;
  onSelect: (id: string) => void;
  highlightPlayerId?: string | null;
  compact?: boolean;
}) {
  const [sortBy, setSortBy] = useState<'role' | 'ovr' | 'price'>('role');
  const team = franchises.find((f) => f.id === selectedId) || franchises[0];
  const retainedCost = useMemo(
    () => new Map(retentionDecisions.map((d) => [d.playerId, d.cost])),
    [retentionDecisions]
  );

  if (!team) return <Empty title="No franchises" />;

  const players = team.players;
  const overseas = players.filter((p) => p.nationality === 'Overseas').length;
  const spent = team.totalPurse - team.remainingPurse;
  const slotsLeft = team.maxSquadSize - players.length;
  const toMinimum = Math.max(0, team.minSquadSize - players.length);
  const priceOf = (p: Player) => retainedCost.get(p.id) ?? (p.soldPrice || p.currentContractValue || 0);
  const howAcquired = (p: Player) => (retainedCost.has(p.id) ? 'Retained' : 'Auction');

  const sorted =
    sortBy === 'ovr'
      ? [...players].sort((a, b) => b.ratings.overall - a.ratings.overall)
      : sortBy === 'price'
      ? [...players].sort((a, b) => priceOf(b) - priceOf(a))
      : null;

  return (
    <div className="flex flex-col gap-3" style={teamVars(team.id)}>
      {/* Team switcher */}
      <div className={`grid ${compact ? 'grid-cols-5' : 'grid-cols-5 lg:grid-cols-10'} gap-1.5`} role="tablist" aria-label="Franchises">
        {franchises.map((f) => {
          const active = f.id === team.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(f.id)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-[2px] border transition-colors ${
                active ? 'border-ink bg-ink/[0.07]' : 'border-[var(--m-line)] hover:border-[var(--m-line-strong)] bg-ink/[0.015]'
              }`}
              title={f.name}
            >
              <TeamCrest franchiseId={f.id} size="xs" />
              <span className="font-display font-extrabold text-[11px] leading-none">
                {f.abbreviation}
                {f.id === humanFranchiseId && <span className="text-[var(--m-cyan)]">•</span>}
              </span>
              <span className="text-[10px] tabular-nums text-[var(--m-faint)] leading-none">{f.players.length}/{f.maxSquadSize}</span>
            </button>
          );
        })}
      </div>

      {/* Team summary */}
      <div
        className="relative overflow-hidden border border-[var(--m-ink)] p-3 bg-[var(--m-panel)]"
        style={{ boxShadow: 'inset 4px 0 0 var(--team-primary)' }}
      >
        <div className="relative flex items-center gap-3">
          <TeamCrest franchiseId={team.id} size="md" />
          <div className="min-w-0 flex-1">
            <div className="m-display text-[1.45rem] leading-tight truncate">
              {team.name}
              {team.id === humanFranchiseId && <span className="m-chip ml-2 !text-ink !border-ink/40">You</span>}
            </div>
            <div className="text-[11px] text-ink/60">Best XI OVR {bestXiOvr(players) || '—'}</div>
          </div>
        </div>
        <div className={`relative grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-2 mt-3`}>
          {[
            ['Purse left', formatPrice(team.remainingPurse), 'var(--m-green)'],
            ['Spent', formatPrice(spent), 'var(--m-gold)'],
            ['Squad', `${players.length}/${team.maxSquadSize}`, undefined],
            ['Overseas', `${overseas}/${team.maxOverseas}`, overseas >= team.maxOverseas ? 'var(--m-red)' : 'var(--m-gold)'],
          ].map(([k, v, c]) => (
            <div key={k} className="border-t border-[var(--m-line-strong)] pt-1.5">
              <div className="m-label !text-[0.55rem]">{k}</div>
              <div className="font-display text-lg leading-tight tabular-nums" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="relative text-[11px] text-ink/60 mt-2">
          {slotsLeft} slot{slotsLeft === 1 ? '' : 's'} open
          {toMinimum > 0 && <> · <span className="text-[var(--m-gold)]">needs {toMinimum} more to reach {team.minSquadSize}</span></>}
          {' '}· max bid now {formatPrice(Math.max(0, team.remainingPurse - Math.max(0, toMinimum - 1) * 20))}
        </div>
      </div>

      {/* Role balance */}
      <div className="grid grid-cols-4 gap-1.5">
        {ROLE_ORDER.map((r) => {
          const n = players.filter((p) => p.role === r).length;
          const pct = Math.min(100, (n / ROLE_TARGET[r]) * 100);
          return (
            <div key={r} className="bg-ink/[0.02] border border-[var(--m-line)] rounded-[2px] px-2 py-1.5">
              <div className="flex items-center justify-between">
                <RoleTag role={r} />
                <span className="font-display font-extrabold tabular-nums">{n}</span>
              </div>
              <div className="m-meter mt-1.5"><span style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>

      {/* Roster */}
      <div className="flex items-center justify-between">
        <span className="m-label">Roster</span>
        <div className="flex gap-1">
          {(['role', 'ovr', 'price'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`m-chip !cursor-pointer ${sortBy === s ? '!text-[var(--m-bg)] !bg-ink !border-ink' : ''}`}
            >
              {s === 'role' ? 'By role' : s === 'ovr' ? 'OVR' : 'Price'}
            </button>
          ))}
        </div>
      </div>

      {players.length === 0 ? (
        <Empty title="Empty roster" hint="This franchise hasn't signed anyone yet." />
      ) : sorted ? (
        <RosterList players={sorted} priceOf={priceOf} howAcquired={howAcquired} highlight={highlightPlayerId} />
      ) : (
        <div className="space-y-3">
          {ROLE_ORDER.map((r) => {
            const group = players.filter((p) => p.role === r).sort((a, b) => b.ratings.overall - a.ratings.overall);
            if (!group.length) return null;
            return (
              <div key={r}>
                <div className="m-label !text-[0.6rem] mb-1">{ROLE_LABEL[r]} · {group.length}</div>
                <RosterList players={group} priceOf={priceOf} howAcquired={howAcquired} highlight={highlightPlayerId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RosterList({
  players,
  priceOf,
  howAcquired,
  highlight,
}: {
  players: Player[];
  priceOf: (p: Player) => number;
  howAcquired: (p: Player) => string;
  highlight?: string | null;
}) {
  return (
    <ul className="divide-y divide-[var(--m-line)] border border-[var(--m-line)] rounded-[2px]">
      {players.map((p) => (
        <li
          key={p.id}
          className={`flex items-center gap-2.5 px-2 py-1.5 ${highlight === p.id ? 'bg-[var(--m-green)]/12 m-rise' : ''}`}
        >
          <OvrBadge ovr={p.ratings.overall} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold uppercase text-[14px] leading-tight truncate">{p.name}</div>
            <div className="text-[10px] text-[var(--m-faint)] truncate">{p.country} · {p.age}y · {howAcquired(p)}</div>
          </div>
          {p.nationality === 'Overseas' && <OverseasTag />}
          <span className="font-display font-extrabold text-sm tabular-nums w-[68px] text-right">{formatPrice(priceOf(p))}</span>
        </li>
      ))}
    </ul>
  );
}
