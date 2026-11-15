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
  isOpen?: boolean;
}

export function CpuDecisionInspectorModal({
  session,
  onClose,
  isOpen = true,
}: CpuDecisionInspectorModalProps) {
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('all');
  const [activeView, setActiveView] = useState<'logs' | 'shortlists'>('logs');

  if (!isOpen) return null;

  const allLogs = getDecisionLogs(session.id);
  const filteredLogs = selectedFranchiseId === 'all'
    ? allLogs
    : allLogs.filter((l) => l.franchiseId === selectedFranchiseId);

  // Sort logs most recent first
  const displayLogs = [...filteredLogs].reverse();

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-none flex items-center justify-center p-3 sm:p-5">
      <div className="neo-box-lg bg-[var(--m-panel)] rounded-none max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[var(--m-text)] border-[3px] border-[var(--m-ink)] shadow-[8px_8px_0px_var(--m-ink)]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-[3px] border-[var(--m-ink)] bg-[var(--m-gold)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-[var(--m-panel)] border-2 border-[var(--m-ink)] flex items-center justify-center shadow-[2px_2px_0px_var(--m-ink)]">
              <Brain className="w-5 h-5 text-[var(--m-text)]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black uppercase text-[var(--m-text)] flex items-center gap-2">
                CPU AUCTION AI INSPECTOR & DECISION LOGS
              </h3>
              <p className="text-xs text-[var(--m-dim)] font-bold">
                Real-time explainable decision audit for all 9 CPU General Managers
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="neo-btn w-9 h-9 rounded-none bg-[var(--m-red)] text-white border-2 border-[var(--m-ink)] shadow-[2px_2px_0px_var(--m-ink)] flex items-center justify-center font-black"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        {/* View Switcher & Franchise Filter Bar */}
        <div className="p-3 border-b-2 border-[var(--m-ink)] bg-[var(--m-raised)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('logs')}
              className={`neo-btn px-3 py-1.5 rounded-none text-xs font-black uppercase border border-[var(--m-ink)] shadow-[1.5px_1.5px_0px_var(--m-ink)] ${
                activeView === 'logs' ? 'bg-[var(--m-gold)] text-white' : 'bg-[var(--m-panel)] text-[var(--m-faint)]'
              }`}
            >
              Live Bidding Logs ({allLogs.length})
            </button>
            <button
              onClick={() => setActiveView('shortlists')}
              className={`neo-btn px-3 py-1.5 rounded-none text-xs font-black uppercase border border-[var(--m-ink)] shadow-[1.5px_1.5px_0px_var(--m-ink)] ${
                activeView === 'shortlists' ? 'bg-[var(--m-gold)] text-white' : 'bg-[var(--m-panel)] text-[var(--m-faint)]'
              }`}
            >
              Franchise Shortlists & Plans
            </button>
          </div>

          {/* Franchise Select */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[var(--m-dim)]" />
            <select
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
              className="neo-input py-1 px-2.5 rounded-lg text-xs font-bold bg-[var(--m-panel)] text-ink border border-[var(--m-line)]"
            >
              <option value="all">All Franchises</option>
              {session.franchises.filter((f) => !f.isHumanControlled).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({getFranchiseActivePersonality(session.id, f)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeView === 'logs' ? (
            displayLogs.length === 0 ? (
              <div className="p-12 text-center text-[var(--m-faint)] font-bold text-sm">
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
                      className="neo-box p-3.5 sm:p-4 rounded-xl bg-[var(--m-panel)] border-2 border-[var(--m-ink)] transition-all"
                    >
                      {/* Top Row: Team + Decision + Price */}
                      <div className="flex flex-wrap items-center justify-between pb-2 mb-2 border-b border-[var(--m-line)] gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center border border-[var(--m-ink)]"
                            style={{ backgroundColor: theme.primary, color: theme.textLight }}
                          >
                            {log.franchiseName[0]}
                          </span>
                          <div>
                            <span className="text-sm font-black text-ink">{log.franchiseName}</span>
                            <span className="neo-badge ml-2 px-1.5 py-0.5 rounded bg-[var(--m-raised)] text-amber-400 text-[10px] font-black">
                              {log.personalityArchetype}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`neo-badge px-2.5 py-0.5 rounded text-xs font-black ${
                            isBid ? 'bg-[var(--m-green)] text-white' : 'bg-[var(--m-raised)] text-[var(--m-dim)]'
                          }`}>
                            {log.decision}
                          </span>
                          <span className="text-xs font-mono font-bold text-ink/80">
                            At {formatPrice(log.minNextBidLakhs)} (Max: {formatPrice(log.maxValuationLakhs)})
                          </span>
                        </div>
                      </div>

                      {/* Middle Row: Player Info & Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-ink/80">
                        <div className="bg-ink/40 p-2 rounded-lg">
                          <span className="text-[10px] text-[var(--m-faint)] block uppercase">TARGET PLAYER</span>
                          <span className="text-ink font-black">{log.playerName}</span>
                          <span className="text-[10px] text-[var(--m-dim)] block">{log.ratingsOverall} OVR • {log.role}</span>
                        </div>

                        <div className="bg-ink/40 p-2 rounded-lg">
                          <span className="text-[10px] text-[var(--m-faint)] block uppercase">SQUAD NEED & XI IMPACT</span>
                          <span className="text-emerald-400 font-black">
                            {log.xiImprovement > 0 ? `+${log.xiImprovement} XI Gain` : `Depth (+${log.depthImprovement})`}
                          </span>
                          <span className="text-[10px] text-[var(--m-dim)] block">Need: {log.squadNeedScore}/100</span>
                        </div>

                        <div className="bg-ink/40 p-2 rounded-lg">
                          <span className="text-[10px] text-[var(--m-faint)] block uppercase">MARKET & ALTERNATIVES</span>
                          <span className="text-amber-400 font-black">{formatPrice(log.marketValuation.fairValue)} Fair</span>
                          <span className="text-[10px] text-[var(--m-dim)] block">{log.alternativesRemaining} Alternatives Left</span>
                        </div>

                        <div className="bg-ink/40 p-2 rounded-lg">
                          <span className="text-[10px] text-[var(--m-faint)] block uppercase">BUDGET DISCIPLINE</span>
                          <span className="text-ink font-black">{formatPrice(log.budgetImpact.remainingPurse)} Left</span>
                          <span className="text-[10px] text-[var(--m-dim)] block">{log.budgetImpact.openSlots} Slots (~{formatPrice(log.budgetImpact.budgetPerSlot)}/slot)</span>
                        </div>
                      </div>

                      {/* Reason Description */}
                      <div className="mt-2.5 pt-2 border-t border-[var(--m-line)]/80 text-xs text-ink/80 flex items-start gap-1.5">
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
                  const personality = getFranchiseActivePersonality(session.id, f);
                  const theme = getTeamTheme(f.id);

                  return (
                    <div key={f.id} className="neo-box p-4 rounded-xl bg-[var(--m-panel)] border-2 border-[var(--m-ink)]">
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--m-line)] mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-md font-black text-xs flex items-center justify-center border border-[var(--m-ink)]"
                            style={{ backgroundColor: theme.primary, color: theme.textLight }}
                          >
                            {f.name[0]}
                          </span>
                          <div>
                            <h4 className="text-sm font-black text-ink">{f.name}</h4>
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
                        <span className="text-[10px] text-[var(--m-dim)] font-black uppercase block mb-1">
                          PRIMARY TARGET SHORTLIST ({shortlist.primaryTargets.length})
                        </span>
                        {shortlist.primaryTargets.length === 0 ? (
                          <div className="text-xs text-[var(--m-faint)]">All initial targets acquired or unavailable.</div>
                        ) : (
                          shortlist.primaryTargets.slice(0, 5).map((t, i) => (
                            <div
                              key={t.playerId}
                              className={`p-2 rounded-lg flex items-center justify-between text-xs font-bold ${
                                t.isAcquired ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300' : 'bg-ink/40 text-ink/80'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-amber-400 font-mono text-[10px]">#{t.priorityRank}</span>
                                <span>{t.playerName}</span>
                                <span className="text-[10px] text-[var(--m-dim)]">({t.primaryRole})</span>
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
                        <div className="mt-3 pt-2 border-t border-[var(--m-line)] space-y-1.5">
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

