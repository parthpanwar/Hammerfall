'use client';

// ============================================================
// IPL DYNASTY — Retention Day (MyNBA-style roster management)
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { RETENTION_RULES_2026, getMegaRetentionRules } from '@/lib/data/retention-rules';
import { seasonLabel } from '@/lib/flow/season-flow';
import { validateRetention, cpuRetentionDecisions } from '@/lib/engines/retention-engine';
import { formatPrice } from '@/lib/utils';
import { createSeededRandom } from '@/lib/utils/random';
import { Lock, X, ChevronRight, Info, AlertTriangle, Search } from 'lucide-react';
import type { Player, RetentionDecision, RetentionRule } from '@/lib/types/game';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import {
  MButton,
  Modal,
  OvrBadge,
  OverseasTag,
  PageHero,
  Panel,
  RoleTag,
  StatTile,
  Tabs,
  TeamCrest,
} from '@/components/mynba/primitives';

type RoleFilter = 'All' | Player['role'];

/**
 * Re-price a franchise's retentions in order. Capped players take the official
 * slabs (₹18 → 14 → 11 → 18 → 14 Cr) by capped order; uncapped cost ₹4 Cr.
 * Releasing a player re-prices the rest, so slabs never go stale.
 */
function repriceRetentions(
  decisions: RetentionDecision[],
  byId: Map<string, Player>,
  rules: RetentionRule
): RetentionDecision[] {
  let cappedIdx = 0;
  return decisions.map((d, i) => {
    const p = byId.get(d.playerId);
    const uncapped = p?.status === 'Uncapped';
    const cost = uncapped ? rules.uncappedRetentionCost : rules.retentionCosts[Math.min(cappedIdx++, rules.retentionCosts.length - 1)];
    return { ...d, cost, retentionNumber: i + 1 };
  });
}

