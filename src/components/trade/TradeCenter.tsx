'use client';

// ============================================================
// IPL DYNASTY — Trade Center (MyNBA-style two-franchise trade builder)
// Builder · Trade Finder · Offers · Trade Block · History · Rules
// ============================================================

import React, { useMemo, useState } from 'react';
import { useGameStore, buildTradeWorld } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import {
  ArrowLeftRight,
  Scale,
  Search,
  Send,
  RotateCcw,
  MessageSquare,
  Check,
  X,
  AlertTriangle,
  CalendarClock,
  Sparkles,
  Lock,
  Bell,
} from 'lucide-react';
import type { Player } from '@/lib/types/game';
import type { CpuTradeEvaluation, TradeBlockStatus, TradeProposal, TradeRules, SalaryMatchingMode } from '@/lib/types/trade';
import {
  autoBalance,
  contractSalary,
  isWindowOpen,
  makeProposal,
  validateTrade,
  MATCHING_MODE_LABEL,
  RULE_PRESETS,
  feeBounds,
} from '@/lib/engines/trade/trade-rules';
import { evaluateProposal, findTrades, cpuTradeBlock, biggestNeed, teamDirection, DIRECTION_BLURB, type FinderResult } from '@/lib/engines/trade/trade-ai';
import { generalTradeValue, roleCoverage, COVERAGE_LABEL } from '@/lib/engines/trade/trade-value';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { MButton, Modal, OvrBadge, OverseasTag, RoleTag, Tabs, TeamCrest, teamVars, Empty } from '@/components/mynba/primitives';

type Tab = 'builder' | 'finder' | 'offers' | 'block' | 'history' | 'rules';

const BLOCK_META: Record<TradeBlockStatus, { label: string; color: string }> = {
  Untouchable: { label: 'Untouchable', color: 'var(--m-red)' },
  Shopping: { label: 'Actively shopping', color: 'var(--m-green)' },
  Available: { label: 'Available', color: 'var(--m-cyan)' },
  Listening: { label: 'Will listen', color: 'var(--m-gold)' },
};

const INTEREST_COLOR: Record<string, string> = {
  None: 'var(--m-faint)',
  Low: 'var(--m-red)',
  Moderate: 'var(--m-gold)',
  Strong: 'var(--m-green)',
  'Very Strong': 'var(--m-cyan)',
};

