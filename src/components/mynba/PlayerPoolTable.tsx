'use client';

// ============================================================
// IPL DYNASTY — Filterable player pool table with shortlist controls
// ============================================================

import React, { useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import type { Player } from '@/lib/types/game';
import type { ShortlistEntry, ShortlistPriority } from '@/lib/types/scouting';
import { formatPrice } from '@/lib/utils';
import { OvrBadge, OverseasTag, RoleTag, MButton } from './primitives';

export const PRIORITY_META: Record<ShortlistPriority, { label: string; short: string; color: string }> = {
  PriorityA: { label: 'Must sign', short: 'A', color: 'var(--m-red)' },
  PriorityB: { label: 'Strong target', short: 'B', color: 'var(--m-gold)' },
  PriorityC: { label: 'Depth option', short: 'C', color: 'var(--m-cyan)' },
  Watchlist: { label: 'Watchlist', short: 'W', color: 'var(--m-dim)' },
};

type SortKey = 'ovr' | 'pot' | 'price' | 'age' | 'name' | 'interest';

export function PlayerPoolTable<T extends Player>({
  players,
  shortlist,
  rivalInterest,
  onPriority,
  onRemove,
  onScout,
  pageSize = 60,
}: {
  players: T[];
  shortlist: Record<string, ShortlistEntry>;
  rivalInterest?: Record<string, number>;
  onPriority: (id: string, p: ShortlistPriority) => void;
  onRemove: (id: string) => void;
  onScout: (p: T) => void;
  pageSize?: number;
}) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'All' | Player['role']>('All');
  const [nat, setNat] = useState<'All' | 'Indian' | 'Overseas'>('All');
  const [status, setStatus] = useState<'All' | 'Capped' | 'Uncapped'>('All');
  const [price, setPrice] = useState<'All' | number>('All');
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState<SortKey>('ovr');
  const [limit, setLimit] = useState(pageSize);

  const prices = useMemo(() => Array.from(new Set(players.map((p) => p.basePrice))).sort((a, b) => b - a), [players]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = players.filter(
      (p) =>
        (!needle || p.name.toLowerCase().includes(needle) || p.country.toLowerCase().includes(needle) || p.alternateNames?.some((a) => a.toLowerCase().includes(needle))) &&
        (role === 'All' || p.role === role) &&
        (nat === 'All' || p.nationality === nat) &&
        (status === 'All' || p.status === status) &&
        (price === 'All' || p.basePrice === price) &&
        (!onlyMine || shortlist[p.id])
    );
    const cmp: Record<SortKey, (a: T, b: T) => number> = {
      ovr: (a, b) => b.ratings.overall - a.ratings.overall,
      pot: (a, b) => b.ratings.potential - a.ratings.potential,
      price: (a, b) => b.basePrice - a.basePrice || b.ratings.overall - a.ratings.overall,
      age: (a, b) => a.age - b.age,
      name: (a, b) => a.name.localeCompare(b.name),
      interest: (a, b) => (rivalInterest?.[b.id] || 0) - (rivalInterest?.[a.id] || 0),
    };
    return filtered.sort(cmp[sort]);
  }, [players, q, role, nat, status, price, onlyMine, shortlist, sort, rivalInterest]);

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={`${cls} cursor-pointer select-none ${sort === key ? '!text-ink' : ''}`} onClick={() => setSort(key)} aria-sort={sort === key ? 'descending' : undefined}>
      {label}
      {sort === key && ' ▾'}
    </th>
  );

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-[var(--m-line)]">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--m-faint)]" />
          <input className="m-input !pl-8" placeholder="Search name or country" value={q} onChange={(e) => { setQ(e.target.value); setLimit(pageSize); }} aria-label="Search players" />
        </div>
        <select className="m-input !w-auto" value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Role">
          <option value="All">All roles</option>
          <option value="Batter">Batters</option>
          <option value="Wicketkeeper">Wicketkeepers</option>
          <option value="All-Rounder">All-rounders</option>
          <option value="Bowler">Bowlers</option>
        </select>
        <select className="m-input !w-auto" value={nat} onChange={(e) => setNat(e.target.value as typeof nat)} aria-label="Nationality">
          <option value="All">Indian + overseas</option>
          <option value="Indian">Indian</option>
          <option value="Overseas">Overseas</option>
        </select>
        <select className="m-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Capped status">
          <option value="All">Capped + uncapped</option>
          <option value="Capped">Capped</option>
          <option value="Uncapped">Uncapped</option>
        </select>
        <select className="m-input !w-auto" value={String(price)} onChange={(e) => setPrice(e.target.value === 'All' ? 'All' : Number(e.target.value))} aria-label="Base price">
          <option value="All">Any base price</option>
          {prices.map((p) => (
            <option key={p} value={p}>{formatPrice(p)}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[var(--m-dim)] cursor-pointer px-1">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-white" /> My shortlist
        </label>
        <span className="m-chip ml-auto">{rows.length} players</span>
      </div>

      <div className="overflow-x-auto m-scroll">
        <table className="m-table">
          <thead>
            <tr>
              {th('ovr', 'OVR', 'w-12')}
              {th('name', 'Player')}
              <th>Role</th>
              {th('age', 'Age', 'text-right')}
              <th className="text-right">BAT</th>
              <th className="text-right">BWL</th>
              {th('pot', 'POT', 'text-right')}
              {th('price', 'Base', 'text-right')}
              {rivalInterest && th('interest', 'Rivals', 'text-right')}
              <th className="text-right">Shortlist</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((p) => {
              const entry = shortlist[p.id];
              return (
                <tr key={p.id} data-selected={!!entry}>
                  <td><OvrBadge ovr={p.ratings.overall} size="sm" /></td>
                  <td>
                    <button className="text-left" onClick={() => onScout(p)}>
                      <div className="font-display font-bold uppercase text-[15px] leading-tight hover:underline">{p.name}</div>
                      <div className="text-[11px] text-[var(--m-faint)]">{p.country} · {p.status}</div>
                    </button>
                  </td>
                  <td><div className="flex gap-1"><RoleTag role={p.role} />{p.nationality === 'Overseas' && <OverseasTag />}</div></td>
                  <td className="text-right tabular-nums">{p.age}</td>
                  <td className="text-right tabular-nums">{p.ratings.batting}</td>
                  <td className="text-right tabular-nums">{p.ratings.bowling}</td>
                  <td className="text-right tabular-nums text-[var(--m-green)]">{p.ratings.potential}</td>
                  <td className="text-right tabular-nums font-display font-bold">{formatPrice(p.basePrice)}</td>
                  {rivalInterest && (
                    <td className="text-right tabular-nums">
                      {rivalInterest[p.id] ? <span className={rivalInterest[p.id] >= 5 ? 'text-[var(--m-red)] font-bold' : 'text-[var(--m-dim)]'}>{rivalInterest[p.id]}</span> : <span className="text-[var(--m-faint)]">–</span>}
                    </td>
                  )}
                  <td className="text-right">
                    <div className="inline-flex items-center gap-0.5">
                      {(['PriorityA', 'PriorityB', 'PriorityC'] as ShortlistPriority[]).map((pr) => {
                        const meta = PRIORITY_META[pr];
                        const active = entry?.priority === pr;
                        return (
                          <button
                            key={pr}
                            title={meta.label}
                            aria-pressed={active}
                            onClick={() => (active ? onRemove(p.id) : onPriority(p.id, pr))}
                            className="w-7 h-7 rounded-[2px] font-display font-extrabold text-xs border transition-colors"
                            style={
                              active
                                ? { background: meta.color, borderColor: meta.color, color: 'var(--m-bg)' }
                                : { borderColor: 'var(--m-line-strong)', color: 'var(--m-faint)' }
                            }
                          >
                            {meta.short}
                          </button>
                        );
                      })}
                      <button
                        title="Watchlist"
                        aria-pressed={entry?.priority === 'Watchlist'}
                        onClick={() => (entry?.priority === 'Watchlist' ? onRemove(p.id) : onPriority(p.id, 'Watchlist'))}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-[2px] border border-[var(--m-line-strong)]"
                      >
                        <Star className="w-3.5 h-3.5" fill={entry?.priority === 'Watchlist' ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="p-3 text-center border-t border-[var(--m-line)]">
          <MButton size="sm" onClick={() => setLimit(limit + pageSize)}>Show {Math.min(pageSize, rows.length - limit)} more</MButton>
        </div>
      )}
    </div>
  );
}
