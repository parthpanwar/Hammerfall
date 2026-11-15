'use client';

// ============================================================
// IPL DYNASTY — Release Day (mini-auction years)
// The squad stays together; the user chooses who to release to free purse and
// squad slots. CPU releases were made when the season rolled over.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { AlertTriangle, ChevronRight, Info, Scissors, Undo2 } from 'lucide-react';
import type { Player } from '@/lib/types/game';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { Modal, MButton, OvrBadge, OverseasTag, PageHero, Panel, RoleTag, StatTile, TeamCrest } from '@/components/mynba/primitives';
import { campaignYear, campaignLength, seasonLabel } from '@/lib/flow/season-flow';

export function MiniReleaseView() {
  const { humanFranchiseId, franchises, careerState, currentSeason, settings, retentionComplete, confirmMiniReleases } = useGameStore();
  const human = franchises.find((f) => f.id === humanFranchiseId);
  const [release, setRelease] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(retentionComplete);
  const [scouting, setScouting] = useState<Player | null>(null);

  const contracts = careerState.contracts;
  const salary = (p: Player) => contracts[p.id]?.salaryLakhs || p.soldPrice || p.currentContractValue || p.basePrice || 20;
  const roster = useMemo(() => [...(human?.players || [])].sort((a, b) => b.ratings.overall - a.ratings.overall), [human]);

  if (!human) return <div className="p-10 text-center m-label">Loading franchise…</div>;

  const kept = roster.filter((p) => !release.includes(p.id));
  const committed = kept.reduce((t, p) => t + salary(p), 0);
  const purseLeft = human.totalPurse - committed;
  const overseas = kept.filter((p) => p.nationality === 'Overseas').length;
  const openSlots = Math.max(0, human.maxSquadSize - kept.length);
  const year = campaignYear(currentSeason, settings);

  const toggle = (id: string) => {
    if (retentionComplete) return;
    setError(null);
    setRelease((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  };
  const confirm = () => {
    const r = confirmMiniReleases(release);
    if (!r.ok) return setError(r.message);
    setShowResults(true);
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHero
        franchiseId={humanFranchiseId}
        kicker={`${seasonLabel(currentSeason, settings)} · Year ${year} of ${campaignLength(settings)}`}
        title="Release Day"
        subtitle={
          <>
            Your squad stays together. Release players to free up purse and squad slots — everyone else stays on their
            contract. The mini auction pool is small, so trades are your best route to a star.
          </>
        }
        right={
          retentionComplete ? (
            <MButton variant="primary" size="lg" onClick={() => setShowResults(true)}>
              View league releases <ChevronRight className="w-4 h-4" />
            </MButton>
          ) : (
            <MButton variant="primary" size="lg" onClick={confirm}>
              <Scissors className="w-4 h-4" /> {release.length ? `Confirm ${release.length} release${release.length > 1 ? 's' : ''}` : 'Confirm releases (keep all)'}
            </MButton>
          )
        }
      />

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-[4px] border border-[var(--m-red)]/50 bg-[var(--m-red)]/10 text-sm" role="alert">
          <AlertTriangle className="w-4 h-4 text-[var(--m-red)] shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <Panel title={`${human.shortName} squad · ${roster.length} players`} bodyClassName="p-0">
          <div className="overflow-x-auto m-scroll">
            <table className="m-table">
              <thead>
                <tr>
                  <th className="w-12">OVR</th>
                  <th>Player</th>
                  <th>Role</th>
                  <th className="text-right">Salary</th>
                  <th className="text-right hidden md:table-cell">Contract</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => {
                  const out = release.includes(p.id);
                  const years = contracts[p.id]?.yearsRemaining;
                  return (
                    <tr key={p.id} className={out ? 'opacity-45' : ''}>
                      <td><OvrBadge ovr={p.ratings.overall} size="sm" /></td>
                      <td>
                        <button className="text-left" onClick={() => setScouting(p)}>
                          <div className={`font-display font-bold uppercase text-[15px] leading-tight hover:underline ${out ? 'line-through' : ''}`}>{p.name}</div>
                          <div className="text-[11px] text-[var(--m-faint)]">{p.country} · {p.age} yrs</div>
                        </button>
                      </td>
                      <td><div className="flex gap-1"><RoleTag role={p.role} />{p.nationality === 'Overseas' && <OverseasTag />}</div></td>
                      <td className="text-right tabular-nums font-display font-bold">{formatPrice(salary(p))}</td>
                      <td className="text-right tabular-nums text-[var(--m-dim)] hidden md:table-cell">{years ? `${years} yr${years > 1 ? 's' : ''} left` : '—'}</td>
                      <td className="text-right">
                        {!retentionComplete && (
                          <MButton size="sm" variant={out ? 'default' : 'ghost'} onClick={() => toggle(p.id)}>
                            {out ? <><Undo2 className="w-3.5 h-3.5" /> Keep</> : 'Release'}
                          </MButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="After releases" className="xl:sticky xl:top-36">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Auction purse" value={formatPrice(Math.max(0, purseLeft))} tone={purseLeft < 0 ? 'red' : 'green'} />
            <StatTile label="Open slots" value={openSlots} tone="gold" />
          </div>
          <div className="mt-5 space-y-2 text-sm">
            {[
              ['Squad', `${kept.length} / ${human.maxSquadSize}`, kept.length > human.maxSquadSize],
              ['Overseas', `${overseas} / ${human.maxOverseas}`, overseas > human.maxOverseas],
              ['Salaries kept', formatPrice(committed), purseLeft < 0],
              ['Released', `${release.length}`, false],
            ].map(([k, v, bad]) => (
              <div key={k as string} className="flex items-center justify-between">
                <span className="text-[var(--m-dim)]">{k}</span>
                <span className={`font-display font-extrabold tabular-nums ${bad ? 'text-[var(--m-red)]' : ''}`}>{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--m-faint)] mt-5 leading-relaxed flex gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Released players enter the mini auction pool, where any team can buy them — including you, at a new price.</span>
          </p>
        </Panel>
      </div>

      <ReleaseResults open={showResults} onClose={() => setShowResults(false)} />
      {scouting && <PlayerScoutingModal player={scouting} franchise={human} onClose={() => setScouting(null)} />}
    </div>
  );
}

function ReleaseResults({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { franchises, careerState, currentSeason, humanFranchiseId, initializeRegistration, retentionComplete } = useGameStore();
  if (!retentionComplete) return null;
  const released = (careerState.transactions || []).filter((t) => t.season === currentSeason && t.type === 'Released');
  return (
    <Modal open={open} onClose={onClose} width="max-w-5xl" labelledBy="rel-results-title">
      <div className="m-panel-head !py-4">
        <div>
          <div className="m-label">Release window closed</div>
          <h2 id="rel-results-title" className="m-display text-3xl italic">Around the league</h2>
        </div>
        <MButton variant="primary" size="lg" onClick={initializeRegistration}>
          Open the mini auction pool <ChevronRight className="w-4 h-4" />
        </MButton>
      </div>
      <div className="p-4 overflow-y-auto m-scroll grid grid-cols-1 md:grid-cols-2 gap-3">
        {franchises.map((f) => {
          const mine = released.filter((t) => t.franchiseId === f.id);
          return (
            <div key={f.id} className={`rounded-[3px] border p-3 ${f.id === humanFranchiseId ? 'border-ink/70' : 'border-[var(--m-line)]'} bg-ink/[0.02]`}>
              <div className="flex items-center gap-3">
                <TeamCrest franchiseId={f.id} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-display font-extrabold uppercase truncate">{f.name}</div>
                  <div className="text-[11px] text-[var(--m-faint)]">
                    {f.players.length} kept · {mine.length} released · {Math.max(0, f.maxSquadSize - f.players.length)} slots open
                  </div>
                </div>
                <div className="text-right">
                  <div className="m-label !text-[0.58rem]">Purse</div>
                  <div className="font-display font-extrabold text-lg text-[var(--m-green)]">{formatPrice(f.remainingPurse)}</div>
                </div>
              </div>
              {mine.length > 0 && (
                <div className="mt-2 text-xs text-[var(--m-dim)] leading-relaxed">
                  Released: {mine.map((t) => `${t.playerName} (${t.overall})`).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
