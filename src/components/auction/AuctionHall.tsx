'use client';

// ============================================================
// IPL DYNASTY — Auction floor (draft-night style)
// Live lot, bidding controls, franchise board and a live squads
// panel for every team that updates after each hammer.
// ============================================================

import { prospectLabel, showDevelopmentNote } from '@/lib/engines/career/prospect-label';
import { tierLabel } from '@/lib/engines/squad-tiers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { auctionTypeFor } from '@/lib/flow/season-flow';
import { iplPedigree } from '@/lib/engines/auction/market-value';
import { getMinimumBid, validateBid } from '@/lib/engines/auction-engine';
import {
  humanBid,
  isAuctionFinished,
  isLotOpen,
  resolveCurrentLot,
  simulateLots,
  simulateRemainingAuction,
  stepAuction,
} from '@/lib/engines/auction/auction-runner';
import { formatPrice } from '@/lib/utils';
import { Gavel, Play, Pause, Users, Brain, ChevronRight, FastForward, SkipForward, Star, Maximize2, X } from 'lucide-react';
import type { AuctionSession, Player } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { CpuDecisionInspectorModal } from './CpuDecisionInspectorModal';
import {
  MButton,
  Modal,
  OvrBadge,
  OverseasTag,
  Panel,
  RatingBar,
  RoleTag,
  TeamCrest,
  teamVars,
} from '@/components/mynba/primitives';
import { SquadsViewer } from '@/components/mynba/SquadsViewer';

const PACE_MS = { Normal: 1300, Fast: 700, Instant: 300 } as const;

