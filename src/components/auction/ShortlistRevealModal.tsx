'use client';

// ============================================================
// IPL DYNASTY — Auction Sets reveal (final list + nomination order)
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { Gavel, Star, ChevronLeft } from 'lucide-react';
import type { Player } from '@/lib/types/game';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { MButton, OvrBadge, OverseasTag, PageHero, Panel, RoleTag, StatTile, Tabs } from '@/components/mynba/primitives';
import { SquadsViewer } from '@/components/mynba/SquadsViewer';
import { PRIORITY_META } from '@/components/mynba/PlayerPoolTable';

export function ShortlistRevealModal() {
  const {
    humanFranchiseId,
    franchises,
    auctionSession,
    franchiseShortlists,
    retentionDecisions,
    setPhase,
  } = useGameStore();

  const sets = useMemo(() => [...(auctionSession?.sets || [])].sort((a, b) => a.order - b.order), [auctionSession]);
  const pool = useMemo(() => new Map((auctionSession?.playerPool || []).map((p) => [p.id, p])), [auctionSession]);
  const [activeSet, setActiveSet] = useState<string>(sets[0]?.code || '');
  const [tab, setTab] = useState<'sets' | 'squads'>('sets');
  const [squadTeam, setSquadTeam] = useState(humanFranchiseId);
  const [scouting, setScouting] = useState<Player | null>(null);

  const entries = useMemo(() => franchiseShortlists[humanFranchiseId]?.entries || {}, [franchiseShortlists, humanFranchiseId]);
  const human = franchises.find((f) => f.id === humanFranchiseId);
  const players = useMemo(() => auctionSession?.playerPool || [], [auctionSession]);

  const stats = useMemo(
    () => ({
      total: players.length,
      overseas: players.filter((p) => p.nationality === 'Overseas').length,
      capped: players.filter((p) => p.status === 'Capped').length,
      targets: players.filter((p) => entries[p.id]).length,
      totalPurse: franchises.reduce((s, f) => s + f.remainingPurse, 0),
    }),
    [players, entries, franchises]
  );

  /** Where each of your targets will be nominated. */
  const targetPlan = useMemo(
    () =>
      Object.values(entries)
        .map((e) => {
          const set = sets.find((s) => s.playerIds.includes(e.playerId));
          return { e, p: pool.get(e.playerId), set };
        })
        .filter((x) => x.p)
        .sort((a, b) => (a.set?.order ?? 999) - (b.set?.order ?? 999)),
    [entries, sets, pool]
  );

  const current = sets.find((s) => s.code === activeSet) || sets[0];
  const currentPlayers = (current?.playerIds || []).map((id) => pool.get(id)).filter(Boolean) as Player[];
  const missingTargets = Object.keys(entries).length - targetPlan.length;

  if (!auctionSession) {
    return (
      <div className="p-10 text-center">
        <div className="m-label">No auction compiled yet</div>
        <MButton className="mt-3" onClick={() => setPhase('Scouting')}>Back to scouting</MButton>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHero
        franchiseId={humanFranchiseId}
        kicker="Auction"
        title="Auction Sets"
        subtitle={<>The final list is locked: {stats.total} players in {sets.length} sets, nominated in this order. Marquee sets open the night.</>}
        right={
          <>
            <MButton variant="ghost" onClick={() => setPhase('Scouting')}><ChevronLeft className="w-4 h-4" /> Scouting</MButton>
            <MButton variant="primary" size="lg" onClick={() => setPhase('Auction')}>
              <Gavel className="w-4 h-4" /> Enter the auction floor
            </MButton>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatTile label="Players" value={stats.total} />
        <StatTile label="Overseas" value={stats.overseas} tone="gold" />
        <StatTile label="Capped" value={stats.capped} />
        <StatTile label="Your targets in list" value={stats.targets} tone="team" sub={missingTargets > 0 ? `${missingTargets} didn't make the cut` : undefined} />
        <StatTile label="League purse" value={formatPrice(stats.totalPurse)} tone="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <div className="m-panel overflow-hidden">
          <Tabs className="px-2" value={tab} onChange={setTab} tabs={[{ id: 'sets', label: 'Set order' }, { id: 'squads', label: 'Squads going in' }]} />
          {tab === 'sets' ? (
            <div className="grid grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)]">
              <ol className="border-b md:border-b-0 md:border-r border-[var(--m-line)] max-h-[620px] overflow-y-auto m-scroll p-1.5 space-y-0.5">
                {sets.map((s) => {
                  const mine = s.playerIds.filter((id) => entries[id]).length;
                  const active = current?.code === s.code;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setActiveSet(s.code)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[2px] text-left ${active ? 'bg-ink text-[var(--m-bg)]' : 'hover:bg-ink/[0.05]'}`}
                      >
                        <span className={`w-6 text-right font-display font-bold text-xs ${active ? '' : 'text-[var(--m-faint)]'}`}>{s.order}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-display font-extrabold uppercase text-[13px] leading-tight truncate">{s.name}</span>
                          <span className={`block text-[10px] ${active ? 'opacity-70' : 'text-[var(--m-faint)]'}`}>{s.code} · {s.totalCount} players</span>
                        </span>
                        {mine > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--m-gold)]">
                            <Star className="w-3 h-3" fill="currentColor" />{mine}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="overflow-x-auto m-scroll">
                <table className="m-table">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th className="w-12">OVR</th>
                      <th>Player</th>
                      <th>Role</th>
                      <th className="text-right">Age</th>
                      <th className="text-right">Base</th>
                      <th>Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPlayers.map((p, i) => (
                      <tr key={p.id} data-selected={!!entries[p.id]}>
                        <td className="text-[var(--m-faint)] tabular-nums">{i + 1}</td>
                        <td><OvrBadge ovr={p.ratings.overall} size="sm" /></td>
                        <td>
                          <button className="text-left" onClick={() => setScouting(p)}>
                            <div className="font-display font-bold uppercase text-[15px] leading-tight hover:underline">{p.name}</div>
                            <div className="text-[11px] text-[var(--m-faint)]">{p.country}</div>
                          </button>
                        </td>
                        <td><div className="flex gap-1"><RoleTag role={p.role} />{p.nationality === 'Overseas' && <OverseasTag />}</div></td>
                        <td className="text-right tabular-nums">{p.age}</td>
                        <td className="text-right font-display font-bold tabular-nums">{formatPrice(p.basePrice)}</td>
                        <td>
                          {entries[p.id] && (
                            <span className="m-chip" style={{ color: PRIORITY_META[entries[p.id].priority].color }}>
                              {PRIORITY_META[entries[p.id].priority].label}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <SquadsViewer
                franchises={franchises}
                humanFranchiseId={humanFranchiseId}
                retentionDecisions={retentionDecisions}
                selectedId={squadTeam}
                onSelect={setSquadTeam}
              />
            </div>
          )}
        </div>

        <Panel title="Your target schedule" bodyClassName="p-0">
          {targetPlan.length === 0 ? (
            <div className="p-4 text-sm text-[var(--m-faint)]">No shortlisted players in the final list. You can still bid on anyone.</div>
          ) : (
            <ul className="max-h-[640px] overflow-y-auto m-scroll">
              {targetPlan.map(({ e, p, set }) => (
                <li key={e.playerId} className="flex items-center gap-2.5 px-3 py-2 border-b border-[var(--m-line)] last:border-0">
                  <span className="w-1 self-stretch" style={{ background: PRIORITY_META[e.priority].color }} />
                  <OvrBadge ovr={p!.ratings.overall} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold uppercase truncate text-[14px]">{p!.name}</div>
                    <div className="text-[10px] text-[var(--m-faint)]">
                      Set {set?.order ?? '?'} · {set?.code} {e.targetMaxBidLakhs ? `· max ${formatPrice(e.targetMaxBidLakhs)}` : ''}
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-[var(--m-dim)]">{formatPrice(p!.basePrice)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {scouting && <PlayerScoutingModal player={scouting} franchise={human} onClose={() => setScouting(null)} />}
    </div>
  );
}
