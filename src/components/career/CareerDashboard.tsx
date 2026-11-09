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
} from 'lucide-react';
import { getAuctionTypeForSeason, getLeaguePurseForSeason } from '@/lib/engines/career/contract-engine';
import { exportSaveSlotAsJson, importSaveJsonToSlot, listAllSaveSlots } from '@/lib/engines/career/save-manager';

export function CareerDashboard() {
  const {
    currentSeason,
    humanFranchiseId,
    franchises,
    careerState,
    releaseHumanPlayer,
    saveToSlot,
    loadFromSlot,
    setPhase,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'squad' | 'development' | 'history' | 'legends' | 'saves'>('overview');
  const [selectedHistorySeason, setSelectedHistorySeason] = useState<number>(currentSeason - 1);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string>('');

  const humanTheme = getTeamTheme(humanFranchiseId);
  const humanFranchise = franchises.find((f) => f.id === humanFranchiseId);
  const franchiseRecord = careerState.franchiseHistory[humanFranchiseId];

  const totalMatches = (franchiseRecord?.allTimeWins || 0) + (franchiseRecord?.allTimeLosses || 0) + (franchiseRecord?.allTimeTies || 0);
  const winPct = totalMatches > 0 ? (((franchiseRecord?.allTimeWins || 0) / totalMatches) * 100).toFixed(1) : '0.0';

  const upcomingAuctionType = getAuctionTypeForSeason(currentSeason);
  const currentPurseCap = getLeaguePurseForSeason(currentSeason);

  const humanPlayers = humanFranchise?.players || [];
  const contracts = careerState.contracts;
  const progressionDeltas = careerState.recentProgressionDeltas;
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
      {/* Franchise Career Header */}
      <div className="neo-box p-6 sm:p-8 rounded-3xl bg-zinc-950 border-[3px] border-black shadow-[6px_6px_0px_#000] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-[3px] border-black flex items-center justify-center font-black text-2xl sm:text-3xl tracking-tighter shadow-[4px_4px_0px_#000]"
              style={{ backgroundColor: humanTheme.primary, color: humanTheme.textLight }}
            >
              {humanFranchise?.abbreviation || 'IPL'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="neo-badge px-2.5 py-0.5 rounded bg-amber-400 text-black text-[11px] font-black uppercase">
                  DYNASTY CAREER HUB
                </span>
                <span className="text-xs font-black text-zinc-400 uppercase">SEASON {currentSeason}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1">
                {humanFranchise?.name}
              </h1>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Home: {humanFranchise?.homeStadium} &bull; GM Strategy: {humanFranchise?.gmPersonality}
              </p>
            </div>
          </div>

          {/* Quick Dynasty Badges */}
          <div className="flex items-center gap-3">
            <div className="neo-box p-3 sm:p-4 rounded-2xl bg-zinc-900 border-2 border-black text-center min-w-[85px]">
              <div className="text-[10px] font-black text-amber-400 uppercase">TITLES</div>
              <div className="text-2xl font-black text-white mt-0.5">
                {franchiseRecord?.championships || 0}
              </div>
            </div>
            <div className="neo-box p-3 sm:p-4 rounded-2xl bg-zinc-900 border-2 border-black text-center min-w-[85px]">
              <div className="text-[10px] font-black text-cyan-400 uppercase">PLAYOFFS</div>
              <div className="text-2xl font-black text-white mt-0.5">
                {franchiseRecord?.playoffAppearances || 0}
              </div>
            </div>
            <div className="neo-box p-3 sm:p-4 rounded-2xl bg-zinc-900 border-2 border-black text-center min-w-[85px]">
              <div className="text-[10px] font-black text-emerald-400 uppercase">WIN %</div>
              <div className="text-2xl font-black text-white mt-0.5">{winPct}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b-2 border-zinc-800 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Stories', icon: Newspaper },
          { id: 'squad', label: 'Contracts & Roster', icon: Users },
          { id: 'development', label: 'Player Development', icon: TrendingUp },
          { id: 'history', label: 'Season Archives', icon: History },
          { id: 'legends', label: 'Hall of Fame', icon: Award },
          { id: 'saves', label: 'Save Manager', icon: Save },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-[1.5px] ${
                isActive
                  ? 'border-black text-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                  : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              style={{
                backgroundColor: isActive ? humanTheme.primary : 'transparent',
                color: isActive ? humanTheme.textLight : undefined,
              }}
            >
              <Icon className="w-4 h-4 stroke-[2.5]" />
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
            <div className="neo-box p-5 rounded-2xl bg-zinc-950 border-2 border-black">
              <h3 className="text-xs font-black uppercase text-zinc-400 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" /> ALL-TIME RECORD
              </h3>
              <div className="space-y-3 font-bold text-sm">
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Total Matches Played:</span>
                  <span className="text-white">{totalMatches}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Wins / Losses / Ties:</span>
                  <span className="text-emerald-400">
                    {franchiseRecord?.allTimeWins || 0}W - {franchiseRecord?.allTimeLosses || 0}L
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Finals Appearances:</span>
                  <span className="text-amber-400">{franchiseRecord?.finalsAppearances || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Record Auction Buy:</span>
                  <span className="text-white">
                    {franchiseRecord?.recordPurchase?.playerName
                      ? `${franchiseRecord.recordPurchase.playerName} (${formatPrice(franchiseRecord.recordPurchase.priceLakhs)})`
                      : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Upcoming Campaign Rules */}
            <div className="neo-box p-5 rounded-2xl bg-zinc-950 border-2 border-black">
              <h3 className="text-xs font-black uppercase text-zinc-400 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" /> SEASON {currentSeason} ENVIRONMENT
              </h3>
              <div className="space-y-3 font-bold text-sm">
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Auction Format:</span>
                  <span className="text-cyan-400 font-black">
                    {upcomingAuctionType === 'Mega' ? 'MEGA AUCTION' : 'MINI AUCTION'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">League Salary Cap:</span>
                  <span className="text-emerald-400 font-black">{formatPrice(currentPurseCap)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Remaining Team Purse:</span>
                  <span className="text-white">{formatPrice(humanFranchise?.remainingPurse || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Squad Size:</span>
                  <span className="text-white">{humanPlayers.length} / 25 players</span>
                </div>
              </div>
            </div>

            {/* Dynasty Status */}
            <div className="neo-box p-5 rounded-2xl bg-zinc-950 border-2 border-black flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black uppercase text-zinc-400 mb-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" /> TROPHY CABINET
                </h3>
                <div className="text-3xl font-black text-amber-400 mt-2">
                  {franchiseRecord?.championships || 0}
                  <span className="text-sm font-bold text-zinc-400 ml-2">IPL Titles</span>
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  {(franchiseRecord?.championships || 0) >= 3
                    ? 'Legendary IPL Dynasty status achieved.'
                    : (franchiseRecord?.championships || 0) >= 1
                    ? 'Champion caliber franchise. Aiming to expand trophy cabinet.'
                    : 'Chasing the elusive maiden IPL championship.'}
                </p>
              </div>

              <button
                onClick={() => setPhase('Tournament')}
                className="neo-btn w-full mt-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider"
                style={{ backgroundColor: humanTheme.primary, color: humanTheme.textLight }}
              >
                Go to Match Center
              </button>
            </div>
          </div>

          {/* Dynamic League Storylines Ticker */}
          <div className="neo-box p-6 rounded-2xl bg-zinc-950 border-2 border-black">
            <h3 className="text-sm font-black uppercase text-white mb-4 flex items-center gap-2 pb-2 border-b-2 border-black">
              <Newspaper className="w-4 h-4 text-amber-400" /> LEAGUE WIRE & VERIFIED STORYLINES
            </h3>

            {storylines.length === 0 ? (
              <div className="text-xs text-zinc-500 font-bold py-4 text-center">
                Storylines will generate as matches and seasons conclude!
              </div>
            ) : (
              <div className="space-y-3">
                {storylines.map((story) => (
                  <div key={story.id} className="neo-box p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="neo-badge px-2 py-0.5 rounded bg-zinc-800 text-amber-400 text-[10px] font-black uppercase">
                        S{story.season} &bull; {story.category}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-white">{story.headline}</h4>
                    <p className="text-xs text-zinc-400 mt-1">{story.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONTRACTS & SQUAD */}
      {activeTab === 'squad' && (
        <div className="neo-box p-6 rounded-2xl bg-zinc-950 border-2 border-black space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b-2 border-black">
            <div>
              <h3 className="text-lg font-black uppercase text-white">
                {humanFranchise?.name} SQUAD & CONTRACTS
              </h3>
              <p className="text-xs text-zinc-400">
                Track player salaries, contract durations, and execute releases prior to mini auctions.
              </p>
            </div>
            <div className="text-xs font-black text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              Purse Available: {formatPrice(humanFranchise?.remainingPurse || 0)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-800">
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
              <tbody className="divide-y divide-zinc-800/80 font-bold">
                {humanPlayers.map((p) => {
                  const contract = contracts[p.id];
                  const salary = contract ? contract.salaryLakhs : p.soldPrice || p.currentContractValue || p.basePrice;
                  const years = contract ? contract.yearsRemaining : 1;

                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/60">
                      <td className="py-2.5 px-3 font-black text-white">{p.name}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{p.age}</td>
                      <td className="py-2.5 px-3 text-zinc-300">{p.role}</td>
                      <td className="py-2.5 px-3 font-black text-amber-400">{p.ratings.overall}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-black">{formatPrice(salary)}</td>
                      <td className="py-2.5 px-3 text-zinc-300">{years} {years === 1 ? 'Year' : 'Years'}</td>
                      <td className="py-2.5 px-3">
                        <span className="neo-badge px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-black">
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
                          className="neo-btn px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-red-600/80 hover:bg-red-500 text-white"
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
      {activeTab === 'development' && (
        <div className="neo-box p-6 rounded-2xl bg-zinc-950 border-2 border-black space-y-4">
          <div className="pb-2 border-b-2 border-black">
            <h3 className="text-lg font-black uppercase text-white">
              YEAR-OVER-YEAR ATTRIBUTE PROGRESSION
            </h3>
            <p className="text-xs text-zinc-400">
              Review how your players developed during the previous season transition.
            </p>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-800">
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
              <tbody className="divide-y divide-zinc-800/80 font-bold">
                {progressionDeltas.map((d) => (
                  <tr key={d.playerId} className="hover:bg-zinc-900/60">
                    <td className="py-2.5 px-3 font-black text-white">{d.playerName}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{d.age}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{d.previousOverall}</td>
                    <td className="py-2.5 px-3 font-black text-amber-400">{d.newOverall}</td>
                    <td className="py-2.5 px-3">
                      {d.overallDelta > 0 ? (
                        <span className="text-emerald-400 font-black flex items-center gap-0.5">
                          <TrendingUp className="w-3.5 h-3.5" /> +{d.overallDelta}
                        </span>
                      ) : d.overallDelta < 0 ? (
                        <span className="text-red-400 font-black flex items-center gap-0.5">
                          <TrendingDown className="w-3.5 h-3.5" /> {d.overallDelta}
                        </span>
                      ) : (
                        <span className="text-zinc-500 font-bold">&plusmn;0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-400 font-black">{d.potential}</td>
                    <td className="py-2.5 px-3 text-[11px] text-zinc-400">{d.progressionNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORICAL SEASON ARCHIVES */}
      {activeTab === 'history' && (
        <div className="neo-box p-6 rounded-2xl bg-zinc-950 border-2 border-black space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b-2 border-black">
            <div>
              <h3 className="text-lg font-black uppercase text-white">
                FRANCHISE HISTORICAL SEASON ARCHIVES
              </h3>
              <p className="text-xs text-zinc-400">
                Inspect your complete historical squad rosters and performance from any past completed season.
              </p>
            </div>

            {completedSeasons.length > 0 && (
              <select
                value={selectedHistorySeason}
                onChange={(e) => setSelectedHistorySeason(Number(e.target.value))}
                className="neo-btn bg-zinc-900 border-2 border-black text-white px-3 py-1.5 rounded-xl text-xs font-black"
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
            <div className="text-center py-8 text-zinc-500 font-bold text-xs">
              No completed seasons archived yet. Complete Season {currentSeason} to view archived rosters!
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="neo-box p-3 rounded-xl bg-zinc-900 text-center">
                  <div className="text-[10px] font-black text-zinc-400 uppercase">Season Finish</div>
                  <div className="text-lg font-black text-white">#{selectedHistory.position}</div>
                </div>
                <div className="neo-box p-3 rounded-xl bg-zinc-900 text-center">
                  <div className="text-[10px] font-black text-zinc-400 uppercase">Record</div>
                  <div className="text-lg font-black text-emerald-400">
                    {selectedHistory.wins}W - {selectedHistory.losses}L
                  </div>
                </div>
                <div className="neo-box p-3 rounded-xl bg-zinc-900 text-center">
                  <div className="text-[10px] font-black text-zinc-400 uppercase">Net Run Rate</div>
                  <div className="text-lg font-black text-white">
                    {selectedHistory.nrr > 0 ? `+${selectedHistory.nrr.toFixed(3)}` : selectedHistory.nrr.toFixed(3)}
                  </div>
                </div>
                <div className="neo-box p-3 rounded-xl bg-zinc-900 text-center">
                  <div className="text-[10px] font-black text-zinc-400 uppercase">Outcome</div>
                  <div className="text-lg font-black text-amber-400">
                    {selectedHistory.isChampion ? 'CHAMPION' : selectedHistory.isRunnerUp ? 'RUNNER-UP' : 'LEAGUE'}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Player</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Salary</th>
                      <th className="py-2.5 px-3">Season Runs</th>
                      <th className="py-2.5 px-3">Season Wickets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80 font-bold">
                    {selectedHistory.playerSummaries.map((p) => (
                      <tr key={p.playerId} className="hover:bg-zinc-900/60">
                        <td className="py-2.5 px-3 font-black text-white">{p.name}</td>
                        <td className="py-2.5 px-3 text-zinc-400">{p.role}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-black">{formatPrice(p.salaryLakhs)}</td>
                        <td className="py-2.5 px-3 text-orange-400 font-black">{p.seasonRuns}</td>
                        <td className="py-2.5 px-3 text-purple-400 font-black">{p.seasonWickets}</td>
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
        <div className="neo-box p-6 rounded-2xl bg-zinc-950 border-2 border-black space-y-4">
          <div className="pb-2 border-b-2 border-black">
            <h3 className="text-lg font-black uppercase text-white">
              IPL DYNASTY HALL OF FAME & RETIRED ICONS
            </h3>
            <p className="text-xs text-zinc-400">
              Career totals and honors for players who hung up their boots.
            </p>
          </div>

          {retirements.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 font-bold text-xs">
              No retired players recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {retirements.map((r) => (
                <div key={r.playerId} className="neo-box p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white text-base">{r.playerName}</span>
                    {r.hallOfFame && (
                      <span className="neo-badge px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black">
                        HALL OF FAME
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Retired Season {r.retirementSeason} at age {r.age}
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-zinc-500 font-black">MATCHES</div>
                      <div className="text-sm font-black text-white">{r.careerMatches}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 font-black">RUNS</div>
                      <div className="text-sm font-black text-orange-400">{r.careerRuns}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 font-black">WICKETS</div>
                      <div className="text-sm font-black text-purple-400">{r.careerWickets}</div>
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
        <div className="neo-box p-6 rounded-2xl bg-zinc-950 border-2 border-black space-y-6">
          <div className="pb-2 border-b-2 border-black">
            <h3 className="text-lg font-black uppercase text-white">
              CAREER SAVE & BACKUP MANAGER
            </h3>
            <p className="text-xs text-zinc-400">
              Manage local save slots, create backups, or export/import career JSON files.
            </p>
          </div>

          {saveStatusMessage && (
            <div className="neo-box p-3 rounded-xl bg-amber-400 text-black font-black text-xs">
              {saveStatusMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((slotNum) => (
              <div key={slotNum} className="neo-box p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-sm">SAVE SLOT {slotNum}</span>
                  <span className="neo-badge px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-black">
                    MANUAL
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      saveToSlot(slotNum);
                      setSaveStatusMessage(`Game saved to Slot ${slotNum}!`);
                    }}
                    className="neo-btn px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-emerald-500 text-black flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>

                  <button
                    onClick={() => {
                      const success = loadFromSlot(slotNum);
                      if (success) setSaveStatusMessage(`Loaded Slot ${slotNum}!`);
                      else setSaveStatusMessage(`Slot ${slotNum} is empty.`);
                    }}
                    className="neo-btn px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-1"
                  >
                    <Clock className="w-3.5 h-3.5" /> Load
                  </button>

                  <button
                    onClick={() => handleExportSave(slotNum)}
                    className="neo-btn px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>

                  <label className="neo-btn px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 cursor-pointer">
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

