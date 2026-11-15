'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { formatPrice } from '@/lib/utils';
import {
  Trophy,
  Users,
  TrendingUp,
  TrendingDown,
  History,
  Save,
  Download,
  Upload,
  UserX,
  Sparkles,
  Award,
  Calendar,
  AlertCircle,
  Clock,
  Shield,
  Newspaper,
  Layers,
  Briefcase,
} from 'lucide-react';
import { getLeaguePurseForSeason } from '@/lib/engines/career/contract-engine';
import { auctionTypeFor } from '@/lib/flow/season-flow';
import { PageHero, StatTile } from '@/components/mynba/primitives';
import { DevelopmentWatch, FrontOfficesPanel } from './FrontOffices';
import { exportSaveSlotAsJson, importSaveJsonToSlot, listAllSaveSlots } from '@/lib/engines/career/save-manager';

export function CareerDashboard() {
  const {
    currentSeason,
    humanFranchiseId,
    franchises,
    allPlayers,
    careerState,
    releaseHumanPlayer,
    saveToSlot,
    loadFromSlot,
    settings,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'squad' | 'development' | 'offices' | 'history' | 'legends' | 'saves'>('overview');
  const [selectedHistorySeason, setSelectedHistorySeason] = useState<number>(currentSeason - 1);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string>('');

  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const franchiseRecord = careerState.franchiseHistory[humanFranchiseId];

  const totalMatches = (franchiseRecord?.allTimeWins || 0) + (franchiseRecord?.allTimeLosses || 0) + (franchiseRecord?.allTimeTies || 0);
  const winPct = totalMatches > 0 ? (((franchiseRecord?.allTimeWins || 0) / totalMatches) * 100).toFixed(1) : '0.0';

  const upcomingAuctionType = auctionTypeFor(currentSeason, settings);
  const currentPurseCap = getLeaguePurseForSeason(currentSeason);

  const humanPlayers = humanFranchise?.players || [];
  const contracts = careerState.contracts;
  const progressionDeltas = careerState.recentProgressionDeltas.filter((d) => humanPlayers.some((p) => p.id === d.playerId));
  const retirements = careerState.retirements;
  const storylines = careerState.storylines.slice(0, 10);

  // Historical season selector
  const completedSeasons = franchiseRecord?.seasonHistory.map((h) => h.season) || [];
  const selectedHistory = franchiseRecord?.seasonHistory.find((h) => h.season === selectedHistorySeason);

  const handleExportSave = (slotNumber: number) => {
    const json = exportSaveSlotAsJson(slotNumber);
    if (!json) {
      setSaveStatusMessage('Save slot is empty.');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ipl-dynasty-slot${slotNumber}-s${currentSeason}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveStatusMessage(`Slot ${slotNumber} exported successfully!`);
  };

  const handleImportSave = (slotNumber: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importSaveJsonToSlot(slotNumber, content);
      if (success) {
        setSaveStatusMessage(`Slot ${slotNumber} imported successfully! Loading...`);
        setTimeout(() => loadFromSlot(slotNumber), 500);
      } else {
        setSaveStatusMessage('Failed to parse save file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Franchise header */}
      <PageHero
        franchiseId={humanFranchiseId}
        kicker={`Franchise office · Season ${currentSeason}`}
        title={humanFranchise?.name ?? 'Franchise'}
        subtitle={<>Home: {humanFranchise?.homeStadium} · GM strategy: {humanFranchise?.gmPersonality}</>}
      />
      <div className="grid grid-cols-3 gap-5 max-w-xl">
        <StatTile label="Titles" value={franchiseRecord?.championships || 0} tone="gold" />
        <StatTile label="Playoff runs" value={franchiseRecord?.playoffAppearances || 0} tone="team" />
        <StatTile label="Win %" value={`${winPct}%`} tone="green" />
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[var(--m-line)] pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Stories', icon: Newspaper },
          { id: 'squad', label: 'Contracts & Roster', icon: Users },
          { id: 'development', label: 'Player Development', icon: TrendingUp },
          { id: 'offices', label: 'Front Offices', icon: Briefcase },
          { id: 'history', label: 'Season Archives', icon: History },
          { id: 'legends', label: 'Hall of Fame', icon: Award },
          { id: 'saves', label: 'Save Manager', icon: Save },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                isActive
                  ? 'bg-[var(--m-ink)] text-[var(--m-bg)] border-[var(--m-ink)]'
                  : 'text-[var(--m-dim)] border-[var(--m-line-strong)] hover:text-[var(--m-text)] hover:border-[var(--m-ink)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* All-Time Record Box */}
            <div className="terminal-card p-6 rounded-xl">
              <h3 className="text-xs font-bold uppercase text-[var(--m-dim)] mb-4 flex items-center gap-2 pb-2 border-b border-[var(--m-line)]">
                <Shield className="w-4 h-4 text-[var(--m-accent-ink)]" /> ALL-TIME RECORD
              </h3>
              <div className="space-y-3 font-medium text-sm">
                <div className="flex justify-between border-b border-[var(--m-line)]/50 pb-2">
                  <span className="text-[var(--m-dim)]">Total Matches Played:</span>
                  <span className="text-[var(--m-text)] font-bold tabular-nums">{totalMatches}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--m-line)]/50 pb-2">
                  <span className="text-[var(--m-dim)]">Wins / Losses / Ties:</span>
                  <span className="text-[var(--m-green)] font-bold tabular-nums">
                    {franchiseRecord?.allTimeWins || 0}W - {franchiseRecord?.allTimeLosses || 0}L
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--m-line)]/50 pb-2">
                  <span className="text-[var(--m-dim)]">Finals Appearances:</span>
                  <span className="text-[var(--m-text)] font-bold tabular-nums">{franchiseRecord?.finalsAppearances || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--m-dim)]">Record Auction Buy:</span>
                  <span className="text-[var(--m-gold)] font-bold">
                    {franchiseRecord?.recordPurchase?.playerName
                      ? `${franchiseRecord.recordPurchase.playerName} (${formatPrice(franchiseRecord.recordPurchase.priceLakhs)})`
                      : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Upcoming Campaign Rules */}
            <div className="terminal-card p-6 rounded-xl">
              <h3 className="text-xs font-bold uppercase text-[var(--m-dim)] mb-4 flex items-center gap-2 pb-2 border-b border-[var(--m-line)]">
                <Calendar className="w-4 h-4 text-[var(--m-accent-ink)]" /> SEASON {currentSeason} ENVIRONMENT
              </h3>
              <div className="space-y-3 font-medium text-sm">
                <div className="flex justify-between border-b border-[var(--m-line)]/50 pb-2">
                  <span className="text-[var(--m-dim)]">Auction Format:</span>
                  <span className="text-[var(--m-accent-ink)] font-bold">
                    {upcomingAuctionType === 'Mega' ? 'MEGA AUCTION' : 'MINI AUCTION'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[var(--m-line)]/50 pb-2">
                  <span className="text-[var(--m-dim)]">League Salary Cap:</span>
                  <span className="text-[var(--m-green)] font-bold font-mono">{formatPrice(currentPurseCap)}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--m-line)]/50 pb-2">
                  <span className="text-[var(--m-dim)]">Remaining Team Purse:</span>
                  <span className="text-[var(--m-text)] font-bold font-mono">{formatPrice(humanFranchise?.remainingPurse || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--m-dim)]">Squad Size:</span>
                  <span className="text-[var(--m-text)] font-bold tabular-nums">{humanPlayers.length} / 25 players</span>
                </div>
              </div>
            </div>

            {/* Dynasty Status */}
            <div className="terminal-card p-6 rounded-xl flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase text-[var(--m-dim)] mb-3 flex items-center gap-2 pb-2 border-b border-[var(--m-line)]">
                  <Trophy className="w-4 h-4 text-[var(--m-gold)]" /> TROPHY CABINET
                </h3>
                <div className="text-3xl font-bold text-[var(--m-text)] mt-2 tabular-nums">
                  {franchiseRecord?.championships || 0}
                  <span className="text-sm font-normal text-[var(--m-dim)] ml-2">IPL Titles</span>
                </div>
                <p className="text-xs text-[var(--m-dim)] font-medium mt-2">
                  {(franchiseRecord?.championships || 0) >= 3
                    ? 'Legendary IPL Dynasty status achieved.'
                    : (franchiseRecord?.championships || 0) >= 1
                    ? 'Champion caliber franchise. Aiming to expand trophy cabinet.'
                    : 'Chasing the elusive maiden IPL championship.'}
                </p>
              </div>

            </div>
          </div>

          {/* Dynamic League Storylines Ticker */}
          <div className="terminal-card p-6 rounded-xl">
            <h3 className="text-sm font-bold uppercase text-[var(--m-text)] mb-4 flex items-center gap-2 pb-2 border-b border-[var(--m-line)] font-heading">
              <Newspaper className="w-4 h-4 text-[var(--m-accent-ink)]" /> League Wire & Verified Storylines
            </h3>

            {storylines.length === 0 ? (
              <div className="text-xs text-[var(--m-dim)] font-medium py-4 text-center">
                Storylines will generate as matches and seasons conclude!
              </div>
            ) : (
              <div className="space-y-3">
                {storylines.map((story) => (
                  <div key={story.id} className="p-4 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="telemetry-badge-sm bg-[var(--m-panel)] text-[var(--m-gold)] border border-[var(--m-line)] text-[10px] font-bold uppercase">
                        S{story.season} &bull; {story.category}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[var(--m-text)]">{story.headline}</h4>
                    <p className="text-xs text-[var(--m-dim)] font-medium mt-1">{story.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONTRACTS & SQUAD */}
      {activeTab === 'squad' && (
        <div className="terminal-card p-6 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--m-line)]">
            <div>
              <h3 className="text-lg font-bold uppercase text-[var(--m-text)] font-heading">
                {humanFranchise?.name} Squad & Contracts
              </h3>
              <p className="text-xs text-[var(--m-dim)] font-medium">
                Track player salaries, contract durations, and execute releases prior to mini auctions.
              </p>
            </div>
            <div className="telemetry-badge-sm bg-[var(--m-green)]/15 text-[var(--m-green)] border border-[var(--m-green)]/30 text-xs font-mono font-bold py-1.5 px-3">
              Purse Available: {formatPrice(humanFranchise?.remainingPurse || 0)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[var(--m-panel)] text-[var(--m-dim)] uppercase text-[10px] font-bold border-y border-[var(--m-line)]">
                <tr>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3">Age</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">OVR</th>
                  <th className="py-2.5 px-3">Salary</th>
                  <th className="py-2.5 px-3">Contract Remaining</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--m-line)]/50 font-medium">
                {humanPlayers.map((p, idx) => {
                  const contract = contracts[p.id];
                  const salary = contract ? contract.salaryLakhs : p.soldPrice || p.currentContractValue || p.basePrice;
                  const years = contract ? contract.yearsRemaining : 1;

                  return (
                    <tr key={p.id} className={idx % 2 === 0 ? 'bg-[var(--m-panel)] hover:bg-[var(--m-raised)]' : 'bg-[var(--m-panel)] hover:bg-[var(--m-raised)]'}>
                      <td className="py-2.5 px-3 font-bold text-[var(--m-text)]">{p.name}</td>
                      <td className="py-2.5 px-3 text-[var(--m-dim)] tabular-nums">{p.age}</td>
                      <td className="py-2.5 px-3 text-[var(--m-dim)]">{p.role}</td>
                      <td className="py-2.5 px-3 font-bold text-[var(--m-gold)] tabular-nums">
                        {p.ratings.overall}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--m-green)] font-bold font-mono">{formatPrice(salary)}</td>
                      <td className="py-2.5 px-3 text-[var(--m-dim)]">{years} {years === 1 ? 'Year' : 'Years'}</td>
                      <td className="py-2.5 px-3">
                        <span className="telemetry-badge-sm bg-[var(--m-raised)] text-[var(--m-dim)] border border-[var(--m-line)] text-[10px]">
                          {contract?.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Release ${p.name}? This will refund ${formatPrice(salary)} to your purse.`)) {
                              releaseHumanPlayer(p.id);
                            }
                          }}
                          className="sports-btn px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-[var(--m-red)]/20 text-[var(--m-red)] border border-[var(--m-red)]/40 hover:bg-[var(--m-red)] hover:text-ink transition-colors"
                        >
                          Release
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PLAYER DEVELOPMENT */}
      {activeTab === 'offices' && <FrontOfficesPanel franchises={franchises} humanFranchiseId={humanFranchiseId} />}

      {activeTab === 'development' && <DevelopmentWatch players={allPlayers} franchises={franchises} season={currentSeason} />}

      {activeTab === 'development' && (
        <div className="terminal-card p-6 rounded-xl space-y-4">
          <div className="pb-3 border-b border-[var(--m-line)]">
            <h3 className="text-lg font-bold uppercase text-[var(--m-text)] font-heading">
              Year-over-Year Attribute Progression
            </h3>
            <p className="text-xs text-[var(--m-dim)] font-medium">
              Review how your players developed during the previous season transition.
            </p>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[var(--m-panel)] text-[var(--m-dim)] uppercase text-[10px] font-bold border-y border-[var(--m-line)]">
                <tr>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3">Age</th>
                  <th className="py-2.5 px-3">Prev OVR</th>
                  <th className="py-2.5 px-3">New OVR</th>
                  <th className="py-2.5 px-3">Growth</th>
                  <th className="py-2.5 px-3">Potential</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--m-line)]/50 font-medium">
                {progressionDeltas.map((d, idx) => (
                  <tr key={d.playerId} className={idx % 2 === 0 ? 'bg-[var(--m-panel)] hover:bg-[var(--m-raised)]' : 'bg-[var(--m-panel)] hover:bg-[var(--m-raised)]'}>
                    <td className="py-2.5 px-3 font-bold text-[var(--m-text)]">{d.playerName}</td>
                    <td className="py-2.5 px-3 text-[var(--m-dim)] tabular-nums">{d.age}</td>
                    <td className="py-2.5 px-3 text-[var(--m-dim)] tabular-nums">{d.previousOverall}</td>
                    <td className="py-2.5 px-3 font-bold text-[var(--m-text)] tabular-nums">{d.newOverall}</td>
                    <td className="py-2.5 px-3">
                      {d.overallDelta > 0 ? (
                        <span className="text-[var(--m-green)] font-bold flex items-center gap-0.5 tabular-nums">
                          <TrendingUp className="w-3.5 h-3.5" /> +{d.overallDelta}
                        </span>
                      ) : d.overallDelta < 0 ? (
                        <span className="text-[var(--m-red)] font-bold flex items-center gap-0.5 tabular-nums">
                          <TrendingDown className="w-3.5 h-3.5" /> {d.overallDelta}
                        </span>
                      ) : (
                        <span className="text-[var(--m-dim)] font-medium">&plusmn;0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--m-accent-ink)] font-bold tabular-nums">
                      {d.potential}
                      {d.potentialDelta ? (
                        <span className={`ml-1 text-[10px] ${d.potentialDelta > 0 ? 'text-[var(--m-green)]' : 'text-[var(--m-red)]'}`}>
                          ({d.potentialDelta > 0 ? '+' : ''}{d.potentialDelta})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-[var(--m-dim)]">{d.progressionNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORICAL SEASON ARCHIVES */}
      {activeTab === 'history' && (
        <div className="terminal-card p-6 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--m-line)]">
            <div>
              <h3 className="text-lg font-bold uppercase text-[var(--m-text)] font-heading">
                Franchise Historical Season Archives
              </h3>
              <p className="text-xs text-[var(--m-dim)] font-medium">
                Inspect your complete historical squad rosters and performance from any past completed season.
              </p>
            </div>

            {completedSeasons.length > 0 && (
              <select
                value={selectedHistorySeason}
                onChange={(e) => setSelectedHistorySeason(Number(e.target.value))}
                className="terminal-input px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {completedSeasons.map((year) => (
                  <option key={year} value={year}>
                    Season {year}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!selectedHistory ? (
            <div className="text-center py-8 text-[var(--m-dim)] font-medium text-xs">
              No completed seasons archived yet. Complete Season {currentSeason} to view archived rosters!
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                  <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase">Season Finish</div>
                  <div className="text-lg font-bold text-[var(--m-text)] tabular-nums">#{selectedHistory.position}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                  <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase">Record</div>
                  <div className="text-lg font-bold text-[var(--m-green)] tabular-nums">
                    {selectedHistory.wins}W - {selectedHistory.losses}L
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                  <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase">Net Run Rate</div>
                  <div className="text-lg font-bold font-mono text-[var(--m-text)] tabular-nums">
                    {selectedHistory.nrr > 0 ? `+${selectedHistory.nrr.toFixed(3)}` : selectedHistory.nrr.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] text-center">
                  <div className="text-[10px] font-bold text-[var(--m-dim)] uppercase">Outcome</div>
                  <div className="text-lg font-bold text-[var(--m-gold)]">
                    {selectedHistory.isChampion ? 'CHAMPION' : selectedHistory.isRunnerUp ? 'RUNNER-UP' : 'LEAGUE'}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[var(--m-panel)] text-[var(--m-dim)] uppercase text-[10px] font-bold border-y border-[var(--m-line)]">
                    <tr>
                      <th className="py-2.5 px-3">Player</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Salary</th>
                      <th className="py-2.5 px-3">Season Runs</th>
                      <th className="py-2.5 px-3">Season Wickets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--m-line)]/50 font-medium">
                    {selectedHistory.playerSummaries.map((p, idx) => (
                      <tr key={p.playerId} className={idx % 2 === 0 ? 'bg-[var(--m-panel)] hover:bg-[var(--m-raised)]' : 'bg-[var(--m-panel)] hover:bg-[var(--m-raised)]'}>
                        <td className="py-2.5 px-3 font-bold text-[var(--m-text)]">{p.name}</td>
                        <td className="py-2.5 px-3 text-[var(--m-dim)]">{p.role}</td>
                        <td className="py-2.5 px-3 text-[var(--m-green)] font-bold font-mono">{formatPrice(p.salaryLakhs)}</td>
                        <td className="py-2.5 px-3 text-[var(--m-gold)] font-bold tabular-nums">{p.seasonRuns}</td>
                        <td className="py-2.5 px-3 text-[var(--m-accent-ink)] font-bold tabular-nums">{p.seasonWickets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RETIREMENTS & HALL OF FAME */}
      {activeTab === 'legends' && (
        <div className="terminal-card p-6 rounded-xl space-y-4">
          <div className="pb-3 border-b border-[var(--m-line)]">
            <h3 className="text-lg font-bold uppercase text-[var(--m-text)] font-heading">
              IPL Dynasty Hall of Fame & Retired Icons
            </h3>
            <p className="text-xs text-[var(--m-dim)] font-medium">
              Career totals and honors for players who hung up their boots.
            </p>
          </div>

          {retirements.length === 0 ? (
            <div className="text-center py-8 text-[var(--m-dim)] font-medium text-xs">
              No retired players recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {retirements.map((r) => (
                <div key={r.playerId} className="p-4 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--m-text)] text-base">{r.playerName}</span>
                    {r.hallOfFame && (
                      <span className="telemetry-badge-sm bg-[var(--m-gold)]/20 text-[var(--m-gold)] border border-[var(--m-gold)]/40 text-[10px] font-bold">
                        HALL OF FAME
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--m-dim)] font-medium mt-1">
                    Retired Season {r.retirementSeason} at age {r.age}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--m-line)] grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-[var(--m-dim)] font-bold">MATCHES</div>
                      <div className="text-sm font-bold text-[var(--m-text)] tabular-nums">{r.careerMatches}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--m-dim)] font-bold">RUNS</div>
                      <div className="text-sm font-bold text-[var(--m-gold)] tabular-nums">{r.careerRuns}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--m-dim)] font-bold">WICKETS</div>
                      <div className="text-sm font-bold text-[var(--m-accent-ink)] tabular-nums">{r.careerWickets}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SAVE GAME MANAGER */}
      {activeTab === 'saves' && (
        <div className="terminal-card p-6 rounded-xl space-y-6">
          <div className="pb-3 border-b border-[var(--m-line)]">
            <h3 className="text-lg font-bold uppercase text-[var(--m-text)] font-heading">
              Career Save & Backup Manager
            </h3>
            <p className="text-xs text-[var(--m-dim)] font-medium">
              Manage local save slots, create backups, or export/import career JSON files.
            </p>
          </div>

          {saveStatusMessage && (
            <div className="p-3 rounded-lg bg-[var(--m-accent-ink)]/15 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/30 font-semibold text-xs">
              {saveStatusMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((slotNum) => (
              <div key={slotNum} className="p-5 rounded-xl bg-[var(--m-raised)] border border-[var(--m-line)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--m-text)] text-sm">SAVE SLOT {slotNum}</span>
                  <span className="telemetry-badge-sm bg-[var(--m-panel)] text-[var(--m-dim)] border border-[var(--m-line)] text-[10px]">
                    MANUAL
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      saveToSlot(slotNum);
                      setSaveStatusMessage(`Game saved to Slot ${slotNum}!`);
                    }}
                    className="sports-btn px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-[var(--m-green)] text-white hover:bg-[var(--m-green)]/90 flex items-center gap-1 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>

                  <button
                    onClick={() => {
                      const success = loadFromSlot(slotNum);
                      if (success) setSaveStatusMessage(`Loaded Slot ${slotNum}!`);
                      else setSaveStatusMessage(`Slot ${slotNum} is empty.`);
                    }}
                    className="sports-btn px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-[var(--m-panel)] text-[var(--m-text)] border border-[var(--m-line)] hover:bg-[var(--m-line)] flex items-center gap-1 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" /> Load
                  </button>

                  <button
                    onClick={() => handleExportSave(slotNum)}
                    className="sports-btn px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-[var(--m-panel)] text-[var(--m-gold)] border border-[var(--m-line)] hover:bg-[var(--m-line)] flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>

                  <label className="sports-btn px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-[var(--m-panel)] text-[var(--m-dim)] border border-[var(--m-line)] hover:text-[var(--m-text)] hover:bg-[var(--m-line)] flex items-center gap-1 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Import
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => handleImportSave(slotNum, e)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
