'use client';

import React, { useState } from 'react';
import type { Player, Franchise } from '@/lib/types/game';
import {
  generatePlayerIntelligenceDossier,
  evaluateFranchiseFit,
} from '@/lib/intelligence/valuation/player-intelligence';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { formatPrice } from '@/lib/utils';
import {
  Shield,
  X,
  TrendingUp,
  Award,
  Zap,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Activity,
  Layers,
  Sparkles,
  Flame,
} from 'lucide-react';

interface PlayerScoutingModalProps {
  player: Player | null;
  franchise: Franchise;
  onClose: () => void;
}

export function PlayerScoutingModal({
  player,
  franchise,
  onClose,
}: PlayerScoutingModalProps) {
  if (!player) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'seasons' | 'projections' | 'fit'>('overview');

  const dossier = generatePlayerIntelligenceDossier(player);
  const fitReport = evaluateFranchiseFit(player, franchise, dossier);
  const theme = getTeamTheme(franchise.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="neo-box-lg bg-zinc-950 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-zinc-100">
        {/* Header Bar */}
        <div
          className="p-5 border-b-[2.5px] border-black flex items-center justify-between"
          style={{ backgroundColor: theme.cardBg }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl border-2 border-black flex items-center justify-center font-black text-xl shadow-[2.5px_2.5px_0px_#000]"
              style={{
                backgroundColor: theme.primary,
                color: theme.textLight,
              }}
            >
              {player.name[0]}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                  {player.name}
                </h3>
                {player.nationality === 'Overseas' ? (
                  <span className="neo-badge px-2 py-0.5 rounded bg-sky-400 text-black text-[10px]">
                    ✈ {player.country}
                  </span>
                ) : (
                  <span className="neo-badge px-2 py-0.5 rounded bg-amber-400 text-black text-[10px]">
                    🇮🇳 INDIA
                  </span>
                )}
                <span className="neo-badge px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[10px]">
                  {dossier.ageProfile.careerPhase}
                </span>
              </div>
              <div className="text-xs text-zinc-300 font-bold mt-0.5">
                {player.role} • {player.age} yrs • {player.battingHand} Bat • {player.bowlingStyle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="neo-badge px-3 py-1 rounded-xl bg-black text-amber-400 text-sm font-black hidden sm:inline-block">
              {dossier.projection.overallImpactScore} IMPACT
            </span>
            <button
              onClick={onClose}
              className="neo-btn w-9 h-9 rounded-xl bg-red-500 hover:bg-red-400 text-white flex items-center justify-center font-black"
            >
              <X className="w-5 h-5 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Neo-Pills) */}
        <div className="flex items-center gap-2 px-5 py-3 border-b-2 border-black bg-zinc-900/90 overflow-x-auto">
          {[
            { id: 'overview', label: 'SCOUTING OVERVIEW' },
            { id: 'seasons', label: 'HISTORICAL SEASONS' },
            { id: 'projections', label: 'ML PROJECTIONS' },
            { id: 'fit', label: `${franchise.abbreviation} SQUAD FIT` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`neo-btn px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-400 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Top Key Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="neo-box-sm p-3 rounded-xl bg-zinc-900">
                  <div className="text-[10px] text-zinc-400 font-black uppercase">CURRENT ABILITY</div>
                  <div className="text-2xl font-black text-white mt-0.5">{player.ratings.overall} <span className="text-xs text-zinc-500">OVR</span></div>
                  <div className="text-[10px] text-emerald-400 font-bold mt-1">Peak: {dossier.ageProfile.projectedPeakAbility} OVR</div>
                </div>

                <div className="neo-box-sm p-3 rounded-xl bg-zinc-900">
                  <div className="text-[10px] text-zinc-400 font-black uppercase">PREDICTED IMPACT</div>
                  <div className="text-2xl font-black text-amber-400 mt-0.5">{dossier.projection.overallImpactScore} <span className="text-xs text-zinc-500">/ 100</span></div>
                  <div className="text-[10px] text-zinc-400 font-bold mt-1">Conf: {dossier.confidenceLevel}%</div>
                </div>

                <div className="neo-box-sm p-3 rounded-xl bg-zinc-900">
                  <div className="text-[10px] text-zinc-400 font-black uppercase">FAIR AUCTION VALUE</div>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">{formatPrice(dossier.marketValuation.fairValue)}</div>
                  <div className="text-[10px] text-zinc-400 font-bold mt-1">Range: {formatPrice(dossier.marketValuation.priceFloor)} - {formatPrice(dossier.marketValuation.priceCeiling)}</div>
                </div>

                <div className="neo-box-sm p-3 rounded-xl bg-zinc-900">
                  <div className="text-[10px] text-zinc-400 font-black uppercase">DEMAND TIER</div>
                  <div className="text-base font-black text-white mt-1 leading-tight">{dossier.marketValuation.expectedDemandTier}</div>
                  <div className="text-[10px] text-amber-300 font-bold mt-1">Longevity: ~{dossier.ageProfile.expectedLongevitySeasons} yrs</div>
                </div>
              </div>

              {/* Match Phase Effectiveness */}
              <div className="neo-box p-4 rounded-xl bg-zinc-900">
                <div className="text-xs font-black uppercase text-zinc-300 mb-3 flex items-center justify-between">
                  <span>T20 MATCH PHASE EFFECTIVENESS</span>
                  <span className="neo-badge px-2 py-0.5 rounded bg-black text-zinc-400 text-[10px]">CRICSHEET BALL-BY-BALL</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="neo-box-sm p-2.5 rounded-lg bg-black">
                    <span className="text-[10px] text-zinc-400 font-black block">POWERPLAY (OVERS 1-6)</span>
                    <span className="text-xl font-black text-amber-400">{dossier.phaseStrengths.powerplay}</span>
                    <span className="text-[10px] text-zinc-500 block">/ 100</span>
                  </div>
                  <div className="neo-box-sm p-2.5 rounded-lg bg-black">
                    <span className="text-[10px] text-zinc-400 font-black block">MIDDLE OVERS (7-15)</span>
                    <span className="text-xl font-black text-amber-400">{dossier.phaseStrengths.middle}</span>
                    <span className="text-[10px] text-zinc-500 block">/ 100</span>
                  </div>
                  <div className="neo-box-sm p-2.5 rounded-lg bg-black">
                    <span className="text-[10px] text-zinc-400 font-black block">DEATH OVERS (16-20)</span>
                    <span className="text-xl font-black text-amber-400">{dossier.phaseStrengths.death}</span>
                    <span className="text-[10px] text-zinc-500 block">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Tactical Roles Breakdown */}
              <div className="neo-box p-4 rounded-xl bg-zinc-900">
                <div className="text-xs font-black uppercase text-zinc-300 mb-3 flex items-center justify-between">
                  <span>11 TACTICAL ROLE PROFICIENCIES</span>
                  <span className="neo-badge px-2 py-0.5 rounded bg-black text-amber-400 text-[10px]">PRIMARY: {dossier.primaryTacticalRole}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(dossier.tacticalRoleScores).map(([role, score]) => (
                    <div
                      key={role}
                      className={`neo-box-sm p-2 rounded-lg flex items-center justify-between ${
                        score >= 80 ? 'bg-black text-amber-300 border-amber-500' : 'bg-black text-zinc-300'
                      }`}
                    >
                      <span className="text-[11px] font-bold truncate max-w-[170px]">{role}</span>
                      <span className={`text-xs font-black ${score >= 80 ? 'text-amber-400' : 'text-zinc-400'}`}>{score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rolling Form & Consistency */}
              <div className="neo-box p-4 rounded-xl bg-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] text-zinc-400 font-black uppercase block">ROLLING FORM RATING</span>
                  <div className="text-xl font-black text-white mt-1">
                    {dossier.form.last5MatchesAvgRating} <span className="text-xs text-zinc-500">(Last 5 Matches)</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-bold mt-1">
                    Trend: <span className={dossier.form.momentumSlope >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {dossier.form.momentumSlope >= 0 ? `+${dossier.form.momentumSlope} (Ascending)` : `${dossier.form.momentumSlope} (Declining)`}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 font-black uppercase block">CONSISTENCY & VOLATILITY</span>
                  <div className="text-xl font-black text-white mt-1">
                    {dossier.form.consistencyScore} <span className="text-xs text-zinc-500">/ 100</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-bold mt-1">
                    Match Volatility: ±{dossier.form.volatilityIndex} pts
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 font-black uppercase block">PROVENANCE & AUDIT</span>
                  <div className="text-xs font-bold text-zinc-300 mt-1">
                    {dossier.provenance.source}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-bold mt-1">
                    Verified: {new Date(dossier.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HISTORICAL SEASONS */}
          {activeTab === 'seasons' && (
            <div className="space-y-5">
              {/* Batting Seasons Table */}
              <div className="neo-box p-4 rounded-xl bg-zinc-900">
                <div className="text-xs font-black uppercase text-white mb-3 pb-2 border-b-2 border-black flex items-center justify-between">
                  <span>AUTHENTIC BATTING RECORDS (BY SEASON)</span>
                  <span className="text-[10px] text-zinc-400 font-bold">SOURCE: CRICSHEET BALL-BY-BALL</span>
                </div>

                {dossier.seasons.batting.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500 font-bold">No verified top-order batting innings recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b-2 border-black text-zinc-400 font-black uppercase text-[10px]">
                          <th className="py-2 px-2">SEASON</th>
                          <th className="py-2 px-2 text-center">M</th>
                          <th className="py-2 px-2 text-center">INN</th>
                          <th className="py-2 px-2 text-right">RUNS</th>
                          <th className="py-2 px-2 text-right">AVG</th>
                          <th className="py-2 px-2 text-right">SR</th>
                          <th className="py-2 px-2 text-right">4S</th>
                          <th className="py-2 px-2 text-right">6S</th>
                          <th className="py-2 px-2 text-right">PP SR</th>
                          <th className="py-2 px-2 text-right">DEATH SR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 font-bold">
                        {dossier.seasons.batting.map((s) => (
                          <tr key={s.season} className="hover:bg-zinc-950">
                            <td className="py-2 px-2 font-black text-amber-400">IPL {s.season}</td>
                            <td className="py-2 px-2 text-center text-zinc-300">{s.matches}</td>
                            <td className="py-2 px-2 text-center text-zinc-300">{s.innings}</td>
                            <td className="py-2 px-2 text-right font-black text-white">{s.runs}</td>
                            <td className="py-2 px-2 text-right text-zinc-300">{s.average.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right font-black text-amber-400">{s.strikeRate.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right text-zinc-400">{s.fours}</td>
                            <td className="py-2 px-2 text-right text-zinc-400">{s.sixes}</td>
                            <td className="py-2 px-2 text-right text-sky-400 font-mono">{s.powerplaySR.toFixed(0)}</td>
                            <td className="py-2 px-2 text-right text-red-400 font-mono">{s.deathSR.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bowling Seasons Table */}
              <div className="neo-box p-4 rounded-xl bg-zinc-900">
                <div className="text-xs font-black uppercase text-white mb-3 pb-2 border-b-2 border-black flex items-center justify-between">
                  <span>AUTHENTIC BOWLING RECORDS (BY SEASON)</span>
                  <span className="text-[10px] text-zinc-400 font-bold">SOURCE: CRICSHEET BALL-BY-BALL</span>
                </div>

                {dossier.seasons.bowling.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500 font-bold">No verified regular bowling overs recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b-2 border-black text-zinc-400 font-black uppercase text-[10px]">
                          <th className="py-2 px-2">SEASON</th>
                          <th className="py-2 px-2 text-center">M</th>
                          <th className="py-2 px-2 text-right">OVERS</th>
                          <th className="py-2 px-2 text-right">WKTS</th>
                          <th className="py-2 px-2 text-right">ECON</th>
                          <th className="py-2 px-2 text-right">SR</th>
                          <th className="py-2 px-2 text-right">DOT %</th>
                          <th className="py-2 px-2 text-right">PP ECON</th>
                          <th className="py-2 px-2 text-right">DEATH ECON</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 font-bold">
                        {dossier.seasons.bowling.map((s) => (
                          <tr key={s.season} className="hover:bg-zinc-950">
                            <td className="py-2 px-2 font-black text-amber-400">IPL {s.season}</td>
                            <td className="py-2 px-2 text-center text-zinc-300">{s.matches}</td>
                            <td className="py-2 px-2 text-right text-zinc-300">{s.overs.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right font-black text-emerald-400">{s.wickets}</td>
                            <td className="py-2 px-2 text-right font-black text-white">{s.economy.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-zinc-300">{s.strikeRate.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right text-zinc-400">{s.dotBallPct.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right text-sky-400 font-mono">{s.powerplayEconomy.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-red-400 font-mono">{s.deathEconomy.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bayesian Shrinkage Transparency Block */}
              <div className="neo-box p-4 rounded-xl bg-black">
                <div className="text-xs font-black uppercase text-amber-400 mb-2 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> BAYESIAN SHRINKAGE AUDIT (SMALL SAMPLE REGULARIZATION)
                </div>
                <div className="text-xs text-zinc-300 font-medium leading-relaxed">
                  Raw observations are regularized toward universal T20 prior distributions (Avg 24.5, SR 130.0, Economy 8.45).
                  Current player sample confidence weight: <strong className="text-white">{(dossier.bayesian.sampleWeight * 100).toFixed(0)}%</strong> (Shrinkage factor: <strong className="text-amber-400">{dossier.bayesian.shrinkageFactor}</strong>).
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ML PROJECTIONS */}
          {activeTab === 'projections' && (
            <div className="space-y-5">
              <div className="neo-box p-5 rounded-2xl bg-zinc-900">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b-2 border-black gap-2">
                  <div>
                    <h4 className="text-base font-black uppercase text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      LIGHTGBM PLAYER PERFORMANCE ENGINE (MODEL 1)
                    </h4>
                    <p className="text-xs text-zinc-400 font-bold">
                      LightGBM Gradient-Boosted Tabular Regression • Outperformed Baseline by 78.3% Lower RMSE (R² = 0.98)
                    </p>
                  </div>
                  <span className="neo-badge px-2.5 py-0.5 rounded bg-emerald-400 text-black text-xs font-black">
                    UNCERTAINTY: ±{dossier.projection.uncertaintyStdDev} PTS
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="neo-box-sm p-3 rounded-xl bg-black text-center">
                    <span className="text-[10px] text-zinc-400 font-black uppercase block">PROJECTED RUNS</span>
                    <span className="text-2xl font-black text-amber-400">{dossier.projection.projectedBattingRuns}</span>
                    <span className="text-[10px] text-zinc-500 font-bold block">@ {dossier.projection.projectedBattingStrikeRate} SR</span>
                  </div>

                  <div className="neo-box-sm p-3 rounded-xl bg-black text-center">
                    <span className="text-[10px] text-zinc-400 font-black uppercase block">PROJECTED WICKETS</span>
                    <span className="text-2xl font-black text-emerald-400">{dossier.projection.projectedWickets}</span>
                    <span className="text-[10px] text-zinc-500 font-bold block">@ {dossier.projection.projectedEconomyRate} ER</span>
                  </div>

                  <div className="neo-box-sm p-3 rounded-xl bg-black text-center">
                    <span className="text-[10px] text-zinc-400 font-black uppercase block">PROJECTED IMPACT</span>
                    <span className="text-2xl font-black text-white">{dossier.projection.overallImpactScore}</span>
                    <span className="text-[10px] text-zinc-500 font-bold block">0 - 100 Calibrated</span>
                  </div>

                  <div className="neo-box-sm p-3 rounded-xl bg-black text-center">
                    <span className="text-[10px] text-zinc-400 font-black uppercase block">MODEL CONFIDENCE</span>
                    <span className="text-2xl font-black text-sky-400">{(dossier.confidenceLevel).toFixed(0)}%</span>
                    <span className="text-[10px] text-zinc-500 font-bold block">Sample Size Calibrated</span>
                  </div>
                </div>

                {/* Model 2: Multi-Season Development & Decline (1, 2, 3 seasons ahead) */}
                <div className="mt-5 p-4 rounded-xl bg-black border border-zinc-800">
                  <div className="text-xs font-black uppercase text-amber-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" /> MODEL 2: MULTI-SEASON DEVELOPMENT & LONGEVITY PROJECTIONS
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      Role Aging Curve ({dossier.ageProfile.peakAgeWindow[0]}-{dossier.ageProfile.peakAgeWindow[1]} yrs peak)
                    </span>
                  </div>

                  {dossier.longevityProjections && dossier.longevityProjections.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                      {dossier.longevityProjections.map((p) => (
                        <div key={p.season} className="neo-box-sm p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                          <div className="flex items-center justify-between text-xs font-black text-zinc-300 pb-1 border-b border-zinc-800">
                            <span>IPL {p.season}</span>
                            <span className="text-amber-400">{p.projectedAge} yrs</span>
                          </div>
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-lg font-black text-white">{p.projectedRating} <span className="text-[10px] text-zinc-400 font-bold">OVR</span></span>
                            <span className="text-[10px] text-zinc-400 font-mono">±{p.uncertaintyStdDev} σ</span>
                          </div>
                          <div className="text-[10px] font-bold text-emerald-400 uppercase mt-1">
                            {p.trajectoryPhase}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold text-zinc-300 mt-2">
                      <div>
                        <span className="text-zinc-500 text-[10px] block">CAREER PHASE</span>
                        <span className="text-white font-black">{dossier.ageProfile.careerPhase}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] block">PEAK AGE WINDOW</span>
                        <span className="text-white font-black">{dossier.ageProfile.peakAgeWindow[0]} - {dossier.ageProfile.peakAgeWindow[1]} Years</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] block">PROJECTED LONGEVITY</span>
                        <span className="text-emerald-400 font-black">~{dossier.ageProfile.expectedLongevitySeasons} More Seasons</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Model 3: Auction Market Valuation Distribution */}
                <div className="mt-4 p-4 rounded-xl bg-black border border-zinc-800">
                  <div className="text-xs font-black uppercase text-amber-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" /> MODEL 3: TWO-STAGE AUCTION MARKET VALUE ESTIMATOR
                    </span>
                    {dossier.marketValuation.soldProbability !== undefined && (
                      <span className="neo-badge px-2 py-0.5 rounded bg-emerald-400 text-black text-[10px] font-black">
                        PROBABILITY SOLD: {(dossier.marketValuation.soldProbability * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                    <div className="p-2.5 rounded-lg bg-zinc-900 text-center">
                      <span className="text-[9px] text-zinc-400 font-black uppercase block">DEMAND TIER</span>
                      <span className="text-xs font-black text-amber-400">{dossier.marketValuation.expectedDemandTier}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900 text-center">
                      <span className="text-[9px] text-zinc-400 font-black uppercase block">PRICE FLOOR (10TH %)</span>
                      <span className="text-xs font-black text-zinc-300">{formatPrice(dossier.marketValuation.priceFloor)}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900 text-center">
                      <span className="text-[9px] text-zinc-400 font-black uppercase block">ESTIMATED FAIR VALUE</span>
                      <span className="text-sm font-black text-white">{formatPrice(dossier.marketValuation.fairValue)}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900 text-center">
                      <span className="text-[9px] text-zinc-400 font-black uppercase block">PRICE CEILING (90TH %)</span>
                      <span className="text-xs font-black text-red-400">{formatPrice(dossier.marketValuation.priceCeiling)}</span>
                    </div>
                  </div>
                </div>

                {/* Model Explainability Features */}
                {dossier.explainability && (
                  <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <div className="font-black uppercase text-zinc-400 text-[10px] mb-1.5">
                      LIGHTGBM TOP PREDICTIVE SIGNALS & EXPLAINABILITY
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dossier.explainability.topDrivingFeatures.map((f, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[10px]">
                          ⚡ {f}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-amber-400 font-mono text-[10px]">
                        📈 Form: {dossier.explainability.recentForm}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-sky-400 font-mono text-[10px]">
                        🎯 Age Multiplier: {dossier.explainability.ageModifier}x
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SQUAD FIT */}
          {activeTab === 'fit' && (
            <div className="space-y-5">
              <div className="neo-box p-5 rounded-2xl bg-zinc-900">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b-2 border-black gap-2">
                  <div>
                    <h4 className="text-base font-black uppercase text-white">
                      FRANCHISE SCOUTING REPORT: {franchise.name}
                    </h4>
                    <p className="text-xs text-zinc-400 font-bold">
                      Algorithmic evaluation of roster synergy, overseas slots, and purse efficiency
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`neo-badge px-3 py-1 rounded text-xs font-black ${
                      fitReport.verdict === 'Must-Target' ? 'bg-emerald-400 text-black' :
                      fitReport.verdict === 'Strong Addition' ? 'bg-amber-400 text-black' :
                      fitReport.verdict === 'Conditional Value' ? 'bg-sky-400 text-black' : 'bg-red-500 text-white'
                    }`}>
                      {fitReport.verdict}
                    </span>
                    <span className="neo-badge px-2.5 py-1 rounded bg-black text-white text-xs font-black">
                      FIT SCORE: {fitReport.fitScore}/100
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Reasons to Buy */}
                  <div className="neo-box-sm p-4 rounded-xl bg-black">
                    <div className="text-xs font-black uppercase text-emerald-400 mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> REASONS TO TARGET
                    </div>
                    {fitReport.reasonsToBuy.length === 0 ? (
                      <div className="text-xs text-zinc-500">No primary tactical synergies identified.</div>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-zinc-300 font-medium">
                        {fitReport.reasonsToBuy.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-black">✓</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Reasons to Pass */}
                  <div className="neo-box-sm p-4 rounded-xl bg-black">
                    <div className="text-xs font-black uppercase text-red-400 mb-2.5 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> RISKS & REASONS TO PASS
                    </div>
                    {fitReport.reasonsToPass.length === 0 ? (
                      <div className="text-xs text-zinc-500">No significant squad friction or budget hazards.</div>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-zinc-300 font-medium">
                        {fitReport.reasonsToPass.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-400 font-black">✕</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Recommended Max Bid Box */}
                <div className="mt-4 p-4 rounded-xl bg-zinc-950 border-2 border-black flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-zinc-400 font-black uppercase">RECOMMENDED CEILING BID</div>
                    <div className="text-xl font-black text-emerald-400">
                      {formatPrice(fitReport.maxRecommendedBid)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-400 font-black uppercase">YOUR REMAINING PURSE</div>
                    <div className="text-base font-black text-white">
                      {formatPrice(franchise.remainingPurse)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
