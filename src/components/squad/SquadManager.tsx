'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import {
  generateBestPlayingXI,
  validatePlayingXI,
} from '@/lib/engines/squad-engine';
import {
  generateIPLFixtures,
  initializeStandings,
} from '@/lib/engines/tournament-engine';
import { Users, Shield, Award, AlertTriangle, CheckCircle, ArrowRight, Wand2 } from 'lucide-react';
import type { PlayingXI, Player } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';

export function SquadManager() {
  const {
    humanFranchiseId,
    franchises,
    playingXIs,
    setPlayingXI,
    setFixtures,
    setStandings,
    fixtures,
    setPhase,
  } = useGameStore();

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);

  const existingXI = humanFranchise ? playingXIs[humanFranchise.id] : null;
  const [currentXI, setCurrentXI] = useState<PlayingXI>(() => {
    if (existingXI) return existingXI;
    if (humanFranchise) return generateBestPlayingXI(humanFranchise);
    return { franchiseId: '', players: [], captain: '', wicketkeeper: '' };
  });

  const [benchFilter, setBenchFilter] = useState<string>('All');
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (humanFranchise && (!existingXI || existingXI.players.length === 0)) {
      const best = generateBestPlayingXI(humanFranchise);
      setCurrentXI(best);
      setPlayingXI(humanFranchise.id, best);
    }
  }, [humanFranchise, existingXI, setPlayingXI]);

  if (!humanFranchise) {
    return <div className="p-8 text-center text-zinc-400 font-bold">Loading squad...</div>;
  }

  const squadMap = new Map(humanFranchise.players.map((p) => [p.id, p]));
  const validation = validatePlayingXI(currentXI, humanFranchise.players);

  const xiPlayers = currentXI.players
    .map((id) => squadMap.get(id))
    .filter((p): p is Player => !!p);

  const benchPlayers = humanFranchise.players
    .filter((p) => !currentXI.players.includes(p.id))
    .filter((p) => (benchFilter === 'All' ? true : p.role === benchFilter));

  const overseasCountInXI = xiPlayers.filter((p) => p.nationality === 'Overseas').length;

  const handleAutoPick = () => {
    const best = generateBestPlayingXI(humanFranchise);
    setCurrentXI(best);
    setPlayingXI(humanFranchise.id, best);
  };

  const handleSwapWithBench = (xiIndex: number, benchPlayer: Player) => {
    const newPlayers = [...currentXI.players];
    const oldPlayerId = newPlayers[xiIndex];
    newPlayers[xiIndex] = benchPlayer.id;

    let newCaptain = currentXI.captain;
    let newWK = currentXI.wicketkeeper;

    if (oldPlayerId === currentXI.captain) newCaptain = benchPlayer.id;
    if (oldPlayerId === currentXI.wicketkeeper) {
      if (benchPlayer.role === 'Wicketkeeper') newWK = benchPlayer.id;
      else {
        const otherWK = newPlayers.find((id) => squadMap.get(id)?.role === 'Wicketkeeper');
        newWK = otherWK || benchPlayer.id;
      }
    }

    const updated: PlayingXI = {
      ...currentXI,
      players: newPlayers,
      captain: newCaptain,
      wicketkeeper: newWK,
    };
    setCurrentXI(updated);
    setPlayingXI(humanFranchise.id, updated);
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === currentXI.players.length - 1)) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newPlayers = [...currentXI.players];
    const temp = newPlayers[index];
    newPlayers[index] = newPlayers[targetIndex];
    newPlayers[targetIndex] = temp;

    const updated = { ...currentXI, players: newPlayers };
    setCurrentXI(updated);
    setPlayingXI(humanFranchise.id, updated);
  };

  const handleSetCaptain = (playerId: string) => {
    const updated = { ...currentXI, captain: playerId };
    setCurrentXI(updated);
    setPlayingXI(humanFranchise.id, updated);
  };

  const handleSetWicketkeeper = (playerId: string) => {
    const updated = { ...currentXI, wicketkeeper: playerId };
    setCurrentXI(updated);
    setPlayingXI(humanFranchise.id, updated);
  };

  const handleConfirmAndProceed = () => {
    if (!validation.valid) {
      alert(`Please fix lineup errors before proceeding:\n${validation.errors.join('\n')}`);
      return;
    }

    // Generate CPU Playing XIs for all other franchises if not yet generated
    for (const f of franchises) {
      if (f.id === humanFranchise.id) continue;
      if (!playingXIs[f.id]) {
        const cpuXI = generateBestPlayingXI(f);
        setPlayingXI(f.id, cpuXI);
      }
    }

    // Generate Fixtures & Standings if not yet generated
    if (fixtures.length === 0) {
      const generatedFixtures = generateIPLFixtures(franchises);
      setFixtures(generatedFixtures);
      const initialStandings = initializeStandings(franchises);
      setStandings(initialStandings);
    }

    setPhase('Tournament');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Squad Status & Controls (Neo-Box) */}
      <div
        className="neo-box p-5 rounded-2xl relative overflow-hidden"
        style={{
          backgroundColor: theme.cardBg,
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                PLAYING XI & MATCH DAY SQUAD
              </h2>
              <span
                className={`neo-badge text-xs px-2.5 py-0.5 rounded ${
                  validation.valid
                    ? 'bg-emerald-400 text-black'
                    : 'bg-red-500 text-white'
                }`}
              >
                {validation.valid ? '✓ LINEUP VALID' : '✕ INVALID LINEUP'}
              </span>
            </div>
            <p className="text-xs text-zinc-300 font-medium max-w-xl leading-relaxed">
              Set your 1-11 batting order, designate your Captain (C) and Wicketkeeper (WK), and balance overseas stars with domestic talent.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs font-bold">
              <span
                className={`neo-badge px-2.5 py-1 rounded-lg ${
                  overseasCountInXI <= 4
                    ? 'bg-sky-400 text-black'
                    : 'bg-red-500 text-white'
                }`}
              >
                ✈ OVERSEAS: {overseasCountInXI} / 4 MAX
              </span>
              <span className="neo-badge px-2.5 py-1 rounded-lg bg-black text-zinc-300">
                SQUAD: {humanFranchise.players.length} PLAYERS
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleAutoPick}
              className="neo-btn px-4 py-2 rounded-xl text-xs uppercase bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-1.5"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>AUTO-SELECT BEST XI</span>
            </button>

            <button
              onClick={handleConfirmAndProceed}
              disabled={!validation.valid}
              className="neo-btn px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-transform"
              style={{
                backgroundColor: validation.valid ? theme.primary : '#3f3f46',
                color: validation.valid ? theme.textLight : '#a1a1aa',
              }}
            >
              <span>CONFIRM & ENTER TOURNAMENT</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>

      {/* Validation Warnings / Errors Banner */}
      {!validation.valid && (
        <div className="neo-box p-4 rounded-xl bg-red-950 border-2 border-black text-xs text-red-200 space-y-1 font-bold">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            <span>PLEASE RESOLVE LINEUP ISSUES:</span>
          </div>
          {validation.errors.map((err, i) => (
            <div key={i} className="pl-6">• {err}</div>
          ))}
        </div>
      )}

      {/* Main Grid: Playing XI (Left) and Bench (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Playing XI Batting Order (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
            <span>BATTING ORDER & PLAYING XI</span>
            <span>CAPTAIN / WK / ORDER</span>
          </div>

          <div className="space-y-2">
            {xiPlayers.map((player, idx) => {
              const isCaptain = currentXI.captain === player.id;
              const isWK = currentXI.wicketkeeper === player.id;
              const isOverseas = player.nationality === 'Overseas';

              return (
                <div
                  key={player.id}
                  className="neo-box p-3 rounded-xl bg-zinc-950 flex items-center justify-between gap-3 transition-all hover:bg-zinc-900"
                >
                  {/* Position number and Name */}
                  <div className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shadow-[1.5px_1.5px_0px_#000]"
                      style={{
                        backgroundColor: theme.primary,
                        color: theme.textLight,
                      }}
                    >
                      #{idx + 1}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white">{player.name}</span>
                        {isOverseas && (
                          <span className="neo-badge text-[9px] px-1.5 py-0.2 rounded bg-sky-400 text-black">
                            ✈ OS
                          </span>
                        )}
                        {isCaptain && (
                          <span className="neo-badge text-[9px] px-1.5 py-0.2 rounded bg-amber-400 text-black font-black">
                            C
                          </span>
                        )}
                        {isWK && (
                          <span className="neo-badge text-[9px] px-1.5 py-0.2 rounded bg-purple-500 text-white font-black">
                            WK
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 font-bold flex items-center gap-2 mt-0.5">
                        <span>{player.role}</span>
                        <span className="text-zinc-600">•</span>
                        <span>{player.battingHand} Bat</span>
                        {player.bowlingStyle !== 'None' && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="truncate max-w-[120px]">{player.bowlingStyle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rating + Badges & Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoutingPlayer(player)}
                      className="neo-btn px-2 py-1 rounded text-[10px] font-black uppercase bg-zinc-800 text-amber-400 hover:bg-zinc-700"
                      title="Scout Player Dossier"
                    >
                      SCOUT
                    </button>

                    <div className="text-right mr-1.5">
                      <div className="text-xs font-black text-amber-400">{player.ratings.overall}</div>
                      <div className="text-[9px] text-zinc-500 font-black">OVR</div>
                    </div>

                    {/* Captain & WK Buttons */}
                    <button
                      onClick={() => handleSetCaptain(player.id)}
                      title="Set as Captain"
                      className={`neo-btn px-2 py-1 rounded text-[11px] font-black uppercase ${
                        isCaptain
                          ? 'bg-amber-400 text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      C
                    </button>

                    <button
                      onClick={() => handleSetWicketkeeper(player.id)}
                      title="Set as Wicketkeeper"
                      className={`neo-btn px-2 py-1 rounded text-[11px] font-black uppercase ${
                        isWK
                          ? 'bg-purple-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      WK
                    </button>

                    {/* Order up / down */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveOrder(idx, 'up')}
                        disabled={idx === 0}
                        className="px-1.5 py-0.5 rounded border border-black bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[9px] font-black disabled:opacity-20"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveOrder(idx, 'down')}
                        disabled={idx === xiPlayers.length - 1}
                        className="px-1.5 py-0.5 rounded border border-black bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[9px] font-black disabled:opacity-20"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bench / Reserves (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
            <span>BENCH ({benchPlayers.length})</span>
            <div className="flex items-center gap-1">
              {['All', 'Batter', 'All-Rounder', 'Bowler'].map((r) => (
                <button
                  key={r}
                  onClick={() => setBenchFilter(r)}
                  className={`neo-btn px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    benchFilter === r ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {benchPlayers.length === 0 ? (
              <div className="neo-box p-8 text-center text-zinc-500 text-xs bg-zinc-950 rounded-xl font-bold">
                No bench reserves matching this filter.
              </div>
            ) : (
              benchPlayers.map((player) => (
                <div
                  key={player.id}
                  className="neo-box-sm p-3 rounded-xl bg-zinc-950 flex items-center justify-between gap-3 hover:bg-zinc-900 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-white">{player.name}</span>
                      {player.nationality === 'Overseas' && (
                        <span className="neo-badge text-[9px] px-1 py-0 rounded bg-sky-400 text-black">
                          ✈ OS
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-bold mt-0.5">
                      {player.role} • {player.ratings.overall} OVR • Age {player.age}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setScoutingPlayer(player)}
                      className="neo-btn text-[10px] py-1 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-black uppercase"
                    >
                      SCOUT
                    </button>
                    <button
                      onClick={() => handleSwapWithBench(xiPlayers.length - 1, player)}
                      className="neo-btn text-[10px] py-1 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase"
                    >
                      SWAP IN
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Player Intelligence Scouting Dossier Modal */}
      {scoutingPlayer && humanFranchise && (
        <PlayerScoutingModal
          player={scoutingPlayer}
          franchise={humanFranchise}
          onClose={() => setScoutingPlayer(null)}
        />
      )}
    </div>
  );
}
