'use client';

import React, { useState } from 'react';
import type { AuctionSession, Franchise } from '@/lib/types/game';
import {
  getDecisionLogs,
  getFranchiseShortlist,
  getFranchiseActivePersonality,
  GM_PERSONALITY_ARCHETYPES,
} from '@/lib/engines/cpu-manager';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { formatPrice } from '@/lib/utils';
import {
  Brain,
  X,
  Target,
  Shield,
  Zap,
  TrendingUp,
  Filter,
  DollarSign,
  Activity,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface CpuDecisionInspectorModalProps {
  session: AuctionSession;
  onClose: () => void;
}

export function CpuDecisionInspectorModal({
  session,
  onClose,
}: CpuDecisionInspectorModalProps) {
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('all');
  const [activeView, setActiveView] = useState<'logs' | 'shortlists'>('logs');

  const allLogs = getDecisionLogs(session.id);
  const filteredLogs = selectedFranchiseId === 'all'
    ? allLogs
    : allLogs.filter((l) => l.franchiseId === selectedFranchiseId);

  // Sort logs most recent first
  const displayLogs = [...filteredLogs].reverse();

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="neo-box-lg bg-zinc-950 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-zinc-100 border-2 border-black">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-black bg-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
              <Brain className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black uppercase text-white flex items-center gap-2">
                CPU AUCTION AI INSPECTOR & DECISION LOGS
              </h3>
              <p className="text-xs text-zinc-400 font-bold">
                Real-time explainable decision audit for all 9 CPU General Managers
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="neo-btn w-9 h-9 rounded-xl bg-red-500 hover:bg-red-400 text-white flex items-center justify-center font-black"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        {/* View Switcher & Franchise Filter Bar */}
        <div className="p-3 border-b-2 border-black bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('logs')}
              className={`neo-btn px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
                activeView === 'logs' ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Live Bidding Logs ({allLogs.length})
            </button>
            <button
              onClick={() => setActiveView('shortlists')}
              className={`neo-btn px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
                activeView === 'shortlists' ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Franchise Shortlists & Plans
            </button>
          </div>

          {/* Franchise Select */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
              className="neo-input py-1 px-2.5 rounded-lg text-xs font-bold bg-black text-white border border-zinc-700"
            >
              <option value="all">All Franchises</option>
              {session.franchises.filter((f) => !f.isHumanControlled).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({getFranchiseActivePersonality(session.id, f.id)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeView === 'logs' ? (
            displayLogs.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 font-bold text-sm">
                No CPU decision logs captured yet. Place bids or advance lots in the auction to observe real-time decision-making.
              </div>
            ) : (
              <div className="space-y-3">
                {displayLogs.map((log) => {
                  const theme = getTeamTheme(log.franchiseId);
                  const isBid = log.decision === 'BID';

                  return (
                    <div
                      key={log.id}
                      className="neo-box p-3.5 sm:p-4 rounded-xl bg-zinc-900 border-2 border-black transition-all"
                    >
                      {/* Top Row: Team + Decision + Price */}
                      <div className="flex flex-wrap items-center justify-between pb-2 mb-2 border-b border-zinc-800 gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center border border-black"
                            style={{ backgroundColor: theme.primary, color: theme.textLight }}
                          >
                            {log.franchiseName[0]}
                          </span>
                          <div>
                            <span className="text-sm font-black text-white">{log.franchiseName}</span>
                            <span className="neo-badge ml-2 px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 text-[10px] font-black">
                              {log.personalityArchetype}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`neo-badge px-2.5 py-0.5 rounded text-xs font-black ${
                            isBid ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {log.decision}
                          </span>
                          <span className="text-xs font-mono font-bold text-zinc-300">
                            At {formatPrice(log.minNextBidLakhs)} (Max: {formatPrice(log.maxValuationLakhs)})
                          </span>
                        </div>
                      </div>

                      {/* Middle Row: Player Info & Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-zinc-300">
                        <div className="bg-black/60 p-2 rounded-lg">
                          <span className="text-[10px] text-zinc-500 block uppercase">TARGET PLAYER</span>
                          <span className="text-white font-black">{log.playerName}</span>
                          <span className="text-[10px] text-zinc-400 block">{log.ratingsOverall} OVR • {log.role}</span>
                        </div>

                        <div className="bg-black/60 p-2 rounded-lg">
                          <span className="text-[10px] text-zinc-500 block uppercase">SQUAD NEED & XI IMPACT</span>
                          <span className="text-emerald-400 font-black">
                            {log.xiImprovement > 0 ? `+${log.xiImprovement} XI Gain` : `Depth (+${log.depthImprovement})`}
                          </span>
                          <span className="text-[10px] text-zinc-400 block">Need: {log.squadNeedScore}/100</span>
                        </div>

                        <div className="bg-black/60 p-2 rounded-lg">
                          <span className="text-[10px] text-zinc-500 block uppercase">MARKET & ALTERNATIVES</span>
                          <span className="text-amber-400 font-black">{formatPrice(log.marketValuation.fairValue)} Fair</span>
                          <span className="text-[10px] text-zinc-400 block">{log.alternativesRemaining} Alternatives Left</span>
                        </div>

                        <div className="bg-black/60 p-2 rounded-lg">
                          <span className="text-[10px] text-zinc-500 block uppercase">BUDGET DISCIPLINE</span>
                          <span className="text-white font-black">{formatPrice(log.budgetImpact.remainingPurse)} Left</span>
                          <span className="text-[10px] text-zinc-400 block">{log.budgetImpact.openSlots} Slots (~{formatPrice(log.budgetImpact.budgetPerSlot)}/slot)</span>
                        </div>
                      </div>

                      {/* Reason Description */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-800/80 text-xs text-zinc-300 flex items-start gap-1.5">
                        <span className="text-amber-400 font-black text-sm leading-none">↳</span>
                        <span className="font-medium leading-relaxed">{log.reason}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* SHORTLISTS VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {session.franchises
                .filter((f) => !f.isHumanControlled && (selectedFranchiseId === 'all' || f.id === selectedFranchiseId))
                .map((f) => {
                  const shortlist = getFranchiseShortlist(session.id, f.id);
                  const personality = getFranchiseActivePersonality(session.id, f.id);
                  const theme = getTeamTheme(f.id);

                  return (
                    <div key={f.id} className="neo-box p-4 rounded-xl bg-zinc-900 border-2 border-black">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-md font-black text-xs flex items-center justify-center border border-black"
                            style={{ backgroundColor: theme.primary, color: theme.textLight }}
                          >
                            {f.name[0]}
                          </span>
                          <div>
                            <h4 className="text-sm font-black text-white">{f.name}</h4>
                            <span className="text-[10px] font-black text-amber-400 uppercase">
                              Strategy: {personality}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {formatPrice(f.remainingPurse)} purse
                        </span>
                      </div>

                      {/* Primary Targets */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-zinc-400 font-black uppercase block mb-1">
                          PRIMARY TARGET SHORTLIST ({shortlist.primaryTargets.length})
                        </span>
                        {shortlist.primaryTargets.length === 0 ? (
                          <div className="text-xs text-zinc-500">All initial targets acquired or unavailable.</div>
                        ) : (
                          shortlist.primaryTargets.slice(0, 5).map((t, i) => (
                            <div
                              key={t.playerId}
                              className={`p-2 rounded-lg flex items-center justify-between text-xs font-bold ${
                                t.isAcquired ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300' : 'bg-black/60 text-zinc-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-amber-400 font-mono text-[10px]">#{t.priorityRank}</span>
                                <span>{t.playerName}</span>
                                <span className="text-[10px] text-zinc-400">({t.primaryRole})</span>
                              </div>
                              <span className="text-amber-300 font-mono text-[11px]">
                                {t.isAcquired ? '✓ Acquired' : formatPrice(t.targetMaxBid)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Promoted Alternatives */}
                      {shortlist.promotedAlternatives.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-zinc-800 space-y-1.5">
                          <span className="text-[10px] text-sky-400 font-black uppercase block mb-1">
                            PROMOTED FALLBACK REPLACEMENTS ({shortlist.promotedAlternatives.length})
                          </span>
                          {shortlist.promotedAlternatives.map((alt) => (
                            <div key={alt.playerId} className="p-2 rounded-lg bg-sky-950/40 border border-sky-800/60 text-xs font-bold text-sky-200 flex items-center justify-between">
                              <span>⚡ {alt.playerName} ({alt.primaryRole})</span>
                              <span className="font-mono text-[11px] text-amber-300">{formatPrice(alt.targetMaxBid)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

