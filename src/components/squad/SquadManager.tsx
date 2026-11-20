'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { generateBestPlayingXI, selectCpuXI, validatePlayingXI } from '@/lib/engines/squad-engine';
import { hashString, mulberry32 } from '@/lib/engines/career/dev-rng';
import { generateIPLFixtures, initializeStandings } from '@/lib/engines/tournament-engine';
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp, Repeat, Wand2, X } from 'lucide-react';
import type { PlayingXI, Player } from '@/lib/types/game';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';
import { MButton, OvrBadge, OverseasTag, PageHeader, Panel, RoleTag } from '@/components/mynba/primitives';

const BENCH_FILTERS = ['All', 'Batter', 'All-Rounder', 'Bowler', 'Wicketkeeper'] as const;

export function SquadManager() {
  const { humanFranchiseId, franchises, playingXIs, setPlayingXI, setFixtures, setStandings, fixtures, setPhase } = useGameStore();

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const existingXI = humanFranchise ? playingXIs[humanFranchise.id] : null;
  const [currentXI, setCurrentXI] = useState<PlayingXI>(() => {
    if (existingXI) return existingXI;
    if (humanFranchise) return generateBestPlayingXI(humanFranchise);
    return { franchiseId: '', players: [], captain: '', wicketkeeper: '' };
  });
  const [benchFilter, setBenchFilter] = useState<(typeof BENCH_FILTERS)[number]>('All');
  /** First half of a swap: tap a player (XI or bench), then the player to swap with. */
  const [picked, setPicked] = useState<string | null>(null);
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (humanFranchise && (!existingXI || existingXI.players.length === 0)) {
      setPlayingXI(humanFranchise.id, generateBestPlayingXI(humanFranchise));
    }
  }, [humanFranchise, existingXI, setPlayingXI]);

  if (!humanFranchise) {
    return <div className="p-8 text-center text-[var(--m-dim)]">Loading squad…</div>;
  }

  const leagueStarted = fixtures.some((f) => f.isCompleted);
  const squadMap = new Map(humanFranchise.players.map((p) => [p.id, p]));
  const validation = validatePlayingXI(currentXI, humanFranchise.players);
  const xiPlayers = currentXI.players.map((id) => squadMap.get(id)).filter((p): p is Player => !!p);
  const allBench = humanFranchise.players.filter((p) => !currentXI.players.includes(p.id));
  const benchPlayers = allBench
    .filter((p) => benchFilter === 'All' || p.role === benchFilter)
    .sort((a, b) => b.ratings.overall - a.ratings.overall);
  const overseasInXi = xiPlayers.filter((p) => p.nationality === 'Overseas').length;
  const avgOvr = xiPlayers.length ? Math.round(xiPlayers.reduce((s, p) => s + p.ratings.overall, 0) / xiPlayers.length) : 0;
  const pickedPlayer = picked ? squadMap.get(picked) ?? null : null;
  const pickedInXi = !!picked && currentXI.players.includes(picked);

  const commit = (updated: PlayingXI) => {
    setCurrentXI(updated);
    setPlayingXI(humanFranchise.id, updated);
  };

  const handleAutoPick = () => {
    commit(generateBestPlayingXI(humanFranchise));
    setPicked(null);
  };

  /** Swap two players: XI↔bench brings one in for the other, XI↔XI swaps batting positions. */
  const swapPlayers = (aId: string, bId: string) => {
    const players = [...currentXI.players];
    const ia = players.indexOf(aId);
    const ib = players.indexOf(bId);
    let { captain, wicketkeeper } = currentXI;
    if (ia >= 0 && ib >= 0) {
      [players[ia], players[ib]] = [players[ib], players[ia]];
    } else if (ia >= 0 || ib >= 0) {
      const outId = ia >= 0 ? aId : bId;
      const inId = ia >= 0 ? bId : aId;
      players[players.indexOf(outId)] = inId;
      if (outId === captain) captain = inId;
      if (outId === wicketkeeper) {
        wicketkeeper =
          squadMap.get(inId)?.role === 'Wicketkeeper' ? inId : players.find((id) => squadMap.get(id)?.role === 'Wicketkeeper') || inId;
      }
    } else return; // two bench players: nothing to swap
    commit({ ...currentXI, players, captain, wicketkeeper });
  };

  const onPick = (id: string) => {
    if (!picked) return setPicked(id);
    if (picked === id) return setPicked(null);
    const bothBench = !currentXI.players.includes(picked) && !currentXI.players.includes(id);
    if (bothBench) return setPicked(id);
    swapPlayers(picked, id);
    setPicked(null);
  };

  /** Rows are keyboard-pickable too (Enter / Space). */
  const pickable = (id: string, selected: boolean) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-pressed': selected,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      onPick(id);
    },
  });

  const handleMoveOrder = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= currentXI.players.length) return;
    const players = [...currentXI.players];
    [players[index], players[target]] = [players[target], players[index]];
    commit({ ...currentXI, players });
  };

  const handleConfirmAndProceed = () => {
    if (!validation.valid) return;
    for (const f of franchises) {
      if (f.id !== humanFranchise.id && !playingXIs[f.id]) {
        const rng = mulberry32((hashString(`opening:${f.id}`) ^ (useGameStore.getState().settings.seed ?? 0)) >>> 0);
        setPlayingXI(f.id, selectCpuXI(f, { rng, season: useGameStore.getState().currentSeason }));
      }
    }
    if (fixtures.length === 0) {
      setFixtures(generateIPLFixtures(franchises));
      setStandings(initializeStandings(franchises));
    }
    setPhase('Tournament');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        kicker={leagueStarted ? 'Between matches' : 'Before the season'}
        title="Squad & Playing XI"
        subtitle="Auto-pick is usually enough. To change it, tap a player, then tap who to swap them with."
        right={
          <>
            <MButton variant="ghost" onClick={handleAutoPick}>
              <Wand2 className="w-4 h-4" /> Auto-pick best XI
            </MButton>
            <MButton variant="primary" size="lg" onClick={handleConfirmAndProceed} disabled={!validation.valid}>
              {fixtures.length ? 'Save & back to league' : 'Confirm & Enter Tournament'} <ArrowRight className="w-4 h-4" />
            </MButton>
          </>
        }
      />

      {/* Three numbers that matter, nothing else */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <Fact label="XI average" value={`${avgOvr} OVR`} />
        <Fact label="Overseas in XI" value={`${overseasInXi} / 4`} warn={overseasInXi > 4} />
        <Fact label="Squad" value={`${humanFranchise.players.length} players`} />
        <Fact label="Line-up" value={validation.valid ? 'Ready' : 'Needs fixing'} warn={!validation.valid} good={validation.valid} />
      </div>

      {!validation.valid && (
        <div className="flex gap-3 rounded-[4px] border border-[var(--m-red)]/40 bg-[var(--m-red)]/10 px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-[var(--m-red)] shrink-0 mt-0.5" />
          <ul className="space-y-0.5">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {pickedPlayer && (
        <div className="sticky top-2 z-20 flex items-center gap-3 rounded-[4px] border border-[var(--m-ink)] bg-[var(--m-panel)] px-4 py-3 text-sm shadow-[4px_4px_0_var(--m-ink)]" role="status">
          <Repeat className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            <b>{pickedPlayer.name}</b> selected.{' '}
            {pickedInXi ? 'Tap a bench player to bring him in, or another XI player to swap batting positions.' : 'Tap the XI player he should replace.'}
          </span>
          <MButton size="sm" variant="ghost" onClick={() => setPicked(null)}>
            <X className="w-3.5 h-3.5" /> Cancel
          </MButton>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6 items-start">
        <Panel title="Playing XI · batting order" bodyClassName="p-2">
          <ol>
            {xiPlayers.map((player, idx) => {
              const isCaptain = currentXI.captain === player.id;
              const isWK = currentXI.wicketkeeper === player.id;
              const selected = picked === player.id;
              const target = !!picked && !selected;
              return (
                <li
                  key={player.id}
                  onClick={() => onPick(player.id)}
                  {...pickable(player.id, selected)}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-[3px] cursor-pointer transition-colors ${
                    selected ? 'bg-ink/[0.08] ring-2 ring-[var(--m-ink)]' : target ? 'hover:bg-ink/[0.06] ring-1 ring-[var(--m-line-strong)]' : 'hover:bg-ink/[0.03]'
                  }`}
                >
                  <span className="w-5 text-right font-display font-extrabold text-[var(--m-faint)] tabular-nums">{idx + 1}</span>
                  <OvrBadge ovr={player.ratings.overall} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button
                        className="font-semibold text-sm truncate hover:underline text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScoutingPlayer(player);
                        }}
                      >
                        {player.name}
                      </button>
                      {player.nationality === 'Overseas' && <OverseasTag />}
                    </div>
                    <div className="text-xs text-[var(--m-faint)] mt-0.5 truncate">
                      {player.role}
                      {player.bowlingStyle !== 'None' ? ` · ${player.bowlingStyle}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {target && !pickedInXi && (
                      <span className="text-[11px] font-semibold text-[var(--m-dim)] mr-1 hidden sm:inline">Swap out</span>
                    )}
                    <ToggleChip active={isCaptain} onClick={() => commit({ ...currentXI, captain: player.id })} label="C" title="Make captain" tone="gold" />
                    <ToggleChip active={isWK} onClick={() => commit({ ...currentXI, wicketkeeper: player.id })} label="WK" title="Make wicketkeeper" tone="blue" />
                    <div className="flex flex-col ml-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button aria-label="Move up" disabled={idx === 0} onClick={() => handleMoveOrder(idx, -1)} className="p-0.5 disabled:opacity-20 hover:text-ink">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        aria-label="Move down"
                        disabled={idx === xiPlayers.length - 1}
                        onClick={() => handleMoveOrder(idx, 1)}
                        className="p-0.5 disabled:opacity-20 hover:text-ink"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel title={`Bench · ${allBench.length}`} bodyClassName="p-0">
          <div className="flex flex-wrap gap-1 px-3 pt-3">
            {BENCH_FILTERS.map((r) => (
              <button
                key={r}
                onClick={() => setBenchFilter(r)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                  benchFilter === r ? 'bg-ink text-[var(--m-bg)] font-semibold' : 'text-[var(--m-dim)] hover:text-ink'
                }`}
              >
                {r === 'All' ? 'All' : r === 'All-Rounder' ? 'All-rounders' : `${r}s`}
              </button>
            ))}
          </div>
          <ul className="max-h-[560px] overflow-y-auto m-scroll px-2 py-2">
            {benchPlayers.length === 0 && <li className="px-3 py-8 text-center text-sm text-[var(--m-faint)]">No bench players in this group.</li>}
            {benchPlayers.map((player) => {
              const selected = picked === player.id;
              return (
              <li
                key={player.id}
                onClick={() => onPick(player.id)}
                {...pickable(player.id, selected)}
                className={`flex items-center gap-3 px-2 py-2 rounded-[3px] cursor-pointer transition-colors ${
                  selected ? 'bg-ink/[0.08] ring-2 ring-[var(--m-ink)]' : 'hover:bg-ink/[0.04]'
                }`}
              >
                <OvrBadge ovr={player.ratings.overall} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      className="font-semibold text-sm truncate hover:underline text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScoutingPlayer(player);
                      }}
                    >
                      {player.name}
                    </button>
                    {player.nationality === 'Overseas' && <OverseasTag />}
                  </div>
                  <div className="text-xs text-[var(--m-faint)] mt-0.5 flex items-center gap-2">
                    <RoleTag role={player.role} /> Age {player.age}
                  </div>
                </div>
                <span className={`text-xs font-semibold inline-flex items-center gap-1 ${pickedInXi ? 'text-[var(--m-text)]' : 'text-[var(--m-faint)]'}`}>
                  <Repeat className="w-3.5 h-3.5" /> {pickedInXi ? 'Swap in' : selected ? 'Selected' : 'Swap'}
                </span>
              </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {scoutingPlayer && (
        <PlayerScoutingModal player={scoutingPlayer} franchise={humanFranchise} onClose={() => setScoutingPlayer(null)} />
      )}
    </div>
  );
}

function Fact({ label, value, warn, good }: { label: string; value: string; warn?: boolean; good?: boolean }) {
  return (
    <div>
      <div className="m-label !text-[0.6rem]">{label}</div>
      <div
        className={`font-display font-extrabold text-xl leading-tight tabular-nums ${
          warn ? 'text-[var(--m-red)]' : good ? 'text-[var(--m-green)]' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
  title,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  tone: 'gold' | 'blue';
}) {
  const on = tone === 'gold' ? 'bg-[var(--m-gold)] text-white border-[var(--m-gold)]' : 'bg-[var(--m-accent-ink)] text-white border-[var(--m-accent-ink)]';
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`min-w-[30px] px-1.5 py-1 rounded-[3px] text-[11px] font-bold border transition-colors ${
        active ? on : 'border-[var(--m-line)] text-[var(--m-faint)] hover:text-ink hover:border-[var(--m-line-strong)]'
      }`}
    >
      {label}
    </button>
  );
}