export function AuctionHall() {
  const {
    auctionSession: session,
    setAuctionSession,
    humanFranchiseId,
    retentionDecisions,
    franchiseShortlists,
    setPhase,
    completeAuction,
    currentSeason,
    settings,
  } = useGameStore();
  const windowType = auctionTypeFor(currentSeason, settings);

  const [message, setMessage] = useState('The auctioneer takes the stage. Open the first lot when you are ready.');
  const [autoRun, setAutoRun] = useState(false);
  const [pauseOnTargets, setPauseOnTargets] = useState(true);
  const [lastBidder, setLastBidder] = useState<string | null>(null);
  const [squadTeam, setSquadTeam] = useState<string>(humanFranchiseId);
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [scouting, setScouting] = useState<Player | null>(null);
  const [inspector, setInspector] = useState(false);
  const [lastSoldId, setLastSoldId] = useState<string | null>(null);
  const [confirmSimAll, setConfirmSimAll] = useState(false);

  const shortlist = useMemo(() => franchiseShortlists[humanFranchiseId]?.entries || {}, [franchiseShortlists, humanFranchiseId]);
  const shortlistRef = useRef(shortlist);
  const pauseRef = useRef(pauseOnTargets);
  useEffect(() => {
    shortlistRef.current = shortlist;
    pauseRef.current = pauseOnTargets;
  }, [shortlist, pauseOnTargets]);

  /** Commit a new session and surface what happened. */
  const commit = useCallback(
    (next: AuctionSession, msg: string, bidder: string | null, prev?: AuctionSession | null) => {
      setAuctionSession(next);
      if (msg) setMessage(msg);
      setLastBidder(bidder);
      if (next.soldPlayers.length > (prev?.soldPlayers.length ?? next.soldPlayers.length)) {
        const sale = next.soldPlayers[next.soldPlayers.length - 1];
        setLastSoldId(sale.playerId);
        // Follow the action: show the buying team's squad unless you're viewing your own.
        setSquadTeam((cur) => (cur === humanFranchiseId ? cur : sale.franchiseId));
      }
    },
    [setAuctionSession, humanFranchiseId]
  );

  // Auto-run loop
  useEffect(() => {
    if (!autoRun || !session) return;
    const id = setInterval(() => {
      const cur = useGameStore.getState().auctionSession;
      if (!cur || isAuctionFinished(cur)) {
        setAutoRun(false);
        return;
      }
      const wasOpen = isLotOpen(cur);
      const r = stepAuction(cur, humanFranchiseId);
      commit(r.session, r.message, r.lastBidderId, cur);
      // A new lot was just opened: pause if it's one of your targets.
      if (!wasOpen && r.session.currentLot && pauseRef.current && shortlistRef.current[r.session.currentLot.player.id]) {
        setAutoRun(false);
        setMessage(`★ Shortlist target up: ${r.session.currentLot.player.name}. Auto-run paused — your call.`);
      }
    }, PACE_MS[session.pace] ?? 1300);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, session?.pace, humanFranchiseId, commit]);

  const lot = session?.currentLot ?? null;
  const live = session ? session.franchises : [];
  const human = live.find((f) => f.id === humanFranchiseId);
  const open = !!session && isLotOpen(session);
  const finished = !!session && isAuctionFinished(session);
  const minBid = session && open ? getMinimumBid(session) : 0;
  const bidCheck = session && open && lot?.currentBidderId !== humanFranchiseId ? validateBid(session, humanFranchiseId, minBid) : null;
  const canBid = !!bidCheck?.success;
  const youLead = lot?.currentBidderId === humanFranchiseId;
  const leader = lot?.currentBidderId ? live.find((f) => f.id === lot.currentBidderId) : null;

  const doStep = useCallback(() => {
    const cur = useGameStore.getState().auctionSession;
    if (!cur) return;
    const r = stepAuction(cur, humanFranchiseId);
    commit(r.session, r.message, r.lastBidderId, cur);
  }, [commit, humanFranchiseId]);

  const doBid = useCallback(() => {
    const cur = useGameStore.getState().auctionSession;
    if (!cur || !isLotOpen(cur)) return;
    const r = humanBid(cur, humanFranchiseId);
    if (r.ok) commit(r.session, r.message, humanFranchiseId, cur);
    else setMessage(r.message);
  }, [commit, humanFranchiseId]);

  const doResolveLot = useCallback(() => {
    const cur = useGameStore.getState().auctionSession;
    if (!cur) return;
    const r = resolveCurrentLot(cur, humanFranchiseId);
    commit(r.session, r.message, null, cur);
  }, [commit, humanFranchiseId]);

  const doSimLots = (n: number) => {
    if (!session) return;
    setAutoRun(false);
    const r = simulateLots(session, humanFranchiseId, n);
    commit(r.session, r.message, null, session);
  };

  const doSimAll = () => {
    if (!session) return;
    setAutoRun(false);
    setConfirmSimAll(false);
    const r = simulateRemainingAuction(session, humanFranchiseId);
    commit(r.session, r.message, null, session);
  };

  const finish = () => {
    completeAuction();
    setPhase('SquadManagement');
  };

  // Keyboard shortcuts (B = bid, P = pass/hammer, N = next lot, Space = auto-run)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || squadsOpen || scouting || inspector) return;
      const cur = useGameStore.getState().auctionSession;
      if (!cur || isAuctionFinished(cur)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') doBid();
      else if (k === 'p' && isLotOpen(cur)) doStep();
      else if (k === 'n' && !isLotOpen(cur)) doStep();
      else if (e.code === 'Space') {
        e.preventDefault();
        setAutoRun((a) => !a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doBid, doStep, squadsOpen, scouting, inspector]);

  const upcoming = useMemo(() => {
    if (!session) return [];
    return session.playerPool.slice(session.currentPlayerIndex + 1, session.currentPlayerIndex + 7);
  }, [session]);

  const recentSales = useMemo(() => (session ? [...session.soldPlayers].slice(-12).reverse() : []), [session]);

  if (!session) {
    return <div className="p-12 text-center m-label">Preparing the auction floor…</div>;
  }

  const processed = session.soldPlayers.length + session.unsoldPlayers.length;
  const progressPct = session.playerPool.length ? Math.min(100, Math.round(((session.currentPlayerIndex + 1) / session.playerPool.length) * 100)) : 0;
  const totalSpent = session.soldPlayers.reduce((s, p) => s + p.price, 0);
  const p = lot?.player;

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 space-y-3">
      {/* Control bar */}
      <div className="m-panel px-3 py-2.5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 bg-ink text-[var(--m-bg)] flex items-center justify-center rounded-[2px]"><Gavel className="w-5 h-5" /></span>
          <div className="min-w-0">
            <div className="m-display text-[1.6rem] leading-none">
              {windowType} auction {session.round > 1 && <span className="text-[var(--m-gold)]">· Accelerated round {session.round}</span>}
            </div>
            <div className="text-[11px] text-[var(--m-faint)] mt-1 truncate">
              {finished
                ? 'Hammer down'
                : `${lot?.auctionSetName ? `${lot.auctionSetCode} · ${lot.auctionSetName}` : 'Opening set'} · Lot ${Math.min(session.playerPool.length, Math.max(1, session.currentPlayerIndex + 1))} of ${session.playerPool.length}`}{' '}
              · {session.soldPlayers.length} sold · {formatPrice(totalSpent)} spent
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[120px] max-w-[280px] hidden md:block">
          <div className="m-meter"><span style={{ width: `${progressPct}%`, background: '#fff' }} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {!finished && (
            <>
              <MButton variant={autoRun ? 'danger' : 'default'} size="sm" onClick={() => setAutoRun(!autoRun)} title="Space">
                {autoRun ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {autoRun ? 'Pause' : 'Auto-run'}
              </MButton>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--m-dim)] px-1 cursor-pointer">
                <input type="checkbox" checked={pauseOnTargets} onChange={(e) => setPauseOnTargets(e.target.checked)} className="accent-white" />
                Pause on my targets
              </label>
              <MButton size="sm" onClick={() => doSimLots(5)} disabled={autoRun}><FastForward className="w-3.5 h-3.5" /> Sim 5</MButton>
              <MButton size="sm" onClick={() => setConfirmSimAll(true)} disabled={autoRun}><SkipForward className="w-3.5 h-3.5" /> Sim rest</MButton>
            </>
          )}
          <MButton size="sm" variant="ghost" onClick={() => setInspector(true)}><Brain className="w-3.5 h-3.5" /> CPU logic</MButton>
          <MButton size="sm" onClick={() => setSquadsOpen(true)}><Users className="w-3.5 h-3.5" /> All squads</MButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_380px] gap-3 items-start">
        {/* Franchise board */}
        <Panel title="Franchise board" right={<span className="m-chip">Purse · Squad</span>} bodyClassName="p-1.5" className="order-2 lg:order-1">
          <ul className="space-y-1">
            {[...live]
              .sort((a, b) => (a.id === humanFranchiseId ? -1 : b.id === humanFranchiseId ? 1 : b.remainingPurse - a.remainingPurse))
              .map((f) => {
                const isLeader = lot?.currentBidderId === f.id && open;
                const justBid = lastBidder === f.id;
                const os = f.players.filter((x) => x.nationality === 'Overseas').length;
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => {
                        setSquadTeam(f.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1280) setSquadsOpen(true);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[2px] border text-left transition-colors ${
                        isLeader
                          ? 'border-[var(--m-green)] bg-[var(--m-green)]/10'
                          : squadTeam === f.id
                          ? 'border-ink/60 bg-ink/[0.05]'
                          : 'border-transparent hover:bg-ink/[0.04]'
                      } ${justBid ? 'm-bid-flash' : ''}`}
                      style={teamVars(f.id)}
                    >
                      <TeamCrest franchiseId={f.id} size="xs" />
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-extrabold uppercase text-[13px] leading-none truncate">
                          {f.shortName}
                          {f.id === humanFranchiseId && <span className="text-[var(--m-cyan)] ml-1">YOU</span>}
                        </div>
                        <div className="text-[10px] text-[var(--m-faint)] tabular-nums mt-0.5">
                          {f.players.length}/{f.maxSquadSize} · {os}/{f.maxOverseas} OS
                        </div>
                      </div>
                      <div className="text-right font-display font-extrabold text-[13px] tabular-nums text-[var(--m-green)]">
                        {formatPrice(f.remainingPurse)}
                      </div>
                    </button>
                  </li>
                );
              })}
          </ul>
        </Panel>

        {/* Centre stage */}
        <div className="space-y-3 order-1 lg:order-2 min-w-0">
          {finished ? (
            <AuctionComplete session={session} humanFranchiseId={humanFranchiseId} onFinish={finish} />
          ) : !lot ? (
            <div className="m-panel relative overflow-hidden p-10 text-center">
              <div className="absolute inset-0 m-slash" />
              <div className="relative">
                <div className="m-label">All 10 franchises are seated</div>
                <h2 className="m-display text-5xl italic mt-2">The floor is yours</h2>
                <p className="text-[var(--m-dim)] max-w-lg mx-auto mt-3 text-sm">
                  {session.playerPool.length} players across {session.sets?.length ?? 0} sets. Marquee players go first. Bid with <Kbd>B</Kbd>, drop the hammer with <Kbd>P</Kbd>, toggle auto-run with <Kbd>Space</Kbd>.
                </p>
                <MButton variant="primary" size="xl" className="mt-6" onClick={doStep}>
                  <Gavel className="w-5 h-5" /> Open lot 1
                </MButton>
              </div>
            </div>
          ) : (
            <div className="m-panel overflow-hidden">
              {/* Lot header */}
              <div className="m-panel-head">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="m-chip !text-ink !border-ink/40">{lot.auctionSetCode || 'SET'}</span>
                  <span className="font-display font-bold uppercase text-sm truncate">{lot.auctionSetName || 'Auction pool'}</span>
                  <span className="text-[11px] text-[var(--m-faint)] shrink-0">#{lot.playerOrderWithinSet || 1}/{lot.totalInSet || 1}</span>
                  {shortlist[lot.player.id] && <span className="m-chip !text-[var(--m-gold)] !border-[#f5c45166]"><Star className="w-3 h-3" /> Your target</span>}
                </div>
                <span className="text-xs text-[var(--m-dim)] shrink-0">Base <b className="text-[var(--m-gold)]">{formatPrice(lot.basePrice)}</b></span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]">
                {/* Player card */}
                <div className="relative p-5 overflow-hidden">
                  <div className="absolute inset-0 m-slash opacity-60 pointer-events-none" />
                  <div className="relative flex items-start gap-4">
                    <OvrBadge ovr={p!.ratings.overall} size="xl" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <RoleTag role={p!.role} />
                        {p!.nationality === 'Overseas' && <OverseasTag />}
                        <span className="m-chip">{p!.status}</span>
                        <span className="m-chip">Age {p!.age}</span>
                        <span className="m-chip" title="Where he fits in an IPL squad">{tierLabel(p!)}</span>
                        <PedigreeChip player={p!} season={currentSeason} />
                        {prospectLabel(p!) && <span className="m-chip">{prospectLabel(p!)}</span>}
                      </div>
                      <h2 className="m-display italic text-4xl sm:text-5xl leading-[0.9] break-words">{p!.name}</h2>
                      <div className="text-sm text-[var(--m-dim)] mt-1">
                        {p!.country} · {p!.battingHand}-hand bat{p!.bowlingStyle !== 'None' ? ` · ${p!.bowlingStyle}` : ''}
                      </div>
                      <div className="text-xs text-[var(--m-faint)] mt-1">{iplLine(p!)}</div>
                      {showDevelopmentNote(p!, currentSeason) && (
                        <div className="text-xs text-[var(--m-dim)] mt-0.5">{p!.development!.note}</div>
                      )}
                    </div>
                  </div>
                  <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 mt-5">
                    <RatingBar label="Batting" value={p!.ratings.batting} color="var(--m-cyan)" />
                    <RatingBar label="Bowling" value={p!.ratings.bowling} color="var(--m-green)" />
                    <RatingBar label="Power" value={p!.ratings.powerHitting} color="var(--m-red)" />
                    <RatingBar label="Fielding" value={p!.ratings.fielding} color="var(--m-purple)" />
                    <RatingBar label="Consistency" value={p!.ratings.consistency} color="var(--m-gold)" />
                    <RatingBar label="Potential" value={p!.ratings.potential} color="var(--m-ink)" />
                  </div>
                  <div className="relative mt-4 grid grid-cols-5 gap-1.5 text-center">
                    {[
                      ['M', p!.stats.matches],
                      ['Runs', p!.stats.runs],
                      ['SR', p!.stats.strikeRate ? p!.stats.strikeRate.toFixed(0) : '—'],
                      ['Wkts', p!.stats.wickets],
                      ['Econ', p!.stats.economyRate ? p!.stats.economyRate.toFixed(1) : '—'],
                    ].map(([k, v]) => (
                      <div key={k as string} className="bg-ink/5 border border-[var(--m-line)] rounded-[2px] py-1.5">
                        <div className="m-label !text-[0.55rem]">{k}</div>
                        <div className="font-display font-extrabold tabular-nums">{v}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setScouting(p!)} className="relative mt-3 text-xs text-[var(--m-cyan)] hover:underline">
                    Full scouting report →
                  </button>
                </div>

                {/* Bid box */}
                <div className="relative border-t md:border-t-0 md:border-l border-[var(--m-line)] p-4 flex flex-col" style={leader ? teamVars(leader.id) : undefined}>
                  {lot.state === 'Sold' && leader && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <span className="m-stamp m-display text-5xl px-4 py-1 border-4 border-[var(--m-green)] text-[var(--m-green)] bg-ink/40">Sold</span>
                    </div>
                  )}
                  {lot.state === 'Unsold' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <span className="m-stamp m-display text-5xl px-4 py-1 border-4 border-[var(--m-red)] text-[var(--m-red)] bg-ink/40">Unsold</span>
                    </div>
                  )}
                  <div className="m-label">{lot.state === 'Sold' ? 'Final price' : lot.bids.length ? 'Current bid' : 'Opening at base'}</div>
                  <div className={`m-display text-5xl tabular-nums mt-1 ${youLead ? 'text-[var(--m-cyan)]' : ''}`}>{formatPrice(lot.currentBid)}</div>
                  <div className="mt-2 min-h-[36px]">
                    {leader ? (
                      <div className="flex items-center gap-2">
                        <TeamCrest franchiseId={leader.id} size="sm" />
                        <div>
                          <div className="font-display font-extrabold uppercase leading-none">{leader.shortName}</div>
                          <div className="text-[10px] text-[var(--m-faint)]">{youLead ? 'You hold the bid' : 'Highest bidder'}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--m-faint)]">No bids yet</div>
                    )}
                  </div>

                  {/* Hammer */}
                  <div className="flex gap-1 mt-3" aria-label="Hammer count">
                    {['Once', 'Twice', 'Sold'].map((s, i) => (
                      <div
                        key={s}
                        className={`flex-1 text-center py-1 rounded-[2px] font-display font-extrabold uppercase text-[11px] tracking-wider ${
                          lot.finalCallCount > i || lot.state !== 'Active'
                            ? i === 2 ? 'bg-[var(--m-green)] text-white' : 'bg-[var(--m-gold)] text-white'
                            : 'bg-ink/[0.05] text-[var(--m-faint)]'
                        }`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-4 space-y-2">
                    {open ? (
                      <>
                        <MButton variant={youLead ? 'default' : 'go'} size="lg" className="w-full" onClick={doBid} disabled={!canBid || youLead}>
                          {youLead ? 'You lead' : `Bid ${formatPrice(minBid)}`} {!youLead && <Kbd dark>B</Kbd>}
                        </MButton>
                        {!canBid && !youLead && bidCheck && <div className="text-[11px] text-[var(--m-red)] leading-tight">{bidCheck.message}</div>}
                        <div className="grid grid-cols-2 gap-2">
                          <MButton size="sm" onClick={doStep} title="Let CPUs respond, or advance the hammer">
                            {youLead || lot.bids.length === 0 ? 'Hammer' : 'Pass'} <Kbd>P</Kbd>
                          </MButton>
                          <MButton size="sm" onClick={doResolveLot}>Sim lot</MButton>
                        </div>
                      </>
                    ) : (
                      <MButton variant="primary" size="lg" className="w-full" onClick={doStep}>
                        Next lot <ChevronRight className="w-4 h-4" /> <Kbd dark>N</Kbd>
                      </MButton>
                    )}
                  </div>
                </div>
              </div>

              {/* Auctioneer line + bid trail */}
              <div className="border-t border-[var(--m-line)] px-4 py-2.5 flex items-center gap-2 text-sm">
                <Gavel className="w-4 h-4 text-[var(--m-dim)] shrink-0" />
                <span className="truncate" aria-live="polite">{message}</span>
              </div>
              {lot.bids.length > 0 && (
                <div className="border-t border-[var(--m-line)] px-3 py-2 flex gap-1.5 overflow-x-auto m-scroll">
                  {[...lot.bids].reverse().map((b, i) => (
                    <span
                      key={lot.bids.length - i}
                      className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-[2px] border text-xs ${
                        b.franchiseId === humanFranchiseId ? 'border-[var(--m-cyan)]/60 bg-[var(--m-cyan)]/10' : 'border-[var(--m-line)]'
                      }`}
                    >
                      <span className="w-2 h-2" style={{ background: getTeamTheme(b.franchiseId).primary }} />
                      <span className="font-display font-bold uppercase">{getTeamTheme(b.franchiseId).abbreviation}</span>
                      <span className="tabular-nums text-[var(--m-dim)]">{formatPrice(b.amount)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Up next + recent sales */}
          {!finished && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Panel title="On deck" bodyClassName="p-0">
                <ul>
                  {upcoming.map((u) => (
                    <li key={u.id} className="flex items-center gap-2.5 px-3 py-1.5 border-b border-[var(--m-line)] last:border-0">
                      <OvrBadge ovr={u.ratings.overall} size="sm" />
                      <span className="flex-1 min-w-0 truncate font-display font-bold uppercase text-[14px]">
                        {shortlist[u.id] && <Star className="w-3 h-3 inline mr-1 text-[var(--m-gold)]" />}
                        {u.name}
                      </span>
                      <RoleTag role={u.role} />
                      <span className="text-xs tabular-nums text-[var(--m-dim)] w-14 text-right">{formatPrice(u.basePrice)}</span>
                    </li>
                  ))}
                  {upcoming.length === 0 && <li className="px-3 py-4 text-xs text-[var(--m-faint)]">End of this round.</li>}
                </ul>
              </Panel>
              <Panel title="Recent sales" bodyClassName="p-0">
                <ul className="max-h-[260px] overflow-y-auto m-scroll">
                  {recentSales.map((s) => (
                    <li key={s.playerId + s.timestamp} className="flex items-center gap-2.5 px-3 py-1.5 border-b border-[var(--m-line)] last:border-0">
                      <TeamCrest franchiseId={s.franchiseId} size="xs" />
                      <span className="flex-1 min-w-0 truncate text-sm">{s.playerName}</span>
                      <span className="font-display font-extrabold tabular-nums text-sm">{formatPrice(s.price)}</span>
                    </li>
                  ))}
                  {recentSales.length === 0 && <li className="px-3 py-4 text-xs text-[var(--m-faint)]">No sales yet.</li>}
                </ul>
              </Panel>
            </div>
          )}
        </div>

        {/* Live squads (xl+) */}
        <Panel
          title="Live squads"
          right={
            <button className="m-btn m-btn-ghost m-btn-sm" onClick={() => setSquadsOpen(true)} aria-label="Expand squads">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          }
          className="hidden xl:block order-3 xl:sticky xl:top-[84px]"
          bodyClassName="p-3 max-h-[calc(100vh-150px)] overflow-y-auto m-scroll"
        >
          <SquadsViewer
            compact
            franchises={live}
            humanFranchiseId={humanFranchiseId}
            retentionDecisions={retentionDecisions}
            selectedId={squadTeam}
            onSelect={setSquadTeam}
            highlightPlayerId={lastSoldId}
          />
        </Panel>
      </div>

      {/* Mobile "my squad" shortcut */}
      {human && (
        <button
          onClick={() => {
            setSquadTeam(humanFranchiseId);
            setSquadsOpen(true);
          }}
          className="xl:hidden fixed bottom-4 right-4 z-30 m-btn m-btn-primary shadow-xl"
        >
          <Users className="w-4 h-4" /> Squads · {human.players.length}/{human.maxSquadSize}
        </button>
      )}

      {/* Full squads modal */}
      <Modal open={squadsOpen} onClose={() => setSquadsOpen(false)} width="max-w-6xl" labelledBy="squads-title">
        <div className="m-panel-head !py-3">
          <h2 id="squads-title" className="m-display text-2xl italic">League squads · live</h2>
          <button className="m-btn m-btn-ghost m-btn-sm" onClick={() => setSquadsOpen(false)} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto m-scroll">
          <SquadsViewer
            franchises={live}
            humanFranchiseId={humanFranchiseId}
            retentionDecisions={retentionDecisions}
            selectedId={squadTeam}
            onSelect={setSquadTeam}
            highlightPlayerId={lastSoldId}
          />
        </div>
      </Modal>

      {/* Confirm sim rest */}
      <Modal open={confirmSimAll} onClose={() => setConfirmSimAll(false)} width="max-w-md">
        <div className="p-5">
          <h2 className="m-display text-2xl italic">Simulate the rest?</h2>
          <p className="text-sm text-[var(--m-dim)] mt-2">
            The remaining {Math.max(0, session.playerPool.length - session.currentPlayerIndex - 1)} lots (plus accelerated rounds) will be auctioned between the CPU teams — you won&apos;t bid. Any squad still under {human?.minSquadSize ?? 18} is topped up at base price.
          </p>
          <div className="flex justify-end gap-2 mt-5">
            <MButton variant="ghost" onClick={() => setConfirmSimAll(false)}>Cancel</MButton>
            <MButton variant="primary" onClick={doSimAll}>Simulate</MButton>
          </div>
        </div>
      </Modal>

      {scouting && <PlayerScoutingModal player={scouting} franchise={human} onClose={() => setScouting(null)} />}
      {inspector && <CpuDecisionInspectorModal isOpen={inspector} onClose={() => setInspector(false)} session={session} />}
      <span className="sr-only">{processed} lots processed</span>
    </div>
  );
}

