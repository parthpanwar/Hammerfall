'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { formatPrice } from '@/lib/utils';
import {
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  TrendingDown,
  UserCheck,
  FileText,
  ArrowRight,
  Sparkles,
  Calendar,
  AlertCircle,
  Award,
} from 'lucide-react';
import type { SeasonTransitionStep } from '@/lib/types/career';

interface SeasonTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SeasonTransitionModal({ isOpen, onClose }: SeasonTransitionModalProps) {
  const {
    currentSeason,
    humanFranchiseId,
    franchises,
    seasonAwards,
    careerState,
    advanceSeason,
    setPhase,
  } = useGameStore();

  const [step, setStep] = useState<SeasonTransitionStep>('SEASON_REVIEW');
  const humanTheme = getTeamTheme(humanFranchiseId);
  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);

  if (!isOpen) return null;

  const orangeCap = seasonAwards.find((a) => a.type === 'OrangeCap');
  const purpleCap = seasonAwards.find((a) => a.type === 'PurpleCap');
  const mvp = seasonAwards.find((a) => a.type === 'MVP');

  const humanPlayers = humanFranchise?.players || [];
  const progressionDeltas = careerState.recentProgressionDeltas.filter((d) =>
    humanPlayers.some((p) => p.id === d.playerId)
  );
  const recentRetirements = careerState.retirements.filter(
    (r) => r.retirementSeason === currentSeason
  );

  const nextSeason = currentSeason + 1;
  const isMega = (nextSeason - 2026) % 3 === 0;

  const handleCompleteAdvance = () => {
    advanceSeason();
    setPhase('Retention');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="neo-box w-full max-w-4xl max-h-[90vh] bg-zinc-950 rounded-2xl flex flex-col overflow-hidden border-[3px] border-black shadow-[8px_8px_0px_#000]">
        {/* Header Bar */}
        <div
          className="p-4 sm:p-5 border-b-[2.5px] border-black flex items-center justify-between"
          style={{ backgroundColor: humanTheme.primary, color: humanTheme.textLight }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                DYNASTY TRANSITION WIZARD
              </h2>
              <p className="text-xs font-bold opacity-90">
                Season {currentSeason} Conclusion &bull; Preparing for Season {nextSeason}
              </p>
            </div>
          </div>
          <div className="neo-badge px-3 py-1 rounded bg-black text-white text-xs font-black">
            {step === 'SEASON_REVIEW' && 'STEP 1 / 4: HONORS'}
            {step === 'PLAYER_DEVELOPMENT' && 'STEP 2 / 4: DEVELOPMENT'}
            {step === 'RETIREMENTS' && 'STEP 3 / 4: RETIREMENTS'}
            {step === 'AUCTION_PREP' && 'STEP 4 / 4: NEW SEASON'}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: SEASON REVIEW */}
          {step === 'SEASON_REVIEW' && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <span className="neo-badge px-2.5 py-0.5 rounded bg-amber-400 text-black text-[11px] font-black inline-block">
                  SEASON {currentSeason} WRAP-UP
                </span>
                <h3 className="text-2xl font-black uppercase text-white">
                  INDIVIDUAL HONORS & MILESTONES
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="neo-box p-4 rounded-xl bg-zinc-900 text-center">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 text-black flex items-center justify-center mx-auto mb-2 border border-black shadow-[2px_2px_0px_#000]">
                    <Flame className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="text-xs font-black text-orange-400 uppercase">Orange Cap</div>
                  <div className="text-base font-black text-white mt-1 truncate">
                    {orangeCap?.playerName || 'Tournament Top Scorer'}
                  </div>
                  <div className="text-2xl font-black text-orange-400 mt-1">
                    {orangeCap?.value || 640} <span className="text-xs font-bold text-zinc-400">runs</span>
                  </div>
                </div>

                <div className="neo-box p-4 rounded-xl bg-zinc-900 text-center">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 text-white flex items-center justify-center mx-auto mb-2 border border-black shadow-[2px_2px_0px_#000]">
                    <Zap className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="text-xs font-black text-purple-400 uppercase">Purple Cap</div>
                  <div className="text-base font-black text-white mt-1 truncate">
                    {purpleCap?.playerName || 'Leading Wicket-Taker'}
                  </div>
                  <div className="text-2xl font-black text-purple-400 mt-1">
                    {purpleCap?.value || 24} <span className="text-xs font-bold text-zinc-400">wickets</span>
                  </div>
                </div>

                <div className="neo-box p-4 rounded-xl bg-zinc-900 text-center">
                  <div className="w-10 h-10 rounded-lg bg-amber-400 text-black flex items-center justify-center mx-auto mb-2 border border-black shadow-[2px_2px_0px_#000]">
                    <Award className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="text-xs font-black text-amber-400 uppercase">Tournament MVP</div>
                  <div className="text-base font-black text-white mt-1 truncate">
                    {mvp?.playerName || 'Most Valuable Player'}
                  </div>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    {mvp?.value || 810} <span className="text-xs font-bold text-zinc-400">pts</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PLAYER DEVELOPMENT */}
          {step === 'PLAYER_DEVELOPMENT' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <span className="neo-badge px-2.5 py-0.5 rounded bg-emerald-400 text-black text-[11px] font-black inline-block">
                  PROGRESSION & AGING
                </span>
                <h3 className="text-2xl font-black uppercase text-white">
                  {humanFranchise?.shortName} SQUAD DEVELOPMENT
                </h3>
                <p className="text-xs text-zinc-400">
                  Ratings have evolved probabilistically based on ML age curves, season game-time, and role ceilings.
                </p>
              </div>

              <div className="neo-box rounded-xl bg-zinc-900 border-2 border-black overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/60 text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Player</th>
                      <th className="py-2.5 px-3">New Age</th>
                      <th className="py-2.5 px-3">Previous OVR</th>
                      <th className="py-2.5 px-3">New OVR</th>
                      <th className="py-2.5 px-3">Delta</th>
                      <th className="py-2.5 px-3">Development Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-bold">
                    {progressionDeltas.map((d) => (
                      <tr key={d.playerId} className="hover:bg-zinc-800/40">
                        <td className="py-2 px-3 font-black text-white">{d.playerName}</td>
                        <td className="py-2 px-3 text-zinc-400">{d.age}</td>
                        <td className="py-2 px-3 text-zinc-400">{d.previousOverall}</td>
                        <td className="py-2 px-3 font-black text-amber-400">{d.newOverall}</td>
                        <td className="py-2 px-3">
                          {d.overallDelta > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-400 font-black">
                              <TrendingUp className="w-3.5 h-3.5" /> +{d.overallDelta}
                            </span>
                          ) : d.overallDelta < 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-red-400 font-black">
                              <TrendingDown className="w-3.5 h-3.5" /> {d.overallDelta}
                            </span>
                          ) : (
                            <span className="text-zinc-500 font-bold">&plusmn;0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-zinc-400">{d.progressionNote}</td>
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
                <span className="neo-badge px-2.5 py-0.5 rounded bg-purple-400 text-black text-[11px] font-black inline-block">
                  CAREER FAREWELLS
                </span>
                <h3 className="text-2xl font-black uppercase text-white">
                  LEAGUE RETIREMENTS & HALL OF FAME
                </h3>
                <p className="text-xs text-zinc-400">
                  Veteran cricketers who have announced their retirement. Full lifetime stats remain preserved in records.
                </p>
              </div>

              {recentRetirements.length === 0 ? (
                <div className="neo-box p-6 rounded-xl bg-zinc-900 text-center text-zinc-400 font-bold text-xs">
                  No players retired this season! All active veterans have confirmed participation for Season {nextSeason}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                  {recentRetirements.map((r) => (
                    <div key={r.playerId} className="neo-box p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-white text-sm">{r.playerName}</span>
                        {r.hallOfFame && (
                          <span className="neo-badge px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black">
                            HALL OF FAME
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Age {r.age} &bull; Reason: {r.reason}
                      </div>
                      <div className="mt-2 text-xs font-bold text-zinc-300 flex items-center gap-3">
                        <span>{r.careerMatches} matches</span>
                        <span>{r.careerRuns} runs</span>
                        <span>{r.careerWickets} wickets</span>
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
                <span className="neo-badge px-2.5 py-0.5 rounded bg-cyan-400 text-black text-[11px] font-black inline-block">
                  LOOKING AHEAD
                </span>
                <h3 className="text-2xl font-black uppercase text-white">
                  WELCOME TO IPL {nextSeason}
                </h3>
                <p className="text-xs text-zinc-400">
                  Financial parameters and auction format for the upcoming campaign.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="neo-box p-5 rounded-xl bg-zinc-900 space-y-2">
                  <div className="text-xs font-black text-cyan-400 uppercase">Auction Format</div>
                  <div className="text-2xl font-black text-white">
                    {isMega ? 'IPL MEGA AUCTION' : 'IPL MINI AUCTION'}
                  </div>
                  <p className="text-xs text-zinc-400">
                    {isMega
                      ? '3-year contract cycle reset. Retain up to 6 players, remainder re-enter auction.'
                      : 'Continuing contracts maintained. Release surplus players to replenish auction purse.'}
                  </p>
                </div>

                <div className="neo-box p-5 rounded-xl bg-zinc-900 space-y-2">
                  <div className="text-xs font-black text-emerald-400 uppercase">Salary Cap Purse</div>
                  <div className="text-2xl font-black text-emerald-400">
                    {formatPrice(12000 + (nextSeason - 2026) * 500)}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Increased by ₹5 Cr in accordance with official IPL league salary cap inflation.
                  </p>
                </div>
              </div>

              <div className="neo-box p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs font-medium flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Clicking <strong>Launch Season {nextSeason}</strong> will finalize development, generate 24 new rookie draft class players, and open the pre-auction phase.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-900/80 border-t-[2.5px] border-black flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 'PLAYER_DEVELOPMENT') setStep('SEASON_REVIEW');
              if (step === 'RETIREMENTS') setStep('PLAYER_DEVELOPMENT');
              if (step === 'AUCTION_PREP') setStep('RETIREMENTS');
            }}
            disabled={step === 'SEASON_REVIEW'}
            className="neo-btn px-4 py-2 rounded-xl text-xs font-black uppercase text-zinc-400 disabled:opacity-30"
          >
            Back
          </button>

          {step !== 'AUCTION_PREP' ? (
            <button
              onClick={() => {
                if (step === 'SEASON_REVIEW') setStep('PLAYER_DEVELOPMENT');
                else if (step === 'PLAYER_DEVELOPMENT') setStep('RETIREMENTS');
                else if (step === 'RETIREMENTS') setStep('AUCTION_PREP');
              }}
              className="neo-btn px-6 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5"
              style={{ backgroundColor: humanTheme.primary, color: humanTheme.textLight }}
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          ) : (
            <button
              onClick={handleCompleteAdvance}
              className="neo-btn px-8 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black shadow-[3px_3px_0px_#000]"
            >
              <Sparkles className="w-4 h-4" />
              <span>LAUNCH SEASON {nextSeason}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

