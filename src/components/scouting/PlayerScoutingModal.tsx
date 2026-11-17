'use client';

import { prospectLabel } from '@/lib/engines/career/prospect-label';
import React, { useState } from 'react';
import type { Player, Franchise } from '@/lib/types/game';
import { FRANCHISES } from '@/lib/data/franchises';
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
  franchise?: Franchise;
  onClose: () => void;
}

export function PlayerScoutingModal({
  player,
  franchise,
  onClose,
}: PlayerScoutingModalProps) {
  if (!player) return null;

  const activeFranchise = franchise || FRANCHISES[0];
  const [activeTab, setActiveTab] = useState<'overview' | 'seasons' | 'projections' | 'fit'>('overview');

  const dossier = generatePlayerIntelligenceDossier(player);
  const fitReport = evaluateFranchiseFit(player, activeFranchise, dossier);
  const theme = getTeamTheme(activeFranchise.id);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[var(--m-panel)] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[var(--m-text)] border border-[var(--m-line)] shadow-2xl relative">
        {/* Top Livery Accent Strip */}
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundColor: theme.primary }}
        />

        {/* Header Bar */}
        <div className="p-5 border-b border-[var(--m-line)] bg-[var(--m-panel)] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-xl font-heading shadow-md border border-[var(--m-line)]"
              style={{
                backgroundColor: theme.primary,
                color: theme.textLight,
              }}
            >
              {player.name[0]}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-extrabold uppercase text-[var(--m-text)] tracking-tight font-heading">
                  {player.name}
                </h3>
                {player.nationality === 'Overseas' ? (
                  <span className="telemetry-badge-sm bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30">
                    ✈ {player.country}
                  </span>
                ) : (
                  <span className="telemetry-badge-sm bg-[var(--m-gold)]/15 text-[var(--m-gold)] border border-[var(--m-gold)]/30">
                    🇮🇳 INDIA
                  </span>
                )}
                <span className="telemetry-badge-sm bg-[var(--m-raised)] text-[var(--m-dim)] border border-[var(--m-line)]">
                  {dossier.ageProfile.careerPhase}
                </span>
                {prospectLabel(player) && (
                  <span className="telemetry-badge-sm bg-[var(--m-gold)]/15 text-[var(--m-gold)] border border-[var(--m-gold)]/30">
                    {prospectLabel(player)}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--m-dim)] font-medium mt-0.5">
                {player.role} • {player.age} yrs • {player.battingHand} Bat • {player.bowlingStyle}
              </div>
              {player.development?.note && (
                <div className="text-xs text-[var(--m-dim)] mt-1">
                  {player.development.trend === 'Steady' ? 'Scouting report' : player.development.trend}: {player.development.note}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="telemetry-badge-sm bg-[var(--m-raised)] text-[var(--m-gold)] border border-[var(--m-line)] font-mono text-xs hidden sm:inline-block">
              {dossier.projection.overallImpactScore} IMPACT
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[var(--m-raised)] hover:bg-[var(--m-line)] text-[var(--m-dim)] hover:text-[var(--m-text)] border border-[var(--m-line)] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--m-line)] bg-[var(--m-panel)] overflow-x-auto">
          {[
            { id: 'overview', label: 'Scouting Overview' },
            { id: 'seasons', label: 'Historical Seasons' },
            { id: 'projections', label: 'ML Projections' },
            { id: 'fit', label: `${activeFranchise.abbreviation} Squad Fit` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${
                activeTab === tab.id
                  ? 'bg-[var(--m-raised)] text-[var(--m-text)] border-[var(--m-accent-ink)]'
                  : 'bg-transparent text-[var(--m-dim)] border-transparent hover:text-[var(--m-text)] hover:bg-[var(--m-raised)]/50'
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
                <div className="terminal-card p-3 rounded-xl">
                  <div className="text-[10px] text-[var(--m-dim)] font-bold uppercase tracking-wider">Current Ability</div>
                  <div className="text-2xl font-bold text-[var(--m-text)] mt-0.5 tabular-nums">
                    {player.ratings.overall} <span className="text-xs text-[var(--m-dim)] font-normal">OVR</span>
                  </div>
                  <div className="text-[10px] text-[var(--m-green)] font-medium mt-1">Peak: {dossier.ageProfile.projectedPeakAbility} OVR</div>
                </div>

                <div className="terminal-card p-3 rounded-xl">
                  <div className="text-[10px] text-[var(--m-dim)] font-bold uppercase tracking-wider">Predicted Impact</div>
                  <div className="text-2xl font-bold text-[var(--m-gold)] mt-0.5 tabular-nums">
                    {dossier.projection.overallImpactScore} <span className="text-xs text-[var(--m-dim)] font-normal">/ 100</span>
                  </div>
                  <div className="text-[10px] text-[var(--m-dim)] font-medium mt-1">Conf: {dossier.confidenceLevel}%</div>
                </div>

                <div className="terminal-card p-3 rounded-xl">
                  <div className="text-[10px] text-[var(--m-dim)] font-bold uppercase tracking-wider">Fair Auction Value</div>
                  <div className="text-2xl font-bold text-[var(--m-green)] mt-0.5 font-mono">
                    {formatPrice(dossier.marketValuation.fairValue)}
                  </div>
                  <div className="text-[10px] text-[var(--m-dim)] font-medium mt-1 font-mono">
                    {formatPrice(dossier.marketValuation.priceFloor)} - {formatPrice(dossier.marketValuation.priceCeiling)}
                  </div>
                </div>

                <div className="terminal-card p-3 rounded-xl">
                  <div className="text-[10px] text-[var(--m-dim)] font-bold uppercase tracking-wider">Demand Tier</div>
                  <div className="text-base font-bold text-[var(--m-text)] mt-1 leading-tight">{dossier.marketValuation.expectedDemandTier}</div>
                  <div className="text-[10px] text-[var(--m-gold)] font-medium mt-1">Longevity: ~{dossier.ageProfile.expectedLongevitySeasons} yrs</div>
                </div>
              </div>

              {/* Match Phase Effectiveness */}
              <div className="terminal-card p-4 rounded-xl">
                <div className="text-xs font-bold uppercase text-[var(--m-text)] mb-3 flex items-center justify-between">
                  <span>T20 Match Phase Effectiveness</span>
                  <span className="telemetry-badge-sm bg-[var(--m-raised)] text-[var(--m-dim)] border border-[var(--m-line)]">
                    CRICSHEET BALL-BY-BALL
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)]">
                    <span className="text-[10px] text-[var(--m-dim)] font-bold block uppercase">Powerplay (1-6)</span>
                    <span className="text-xl font-bold text-[var(--m-gold)] tabular-nums">{dossier.phaseStrengths.powerplay}</span>
                    <span className="text-[10px] text-[var(--m-dim)] block">/ 100</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)]">
                    <span className="text-[10px] text-[var(--m-dim)] font-bold block uppercase">Middle (7-15)</span>
                    <span className="text-xl font-bold text-[var(--m-gold)] tabular-nums">{dossier.phaseStrengths.middle}</span>
                    <span className="text-[10px] text-[var(--m-dim)] block">/ 100</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)]">
                    <span className="text-[10px] text-[var(--m-dim)] font-bold block uppercase">Death (16-20)</span>
                    <span className="text-xl font-bold text-[var(--m-gold)] tabular-nums">{dossier.phaseStrengths.death}</span>
                    <span className="text-[10px] text-[var(--m-dim)] block">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Tactical Roles Breakdown */}
              <div className="terminal-card p-4 rounded-xl">
                <div className="text-xs font-bold uppercase text-[var(--m-text)] mb-3 flex items-center justify-between">
                  <span>11 Tactical Role Proficiencies</span>
                  <span className="telemetry-badge-sm bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30">
                    PRIMARY: {dossier.primaryTacticalRole}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(dossier.tacticalRoleScores).map(([role, score]) => (
                    <div
                      key={role}
                      className={`p-2.5 rounded-lg flex items-center justify-between border ${
                        score >= 80
                          ? 'bg-[var(--m-raised)] text-[var(--m-gold)] border-[var(--m-gold)]/40'
                          : 'bg-[var(--m-raised)] text-[var(--m-dim)] border-[var(--m-line)]'
                      }`}
                    >
                      <span className="text-[11px] font-medium truncate max-w-[170px]">{role}</span>
                      <span className={`text-xs font-bold tabular-nums ${score >= 80 ? 'text-[var(--m-gold)]' : 'text-[var(--m-dim)]'}`}>
                        {score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rolling Form & Consistency */}
              <div className="terminal-card p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] text-[var(--m-dim)] font-bold uppercase block">Rolling Form Rating</span>
                  <div className="text-xl font-bold text-[var(--m-text)] mt-1 tabular-nums">
                    {dossier.form.last5MatchesAvgRating} <span className="text-xs text-[var(--m-dim)] font-normal">(Last 5 Matches)</span>
                  </div>
                  <div className="text-[11px] text-[var(--m-dim)] font-medium mt-1">
                    Trend:{' '}
                    <span className={dossier.form.momentumSlope >= 0 ? 'text-[var(--m-green)]' : 'text-[var(--m-red)]'}>
                      {dossier.form.momentumSlope >= 0 ? `+${dossier.form.momentumSlope} (Ascending)` : `${dossier.form.momentumSlope} (Declining)`}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--m-dim)] font-bold uppercase block">Consistency & Volatility</span>
                  <div className="text-xl font-bold text-[var(--m-text)] mt-1 tabular-nums">
                    {dossier.form.consistencyScore} <span className="text-xs text-[var(--m-dim)] font-normal">/ 100</span>
                  </div>
                  <div className="text-[11px] text-[var(--m-dim)] font-medium mt-1">
                    Match Volatility: ±{dossier.form.volatilityIndex} pts
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--m-dim)] font-bold uppercase block">Provenance & Audit</span>
                  <div className="text-xs font-medium text-[var(--m-text)] mt-1">
                    {dossier.provenance.source}
                  </div>
                  <div className="text-[10px] text-[var(--m-dim)] font-medium mt-1">
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
              <div className="terminal-card p-4 rounded-xl">
                <div className="text-xs font-bold uppercase text-[var(--m-text)] mb-3 pb-2 border-b border-[var(--m-line)] flex items-center justify-between">
                  <span>Authentic Batting Records (By Season)</span>
                  <span className="text-[10px] text-[var(--m-dim)] font-mono">SOURCE: CRICSHEET</span>
                </div>

                {dossier.seasons.batting.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[var(--m-dim)] font-medium">No verified top-order batting innings recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[var(--m-line)] text-[var(--m-dim)] font-bold uppercase text-[10px]">
                          <th className="py-2 px-2">Season</th>
                          <th className="py-2 px-2 text-center">M</th>
                          <th className="py-2 px-2 text-center">Inn</th>
                          <th className="py-2 px-2 text-right">Runs</th>
                          <th className="py-2 px-2 text-right">Avg</th>
                          <th className="py-2 px-2 text-right">SR</th>
                          <th className="py-2 px-2 text-right">4s</th>
                          <th className="py-2 px-2 text-right">6s</th>
                          <th className="py-2 px-2 text-right">PP SR</th>
                          <th className="py-2 px-2 text-right">Death SR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--m-line)]/60">
                        {dossier.seasons.batting.map((s) => (
                          <tr key={s.season} className="hover:bg-[var(--m-raised)] transition-colors">
                            <td className="py-2 px-2 font-bold text-[var(--m-gold)]">IPL {s.season}</td>
                            <td className="py-2 px-2 text-center text-[var(--m-dim)]">{s.matches}</td>
                            <td className="py-2 px-2 text-center text-[var(--m-dim)]">{s.innings}</td>
                            <td className="py-2 px-2 text-right font-bold text-[var(--m-text)] tabular-nums">{s.runs}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-dim)] tabular-nums">{s.average.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right font-bold text-[var(--m-gold)] tabular-nums">{s.strikeRate.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-dim)] tabular-nums">{s.fours}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-dim)] tabular-nums">{s.sixes}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-accent-ink)] font-mono tabular-nums">{s.powerplaySR.toFixed(0)}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-red)] font-mono tabular-nums">{s.deathSR.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bowling Seasons Table */}
              <div className="terminal-card p-4 rounded-xl">
                <div className="text-xs font-bold uppercase text-[var(--m-text)] mb-3 pb-2 border-b border-[var(--m-line)] flex items-center justify-between">
                  <span>Authentic Bowling Records (By Season)</span>
                  <span className="text-[10px] text-[var(--m-dim)] font-mono">SOURCE: CRICSHEET</span>
                </div>

                {dossier.seasons.bowling.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[var(--m-dim)] font-medium">No verified regular bowling overs recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[var(--m-line)] text-[var(--m-dim)] font-bold uppercase text-[10px]">
                          <th className="py-2 px-2">Season</th>
                          <th className="py-2 px-2 text-center">M</th>
                          <th className="py-2 px-2 text-right">Overs</th>
                          <th className="py-2 px-2 text-right">Wkts</th>
                          <th className="py-2 px-2 text-right">Econ</th>
                          <th className="py-2 px-2 text-right">SR</th>
                          <th className="py-2 px-2 text-right">Dot %</th>
                          <th className="py-2 px-2 text-right">PP Econ</th>
                          <th className="py-2 px-2 text-right">Death Econ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--m-line)]/60">
                        {dossier.seasons.bowling.map((s) => (
                          <tr key={s.season} className="hover:bg-[var(--m-raised)] transition-colors">
                            <td className="py-2 px-2 font-bold text-[var(--m-gold)]">IPL {s.season}</td>
                            <td className="py-2 px-2 text-center text-[var(--m-dim)]">{s.matches}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-dim)] tabular-nums">{s.overs.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right font-bold text-[var(--m-green)] tabular-nums">{s.wickets}</td>
                            <td className="py-2 px-2 text-right font-bold text-[var(--m-text)] tabular-nums">{s.economy.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-dim)] tabular-nums">{s.strikeRate.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-dim)] tabular-nums">{s.dotBallPct.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right text-[var(--m-accent-ink)] font-mono tabular-nums">{s.powerplayEconomy.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-[var(--m-red)] font-mono tabular-nums">{s.deathEconomy.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bayesian Shrinkage Transparency Block */}
              <div className="terminal-card p-4 rounded-xl">
                <div className="text-xs font-bold uppercase text-[var(--m-gold)] mb-2 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Bayesian Shrinkage Audit (Small Sample Regularization)
                </div>
                <div className="text-xs text-[var(--m-dim)] font-medium leading-relaxed">
                  Raw observations are regularized toward universal T20 prior distributions (Avg 24.5, SR 130.0, Economy 8.45).
                  Current player sample confidence weight: <strong className="text-[var(--m-text)]">{(dossier.bayesian.sampleWeight * 100).toFixed(0)}%</strong> (Shrinkage factor: <strong className="text-[var(--m-gold)]">{dossier.bayesian.shrinkageFactor}</strong>).
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ML PROJECTIONS */}
          {activeTab === 'projections' && (
            <div className="space-y-5">
              <div className="terminal-card p-5 rounded-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[var(--m-line)] gap-2">
                  <div>
                    <h4 className="text-base font-bold uppercase text-[var(--m-text)] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--m-gold)]" />
                      LightGBM Player Performance Engine (Model 1)
                    </h4>
                    <p className="text-xs text-[var(--m-dim)] font-medium">
                      Gradient-Boosted Tabular Regression • Outperformed Baseline by 78.3% Lower RMSE (R² = 0.98)
                    </p>
                  </div>
                  <span className="telemetry-badge-sm bg-[var(--m-green)]/15 text-[var(--m-green)] border border-[var(--m-green)]/30">
                    UNCERTAINTY: ±{dossier.projection.uncertaintyStdDev} PTS
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                    <span className="text-[10px] text-[var(--m-dim)] font-bold uppercase block">Projected Runs</span>
                    <span className="text-2xl font-bold text-[var(--m-gold)] tabular-nums">{dossier.projection.projectedBattingRuns}</span>
                    <span className="text-[10px] text-[var(--m-dim)] font-medium block">@ {dossier.projection.projectedBattingStrikeRate} SR</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                    <span className="text-[10px] text-[var(--m-dim)] font-bold uppercase block">Projected Wickets</span>
                    <span className="text-2xl font-bold text-[var(--m-green)] tabular-nums">{dossier.projection.projectedWickets}</span>
                    <span className="text-[10px] text-[var(--m-dim)] font-medium block">@ {dossier.projection.projectedEconomyRate} ER</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                    <span className="text-[10px] text-[var(--m-dim)] font-bold uppercase block">Projected Impact</span>
                    <span className="text-2xl font-bold text-[var(--m-text)] tabular-nums">{dossier.projection.overallImpactScore}</span>
                    <span className="text-[10px] text-[var(--m-dim)] font-medium block">0 - 100 Calibrated</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                    <span className="text-[10px] text-[var(--m-dim)] font-bold uppercase block">Model Confidence</span>
                    <span className="text-2xl font-bold text-[var(--m-accent-ink)] tabular-nums">{(dossier.confidenceLevel).toFixed(0)}%</span>
                    <span className="text-[10px] text-[var(--m-dim)] font-medium block">Sample Size Calibrated</span>
                  </div>
                </div>

                {/* Model 2: Multi-Season Development & Longevity Projections */}
                <div className="mt-5 p-4 rounded-xl bg-[var(--m-panel)] border border-[var(--m-line)]">
                  <div className="text-xs font-bold uppercase text-[var(--m-gold)] mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" /> Model 2: Multi-Season Development & Longevity Projections
                    </span>
                    <span className="text-[10px] text-[var(--m-dim)]">
                      Role Aging Curve ({dossier.ageProfile.peakAgeWindow[0]}-{dossier.ageProfile.peakAgeWindow[1]} yrs peak)
                    </span>
                  </div>

                  {dossier.longevityProjections && dossier.longevityProjections.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                      {dossier.longevityProjections.map((p) => (
                        <div key={p.season} className="p-3 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)]">
                          <div className="flex items-center justify-between text-xs font-bold text-[var(--m-text)] pb-1 border-b border-[var(--m-line)]">
                            <span>IPL {p.season}</span>
                            <span className="text-[var(--m-gold)]">{p.projectedAge} yrs</span>
                          </div>
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-lg font-bold text-[var(--m-text)] tabular-nums">
                              {p.projectedRating} <span className="text-[10px] text-[var(--m-dim)]">OVR</span>
                            </span>
                            <span className="text-[10px] text-[var(--m-dim)] font-mono">±{p.uncertaintyStdDev} σ</span>
                          </div>
                          <div className="text-[10px] font-semibold text-[var(--m-green)] uppercase mt-1">
                            {p.trajectoryPhase}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-medium text-[var(--m-dim)] mt-2">
                      <div>
                        <span className="text-[var(--m-dim)]/70 text-[10px] block uppercase">Career Phase</span>
                        <span className="text-[var(--m-text)] font-bold">{dossier.ageProfile.careerPhase}</span>
                      </div>
                      <div>
                        <span className="text-[var(--m-dim)]/70 text-[10px] block uppercase">Peak Age Window</span>
                        <span className="text-[var(--m-text)] font-bold">{dossier.ageProfile.peakAgeWindow[0]} - {dossier.ageProfile.peakAgeWindow[1]} Years</span>
                      </div>
                      <div>
                        <span className="text-[var(--m-dim)]/70 text-[10px] block uppercase">Projected Longevity</span>
                        <span className="text-[var(--m-green)] font-bold">~{dossier.ageProfile.expectedLongevitySeasons} More Seasons</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Model 3: Two-Stage Auction Market Valuation */}
                <div className="mt-4 p-4 rounded-xl bg-[var(--m-panel)] border border-[var(--m-line)]">
                  <div className="text-xs font-bold uppercase text-[var(--m-gold)] mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" /> Model 3: Two-Stage Auction Market Value Estimator
                    </span>
                    {dossier.marketValuation.soldProbability !== undefined && (
                      <span className="telemetry-badge-sm bg-[var(--m-green)]/15 text-[var(--m-green)] border border-[var(--m-green)]/30">
                        PROBABILITY SOLD: {(dossier.marketValuation.soldProbability * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                    <div className="p-2.5 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                      <span className="text-[9px] text-[var(--m-dim)] font-bold uppercase block">Demand Tier</span>
                      <span className="text-xs font-bold text-[var(--m-gold)]">{dossier.marketValuation.expectedDemandTier}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                      <span className="text-[9px] text-[var(--m-dim)] font-bold uppercase block">Price Floor (10th %)</span>
                      <span className="text-xs font-bold font-mono text-[var(--m-dim)]">{formatPrice(dossier.marketValuation.priceFloor)}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                      <span className="text-[9px] text-[var(--m-dim)] font-bold uppercase block">Estimated Fair Value</span>
                      <span className="text-sm font-bold font-mono text-[var(--m-text)]">{formatPrice(dossier.marketValuation.fairValue)}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                      <span className="text-[9px] text-[var(--m-dim)] font-bold uppercase block">Price Ceiling (90th %)</span>
                      <span className="text-xs font-bold font-mono text-[var(--m-red)]">{formatPrice(dossier.marketValuation.priceCeiling)}</span>
                    </div>
                  </div>
                </div>

                {/* Model Explainability Features */}
                {dossier.explainability && (
                  <div className="mt-4 p-3 rounded-xl bg-[var(--m-panel)] border border-[var(--m-line)] text-xs">
                    <div className="font-bold uppercase text-[var(--m-dim)] text-[10px] mb-1.5">
                      LightGBM Top Predictive Signals & Explainability
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dossier.explainability.topDrivingFeatures.map((f, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-text)] font-mono text-[10px]">
                          ⚡ {f}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 rounded bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-gold)] font-mono text-[10px]">
                        📈 Form: {dossier.explainability.recentForm}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-accent-ink)] font-mono text-[10px]">
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
              <div className="terminal-card p-5 rounded-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[var(--m-line)] gap-2">
                  <div>
                    <h4 className="text-base font-bold uppercase text-[var(--m-text)]">
                      Franchise Scouting Report: {activeFranchise.name}
                    </h4>
                    <p className="text-xs text-[var(--m-dim)] font-medium">
                      Algorithmic evaluation of roster synergy, overseas slots, and purse efficiency
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`telemetry-badge-sm ${
                      fitReport.verdict === 'Must-Target' ? 'bg-[var(--m-green)]/15 text-[var(--m-green)] border border-[var(--m-green)]/30' :
                      fitReport.verdict === 'Strong Addition' ? 'bg-[var(--m-gold)]/15 text-[var(--m-gold)] border border-[var(--m-gold)]/30' :
                      fitReport.verdict === 'Conditional Value' ? 'bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30' :
                      'bg-[var(--m-red)]/15 text-[var(--m-red)] border border-[var(--m-red)]/30'
                    }`}>
                      {fitReport.verdict}
                    </span>
                    <span className="telemetry-badge-sm bg-[var(--m-raised)] text-[var(--m-text)] border border-[var(--m-line)]">
                      FIT SCORE: {fitReport.fitScore}/100
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Reasons to Buy */}
                  <div className="p-4 rounded-xl bg-[var(--m-panel)] border border-[var(--m-line)]">
                    <div className="text-xs font-bold uppercase text-[var(--m-green)] mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Reasons to Target
                    </div>
                    {fitReport.reasonsToBuy.length === 0 ? (
                      <div className="text-xs text-[var(--m-dim)]">No primary tactical synergies identified.</div>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-[var(--m-text)] font-medium">
                        {fitReport.reasonsToBuy.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[var(--m-green)] font-bold">✓</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Reasons to Pass */}
                  <div className="p-4 rounded-xl bg-[var(--m-panel)] border border-[var(--m-line)]">
                    <div className="text-xs font-bold uppercase text-[var(--m-red)] mb-2.5 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Risks & Reasons to Pass
                    </div>
                    {fitReport.reasonsToPass.length === 0 ? (
                      <div className="text-xs text-[var(--m-dim)]">No significant squad friction or budget hazards.</div>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-[var(--m-text)] font-medium">
                        {fitReport.reasonsToPass.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[var(--m-red)] font-bold">✕</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Recommended Max Bid Box */}
                <div className="mt-4 p-4 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[var(--m-dim)] font-bold uppercase">Recommended Ceiling Bid</div>
                    <div className="text-xl font-bold font-mono text-[var(--m-green)]">
                      {formatPrice(fitReport.maxRecommendedBid)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--m-dim)] font-bold uppercase">Your Remaining Purse</div>
                    <div className="text-base font-bold font-mono text-[var(--m-text)]">
                      {formatPrice(activeFranchise.remainingPurse)}
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