export function TradeCenter() {
  const state = useGameStore();
  const {
    humanFranchiseId,
    franchises,
    submitTrade,
    requestCounteroffer,
    respondToOffer,
    confirmTrade,
    cancelTrade,
    tradeMarketTick,
    setTradeBlock,
    setTradeRules,
    tradeEvents,
    dismissTradeEvents,
    careerState,
  } = state;

  const world = useMemo(
    () => buildTradeWorld(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.franchises, state.careerState, state.retentionDecisions, state.phase, state.tradeReturnPhase, state.fixtures, state.auctionComplete, state.settings.cpuDifficulty]
  );
  const trade = world.trade;
  const win = isWindowOpen(world);

  const [tab, setTab] = useState<Tab>('builder');
  const [partnerId, setPartnerId] = useState<string>(() => franchises.find((f) => f.id !== humanFranchiseId)?.id || 'csk');
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const [cash, setCash] = useState<[number, number]>([0, 0]);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [response, setResponse] = useState<{ ev: CpuTradeEvaluation; proposal: TradeProposal } | null>(null);
  const [preview, setPreview] = useState<CpuTradeEvaluation | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scouting, setScouting] = useState<Player | null>(null);

  const me = franchises.find((f) => f.id === humanFranchiseId)!;
  const partner = franchises.find((f) => f.id === partnerId)!;
  const cpus = franchises.filter((f) => f.id !== humanFranchiseId);
  const rules = trade.rules;

  const proposal = useMemo<TradeProposal>(() => {
    const base = makeProposal(world, humanFranchiseId, partnerId, give, get, 'human', cash);
    // Only fees for players still in the deal.
    const live = Object.fromEntries(Object.entries(fees).filter(([id]) => give.includes(id) || get.includes(id)));
    const p = Object.keys(live).length ? { ...base, fees: live } : base;
    return draftId ? { ...p, id: draftId } : p;
  }, [world, humanFranchiseId, partnerId, give, get, cash, draftId, fees]);
  const setFee = (id: string, fee: number | null) =>
    setFees((f) => {
      const n = { ...f };
      if (fee === null) delete n[id];
      else n[id] = fee;
      return n;
    });
  const validation = useMemo(() => validateTrade(proposal, world), [proposal, world]);

  const resetBuilder = (pid = partnerId) => {
    setPartnerId(pid);
    setGive([]);
    setGet([]);
    setCash([0, 0]);
    setFees({});
    setDraftId(null);
    setResponse(null);
    setPreview(null);
  };
  const loadProposal = (p: TradeProposal) => {
    // Normalise so the human franchise is side 0.
    const humanFirst = p.sides[0].franchiseId === humanFranchiseId;
    const [mine, theirs] = humanFirst ? p.sides : [p.sides[1], p.sides[0]];
    setPartnerId(theirs.franchiseId);
    setGive(mine.playerIds);
    setGet(theirs.playerIds);
    setCash([mine.cashLakhs, theirs.cashLakhs]);
    setFees(p.fees || {});
    setDraftId(null);
    setResponse(null);
    setPreview(null);
    setTab('builder');
  };
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const salaryOf = (p: Player, fid: string) => contractSalary(p, fid, world);
  const tv = (p: Player, fid: string) => generalTradeValue(p, salaryOf(p, fid)).value;

  const offers = trade.proposals.filter(
    (p) => (p.status === 'SUBMITTED' && p.initiatedBy === 'cpu' && p.sides.some((s) => s.franchiseId === humanFranchiseId)) || (p.status === 'ACCEPTED' && p.sides.some((s) => s.franchiseId === humanFranchiseId))
  );

  const submit = () => {
    const ev = submitTrade(proposal);
    // Keep the builder bound to the submitted deal so it isn't flagged as "locked" by itself.
    setDraftId(proposal.id);
    setResponse({ ev, proposal });
    setPreview(null);
  };
  const doConfirm = (id: string) => {
    const r = confirmTrade(id);
    setConfirmId(null);
    setNotice(r.message);
    if (r.ok) resetBuilder();
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* Title row — the global header already shows the trade window and a Back button */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div>
          <div className="m-label">Season {world.season} · {MATCHING_MODE_LABEL[rules.matchingMode]}</div>
          <h1 className="m-display text-3xl sm:text-4xl italic mt-1">Trade Center</h1>
          <p className="text-sm text-[var(--m-dim)] mt-2 max-w-2xl">
            {win.open ? (
              <>Swap players with any CPU team. The window closes {win.closesAt}.</>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {win.reason} You can still browse rosters and history.</span>
            )}
          </p>
        </div>
        <MButton
          variant="ghost"
          onClick={() => {
            const ev = tradeMarketTick();
            setNotice(ev.length ? null : 'A quiet day on the trade market.');
          }}
          disabled={!win.open}
          title="Advance the trade market one day: new CPU offers, expiries and CPU-to-CPU deals"
        >
          <CalendarClock className="w-4 h-4" /> Next market day
        </MButton>
      </div>

      {(notice || tradeEvents.length > 0) && (
        <div className="m-panel px-4 py-2.5 flex items-start gap-2 text-sm" role="status">
          <Bell className="w-4 h-4 text-[var(--m-gold)] shrink-0 mt-0.5" />
          <div className="flex-1">
            {notice && <div>{notice}</div>}
            {tradeEvents.map((e, i) => (
              <div key={i} className="text-[var(--m-dim)]">{e}</div>
            ))}
          </div>
          <button
            className="text-[var(--m-faint)] hover:text-ink"
            onClick={() => {
              setNotice(null);
              dismissTradeEvents();
            }}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="m-panel overflow-hidden">
        <Tabs
          className="px-2"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'builder', label: 'Trade builder' },
            { id: 'finder', label: 'Trade finder' },
            { id: 'offers', label: 'Offers', count: offers.length },
            { id: 'block', label: 'Trade block' },
            { id: 'history', label: 'History', count: trade.history.length },
            { id: 'rules', label: 'Rules & cash' },
          ]}
        />

        {tab === 'builder' && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px_minmax(0,1fr)] gap-0 xl:divide-x divide-[var(--m-line)]">
            {/* LEFT — your franchise */}
            <RosterPanel
              title={`${me.shortName} · your roster`}
              franchiseId={me.id}
              players={me.players}
              selected={give}
              onToggle={(id) => toggle(give, setGive, id)}
              salaryOf={(p) => salaryOf(p, me.id)}
              valueOf={(p) => tv(p, me.id)}
              tag={(p) => (trade.humanBlock[p.id] ? BLOCK_META[trade.humanBlock[p.id]] : null)}
              disabled={(p) => trade.humanBlock[p.id] === 'Untouchable'}
              onScout={setScouting}
            />

            {/* CENTRE — proposal */}
            <div className="p-4 space-y-4 bg-ink/[0.04]">
              <div>
                <div className="m-label mb-1.5">Trade partner</div>
                <div className="grid grid-cols-9 gap-1">
                  {cpus.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => resetBuilder(f.id)}
                      aria-pressed={f.id === partnerId}
                      title={f.name}
                      className={`flex items-center justify-center py-1.5 rounded-[2px] border ${f.id === partnerId ? 'border-ink bg-ink/10' : 'border-[var(--m-line)] hover:border-[var(--m-line-strong)]'}`}
                    >
                      <TeamCrest franchiseId={f.id} size="xs" />
                    </button>
                  ))}
                </div>
              </div>

              <ProposalSide
                title={`You send · ${give.length}`}
                franchiseId={me.id}
                players={me.players.filter((p) => give.includes(p.id))}
                salaryOf={(p) => salaryOf(p, me.id)}
                onRemove={(id) => toggle(give, setGive, id)}
                fees={fees}
                onFee={setFee}
              />
              <div className="flex justify-center -my-1">
                <ArrowLeftRight className="w-5 h-5 text-[var(--m-faint)]" />
              </div>
              <ProposalSide
                title={`You receive · ${get.length}`}
                franchiseId={partner.id}
                players={partner.players.filter((p) => get.includes(p.id))}
                salaryOf={(p) => salaryOf(p, partner.id)}
                onRemove={(id) => toggle(get, setGet, id)}
                fees={fees}
                onFee={setFee}
              />

              {give.length === 0 || get.length === 0 ? (
                <ol className="rounded-[3px] border border-dashed border-[var(--m-line-strong)] px-4 py-4 space-y-2.5 text-sm text-[var(--m-dim)]">
                  {[
                    'Pick a trade partner above.',
                    'Click players in your roster (left) to send them.',
                    'Click players in their roster (right) that you want.',
                    'Check it is legal, then submit. The CPU replies at once.',
                  ].map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-5 h-5 shrink-0 rounded-[3px] border border-[var(--m-line-strong)] inline-flex items-center justify-center text-[11px]">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              ) : (
              <>
              {/* Money */}
              <div className="border border-[var(--m-line)] rounded-[3px] p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MoneyCell label="You send (fees)" value={formatPrice(validation.financials.incomingSalary[1])} />
                  <MoneyCell label="You take on" value={formatPrice(validation.financials.incomingSalary[0])} />
                  <MoneyCell
                    label="Salary difference"
                    value={`${validation.financials.salaryDifference > 0 ? '+' : validation.financials.salaryDifference < 0 ? '−' : ''}${formatPrice(Math.abs(validation.financials.salaryDifference))}`}
                    tone={validation.financials.salaryDifference > 0 ? 'var(--m-gold)' : 'var(--m-green)'}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex-1">
                    <span className="m-label !text-[0.58rem]">You pay (₹ Cr)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      className="m-input !py-1.5"
                      value={cash[0] / 100 || ''}
                      placeholder="0"
                      onChange={(e) => setCash([Math.max(0, Math.round(Number(e.target.value) * 100)), 0])}
                    />
                  </label>
                  <label className="flex-1">
                    <span className="m-label !text-[0.58rem]">They pay (₹ Cr)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      className="m-input !py-1.5"
                      value={cash[1] / 100 || ''}
                      placeholder="0"
                      onChange={(e) => setCash([0, Math.max(0, Math.round(Number(e.target.value) * 100))])}
                    />
                  </label>
                  <MButton
                    size="sm"
                    onClick={() => {
                      const b = autoBalance(proposal, world);
                      setCash([b.sides[0].cashLakhs, b.sides[1].cashLakhs]);
                    }}
                    disabled={!give.length || !get.length || rules.matchingMode === 'Exact'}
                    title="Set the cash payment that satisfies the salary-matching rule"
                  >
                    <Scale className="w-3.5 h-3.5" /> Auto-balance
                  </MButton>
                </div>
                <div className="text-[11px] text-[var(--m-faint)]" title="Trade cash moves between settlement accounts (or purses, depending on the rules). It never changes a player's salary.">
                  Your cash: {formatPrice(trade.settlement[me.id] ?? 0)} · purse after: {formatPrice(validation.financials.purseAfter[0])}
                </div>
              </div>

              {/* Validity */}
              <div className={`rounded-[3px] border px-3 py-2 text-sm ${validation.valid ? 'border-[var(--m-green)]/50 bg-[var(--m-green)]/5' : 'border-[var(--m-line)]'}`}>
                {validation.valid ? (
                  <span className="flex items-center gap-2 text-[var(--m-green)]"><Check className="w-4 h-4" /> Legal trade</span>
                ) : (
                  <ul className="space-y-1">
                    {validation.issues.slice(0, 4).map((i, k) => (
                      <li key={k} className="flex gap-2 text-[var(--m-text)]"><AlertTriangle className="w-4 h-4 text-[var(--m-red)] shrink-0 mt-0.5" /> {i.message}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Impact */}
              <div className="grid grid-cols-2 gap-2">
                <ImpactCard title="Your squad" before={validation.before[0]} after={validation.after[0]} showStrength />
                <ImpactCard title={partner.shortName} before={validation.before[1]} after={validation.after[1]} />
              </div>
              </>
              )}

              {/* Actions */}
              <MButton variant="primary" size="lg" className="w-full" onClick={submit} disabled={!validation.valid}>
                <Send className="w-4 h-4" /> Submit offer
              </MButton>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                <button
                  className="inline-flex items-center gap-1.5 text-[var(--m-dim)] hover:text-ink disabled:opacity-40"
                  onClick={() => setPreview(evaluateProposal(proposal, world, { allowCounter: false }))}
                  disabled={!give.length || !get.length}
                >
                  <Search className="w-3.5 h-3.5" /> Gauge interest
                </button>
                <button
                  className="inline-flex items-center gap-1.5 text-[var(--m-dim)] hover:text-ink disabled:opacity-40"
                  onClick={() => {
                    const r = requestCounteroffer(proposal);
                    setNotice(r.message);
                    if (r.counter) setResponse({ ev: { decision: 'COUNTER', acceptanceProbability: 0.5, interest: 'Moderate', reasons: [r.message], counter: r.counter, utility: 0, threshold: 0 }, proposal });
                  }}
                  disabled={!give.length || !get.length || !win.open}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Ask what they want
                </button>
                <button className="inline-flex items-center gap-1.5 text-[var(--m-dim)] hover:text-ink" onClick={() => resetBuilder()}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>

              {preview && !response && (
                <div className="border border-[var(--m-line)] rounded-[3px] p-3">
                  <div className="flex items-center justify-between">
                    <span className="m-label">Front-office read</span>
                    <span className="font-display font-extrabold uppercase" style={{ color: INTEREST_COLOR[preview.interest] }}>{preview.interest} interest</span>
                  </div>
                  <ul className="mt-1.5 text-sm text-[var(--m-dim)] space-y-0.5">
                    {preview.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}

              {response && (
                <ResponseCard
                  response={response}
                  partnerName={partner.name}
                  world={world}
                  onConfirm={() => setConfirmId(response.proposal.id)}
                  onAcceptCounter={(c) => {
                    const r = respondToOffer(c.id, 'accept');
                    setNotice(r.message);
                    if (r.ok) setConfirmId(c.id);
                  }}
                  onRejectCounter={(c) => {
                    respondToOffer(c.id, 'reject');
                    setResponse(null);
                  }}
                  onEditCounter={(c) => loadProposal(c)}
                />
              )}
            </div>

            {/* RIGHT — CPU franchise */}
            <div className="min-w-0">
              <PartnerSummary partnerId={partner.id} world={world} />
              <RosterPanel
                title={`${partner.shortName} roster`}
                franchiseId={partner.id}
                players={partner.players}
                selected={get}
                onToggle={(id) => toggle(get, setGet, id)}
                salaryOf={(p) => salaryOf(p, partner.id)}
                valueOf={(p) => tv(p, partner.id)}
                tag={(p) => {
                  const b = cpuBlockIds(partner.id).get(p.id);
                  return b ? { label: b, color: 'var(--m-green)' } : null;
                }}
                onScout={setScouting}
              />
            </div>
          </div>
        )}

        {tab === 'finder' && <FinderTab world={world} onLoad={loadProposal} salaryOf={salaryOf} valueOf={tv} />}

        {tab === 'offers' && (
          <OffersTab
            offers={offers}
            world={world}
            onAccept={(p) => {
              if (p.status === 'ACCEPTED') return setConfirmId(p.id);
              const r = respondToOffer(p.id, 'accept');
              setNotice(r.message);
              if (r.ok) setConfirmId(p.id);
            }}
            onReject={(p) => (p.status === 'ACCEPTED' ? cancelTrade(p.id) : respondToOffer(p.id, 'reject'))}
            onCounter={loadProposal}
            onScout={setScouting}
          />
        )}

        {tab === 'block' && (
          <BlockTab
            world={world}
            onSet={setTradeBlock}
            onTarget={(fid, pid) => {
              resetBuilder(fid);
              setGet([pid]);
              setTab('builder');
            }}
          />
        )}

        {tab === 'history' && <HistoryTab world={world} />}

        {tab === 'rules' && <RulesTab rules={rules} onChange={setTradeRules} world={world} locked={trade.history.some((h) => h.season === world.season && !h.isCpuToCpu)} />}
      </div>

      {confirmId && <ConfirmModal proposalId={confirmId} world={world} onCancel={() => setConfirmId(null)} onConfirm={() => doConfirm(confirmId)} />}
      {scouting && <PlayerScoutingModal player={scouting} franchise={me} onClose={() => setScouting(null)} />}
    </div>
  );

  function cpuBlockIds(fid: string) {
    const f = franchises.find((x) => x.id === fid);
    return new Map(f ? cpuTradeBlock(f, world).map((b) => [b.player.id, b.reason] as const) : []);
  }
  void careerState;
}

// ------------------------------------------------------------
// Pieces
// ------------------------------------------------------------

function MoneyCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-t border-[var(--m-ink)] pt-1.5 pb-0.5">
      <div className="m-label !text-[0.6rem]">{label}</div>
      <div className="font-display text-lg leading-tight tabular-nums" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function RosterPanel({
  title,
  franchiseId,
  players,
  selected,
  onToggle,
  salaryOf,
  valueOf,
  tag,
  disabled,
  onScout,
}: {
  title: string;
  franchiseId: string;
  players: Player[];
  selected: string[];
  onToggle: (id: string) => void;
  salaryOf: (p: Player) => number;
  valueOf: (p: Player) => number;
  tag?: (p: Player) => { label: string; color: string } | null;
  disabled?: (p: Player) => boolean;
  onScout: (p: Player) => void;
}) {
  const [role, setRole] = useState<'All' | Player['role']>('All');
  const [sort, setSort] = useState<'ovr' | 'tv' | 'sal' | 'age'>('ovr');
  const rows = players
    .filter((p) => role === 'All' || p.role === role)
    .sort((a, b) =>
      sort === 'ovr' ? b.ratings.overall - a.ratings.overall : sort === 'tv' ? valueOf(b) - valueOf(a) : sort === 'sal' ? salaryOf(b) - salaryOf(a) : a.age - b.age
    );
  return (
    <div style={teamVars(franchiseId)} className="min-w-0">
      <div className="m-panel-head">
        <span className="m-label !text-[var(--m-text)]">{title}</span>
        <div className="flex gap-1">
          <select className="m-input !w-auto !py-1 !text-xs" value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Filter role">
            <option value="All">All</option>
            <option value="Batter">BAT</option>
            <option value="Wicketkeeper">WK</option>
            <option value="All-Rounder">AR</option>
            <option value="Bowler">BOWL</option>
          </select>
          <select className="m-input !w-auto !py-1 !text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="ovr">OVR</option>
            <option value="tv">Trade value</option>
            <option value="sal">Salary</option>
            <option value="age">Age</option>
          </select>
        </div>
      </div>
      <div className="max-h-[640px] overflow-y-auto m-scroll">
        <table className="m-table">
          <thead>
            <tr>
              <th className="w-8" />
              <th>Player</th>
              <th className="text-right">Age</th>
              <th className="text-right">POT</th>
              <th className="text-right">Salary</th>
              <th className="text-right" title="General trade value (0–100)">TV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const sel = selected.includes(p.id);
              const dis = disabled?.(p) && !sel;
              const t = tag?.(p);
              return (
                <tr key={p.id} data-selected={sel} className={dis ? 'opacity-40' : 'cursor-pointer'} onClick={() => !dis && onToggle(p.id)}>
                  <td><OvrBadge ovr={p.ratings.overall} size="sm" /></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="font-display font-bold uppercase text-[14px] leading-tight hover:underline text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          onScout(p);
                        }}
                      >
                        {p.name}
                      </button>
                      {p.nationality === 'Overseas' && <OverseasTag />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <RoleTag role={p.role} />
                      {t && <span className="m-chip !text-[0.55rem]" style={{ color: t.color, borderColor: `${t.color}55` }}>{t.label}</span>}
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{p.age}</td>
                  <td className="text-right tabular-nums text-[var(--m-green)]">{p.ratings.potential}</td>
                  <td className="text-right tabular-nums">{formatPrice(salaryOf(p))}</td>
                  <td className="text-right tabular-nums font-display font-bold">{Math.round(valueOf(p))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProposalSide({
  title,
  franchiseId,
  players,
  salaryOf,
  onRemove,
  fees,
  onFee,
}: {
  title: string;
  franchiseId: string;
  players: Player[];
  salaryOf: (p: Player) => number;
  onRemove?: (id: string) => void;
  /** Renegotiated fees for these players (lakhs). */
  fees?: Record<string, number>;
  onFee?: (id: string, fee: number | null) => void;
}) {
  return (
    <div className="border border-[var(--m-line)] rounded-[3px] overflow-hidden" style={teamVars(franchiseId)}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--team-primary) 16%, transparent), transparent 70%)' }}>
        <TeamCrest franchiseId={franchiseId} size="xs" />
        <span className="m-label !text-[var(--m-text)]">{title}</span>
      </div>
      {players.length === 0 ? (
        <div className="px-3 py-3 text-xs text-[var(--m-faint)]">Click players in the roster to add them.</div>
      ) : (
        <ul>
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--m-line)]">
              <OvrBadge ovr={p.ratings.overall} size="sm" />
              <span className="flex-1 min-w-0 truncate font-display font-bold uppercase text-[14px]">{p.name}</span>
              <RoleTag role={p.role} />
              {onFee ? (
                <FeeControl current={salaryOf(p)} fee={fees?.[p.id]} onChange={(v) => onFee(p.id, v)} />
              ) : (
                <span className="font-display font-bold tabular-nums text-sm w-16 text-right">{formatPrice(salaryOf(p))}</span>
              )}
              {onRemove && (
                <button onClick={() => onRemove(p.id)} className="text-[var(--m-faint)] hover:text-[var(--m-red)]" aria-label={`Remove ${p.name}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Salary with an optional renegotiated fee (50–125% of the current contract). */
function FeeControl({ current, fee, onChange }: { current: number; fee?: number; onChange: (v: number | null) => void }) {
  const [lo, hi] = feeBounds(current);
  const [editing, setEditing] = useState(false);
  const changed = fee !== undefined && fee !== current;
  if (!editing) {
    return (
      <button
        className="text-right w-24 leading-tight"
        onClick={() => setEditing(true)}
        title="Renegotiate this player's fee for the move (50–125% of his current salary)"
      >
        {changed && <span className="block text-[10px] text-[var(--m-faint)] line-through tabular-nums">{formatPrice(current)}</span>}
        <span className={`font-display font-bold tabular-nums text-sm ${changed ? 'text-[var(--m-gold)]' : ''}`}>{formatPrice(fee ?? current)}</span>
        <span className="block text-[10px] text-[var(--m-faint)] underline decoration-dotted">{changed ? 'new fee' : 'edit fee'}</span>
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        autoFocus
        className="m-input !py-1 !px-1.5 !w-20 text-right"
        min={lo / 100}
        max={hi / 100}
        step={0.25}
        defaultValue={(fee ?? current) / 100}
        aria-label={`New fee in crore (${formatPrice(lo)}–${formatPrice(hi)})`}
        onBlur={(e) => {
          const v = Math.round((Number(e.target.value) * 100) / 5) * 5;
          onChange(!v || v === current ? null : Math.max(lo, Math.min(hi, v)));
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-[10px] text-[var(--m-faint)]">Cr</span>
    </span>
  );
}

function ImpactCard({
  title,
  before,
  after,
  showStrength,
}: {
  title: string;
  before: { size: number; overseas: number; bestXiOvr: number; strength: number };
  after: { size: number; overseas: number; bestXiOvr: number; strength: number };
  showStrength?: boolean;
}) {
  const delta = (a: number, b: number, dp = 0) => {
    const d = Math.round((b - a) * 10 ** dp) / 10 ** dp;
    return d === 0 ? <span className="text-[var(--m-faint)]">±0</span> : <span style={{ color: d > 0 ? 'var(--m-green)' : 'var(--m-red)' }}>{d > 0 ? '+' : ''}{d}</span>;
  };
  return (
    <div className="border border-[var(--m-line)] rounded-[3px] p-2.5 text-sm">
      <div className="m-label !text-[0.6rem] mb-1">{title}</div>
      <div className="flex justify-between"><span className="text-[var(--m-dim)]">Squad</span><span className="tabular-nums">{before.size} → {after.size}</span></div>
      <div className="flex justify-between"><span className="text-[var(--m-dim)]">Overseas</span><span className="tabular-nums">{before.overseas} → {after.overseas}</span></div>
      <div className="flex justify-between"><span className="text-[var(--m-dim)]">Best XI OVR</span><span className="tabular-nums">{after.bestXiOvr} {delta(before.bestXiOvr, after.bestXiOvr)}</span></div>
      {showStrength && (
        <div className="flex justify-between"><span className="text-[var(--m-dim)]">Team strength</span><span className="tabular-nums">{after.strength} {delta(before.strength, after.strength, 1)}</span></div>
      )}
    </div>
  );
}

function PartnerSummary({ partnerId, world }: { partnerId: string; world: ReturnType<typeof buildTradeWorld> }) {
  const f = world.franchises.find((x) => x.id === partnerId)!;
  const cov = roleCoverage(f.players);
  const need = biggestNeed(f);
  const commitment = f.players.reduce((s, p) => s + contractSalary(p, f.id, world), 0);
  const os = f.players.filter((p) => p.nationality === 'Overseas').length;
  const dir = teamDirection(f, world);
  return (
    <div className="p-3 border-b border-[var(--m-line)]" style={teamVars(f.id)}>
      <div className="flex items-center gap-3">
        <TeamCrest franchiseId={f.id} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-display font-extrabold uppercase text-lg truncate">{f.name}</div>
          <div className="text-[11px] text-[var(--m-faint)]">{need ? `Biggest need: ${COVERAGE_LABEL[need]}` : 'Balanced squad — looking for upgrades'}</div>
        </div>
        <span className="m-chip !text-[0.68rem]" title={DIRECTION_BLURB[dir]} style={{ color: dir === 'Contending' ? 'var(--m-gold)' : dir === 'Rebuilding' ? 'var(--m-cyan)' : 'var(--m-dim)' }}>
          {dir}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-2 text-center">
        <MoneyCell label="Cap room" value={formatPrice(f.remainingPurse)} tone="var(--m-green)" />
        <MoneyCell label="Trade cash" value={formatPrice(world.trade.settlement[f.id] ?? 0)} tone="var(--m-gold)" />
        <MoneyCell label="Salaries" value={formatPrice(commitment)} />
        <MoneyCell label="Squad · OS" value={`${f.players.length} · ${os}`} />
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {(Object.keys(cov) as (keyof typeof cov)[]).map((k) => (
          <span key={k} className="m-chip" style={{ color: cov[k] < 2 ? 'var(--m-red)' : 'var(--m-dim)' }}>
            {COVERAGE_LABEL[k]} {cov[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResponseCard({
  response,
  partnerName,
  world,
  onConfirm,
  onAcceptCounter,
  onRejectCounter,
  onEditCounter,
}: {
  response: { ev: CpuTradeEvaluation; proposal: TradeProposal };
  partnerName: string;
  world: ReturnType<typeof buildTradeWorld>;
  onConfirm: () => void;
  onAcceptCounter: (c: TradeProposal) => void;
  onRejectCounter: (c: TradeProposal) => void;
  onEditCounter: (c: TradeProposal) => void;
}) {
  const { ev } = response;
  const color = ev.decision === 'ACCEPT' ? 'var(--m-green)' : ev.decision === 'COUNTER' ? 'var(--m-gold)' : 'var(--m-red)';
  return (
    <div className="border rounded-[3px] p-3 m-rise" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <span className="font-display font-extrabold uppercase text-lg" style={{ color }}>
          {ev.decision === 'ACCEPT' ? 'Offer accepted' : ev.decision === 'COUNTER' ? 'Counteroffer' : 'Offer rejected'}
        </span>
        <span className="text-xs text-[var(--m-faint)]">{partnerName}</span>
      </div>
      <ul className="mt-1.5 text-sm space-y-0.5">
        {ev.reasons.map((r, i) => <li key={i} className="text-[var(--m-dim)]">“{r}”</li>)}
      </ul>
      {ev.decision === 'ACCEPT' && (
        <MButton variant="go" className="w-full mt-3" onClick={onConfirm}>Review & confirm trade</MButton>
      )}
      {ev.decision === 'COUNTER' && ev.counter && (
        <>
          <ProposalSummary proposal={ev.counter} world={world} />
          <div className="grid grid-cols-3 gap-2 mt-2">
            <MButton size="sm" variant="go" onClick={() => onAcceptCounter(ev.counter!)}>Accept</MButton>
            <MButton size="sm" onClick={() => onEditCounter(ev.counter!)}>Edit</MButton>
            <MButton size="sm" variant="danger" onClick={() => onRejectCounter(ev.counter!)}>Reject</MButton>
          </div>
        </>
      )}
    </div>
  );
}

function ProposalSummary({ proposal, world }: { proposal: TradeProposal; world: ReturnType<typeof buildTradeWorld> }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {proposal.sides.map((s) => {
        const f = world.franchises.find((x) => x.id === s.franchiseId)!;
        const ps = f.players.filter((p) => s.playerIds.includes(p.id));
        return (
          <div key={s.franchiseId} className="bg-ink/[0.04] rounded-[2px] p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <TeamCrest franchiseId={f.id} size="xs" />
              <span className="m-label !text-[0.58rem]">{f.shortName} send</span>
            </div>
            {ps.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 text-sm">
                <OvrBadge ovr={p.ratings.overall} size="sm" />
                <span className="truncate flex-1">{p.name}</span>
                {proposal.fees?.[p.id] !== undefined && (
                  <span className="text-[11px] tabular-nums text-[var(--m-gold)]" title="Renegotiated fee for the move">
                    <span className="line-through text-[var(--m-faint)] mr-1">{formatPrice(contractSalary(p, f.id, world))}</span>
                    {formatPrice(proposal.fees[p.id])}
                  </span>
                )}
              </div>
            ))}
            {s.cashLakhs > 0 && <div className="text-xs text-[var(--m-gold)] mt-1">+ {formatPrice(s.cashLakhs)} cash</div>}
          </div>
        );
      })}
    </div>
  );
}

function FinderTab({
  world,
  onLoad,
  salaryOf,
  valueOf,
}: {
  world: ReturnType<typeof buildTradeWorld>;
  onLoad: (p: TradeProposal) => void;
  salaryOf: (p: Player, fid: string) => number;
  valueOf: (p: Player, fid: string) => number;
}) {
  const me = world.franchises.find((f) => f.id === world.humanFranchiseId)!;
  const [offered, setOffered] = useState<string[]>([]);
  const [franchiseId, setFranchiseId] = useState('');
  const [role, setRole] = useState<'' | Player['role']>('');
  const [maxAge, setMaxAge] = useState(0);
  const [minOvr, setMinOvr] = useState(0);
  const [maxSalary, setMaxSalary] = useState(0);
  const [difficulty, setDifficulty] = useState(0.35);
  const [results, setResults] = useState<FinderResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      setResults(
        findTrades(world, offered, {
          franchiseId: franchiseId || undefined,
          role: role || undefined,
          maxAge: maxAge || undefined,
          minOverall: minOvr || undefined,
          maxSalaryLakhs: maxSalary ? maxSalary * 100 : undefined,
          minProbability: difficulty,
        })
      );
      setBusy(false);
    }, 20);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] lg:divide-x divide-[var(--m-line)]">
      <div className="p-3 space-y-3">
        <div className="m-label">1 · Players you would move</div>
        <ul className="max-h-[300px] overflow-y-auto m-scroll border border-[var(--m-line)] rounded-[2px]">
          {[...me.players]
            .sort((a, b) => b.ratings.overall - a.ratings.overall)
            .map((p) => {
              const sel = offered.includes(p.id);
              const blocked = world.trade.humanBlock[p.id] === 'Untouchable';
              return (
                <li key={p.id}>
                  <label className={`flex items-center gap-2 px-2 py-1.5 border-b border-[var(--m-line)] ${blocked ? 'opacity-40' : 'cursor-pointer hover:bg-ink/[0.03]'}`}>
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={sel}
                      onChange={() => setOffered(sel ? offered.filter((x) => x !== p.id) : offered.length < world.trade.rules.maxPlayersPerSide ? [...offered, p.id] : offered)}
                      className="accent-white"
                    />
                    <OvrBadge ovr={p.ratings.overall} size="sm" />
                    <span className="flex-1 truncate text-sm">{p.name}</span>
                    <span className="text-xs tabular-nums text-[var(--m-dim)]">{formatPrice(salaryOf(p, me.id))}</span>
                  </label>
                </li>
              );
            })}
        </ul>
        <div className="m-label">2 · What you want back</div>
        <div className="grid grid-cols-2 gap-2">
          <select className="m-input" value={franchiseId} onChange={(e) => setFranchiseId(e.target.value)} aria-label="Franchise">
            <option value="">Any franchise</option>
            {world.franchises.filter((f) => f.id !== me.id).map((f) => <option key={f.id} value={f.id}>{f.shortName}</option>)}
          </select>
          <select className="m-input" value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Role">
            <option value="">Any role</option>
            <option value="Batter">Batter</option>
            <option value="Wicketkeeper">Wicketkeeper</option>
            <option value="All-Rounder">All-rounder</option>
            <option value="Bowler">Bowler</option>
          </select>
          <input className="m-input" type="number" placeholder="Max age" value={maxAge || ''} onChange={(e) => setMaxAge(Number(e.target.value))} aria-label="Max age" />
          <input className="m-input" type="number" placeholder="Min OVR" value={minOvr || ''} onChange={(e) => setMinOvr(Number(e.target.value))} aria-label="Minimum rating" />
          <input className="m-input" type="number" placeholder="Max salary ₹Cr" value={maxSalary || ''} onChange={(e) => setMaxSalary(Number(e.target.value))} aria-label="Maximum salary in crore" />
          <select className="m-input" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} aria-label="Trade difficulty">
            <option value={0.25}>Long shots too</option>
            <option value={0.35}>Realistic</option>
            <option value={0.6}>Likely only</option>
          </select>
        </div>
        <MButton variant="primary" className="w-full" onClick={run} disabled={!offered.length || busy}>
          <Sparkles className="w-4 h-4" /> {busy ? 'Scanning 9 front offices…' : 'Find trades'}
        </MButton>
      </div>
      <div className="p-3">
        {!results ? (
          <Empty title="Trade Finder" hint="Pick up to 3 players and the finder searches every CPU roster for packages they would plausibly accept." />
        ) : results.length === 0 ? (
          <Empty title="No viable packages" hint="Try different players, loosen the filters, or add cap room." />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {results.map((r) => {
              const partner = world.franchises.find((f) => f.id === r.partnerId)!;
              const getPs = partner.players.filter((p) => r.proposal.sides[1].playerIds.includes(p.id));
              return (
                <li key={r.proposal.id} className="border border-[var(--m-line)] rounded-[3px] p-3" style={teamVars(partner.id)}>
                  <div className="flex items-center gap-2">
                    <TeamCrest franchiseId={partner.id} size="sm" />
                    <span className="font-display font-extrabold uppercase flex-1">{partner.shortName}</span>
                    <span className="font-display font-bold uppercase text-sm" style={{ color: INTEREST_COLOR[r.interest] }}>{r.interest}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {getPs.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <OvrBadge ovr={p.ratings.overall} size="sm" />
                        <span className="flex-1 truncate font-display font-bold uppercase">{p.name}</span>
                        <RoleTag role={p.role} />
                        <span className="text-xs tabular-nums text-[var(--m-dim)]">{formatPrice(salaryOf(p, partner.id))} · TV {Math.round(valueOf(p, partner.id))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-[var(--m-faint)]">
                    <span>
                      {r.proposal.sides[0].cashLakhs > 0 && `You add ${formatPrice(r.proposal.sides[0].cashLakhs)} · `}
                      {r.proposal.sides[1].cashLakhs > 0 && `They add ${formatPrice(r.proposal.sides[1].cashLakhs)} · `}
                      Your strength {r.userGain >= 0 ? '+' : ''}{(r.userGain / 10).toFixed(1)}
                    </span>
                    <MButton size="sm" onClick={() => onLoad(r.proposal)}>Open in builder</MButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function OffersTab({
  offers,
  world,
  onAccept,
  onReject,
  onCounter,
  onScout,
}: {
  offers: TradeProposal[];
  world: ReturnType<typeof buildTradeWorld>;
  onAccept: (p: TradeProposal) => void;
  onReject: (p: TradeProposal) => void;
  onCounter: (p: TradeProposal) => void;
  onScout: (p: Player) => void;
}) {
  if (!offers.length) return <Empty title="No open offers" hint="CPU franchises send offers as the market moves — check back after the next phase or market day." />;
  return (
    <ul className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
      {offers.map((p) => {
        const other = p.sides.find((s) => s.franchiseId !== world.humanFranchiseId)!;
        const v = validateTrade(p, { ...world, trade: { ...world.trade, proposals: world.trade.proposals.filter((x) => x.id !== p.id) } });
        const mineIdx = p.sides[0].franchiseId === world.humanFranchiseId ? 0 : 1;
        const before = v.before[mineIdx];
        const after = v.after[mineIdx];
        return (
          <li key={p.id} className="border border-[var(--m-line)] rounded-[3px] overflow-hidden" style={teamVars(other.franchiseId)}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--team-primary) 16%, transparent), transparent 70%)' }}>
              <TeamCrest franchiseId={other.franchiseId} size="sm" />
              <span className="font-display font-extrabold uppercase flex-1">{getTeamTheme(other.franchiseId).name}</span>
              <span className="m-chip">{p.status === 'ACCEPTED' ? 'Agreed — confirm' : p.parentId ? 'Counteroffer' : 'New offer'}</span>
            </div>
            <div className="p-3">
              {p.messages.map((m, i) => <p key={i} className="text-sm text-[var(--m-dim)] italic">“{m}”</p>)}
              <ProposalSummary proposal={p} world={world} />
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-[var(--m-dim)]">
                  Your XI OVR {before.bestXiOvr} → {after.bestXiOvr} · strength {(after.strength - before.strength) >= 0 ? '+' : ''}{(after.strength - before.strength).toFixed(1)}
                </span>
                {!v.valid && <span className="text-[var(--m-red)]">{v.issues[0]?.message}</span>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <MButton size="sm" variant="go" onClick={() => onAccept(p)} disabled={!v.valid}><Check className="w-3.5 h-3.5" /> Accept</MButton>
                <MButton size="sm" onClick={() => onCounter(p)}><MessageSquare className="w-3.5 h-3.5" /> Counter</MButton>
                <MButton size="sm" variant="danger" onClick={() => onReject(p)}><X className="w-3.5 h-3.5" /> {p.status === 'ACCEPTED' ? 'Withdraw' : 'Reject'}</MButton>
                {world.franchises.find((f) => f.id === other.franchiseId)?.players.filter((x) => other.playerIds.includes(x.id)).map((x) => (
                  <MButton key={x.id} size="sm" variant="ghost" onClick={() => onScout(x)}>Inspect {x.name.split(' ').slice(-1)[0]}</MButton>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BlockTab({
  world,
  onSet,
  onTarget,
}: {
  world: ReturnType<typeof buildTradeWorld>;
  onSet: (id: string, s: TradeBlockStatus | null) => void;
  onTarget: (fid: string, pid: string) => void;
}) {
  const me = world.franchises.find((f) => f.id === world.humanFranchiseId)!;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 xl:divide-x divide-[var(--m-line)]">
      <div className="p-3">
        <div className="m-label mb-2">Your trade block</div>
        <p className="text-xs text-[var(--m-faint)] mb-2">Untouchable players are never requested by CPUs. Shopping and Available players attract offers — listing never guarantees a deal.</p>
        <ul className="divide-y divide-[var(--m-line)] border border-[var(--m-line)] rounded-[2px]">
          {[...me.players].sort((a, b) => b.ratings.overall - a.ratings.overall).map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-2 py-1.5">
              <OvrBadge ovr={p.ratings.overall} size="sm" />
              <span className="flex-1 truncate text-sm font-display font-bold uppercase">{p.name}</span>
              <RoleTag role={p.role} />
              <select
                className="m-input !w-[150px] !py-1 !text-xs"
                value={world.trade.humanBlock[p.id] || ''}
                onChange={(e) => onSet(p.id, (e.target.value || null) as TradeBlockStatus | null)}
                aria-label={`Trade block status for ${p.name}`}
                style={{ color: world.trade.humanBlock[p.id] ? BLOCK_META[world.trade.humanBlock[p.id]].color : undefined }}
              >
                <option value="">Not listed</option>
                {(Object.keys(BLOCK_META) as TradeBlockStatus[]).map((s) => <option key={s} value={s}>{BLOCK_META[s].label}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-3">
        {Object.values(world.trade.tradeRequests || {}).length > 0 && (
          <div className="mb-3 border border-[var(--m-gold)]/40 bg-[var(--m-gold)]/[0.05] rounded-[3px] p-2">
            <div className="m-label mb-1.5 !text-[var(--m-gold)]">Trade requests this season</div>
            <ul className="space-y-1">
              {Object.values(world.trade.tradeRequests || {}).map((req) => {
                const f = world.franchises.find((x) => x.players.some((p) => p.id === req.playerId));
                const pl = f?.players.find((p) => p.id === req.playerId);
                if (!f || !pl) return null;
                return (
                  <li key={req.playerId} className="flex items-center gap-2">
                    <TeamCrest franchiseId={f.id} size="xs" />
                    <OvrBadge ovr={pl.ratings.overall} size="sm" />
                    <span className="text-sm font-semibold truncate">{pl.name}</span>
                    <span className="text-[11px] text-[var(--m-faint)] flex-1 truncate">{req.reason}</span>
                    {f.id !== me.id && <MButton size="sm" variant="ghost" onClick={() => onTarget(f.id, pl.id)}>Build trade</MButton>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="m-label mb-2">Around the league</div>
        <div className="space-y-2 max-h-[720px] overflow-y-auto m-scroll">
          {world.franchises.filter((f) => f.id !== me.id).map((f) => {
            const block = cpuTradeBlock(f, world);
            return (
              <div key={f.id} className="border border-[var(--m-line)] rounded-[2px]" style={teamVars(f.id)}>
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--m-line)]">
                  <TeamCrest franchiseId={f.id} size="xs" />
                  <span className="font-display font-extrabold uppercase text-sm flex-1">{f.shortName}</span>
                  <span className="m-chip">{block.length} listed</span>
                </div>
                {block.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-[var(--m-faint)]">Not shopping anyone right now.</div>
                ) : (
                  <ul>
                    {block.slice(0, 5).map((b) => (
                      <li key={b.player.id} className="flex items-center gap-2 px-2 py-1">
                        <OvrBadge ovr={b.player.ratings.overall} size="sm" />
                        <span className="flex-1 truncate text-sm">{b.player.name}</span>
                        <span className="text-[11px] text-[var(--m-faint)] hidden sm:inline">{b.reason}</span>
                        <MButton size="sm" variant="ghost" onClick={() => onTarget(f.id, b.player.id)}>Build trade</MButton>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ world }: { world: ReturnType<typeof buildTradeWorld> }) {
  const seasons = Array.from(new Set(world.trade.history.map((h) => h.season))).sort((a, b) => b - a);
  const [season, setSeason] = useState<number | 'all'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const rows = world.trade.history.filter((h) => (season === 'all' || h.season === season) && (!mineOnly || h.franchiseIds.includes(world.humanFranchiseId)));
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <select className="m-input !w-auto" value={String(season)} onChange={(e) => setSeason(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Season">
          <option value="all">All seasons</option>
          {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-xs text-[var(--m-dim)] flex items-center gap-1.5"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-white" /> My trades only</label>
        <span className="m-chip ml-auto">{rows.length} trades</span>
      </div>
      {rows.length === 0 ? (
        <Empty title="No trades yet" hint="Every completed trade — yours and CPU↔CPU — is recorded here permanently." />
      ) : (
        <div className="overflow-x-auto m-scroll">
          <table className="m-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Teams</th>
                <th>Players</th>
                <th className="text-right">Cash</th>
                <th className="text-right">XI OVR (before → after)</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">{h.season} <span className="text-[var(--m-faint)] text-xs">{h.phase}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <TeamCrest franchiseId={h.franchiseIds[0]} size="xs" />
                      <ArrowLeftRight className="w-3 h-3 text-[var(--m-faint)]" />
                      <TeamCrest franchiseId={h.franchiseIds[1]} size="xs" />
                      {h.isCpuToCpu && <span className="m-chip ml-1">CPU</span>}
                    </div>
                  </td>
                  <td>
                    {h.players.map((p) => (
                      <div key={p.playerId} className="text-sm whitespace-nowrap">
                        <b className="font-display uppercase">{p.playerName}</b>{' '}
                        <span className="text-[var(--m-faint)] text-xs">
                          {getTeamTheme(p.fromFranchiseId).abbreviation} → {getTeamTheme(p.toFranchiseId).abbreviation} · {p.previousSalaryLakhs ? `${formatPrice(p.previousSalaryLakhs)} → ` : ''}{formatPrice(p.salaryLakhs)} · {p.overall}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="text-right whitespace-nowrap">{h.cash ? `${formatPrice(h.cash.amountLakhs)} ${getTeamTheme(h.cash.fromFranchiseId).abbreviation}→${getTeamTheme(h.cash.toFranchiseId).abbreviation}` : '—'}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {getTeamTheme(h.franchiseIds[0]).abbreviation} {h.preSquad[0].bestXiOvr}→{h.postSquad[0].bestXiOvr} · {getTeamTheme(h.franchiseIds[1]).abbreviation} {h.preSquad[1].bestXiOvr}→{h.postSquad[1].bestXiOvr}
                  </td>
                  <td className="text-[10px] text-[var(--m-faint)] font-num">{h.id.slice(-8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const MODE_DESC: Record<SalaryMatchingMode, string> = {
  Exact: 'Both sides must send exactly equal contract totals.',
  Tolerance: 'Contract totals may differ by a set percentage or amount.',
  CashBalanced: 'Contract gaps must be covered by a separate balancing cash payment.',
  OfficialIPL: 'IPL-style: no salary matching — the gap is absorbed by each purse. Player consent and one move per season apply.',
};

function RulesTab({ rules, onChange, world, locked }: { rules: TradeRules; onChange: (r: TradeRules) => void; world: ReturnType<typeof buildTradeWorld>; locked: boolean }) {
  const set = (patch: Partial<TradeRules>) => onChange({ ...rules, ...patch });
  const total = Object.values(world.trade.settlement).reduce((a, b) => a + b, 0);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] xl:divide-x divide-[var(--m-line)]">
      <div className="p-3 space-y-3">
        {locked && <div className="text-xs text-[var(--m-gold)]">You have traded this season — rule changes apply to future deals only.</div>}
        <div className="m-label">Salary matching</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.keys(RULE_PRESETS) as SalaryMatchingMode[]).map((m) => (
            <button
              key={m}
              data-active={rules.matchingMode === m}
              onClick={() => onChange({ ...RULE_PRESETS[m], windowPhases: rules.windowPhases })}
              className="m-tile p-3"
              aria-pressed={rules.matchingMode === m}
            >
              <div className="m-display text-lg italic">{MATCHING_MODE_LABEL[m]}</div>
              <div className="text-xs text-[var(--m-dim)] mt-1">{MODE_DESC[m]}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumberField label="Tolerance (%)" value={Math.round(rules.tolerancePct * 100)} onChange={(v) => set({ tolerancePct: v / 100 })} disabled={rules.matchingMode === 'Exact' || rules.matchingMode === 'OfficialIPL'} />
          <NumberField label="Tolerance (₹ L)" value={rules.toleranceFixedLakhs} onChange={(v) => set({ toleranceFixedLakhs: v })} disabled={rules.matchingMode === 'Exact' || rules.matchingMode === 'OfficialIPL'} />
          <NumberField label="Max cash / trade (₹ L)" value={rules.maxCashPerTradeLakhs} onChange={(v) => set({ maxCashPerTradeLakhs: v })} />
          <NumberField label="Max players per side" value={rules.maxPlayersPerSide} onChange={(v) => set({ maxPlayersPerSide: Math.max(1, Math.min(5, v)) })} />
          <NumberField label="Max players per trade" value={rules.maxPlayersTotal} onChange={(v) => set({ maxPlayersTotal: Math.max(2, Math.min(8, v)) })} />
          <NumberField label="Trades per player / season" value={rules.maxTradesPerPlayerPerSeason} onChange={(v) => set({ maxTradesPerPlayerPerSeason: Math.max(1, v) })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label>
            <span className="m-label !text-[0.6rem]">Cash comes from</span>
            <select className="m-input" value={rules.cashSource} onChange={(e) => set({ cashSource: e.target.value as TradeRules['cashSource'] })}>
              <option value="SettlementAccount">Trade settlement account</option>
              <option value="AuctionPurse">Auction purse (custom)</option>
            </select>
          </label>
          <label>
            <span className="m-label !text-[0.6rem]">18-player minimum</span>
            <select className="m-input" value={rules.squadMinimumPolicy} onChange={(e) => set({ squadMinimumPolicy: e.target.value as TradeRules['squadMinimumPolicy'] })}>
              <option value="ByPhase">Only once squads are complete</option>
              <option value="Always">Always</option>
              <option value="Never">Never (sandbox)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 mt-5 text-sm">
            <input type="checkbox" checked={rules.requirePlayerConsent} onChange={(e) => set({ requirePlayerConsent: e.target.checked })} className="accent-white" />
            Require player consent
          </label>
        </div>
        <p className="text-[11px] text-[var(--m-faint)]">
          Trade window: open in the offseason and pre-auction phases, frozen from the final auction list until the auction ends, open again until the first league match. No calendar dates are assumed for future seasons.
        </p>
      </div>
      <div className="p-3">
        <div className="m-label mb-2">Trade cash accounts · league total {formatPrice(total)}</div>
        <ul className="divide-y divide-[var(--m-line)] border border-[var(--m-line)] rounded-[2px]">
          {world.franchises.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-2 py-1.5">
              <TeamCrest franchiseId={f.id} size="xs" />
              <span className="flex-1 text-sm">{f.shortName}</span>
              <span className="font-display font-bold tabular-nums">{formatPrice(world.trade.settlement[f.id] ?? 0)}</span>
            </li>
          ))}
        </ul>
        <div className="m-label mt-3 mb-1">Ledger</div>
        {world.trade.ledger.length === 0 ? (
          <div className="text-xs text-[var(--m-faint)]">No cash has changed hands.</div>
        ) : (
          <ul className="text-xs space-y-1 max-h-[220px] overflow-y-auto m-scroll">
            {[...world.trade.ledger].reverse().map((l) => (
              <li key={l.id} className="flex justify-between">
                <span>{l.season} · {getTeamTheme(l.fromFranchiseId).abbreviation} → {getTeamTheme(l.toFranchiseId).abbreviation}</span>
                <span className="tabular-nums">{formatPrice(l.amountLakhs)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label>
      <span className="m-label !text-[0.6rem]">{label}</span>
      <input type="number" className="m-input" value={value} disabled={disabled} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </label>
  );
}

function ConfirmModal({
  proposalId,
  world,
  onCancel,
  onConfirm,
}: {
  proposalId: string;
  world: ReturnType<typeof buildTradeWorld>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const p = world.trade.proposals.find((x) => x.id === proposalId);
  if (!p) return null;
  const v = validateTrade(p, { ...world, trade: { ...world.trade, proposals: world.trade.proposals.filter((x) => x.id !== p.id) } });
  const fin = v.financials;
  return (
    <Modal open onClose={onCancel} width="max-w-3xl" labelledBy="trade-confirm-title">
      <div className="m-panel-head !py-3">
        <h2 id="trade-confirm-title" className="m-display text-2xl italic">Confirm trade</h2>
        <button className="m-btn m-btn-ghost m-btn-sm" onClick={onCancel} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 overflow-y-auto m-scroll space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {p.sides.map((s, i) => {
            const f = world.franchises.find((x) => x.id === s.franchiseId)!;
            const other = p.sides[i === 0 ? 1 : 0];
            const otherF = world.franchises.find((x) => x.id === other.franchiseId)!;
            const outPs = f.players.filter((x) => s.playerIds.includes(x.id));
            const inPs = otherF.players.filter((x) => other.playerIds.includes(x.id));
            return (
              <div key={f.id} className="border border-[var(--m-line)] rounded-[3px] p-3" style={teamVars(f.id)}>
                <div className="flex items-center gap-2 mb-2">
                  <TeamCrest franchiseId={f.id} size="sm" />
                  <span className="font-display font-extrabold uppercase">{f.name}</span>
                </div>
                <div className="m-label !text-[0.58rem]">Sends</div>
                {outPs.map((x) => <div key={x.id} className="text-sm flex justify-between"><span>{x.name}</span><span className="tabular-nums">{formatPrice(contractSalary(x, f.id, world))}</span></div>)}
                <div className="m-label !text-[0.58rem] mt-2">Receives</div>
                {inPs.map((x) => {
                  const cur = contractSalary(x, otherF.id, world);
                  const fee = p.fees?.[x.id];
                  return (
                    <div key={x.id} className="text-sm flex justify-between">
                      <span>{x.name}</span>
                      <span className="tabular-nums">
                        {fee !== undefined && fee !== cur && <span className="line-through text-[var(--m-faint)] mr-1.5">{formatPrice(cur)}</span>}
                        {formatPrice(fee ?? cur)}
                      </span>
                    </div>
                  );
                })}
                <dl className="mt-2 pt-2 border-t border-[var(--m-line)] text-xs space-y-0.5">
                  <div className="flex justify-between"><dt className="text-[var(--m-dim)]">Salary freed / taken on</dt><dd className="tabular-nums">{formatPrice(fin.outgoingSalary[i])} / {formatPrice(fin.incomingSalary[i])}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--m-dim)]">Cash paid</dt><dd className="tabular-nums">{formatPrice(s.cashLakhs)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--m-dim)]">Salary commitments after</dt><dd className="tabular-nums">{formatPrice(fin.commitmentAfter[i])}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--m-dim)]">Purse after</dt><dd className="tabular-nums">{formatPrice(fin.purseAfter[i])}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--m-dim)]">Trade cash after</dt><dd className="tabular-nums">{formatPrice(fin.settlementAfter[i])}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--m-dim)]">Squad · overseas</dt><dd className="tabular-nums">{v.before[i].size}→{v.after[i].size} · {v.before[i].overseas}→{v.after[i].overseas}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--m-dim)]">Best XI OVR</dt><dd className="tabular-nums">{v.before[i].bestXiOvr} → {v.after[i].bestXiOvr}</dd></div>
                </dl>
              </div>
            );
          })}
        </div>
        {!v.valid && (
          <div className="text-sm text-[var(--m-red)] flex gap-2"><AlertTriangle className="w-4 h-4" /> {v.issues.map((i) => i.message).join(' ')}</div>
        )}
        <p className="text-[11px] text-[var(--m-faint)]">The trade is applied as one transaction: rosters, contracts, purses and cash all update together, or nothing changes.</p>
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--m-line)]">
        <MButton variant="ghost" onClick={onCancel}>Not yet</MButton>
        <MButton variant="go" onClick={onConfirm} disabled={!v.valid}><Check className="w-4 h-4" /> Confirm trade</MButton>
      </div>
    </Modal>
  );
}