export function RetentionView() {
  const {
    humanFranchiseId,
    franchises,
    retentionDecisions,
    setRetentionDecisions,
    completeRetention,
    updateFranchise,
    retentionComplete,
    settings,
    currentSeason,
  } = useGameStore();
  const settingsSeed = settings.seed || 1;

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scouting, setScouting] = useState<Player | null>(null);
  const [showResults, setShowResults] = useState(retentionComplete);

  const human = franchises.find((f) => f.id === humanFranchiseId);
  const rules: RetentionRule = useMemo(
    () => getMegaRetentionRules(human?.totalPurse ?? RETENTION_RULES_2026.totalPurse),
    [human?.totalPurse]
  );

  if (!human) return <div className="p-10 text-center m-label">Loading franchise…</div>;

  const roster = [...human.players].sort((a, b) => b.ratings.overall - a.ratings.overall);
  const byId = new Map(roster.map((p) => [p.id, p]));
  const mine = retentionDecisions.filter((d) => d.franchiseId === humanFranchiseId);
  const spent = mine.reduce((s, d) => s + d.cost, 0);
  const purseLeft = human.totalPurse - spent;
  const cappedUsed = mine.filter((d) => byId.get(d.playerId)?.status === 'Capped').length;
  const uncappedUsed = mine.length - cappedUsed;
  const overseasUsed = mine.filter((d) => byId.get(d.playerId)?.nationality === 'Overseas').length;

  const nextCostFor = (p: Player) =>
    p.status === 'Uncapped' ? rules.uncappedRetentionCost : rules.retentionCosts[Math.min(cappedUsed, rules.retentionCosts.length - 1)];

  const setMine = (next: RetentionDecision[]) => {
    const others = retentionDecisions.filter((d) => d.franchiseId !== humanFranchiseId);
    setRetentionDecisions([...others, ...repriceRetentions(next, byId, rules)]);
  };

  const toggle = (p: Player) => {
    setError(null);
    if (mine.some((d) => d.playerId === p.id)) {
      setMine(mine.filter((d) => d.playerId !== p.id));
      return;
    }
    const v = validateRetention(human, p, mine, rules);
    if (!v.valid) {
      setError(v.reason);
      return;
    }
    const draft = repriceRetentions(
      [...mine, { franchiseId: humanFranchiseId, playerId: p.id, playerName: p.name, cost: 0, retentionNumber: 0, isRTM: false }],
      byId,
      rules
    );
    const draftSpent = draft.reduce((s, d) => s + d.cost, 0);
    const slotsToFill = human.minSquadSize - draft.length;
    if (human.totalPurse - draftSpent < slotsToFill * 20) {
      setError(`Retaining ${p.name} would leave too little purse to fill ${slotsToFill} more squad spots.`);
      return;
    }
    setMine(draft.slice(0, -1).concat(draft[draft.length - 1]));
  };

  const lockRetentions = () => {
    const keptHuman = roster.filter((p) => mine.some((d) => d.playerId === p.id));
    updateFranchise(human.id, {
      remainingPurse: human.totalPurse - spent,
      retainedPlayers: keptHuman,
      players: keptHuman,
      releasedPlayers: roster.filter((p) => !keptHuman.includes(p)),
    });

    const rng = createSeededRandom(settingsSeed + retentionDecisions.length + 1);
    let all: RetentionDecision[] = [...mine];
    for (const cpu of franchises.filter((f) => f.id !== humanFranchiseId)) {
      const cpuRules = getMegaRetentionRules(cpu.totalPurse);
      const decisions = cpuRetentionDecisions(cpu, cpuRules, rng);
      all = all.concat(decisions);
      const kept = cpu.players.filter((p) => decisions.some((d) => d.playerId === p.id));
      updateFranchise(cpu.id, {
        remainingPurse: cpu.totalPurse - decisions.reduce((s, d) => s + d.cost, 0),
        retainedPlayers: kept,
        players: kept,
        releasedPlayers: cpu.players.filter((p) => !kept.includes(p)),
      });
    }
    setRetentionDecisions(all);
    completeRetention();
    setShowResults(true);
  };

  const filtered = roster.filter(
    (p) =>
      (roleFilter === 'All' || p.role === roleFilter) &&
      (!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()))
  );

  const roles: RoleFilter[] = ['All', 'Batter', 'All-Rounder', 'Bowler', 'Wicketkeeper'];

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHero
        franchiseId={humanFranchiseId}
        kicker={seasonLabel(currentSeason, settings)}
        title="Retention Day"
        subtitle={
          <>Keep up to {rules.maxRetentions} players before the auction. Every crore you commit here comes out of your {formatPrice(human.totalPurse)} purse — everyone else goes back into the pool.</>
        }
        right={
          retentionComplete ? (
            <MButton variant="primary" size="lg" onClick={() => setShowResults(true)}>
              View league retentions <ChevronRight className="w-4 h-4" />
            </MButton>
          ) : (
            <MButton variant="primary" size="lg" onClick={lockRetentions}>
              <Lock className="w-4 h-4" /> Lock {mine.length ? `${mine.length} retention${mine.length > 1 ? 's' : ''}` : 'no retentions'}
            </MButton>
          )
        }
      />

      {/* Retention slot tray */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: rules.maxRetentions }).map((_, i) => {
          const d = mine[i];
          const p = d ? byId.get(d.playerId) : undefined;
          return (
            <div
              key={i}
              className={`relative rounded-[3px] p-3 min-h-[92px] flex flex-col justify-between ${
                p ? 'm-panel border-ink/70' : 'border border-dashed border-[var(--m-line-strong)] bg-ink/[0.01]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="m-label !text-[0.6rem]">Slot {i + 1}</span>
                {d && <span className="font-display font-extrabold text-[var(--m-gold)]">{formatPrice(d.cost)}</span>}
              </div>
              {p ? (
                <div className="flex items-center gap-2 mt-2">
                  <OvrBadge ovr={p.ratings.overall} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-bold uppercase truncate leading-tight">{p.name}</div>
                    <div className="text-[10px] text-[var(--m-faint)]">{p.status} · {p.role}</div>
                  </div>
                  {!retentionComplete && (
                    <button onClick={() => toggle(p)} className="text-[var(--m-faint)] hover:text-[var(--m-red)]" aria-label={`Release ${p.name}`}>
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[var(--m-faint)] mt-2">Empty</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <Panel
          title={`${human.shortName} roster · ${roster.length} players`}
          right={
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--m-faint)]" />
              <input className="m-input !py-1.5 !pl-8 !w-44" placeholder="Search roster" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          }
          bodyClassName="p-0"
        >
          <Tabs
            className="px-2"
            tabs={roles.map((r) => ({ id: r, label: r === 'All' ? 'All' : r + 's', count: r === 'All' ? roster.length : roster.filter((p) => p.role === r).length }))}
            value={roleFilter}
            onChange={setRoleFilter}
          />
          {error && (
            <div className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-[2px] border border-[var(--m-red)]/50 bg-[var(--m-red)]/10 text-sm" role="alert">
              <AlertTriangle className="w-4 h-4 text-[var(--m-red)] shrink-0" /> {error}
            </div>
          )}
          <div className="overflow-x-auto m-scroll">
            <table className="m-table">
              <thead>
                <tr>
                  <th className="w-12">OVR</th>
                  <th>Player</th>
                  <th>Role</th>
                  <th className="text-right">Potential</th>
                  <th className="text-right hidden lg:table-cell">Market value</th>
                  <th className="text-right">Retain cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const d = mine.find((x) => x.playerId === p.id);
                  return (
                    <tr key={p.id} data-selected={!!d}>
                      <td><OvrBadge ovr={p.ratings.overall} size="sm" /></td>
                      <td>
                        <button className="text-left" onClick={() => setScouting(p)}>
                          <div className="font-display font-bold uppercase text-[15px] leading-tight hover:underline">{p.name}</div>
                          <div className="text-[11px] text-[var(--m-faint)]">{p.country} · {p.age} yrs · {p.status}</div>
                        </button>
                      </td>
                      <td><div className="flex gap-1"><RoleTag role={p.role} />{p.nationality === 'Overseas' && <OverseasTag />}</div></td>
                      <td className="text-right tabular-nums text-[var(--m-green)]">{p.ratings.potential}</td>
                      <td className="text-right tabular-nums text-[var(--m-dim)] hidden lg:table-cell">{formatPrice(p.estimatedMarketValue)}</td>
                      <td className="text-right tabular-nums font-display font-bold">
                        {d ? <span className="text-[var(--m-gold)]">{formatPrice(d.cost)}</span> : formatPrice(nextCostFor(p))}
                      </td>
                      <td className="text-right">
                        {!retentionComplete && (
                          <MButton size="sm" variant={d ? 'danger' : 'default'} onClick={() => toggle(p)}>
                            {d ? 'Release' : 'Retain'}
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

        <Panel title="Your budget" className="xl:sticky xl:top-36">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Auction purse" value={formatPrice(purseLeft)} tone="green" />
            <StatTile label="Committed" value={formatPrice(spent)} tone="gold" />
          </div>
          <div className="mt-3 m-meter"><span style={{ width: `${(spent / human.totalPurse) * 100}%`, background: 'var(--m-gold)' }} /></div>
          <div className="mt-5 space-y-2">
            {[
              ['Retained', mine.length, rules.maxRetentions],
              ['Capped', cappedUsed, rules.maxCappedRetentions],
              ['Uncapped', uncappedUsed, rules.maxUncappedRetentions],
              ['Overseas', overseasUsed, rules.maxOverseasRetentions],
            ].map(([k, v, m]) => (
              <div key={k as string} className="flex items-center justify-between text-sm">
                <span className="text-[var(--m-dim)]">{k}</span>
                <span className="font-display font-extrabold tabular-nums">
                  <span className={Number(v) >= Number(m) ? 'text-[var(--m-gold)]' : ''}>{v}</span>
                  <span className="text-[var(--m-faint)]"> / {m}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--m-faint)] mt-5 leading-relaxed flex gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Capped players cost {rules.retentionCosts.slice(0, 5).map((c) => c / 100).join(' / ')} Cr in the order you retain them. Uncapped players cost{' '}
              {formatPrice(rules.uncappedRetentionCost)}.
            </span>
          </p>
        </Panel>
      </div>

      <RetentionResults open={showResults} onClose={() => setShowResults(false)} />

      {scouting && <PlayerScoutingModal player={scouting} franchise={human} onClose={() => setScouting(null)} />}
    </div>
  );
}

function RetentionResults({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { franchises, retentionDecisions, humanFranchiseId, initializeRegistration, retentionComplete } = useGameStore();
  if (!retentionComplete) return null;
  return (
    <Modal open={open} onClose={onClose} width="max-w-6xl" labelledBy="ret-results-title">
      <div className="m-panel-head !py-4">
        <div>
          <div className="m-label">Retention window closed</div>
          <h2 id="ret-results-title" className="m-display text-3xl italic">Around the league</h2>
        </div>
        <MButton variant="primary" size="lg" onClick={initializeRegistration}>
          Open the player pool <ChevronRight className="w-4 h-4" />
        </MButton>
      </div>
      <div className="p-4 overflow-y-auto m-scroll grid grid-cols-1 md:grid-cols-2 gap-3">
        {franchises.map((f) => {
          const ds = retentionDecisions.filter((d) => d.franchiseId === f.id);
          const byId = new Map(f.players.map((p) => [p.id, p]));
          return (
            <div key={f.id} className={`rounded-[3px] border p-3 ${f.id === humanFranchiseId ? 'border-ink/70' : 'border-[var(--m-line)]'} bg-ink/[0.02]`}>
              <div className="flex items-center gap-3">
                <TeamCrest franchiseId={f.id} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-display font-extrabold uppercase truncate">
                    {f.name} {f.id === humanFranchiseId && <span className="m-chip ml-1">You</span>}
                  </div>
                  <div className="text-[11px] text-[var(--m-faint)]">{ds.length} retained · {formatPrice(ds.reduce((s, d) => s + d.cost, 0))} committed</div>
                </div>
                <div className="text-right">
                  <div className="m-label !text-[0.58rem]">Auction purse</div>
                  <div className="font-display font-extrabold text-lg text-[var(--m-green)]">{formatPrice(f.remainingPurse)}</div>
                </div>
              </div>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {ds.map((d) => {
                  const p = byId.get(d.playerId);
                  return (
                    <li key={d.playerId} className="flex items-center gap-2 text-sm px-2 py-1 bg-ink/5 rounded-[2px]">
                      {p && <OvrBadge ovr={p.ratings.overall} size="sm" />}
                      <span className="truncate flex-1">{d.playerName}</span>
                      <span className="font-display font-bold text-[var(--m-gold)]">{formatPrice(d.cost)}</span>
                    </li>
                  );
                })}
                {ds.length === 0 && <li className="text-xs text-[var(--m-faint)] italic">Full reset — no retentions</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
