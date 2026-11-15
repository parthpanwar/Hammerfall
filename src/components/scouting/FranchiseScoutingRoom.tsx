'use client';

// ============================================================
// IPL DYNASTY — Scouting Room: big board, rival intel, squad needs
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { Sparkles, X } from 'lucide-react';
import type { Player } from '@/lib/types/game';
import type { ShortlistPriority } from '@/lib/types/scouting';
import { MButton, OvrBadge, PageHero, Panel, RoleTag, Tabs, TeamCrest, Empty } from '@/components/mynba/primitives';
import { PlayerPoolTable, PRIORITY_META } from '@/components/mynba/PlayerPoolTable';
import { bestXiOvr } from '@/components/mynba/SquadsViewer';

const ROLE_TARGET: Record<Player['role'], number> = { Batter: 6, Wicketkeeper: 2, 'All-Rounder': 5, Bowler: 7 };

export function FranchiseScoutingRoom() {
  const {
    humanFranchiseId,
    franchises,
    registrationPool,
    franchiseShortlists,
    updateHumanShortlist,
    removeHumanShortlist,
    compileAuctionPool,
  } = useGameStore();

  const [tab, setTab] = useState<'board' | 'pool' | 'rivals'>('board');
  const [scouting, setScouting] = useState<Player | null>(null);
  const [compiling, setCompiling] = useState(false);

  const human = franchises.find((f) => f.id === humanFranchiseId);
  const entries = franchiseShortlists[humanFranchiseId]?.entries || {};
  const byId = useMemo(() => new Map(registrationPool.map((p) => [p.id, p])), [registrationPool]);

  const rivalInterest = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [fid, list] of Object.entries(franchiseShortlists)) {
      if (fid === humanFranchiseId) continue;
      for (const id of Object.keys(list.entries)) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [franchiseShortlists, humanFranchiseId]);

  const board = (Object.keys(PRIORITY_META) as ShortlistPriority[]).map((pr) => ({
    pr,
    items: Object.values(entries)
      .filter((e) => e.priority === pr)
      .map((e) => ({ e, p: byId.get(e.playerId) }))
      .filter((x): x is { e: typeof x.e; p: NonNullable<typeof x.p> } => !!x.p)
      .sort((a, b) => b.p.ratings.overall - a.p.ratings.overall),
  }));

  const plannedSpend = Object.values(entries).reduce((s, e) => s + (e.targetMaxBidLakhs || 0), 0);

  const compile = () => {
    setCompiling(true);
    // Let the button state paint before the synchronous compile runs.
    setTimeout(() => compileAuctionPool(), 30);
  };

  if (!human) return null;
  const roleCount = (r: Player['role']) => human.players.filter((p) => p.role === r).length;
  const os = human.players.filter((p) => p.nationality === 'Overseas').length;

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHero
        franchiseId={humanFranchiseId}
        kicker="Offseason"
        title="Scouting Room"
        subtitle={<>Rank your targets and set walk-away prices. When you&apos;re done, the league compiles the final auction list and sets from every franchise&apos;s shortlist.</>}
        right={
          <MButton variant="primary" size="lg" onClick={compile} disabled={compiling}>
            <Sparkles className="w-4 h-4" /> {compiling ? 'Compiling sets…' : 'Compile auction sets'}
          </MButton>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="m-panel overflow-hidden">
          <Tabs
            className="px-2"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'board', label: 'My big board', count: Object.keys(entries).length },
              { id: 'pool', label: 'Full player pool', count: registrationPool.length },
              { id: 'rivals', label: 'Rival intel' },
            ]}
          />

          {tab === 'board' && (
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
              {board.map(({ pr, items }) => {
                const meta = PRIORITY_META[pr];
                return (
                  <div key={pr} className="border border-[var(--m-line)] rounded-[3px] bg-ink/[0.015] flex flex-col min-h-[200px]">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--m-line)]" style={{ boxShadow: `inset 0 2px 0 ${meta.color}` }}>
                      <span className="font-display font-extrabold uppercase tracking-wider text-sm" style={{ color: meta.color }}>
                        {meta.short} · {meta.label}
                      </span>
                      <span className="m-chip">{items.length}</span>
                    </div>
                    <ul className="p-1.5 space-y-1 flex-1">
                      {items.map(({ e, p }) => (
                        <li key={p.id} className="flex items-center gap-2 px-1.5 py-1.5 rounded-[2px] bg-ink/5">
                          <OvrBadge ovr={p.ratings.overall} size="sm" />
                          <button className="min-w-0 flex-1 text-left" onClick={() => setScouting(p)}>
                            <div className="font-display font-bold uppercase text-[13px] truncate leading-tight">{p.name}</div>
                            <div className="text-[10px] text-[var(--m-faint)]">
                              {p.role} · base {formatPrice(p.basePrice)}
                              {rivalInterest[p.id] ? ` · ${rivalInterest[p.id]} rivals` : ''}
                            </div>
                          </button>
                          <label className="sr-only" htmlFor={`max-${p.id}`}>Max bid (crore)</label>
                          <input
                            id={`max-${p.id}`}
                            type="number"
                            min={p.basePrice / 100}
                            step={0.25}
                            placeholder="Max ₹Cr"
                            value={e.targetMaxBidLakhs ? e.targetMaxBidLakhs / 100 : ''}
                            onChange={(ev) =>
                              updateHumanShortlist(p.id, pr, e.scoutingNotes, ev.target.value ? Math.round(Number(ev.target.value) * 100) : undefined)
                            }
                            className="m-input !w-[74px] !py-1 !px-1.5 !text-xs"
                          />
                          <button onClick={() => removeHumanShortlist(p.id)} className="text-[var(--m-faint)] hover:text-[var(--m-red)]" aria-label={`Remove ${p.name}`}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                      {items.length === 0 && <li className="text-xs text-[var(--m-faint)] px-2 py-6 text-center">Tag players from the pool.</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'pool' && (
            <PlayerPoolTable
              players={registrationPool}
              shortlist={entries}
              rivalInterest={rivalInterest}
              onPriority={(id, p) => updateHumanShortlist(id, p, entries[id]?.scoutingNotes, entries[id]?.targetMaxBidLakhs)}
              onRemove={removeHumanShortlist}
              onScout={setScouting}
            />
          )}

          {tab === 'rivals' && <RivalIntel rivalInterest={rivalInterest} byId={byId} onScout={setScouting} />}
        </div>

        <div className="space-y-4">
          <Panel title="Your squad today">
            <div className="flex items-center gap-3 mb-3">
              <TeamCrest franchiseId={humanFranchiseId} size="sm" />
              <div className="flex-1">
                <div className="font-display font-extrabold uppercase">{human.players.length} retained</div>
                <div className="text-[11px] text-[var(--m-faint)]">Best XI OVR {bestXiOvr(human.players) || '—'}</div>
              </div>
              <div className="text-right">
                <div className="m-label !text-[0.58rem]">Purse</div>
                <div className="font-display font-extrabold text-[var(--m-green)]">{formatPrice(human.remainingPurse)}</div>
              </div>
            </div>
            <div className="m-label !text-[0.6rem] mb-1.5">Needs (target for a 20-man squad)</div>
            <ul className="space-y-1.5">
              {(Object.keys(ROLE_TARGET) as Player['role'][]).map((r) => {
                const have = roleCount(r);
                const need = Math.max(0, ROLE_TARGET[r] - have);
                return (
                  <li key={r} className="flex items-center gap-2 text-sm">
                    <RoleTag role={r} />
                    <span className="flex-1 m-meter"><span style={{ width: `${Math.min(100, (have / ROLE_TARGET[r]) * 100)}%` }} /></span>
                    <span className={`w-16 text-right text-xs ${need ? 'text-[var(--m-gold)]' : 'text-[var(--m-green)]'}`}>{need ? `need ${need}` : 'covered'}</span>
                  </li>
                );
              })}
              <li className="flex items-center justify-between text-sm pt-1.5 border-t border-[var(--m-line)]">
                <span className="text-[var(--m-dim)]">Overseas slots open</span>
                <span className="font-display font-extrabold">{human.maxOverseas - os}</span>
              </li>
            </ul>
          </Panel>
          <Panel title="Budget plan">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--m-dim)]">Max bids set</span>
              <span className="font-display font-extrabold text-xl">{formatPrice(plannedSpend)}</span>
            </div>
            <div className="m-meter mt-2">
              <span style={{ width: `${Math.min(100, (plannedSpend / Math.max(1, human.remainingPurse)) * 100)}%`, background: plannedSpend > human.remainingPurse ? 'var(--m-red)' : 'var(--m-green)' }} />
            </div>
            <div className="text-[11px] text-[var(--m-faint)] mt-1">
              {plannedSpend > human.remainingPurse
                ? `Over budget by ${formatPrice(plannedSpend - human.remainingPurse)} — you won't land everyone.`
                : `${formatPrice(human.remainingPurse - plannedSpend)} unallocated.`}
            </div>
          </Panel>
        </div>
      </div>

      {scouting && <PlayerScoutingModal player={scouting} franchise={human} onClose={() => setScouting(null)} />}
    </div>
  );
}

function RivalIntel({
  rivalInterest,
  byId,
  onScout,
}: {
  rivalInterest: Record<string, number>;
  byId: Map<string, Player>;
  onScout: (p: Player) => void;
}) {
  const hot = Object.entries(rivalInterest)
    .map(([id, n]) => ({ p: byId.get(id), n }))
    .filter((x): x is { p: Player; n: number } => !!x.p)
    .sort((a, b) => b.n - a.n || b.p.ratings.overall - a.p.ratings.overall)
    .slice(0, 30);
  if (!hot.length) return <Empty title="No intel yet" />;
  return (
    <div className="p-3">
      <p className="text-xs text-[var(--m-faint)] mb-2">Players appearing on the most CPU shortlists — expect bidding wars.</p>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {hot.map(({ p, n }) => (
          <li key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 bg-ink/[0.02] border border-[var(--m-line)] rounded-[2px]">
            <OvrBadge ovr={p.ratings.overall} size="sm" />
            <button className="flex-1 min-w-0 text-left" onClick={() => onScout(p)}>
              <div className="font-display font-bold uppercase truncate text-[14px]">{p.name}</div>
              <div className="text-[10px] text-[var(--m-faint)]">{p.role} · base {formatPrice(p.basePrice)}</div>
            </button>
            <div className="flex gap-0.5" aria-label={`${n} of 9 rivals interested`}>
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="w-1.5 h-4" style={{ background: i < n ? (n >= 6 ? 'var(--m-red)' : 'var(--m-gold)') : 'rgba(255,255,255,.08)' }} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
