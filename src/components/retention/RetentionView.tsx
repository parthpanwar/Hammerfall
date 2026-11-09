'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { RETENTION_RULES_2026 } from '@/lib/data/retention-rules';
import {
  validateRetention,
  processRetention,
  cpuRetentionDecisions,
} from '@/lib/engines/retention-engine';
import { createAuctionSession } from '@/lib/engines/auction-engine';
import { formatPrice } from '@/lib/utils';
import { createSeededRandom } from '@/lib/utils/random';
import { Shield, Check, X, ArrowRight, DollarSign, Users, Award, Sparkles, Filter } from 'lucide-react';
import type { Player, RetentionDecision } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { PlayerScoutingModal } from '@/components/scouting/PlayerScoutingModal';

export function RetentionView() {
  const {
    humanFranchiseId,
    franchises,
    allPlayers,
    retentionDecisions,
    addRetentionDecision,
    removeRetentionDecision,
    setRetentionDecisions,
    completeRetention,
    setPhase,
    setAuctionSession,
    updateFranchise,
  } = useGameStore();

  const [showResultsModal, setShowResultsModal] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('All');
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const theme = getTeamTheme(humanFranchiseId);
  const rules = RETENTION_RULES_2026;

  if (!humanFranchise) {
    return <div className="p-8 text-center text-zinc-400 font-bold">Loading franchise...</div>;
  }

  // Get current human retentions
  const currentRetentions = retentionDecisions.filter(
    (d) => d.franchiseId === humanFranchiseId
  );

  const humanRoster = humanFranchise.players;
  const totalSpent = currentRetentions.reduce((sum, d) => sum + d.cost, 0);
  const remainingPurse = rules.totalPurse - totalSpent;

  // Filter roster
  const filteredRoster = humanRoster.filter((p) => {
    if (filterRole === 'All') return true;
    return p.role === filterRole;
  });

  const handleToggleRetention = (player: Player) => {
    const isRetained = currentRetentions.some((d) => d.playerId === player.id);

    if (isRetained) {
      removeRetentionDecision(humanFranchiseId, player.id);
    } else {
      const val = validateRetention(humanFranchise, player, currentRetentions, rules);
      if (!val.valid) {
        alert(val.reason);
        return;
      }
      const decision = processRetention(
        humanFranchise,
        player,
        currentRetentions.length + 1,
        rules
      );
      addRetentionDecision(decision);
    }
  };

  const handleFinalizeRetentions = () => {
    const rng = createSeededRandom(Date.now());
    let allDecisions: RetentionDecision[] = [...currentRetentions];

    // Deduct purse and assign retained players for human team
    const humanRetainedPlayers = humanRoster.filter((p) =>
      currentRetentions.some((d) => d.playerId === p.id)
    );
    const humanReleased = humanRoster.filter(
      (p) => !currentRetentions.some((d) => d.playerId === p.id)
    );

    updateFranchise(humanFranchiseId, {
      remainingPurse,
      retainedPlayers: humanRetainedPlayers,
      releasedPlayers: humanReleased,
      players: humanRetainedPlayers,
    });

    // Run CPU Retentions for the other 9 franchises
    for (const franchise of franchises) {
      if (franchise.id === humanFranchiseId) continue;

      const cpuDecisions = cpuRetentionDecisions(franchise, rules, rng);
      allDecisions = [...allDecisions, ...cpuDecisions];

      const cpuSpent = cpuDecisions.reduce((sum, d) => sum + d.cost, 0);
      const cpuRetained = franchise.players.filter((p) =>
        cpuDecisions.some((d) => d.playerId === p.id)
      );
      const cpuReleased = franchise.players.filter(
        (p) => !cpuDecisions.some((d) => d.playerId === p.id)
      );

      updateFranchise(franchise.id, {
        remainingPurse: rules.totalPurse - cpuSpent,
        retainedPlayers: cpuRetained,
        releasedPlayers: cpuReleased,
        players: cpuRetained,
      });
    }

    setRetentionDecisions(allDecisions);
    completeRetention();
    setShowResultsModal(true);
  };

  const handleProceedToAuction = () => {
    // Transition to the official Registration & Scouting phases
    const initReg = useGameStore.getState().initializeRegistration;
    initReg();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Retention Rules & Purse Status (Neo-Box) */}
      <div
        className="neo-box p-5 sm:p-6 rounded-2xl relative overflow-hidden"
        style={{
          backgroundColor: theme.cardBg,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="neo-badge px-2.5 py-0.5 rounded bg-black text-amber-400 text-xs">
                PHASE 1 OF 5: RETENTIONS
              </span>
              <span
                className="neo-badge px-2.5 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: theme.primary,
                  color: theme.textLight,
                }}
              >
                {humanFranchise.name}
              </span>
            </div>
            <h2 className="text-2xl font-black uppercase text-white tracking-tight">
              PRE-AUCTION RETENTION DESK
            </h2>
            <p className="text-xs text-zinc-300 font-medium max-w-xl mt-1 leading-relaxed">
              Lock in up to 6 core players before the Mega Auction hammer drops. Retained player salaries are directly deducted from your initial ₹120.00 Cr purse.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="neo-box-sm bg-black px-4 py-2.5 rounded-xl text-right">
              <div className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">Remaining Purse</div>
              <div className="text-xl font-black text-emerald-400">{formatPrice(remainingPurse)}</div>
            </div>

            <div className="neo-box-sm bg-black px-4 py-2.5 rounded-xl text-right">
              <div className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">Slots Used</div>
              <div className="text-xl font-black text-amber-400">
                {currentRetentions.length} / {rules.maxRetentions}
              </div>
            </div>

            <button
              onClick={handleFinalizeRetentions}
              className="neo-btn px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2"
              style={{
                backgroundColor: theme.primary,
                color: theme.textLight,
              }}
            >
              <span>LOCK RETENTIONS & REVEAL</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Retention Slabs */}
        <div className="mt-5 pt-4 border-t-2 border-black grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="neo-box-sm bg-zinc-950 p-2 rounded-lg">
            <span className="text-zinc-400 block text-[10px] font-bold">SLOT 1 (CAPPED)</span>
            <span className="font-black text-amber-400">₹18.00 Cr</span>
          </div>
          <div className="neo-box-sm bg-zinc-950 p-2 rounded-lg">
            <span className="text-zinc-400 block text-[10px] font-bold">SLOT 2 (CAPPED)</span>
            <span className="font-black text-amber-400">₹14.00 Cr</span>
          </div>
          <div className="neo-box-sm bg-zinc-950 p-2 rounded-lg">
            <span className="text-zinc-400 block text-[10px] font-bold">SLOT 3 (CAPPED)</span>
            <span className="font-black text-amber-400">₹11.00 Cr</span>
          </div>
          <div className="neo-box-sm bg-zinc-950 p-2 rounded-lg">
            <span className="text-zinc-400 block text-[10px] font-bold">SLOT 4 (CAPPED)</span>
            <span className="font-black text-amber-400">₹18.00 Cr</span>
          </div>
          <div className="neo-box-sm bg-zinc-950 p-2 rounded-lg">
            <span className="text-zinc-400 block text-[10px] font-bold">SLOT 5 (CAPPED)</span>
            <span className="font-black text-amber-400">₹14.00 Cr</span>
          </div>
          <div className="neo-box-sm bg-zinc-950 p-2 rounded-lg">
            <span className="text-zinc-400 block text-[10px] font-bold">UNCAPPED SLOTS</span>
            <span className="font-black text-emerald-400">₹4.00 Cr</span>
          </div>
        </div>
      </div>

      {/* Role Filter Tabs (Neo-Pills) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['All', 'Batter', 'All-Rounder', 'Bowler', 'Wicketkeeper'].map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`neo-btn px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                filterRole === role
                  ? 'bg-amber-400 text-black'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
        <div className="neo-badge px-2.5 py-1 rounded bg-black text-zinc-300 text-[11px]">
          {filteredRoster.length} SQUAD CANDIDATES
        </div>
      </div>

      {/* Roster Cards Grid (Neo-Brutalist Player Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoster.map((player) => {
          const retentionIndex = currentRetentions.findIndex((d) => d.playerId === player.id);
          const isRetained = retentionIndex !== -1;
          const assignedDecision = isRetained ? currentRetentions[retentionIndex] : null;

          return (
            <div
              key={player.id}
              className={`neo-box p-4 rounded-xl flex flex-col justify-between transition-all ${
                isRetained
                  ? 'bg-zinc-950 ring-2 ring-amber-400'
                  : 'bg-zinc-900/90 hover:bg-zinc-900'
              }`}
              style={{
                borderColor: '#000000',
              }}
            >
              <div>
                {/* Header: Name, Role, Rating */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-white">{player.name}</span>
                      {player.nationality === 'Overseas' && (
                        <span className="neo-badge px-1.5 py-0.2 rounded bg-sky-400 text-black text-[9px]">
                          ✈ OS
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 font-bold mt-0.5">
                      {player.role} • {player.age} yrs • {player.status}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className="neo-badge text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: theme.primary,
                        color: theme.textLight,
                      }}
                    >
                      {player.ratings.overall} OVR
                    </span>
                  </div>
                </div>

                {/* Key Stats Bar (Neo-Brutalist Stat Ticker) */}
                <div className="grid grid-cols-4 gap-1 mt-3 text-center text-[10px] py-1.5 px-2 rounded-lg bg-black border-2 border-zinc-800 text-zinc-300 font-black">
                  <div>
                    <span className="text-zinc-500 block text-[9px]">BAT</span>
                    <span className="text-white">{player.ratings.batting}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px]">BOWL</span>
                    <span className="text-white">{player.ratings.bowling}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px]">PWR</span>
                    <span className="text-amber-400">{player.ratings.powerHitting}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px]">POT</span>
                    <span className="text-emerald-400">{player.ratings.potential}</span>
                  </div>
                </div>

                {/* Career Snapshot */}
                <div className="mt-2 text-[11px] text-zinc-400 font-bold flex items-center justify-between">
                  <span>{player.stats.matches} Matches</span>
                  {player.stats.runs > 0 && <span>{player.stats.runs} runs (SR {player.stats.strikeRate})</span>}
                  {player.stats.wickets > 0 && <span>{player.stats.wickets} wkts</span>}
                </div>
              </div>

              {/* Action Button & Cost */}
              <div className="mt-4 pt-3 border-t-2 border-black flex items-center justify-between">
                <div>
                  {isRetained ? (
                    <div>
                      <span className="neo-badge px-1.5 py-0.5 rounded bg-amber-400 text-black text-[10px]">
                        SLOT #{assignedDecision?.retentionNumber}
                      </span>
                      <span className="text-zinc-300 block text-[10px] font-black mt-0.5">
                        Cost: {formatPrice(assignedDecision?.cost || 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-400 font-bold">
                      Est. Cost:{' '}
                      <span className="text-white font-black">
                        {player.status === 'Uncapped' ? '₹4.00 Cr' : '₹11-18 Cr'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setScoutingPlayer(player)}
                    className="neo-btn px-2.5 py-1.5 rounded-lg text-xs font-black uppercase bg-zinc-800 hover:bg-zinc-700 text-amber-400"
                    title="Scout Player Intelligence Dossier"
                  >
                    SCOUT
                  </button>

                  <button
                    onClick={() => handleToggleRetention(player)}
                    className={`neo-btn px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isRetained
                        ? 'bg-red-500 text-white'
                        : 'bg-emerald-400 text-black'
                    }`}
                  >
                    {isRetained ? (
                      <>
                        <X className="w-3.5 h-3.5 stroke-[3]" /> Release
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Retain
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Retention Results Modal (Neo-Brutalist Modal) */}
      {showResultsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="neo-box-lg bg-zinc-950 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b-[2.5px] border-black bg-zinc-900 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" /> RETENTION WINDOW CLOSED
                </h3>
                <p className="text-xs text-zinc-400 font-bold mt-0.5">
                  All 10 IPL franchises have submitted their retained core.
                </p>
              </div>
              <button
                onClick={handleProceedToAuction}
                className="neo-btn px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase flex items-center gap-2"
              >
                <span>ENTER AUCTION ROOM</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {franchises.map((f) => {
                const teamRetentions = retentionDecisions.filter((d) => d.franchiseId === f.id);
                const fTheme = getTeamTheme(f.id);

                return (
                  <div
                    key={f.id}
                    className="neo-box-sm p-3.5 rounded-xl bg-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_#000]"
                        style={{
                          backgroundColor: fTheme.primary,
                          color: fTheme.textLight,
                        }}
                      >
                        {f.abbreviation}
                      </div>
                      <div>
                        <div className="font-black text-sm text-white flex items-center gap-2">
                          {f.name}
                          {f.id === humanFranchiseId && (
                            <span className="neo-badge bg-amber-400 text-black text-[9px] px-1.5 py-0.2 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 flex flex-wrap gap-1.5 mt-1 font-medium">
                          {teamRetentions.length === 0 ? (
                            <span className="text-zinc-500 italic text-xs">No retentions (Full purse preserved)</span>
                          ) : (
                            teamRetentions.map((d) => (
                              <span
                                key={d.playerId}
                                className="neo-badge px-2 py-0.5 rounded bg-black text-zinc-300 text-[10px]"
                              >
                                {d.playerName} ({formatPrice(d.cost)})
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right sm:self-center">
                      <span className="text-[10px] text-zinc-400 uppercase block font-black">
                        AUCTION PURSE
                      </span>
                      <span className="text-base font-black text-emerald-400">
                        {formatPrice(f.remainingPurse)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
