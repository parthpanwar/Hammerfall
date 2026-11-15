'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { SeasonTransitionStep } from '@/lib/types/career';
import { auctionTypeFor } from '@/lib/flow/season-flow';

interface SeasonTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SeasonTransitionModal({ isOpen, onClose }: SeasonTransitionModalProps) {
  const {
    currentSeason,
    humanFranchiseId,
    franchises,
    careerState,
    advanceSeason,
    settings,
    setPhase,
  } = useGameStore();

  const [step, setStep] = useState<SeasonTransitionStep>('PLAYER_DEVELOPMENT');
  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);

  if (!isOpen) return null;


  const humanPlayers = humanFranchise?.players || [];
  const progressionDeltas = careerState.recentProgressionDeltas.filter((d) =>
    humanPlayers.some((p) => p.id === d.playerId)
  );
  const recentRetirements = careerState.retirements.filter(
    (r) => r.retirementSeason === currentSeason
  );

  const nextSeason = currentSeason + 1;
  const isMega = auctionTypeFor(nextSeason, settings) === 'Mega';

  const handleCompleteAdvance = () => {
    advanceSeason();
    setPhase('Retention');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-in fade-in duration-150">
      <div className="terminal-card w-full max-w-4xl max-h-[90vh] bg-[var(--m-panel)] rounded-2xl flex flex-col overflow-hidden border border-[var(--m-line)] shadow-2xl relative">
        {/* Header Bar */}
        <div className="p-5 border-b border-[var(--m-line)] bg-[var(--m-panel)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[var(--m-accent-ink)]" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-[var(--m-text)] font-heading">
                Preparing IPL {nextSeason}
              </h2>
              <p className="text-xs text-[var(--m-dim)] font-medium">
                Season {currentSeason} Conclusion &bull; Preparing for Season {nextSeason}
              </p>
            </div>
          </div>
          <div className="telemetry-badge-sm bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30 text-xs font-bold">
            {step === 'PLAYER_DEVELOPMENT' && 'Step 1 of 3 · Development'}
            {step === 'RETIREMENTS' && 'Step 2 of 3 · Retirements'}
            {step === 'AUCTION_PREP' && 'Step 3 of 3 · New season'}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-[var(--m-panel)]">
          {step === 'PLAYER_DEVELOPMENT' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <span className="telemetry-badge-sm bg-[var(--m-green)]/15 text-[var(--m-green)] border border-[var(--m-green)]/30 text-[11px] font-bold inline-block">
                  PROGRESSION & AGING
                </span>
                <h3 className="text-2xl font-bold uppercase text-[var(--m-text)] font-heading">
                  {humanFranchise?.shortName} Squad Development
                </h3>
                <p className="text-xs text-[var(--m-dim)] font-medium">
                  Ratings have evolved probabilistically based on ML age curves, season game-time, and role ceilings.
                </p>
              </div>

              <div className="terminal-card rounded-xl overflow-hidden max-h-72 overflow-y-auto border border-[var(--m-line)]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[var(--m-panel)] text-[var(--m-dim)] uppercase text-[10px] font-bold border-b border-[var(--m-line)]">
                    <tr>
                      <th className="py-2.5 px-3">Player</th>
                      <th className="py-2.5 px-3">New Age</th>
                      <th className="py-2.5 px-3">Previous OVR</th>
                      <th className="py-2.5 px-3">New OVR</th>
                      <th className="py-2.5 px-3">Delta</th>
                      <th className="py-2.5 px-3">Development Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--m-line)]/50 font-medium">
                    {progressionDeltas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--m-dim)]">
                          Ratings update when you launch the new season. You will see who improved in the Franchise Office.
                        </td>
                      </tr>
                    )}
                    {progressionDeltas.map((d, idx) => (
                      <tr key={d.playerId} className={idx % 2 === 0 ? 'bg-[var(--m-panel)]' : 'bg-[var(--m-panel)]'}>
                        <td className="py-2 px-3 font-bold text-[var(--m-text)]">{d.playerName}</td>
                        <td className="py-2 px-3 text-[var(--m-dim)] tabular-nums">{d.age}</td>
                        <td className="py-2 px-3 text-[var(--m-dim)] tabular-nums">{d.previousOverall}</td>
                        <td className="py-2 px-3 font-bold text-[var(--m-text)] tabular-nums">{d.newOverall}</td>
                        <td className="py-2 px-3">
                          {d.overallDelta > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[var(--m-green)] font-bold tabular-nums">
                              <TrendingUp className="w-3.5 h-3.5" /> +{d.overallDelta}
                            </span>
                          ) : d.overallDelta < 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[var(--m-red)] font-bold tabular-nums">
                              <TrendingDown className="w-3.5 h-3.5" /> {d.overallDelta}
                            </span>
                          ) : (
                            <span className="text-[var(--m-dim)] font-medium">&plusmn;0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-[var(--m-dim)]">{d.progressionNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: RETIREMENTS */}
          {step === 'RETIREMENTS' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <span className="telemetry-badge-sm bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30 text-[11px] font-bold inline-block">
                  CAREER FAREWELLS
                </span>
                <h3 className="text-2xl font-bold uppercase text-[var(--m-text)] font-heading">
                  League Retirements & Hall of Fame
                </h3>
                <p className="text-xs text-[var(--m-dim)] font-medium">
                  Veteran cricketers who have announced their retirement. Full lifetime stats remain preserved in records.
                </p>
              </div>

              {recentRetirements.length === 0 ? (
                <div className="p-6 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] text-center text-[var(--m-dim)] font-medium text-xs">
                  No players retired this season! All active veterans have confirmed participation for Season {nextSeason}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                  {recentRetirements.map((r) => (
                    <div key={r.playerId} className="p-4 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--m-text)] text-sm">{r.playerName}</span>
                        {r.hallOfFame && (
                          <span className="telemetry-badge-sm bg-[var(--m-gold)]/20 text-[var(--m-gold)] border border-[var(--m-gold)]/40 text-[10px] font-bold">
                            HALL OF FAME
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--m-dim)] font-medium mt-1">
                        Age {r.age} &bull; Reason: {r.reason}
                      </div>
                      <div className="mt-2 text-xs font-semibold text-[var(--m-text)] flex items-center gap-3">
                        <span>{r.careerMatches} matches</span>
                        <span className="text-[var(--m-gold)]">{r.careerRuns} runs</span>
                        <span className="text-[var(--m-accent-ink)]">{r.careerWickets} wickets</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: AUCTION PREP & NEW SEASON */}
          {step === 'AUCTION_PREP' && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <span className="telemetry-badge-sm bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30 text-[11px] font-bold inline-block">
                  LOOKING AHEAD
                </span>
                <h3 className="text-2xl font-bold uppercase text-[var(--m-text)] font-heading">
                  Welcome to IPL {nextSeason}
                </h3>
                <p className="text-xs text-[var(--m-dim)] font-medium">
                  Financial parameters and auction format for the upcoming campaign.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] space-y-2">
                  <div className="text-xs font-bold text-[var(--m-accent-ink)] uppercase">Auction Format</div>
                  <div className="text-2xl font-bold text-[var(--m-text)]">
                    {isMega ? `MEGA AUCTION · NOV ${currentSeason}` : `MINI AUCTION · DEC ${currentSeason}`}
                  </div>
                  <p className="text-xs text-[var(--m-dim)] font-medium">
                    {isMega
                      ? '3-year contract cycle reset. Retain up to 6 players, remainder re-enter auction.'
                      : 'Continuing contracts maintained. Release surplus players to replenish auction purse.'}
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] space-y-2">
                  <div className="text-xs font-bold text-[var(--m-green)] uppercase">Salary Cap Purse</div>
                  <div className="text-2xl font-bold font-mono text-[var(--m-green)]">
                    {formatPrice(12000 + (nextSeason - 2026) * 500)}
                  </div>
                  <p className="text-xs text-[var(--m-dim)] font-medium">
                    Increased by ₹5 Cr in accordance with official IPL league salary cap inflation.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-text)] text-xs font-medium flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--m-gold)] shrink-0" />
                <span>
                  Clicking <strong>Launch Season {nextSeason}</strong> will finalize development, add a new intake of young players to the auction pool, and open retentions.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--m-panel)] border-t border-[var(--m-line)] flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 'RETIREMENTS') setStep('PLAYER_DEVELOPMENT');
              if (step === 'AUCTION_PREP') setStep('RETIREMENTS');
            }}
            disabled={step === 'PLAYER_DEVELOPMENT'}
            className="sports-btn px-4 py-2 rounded-lg text-xs font-bold uppercase text-[var(--m-dim)] border border-[var(--m-line)] bg-[var(--m-raised)] hover:text-[var(--m-text)] hover:bg-[var(--m-line)] disabled:opacity-30 transition-colors"
          >
            Back
          </button>

          {step !== 'AUCTION_PREP' ? (
            <button
              onClick={() => {
                if (step === 'PLAYER_DEVELOPMENT') setStep('RETIREMENTS');
                else if (step === 'RETIREMENTS') setStep('AUCTION_PREP');
              }}
              className="sports-btn px-6 py-2.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 bg-[var(--m-accent-ink)] text-white hover:bg-[var(--m-accent-ink)]/90 transition-colors shadow-md shadow-[var(--m-accent-ink)]/20"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleCompleteAdvance}
              className="sports-btn px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-[var(--m-green)] hover:bg-[var(--m-green)]/90 text-white transition-colors shadow-lg shadow-[var(--m-green)]/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Season {nextSeason}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