function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-display font-extrabold rounded-[2px] border ${
        dark ? 'border-black/30 bg-ink/[0.04]' : 'border-[var(--m-line-strong)] bg-ink/5'
      }`}
    >
      {children}
    </kbd>
  );
}

function AuctionComplete({
  session,
  humanFranchiseId,
  onFinish,
}: {
  session: AuctionSession;
  humanFranchiseId: string;
  onFinish: () => void;
}) {
  const top = [...session.soldPlayers].sort((a, b) => b.price - a.price).slice(0, 5);
  const human = session.franchises.find((f) => f.id === humanFranchiseId)!;
  const short = Math.max(0, human.minSquadSize - human.players.length);
  return (
    <div className="m-panel relative overflow-hidden">
      <div className="absolute inset-0 m-slash" />
      <div className="relative p-6">
        <div className="m-label">Hammer down</div>
        <h2 className="m-display text-5xl italic">Auction complete</h2>
        <p className="text-sm text-[var(--m-dim)] mt-2">
          {session.soldPlayers.length} players sold for {formatPrice(session.soldPlayers.reduce((s, p) => s + p.price, 0))}.
          {short > 0
            ? ` Your squad is ${short} short of the ${human.minSquadSize}-player minimum — the best remaining unsold players will be signed at base price.`
            : ' Your squad meets the league minimum.'}
        </p>
        <div className="mt-4">
          <div className="m-label mb-1.5">Biggest buys</div>
          <ul className="space-y-1">
            {top.map((s) => (
              <li key={s.playerId} className="flex items-center gap-2.5 px-2 py-1.5 bg-ink/5 rounded-[2px]">
                <TeamCrest franchiseId={s.franchiseId} size="xs" />
                <span className="flex-1 truncate font-display font-bold uppercase">{s.playerName}</span>
                <span className="font-display font-extrabold tabular-nums">{formatPrice(s.price)}</span>
              </li>
            ))}
          </ul>
        </div>
        <MButton variant="primary" size="lg" className="mt-5" onClick={onFinish}>
          Finalize squads & set your XI <ChevronRight className="w-4 h-4" />
        </MButton>
      </div>
    </div>
  );
}

/** IPL pedigree as the CPU general managers see it. */
function PedigreeChip({ player, season }: { player: Player; season: number }) {
  const ped = iplPedigree(player, season);
  const tone: Record<string, string> = {
    'Proven IPL star': 'var(--m-green)',
    'IPL regular': 'var(--m-green)',
    'Uncapped prospect': 'var(--m-cyan)',
    'Domestic breakout': 'var(--m-purple)',
    'IPL flop risk': 'var(--m-red)',
    'Unproven in India': 'var(--m-gold)',
    'Out of the IPL': 'var(--m-gold)',
  };
  const c = tone[ped.tag] ?? 'var(--m-dim)';
  return (
    <span className="m-chip" style={{ color: c, borderColor: `color-mix(in srgb, ${c} 45%, transparent)` }} title="How franchises rate his IPL record">
      {ped.tag}
    </span>
  );
}

function iplLine(p: Player): string {
  const r = p.ipl;
  if (!r || r.matches === 0) return r?.lastSquadSeason ? `In an IPL squad in ${r.lastSquadSeason} · yet to play a match` : 'Has never played in the IPL';
  const span = r.firstSeason === r.lastSeason ? `${r.lastSeason}` : `${r.firstSeason}–${r.lastSeason}`;
  const bat = r.runs >= 100 ? ` · ${r.runs} runs @ SR ${r.strikeRate}` : '';
  const bowl = r.ballsBowled >= 60 ? ` · ${r.wickets} wkts, econ ${r.economy}` : '';
  return `IPL: ${r.matches} matches, ${r.seasons} season${r.seasons === 1 ? '' : 's'} (${span})${bat}${bowl}`;
}
