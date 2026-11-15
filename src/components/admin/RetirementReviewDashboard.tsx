'use client';

import React, { useState, useMemo } from 'react';
import type { Player } from '@/lib/types/game';
import type {
  ActivityStatus,
  RetirementScope,
  RetirementAuditLogEntry,
  DatabaseRetirementAuditReport,
} from '@/lib/types/retirement';
import {
  isPlayerEligibleForAuction,
  auditDatabaseRetirements,
} from '@/lib/engines/eligibility/auction-eligibility-engine';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Edit3,
  Calendar,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';

interface RetirementReviewDashboardProps {
  players: Player[];
  seasonYear?: number;
  isOpen: boolean;
  onClose: () => void;
  onPlayerStatusOverride?: (updatedPlayer: Player, auditLog: RetirementAuditLogEntry) => void;
}

export function RetirementReviewDashboard({
  players,
  seasonYear = 2026,
  isOpen,
  onClose,
  onPlayerStatusOverride,
}: RetirementReviewDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'FULLY_RETIRED' | 'INT_RETIRED' | 'INACTIVE' | 'UNKNOWN' | 'ELIGIBLE' | 'INELIGIBLE'
  >('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [selectedPlayerForEdit, setSelectedPlayerForEdit] = useState<Player | null>(null);
  const [auditLogs, setAuditLogs] = useState<RetirementAuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit_log'>('dashboard');

  // Edit form state
  const [editProfStatus, setEditProfStatus] = useState<ActivityStatus>('ACTIVE');
  const [editIplStatus, setEditIplStatus] = useState<ActivityStatus>('ACTIVE');
  const [editScope, setEditScope] = useState<RetirementScope>('NONE');
  const [editDate, setEditDate] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editSource, setEditSource] = useState<string>('');

  // Generate audit summary
  const auditReport = useMemo(() => {
    return auditDatabaseRetirements(players, seasonYear);
  }, [players, seasonYear]);

  // Countries list
  const countries = useMemo(() => {
    const set = new Set<string>();
    players.forEach((p) => {
      if (p.country) set.add(p.country);
    });
    return Array.from(set).sort();
  }, [players]);

  // Filtered players
  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = player.name.toLowerCase().includes(q);
        const matchesCountry = (player.country || '').toLowerCase().includes(q);
        const matchesRole = player.role.toLowerCase().includes(q);
        if (!matchesName && !matchesCountry && !matchesRole) return false;
      }

      // Country
      if (countryFilter !== 'ALL' && player.country !== countryFilter) {
        return false;
      }

      const evalResult = isPlayerEligibleForAuction(player, seasonYear, { checkRetained: false });
      const prof = player.professionalStatus || (player.isRetired ? 'RETIRED' : 'ACTIVE');
      const scope = player.retirementScope || (player.isRetired ? 'ALL_CRICKET' : 'NONE');

      // Status Filter
      switch (statusFilter) {
        case 'ACTIVE':
          return prof === 'ACTIVE' && scope === 'NONE';
        case 'FULLY_RETIRED':
          return prof === 'RETIRED' || scope === 'ALL_CRICKET';
        case 'INT_RETIRED':
          return scope === 'INTERNATIONAL_ONLY' || (player.internationalStatus === 'RETIRED' && evalResult.isEligible);
        case 'INACTIVE':
          return prof === 'INACTIVE' || player.internationalStatus === 'INACTIVE';
        case 'UNKNOWN':
          return prof === 'UNKNOWN' || player.manualReviewRequired;
        case 'ELIGIBLE':
          return evalResult.isEligible;
        case 'INELIGIBLE':
          return !evalResult.isEligible;
        default:
          return true;
      }
    });
  }, [players, searchQuery, statusFilter, countryFilter, seasonYear]);

  const handleOpenEdit = (player: Player) => {
    setSelectedPlayerForEdit(player);
    setEditProfStatus(player.professionalStatus || (player.isRetired ? 'RETIRED' : 'ACTIVE'));
    setEditIplStatus(player.iplStatus || (player.isRetired ? 'RETIRED' : 'ACTIVE'));
    setEditScope(player.retirementScope || (player.isRetired ? 'ALL_CRICKET' : 'NONE'));
    setEditDate(player.dateOfRetirement || '');
    setEditReason('');
    setEditSource(player.verificationSource || 'Manual Administrative Verification');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerForEdit) return;

    const previousEval = isPlayerEligibleForAuction(selectedPlayerForEdit, seasonYear);

    const updatedPlayer: Player = {
      ...selectedPlayerForEdit,
      professionalStatus: editProfStatus,
      iplStatus: editIplStatus,
      retirementScope: editScope,
      dateOfRetirement: editDate || undefined,
      isRetired: editProfStatus === 'RETIRED',
      verificationSource: editSource || 'Manual Administrative Override',
      verificationConfidence: 1.0,
      lastVerificationDate: new Date().toISOString(),
      manualReviewRequired: false,
      seasonEligibility: {
        ...(selectedPlayerForEdit.seasonEligibility || {}),
        [seasonYear]: editProfStatus !== 'RETIRED' && editIplStatus !== 'RETIRED',
      },
      isAvailableForAuction: editProfStatus !== 'RETIRED' && editIplStatus !== 'RETIRED',
    };

    const newEval = isPlayerEligibleForAuction(updatedPlayer, seasonYear);

    const logEntry: RetirementAuditLogEntry = {
      id: `audit-${Date.now()}`,
      playerId: selectedPlayerForEdit.id,
      playerName: selectedPlayerForEdit.name,
      timestamp: new Date().toISOString(),
      actor: 'Authorized Administrator',
      previousStatus: {
        professionalStatus: selectedPlayerForEdit.professionalStatus || 'ACTIVE',
        iplStatus: selectedPlayerForEdit.iplStatus || 'ACTIVE',
        retirementScope: selectedPlayerForEdit.retirementScope || 'NONE',
        isEligible: previousEval.isEligible,
      },
      newStatus: {
        professionalStatus: editProfStatus,
        iplStatus: editIplStatus,
        retirementScope: editScope,
        isEligible: newEval.isEligible,
      },
      reason: editReason || 'Administrative status verification and review',
      sourceCitation: editSource || 'Manual verified official source',
    };

    setAuditLogs((prev) => [logEntry, ...prev]);

    if (onPlayerStatusOverride) {
      onPlayerStatusOverride(updatedPlayer, logEntry);
    }

    setSelectedPlayerForEdit(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[var(--m-panel)] rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[var(--m-text)] border border-[var(--m-line)] shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--m-line)] bg-[var(--m-panel)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--m-green)]/20 border border-[var(--m-green)]/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[var(--m-green)]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold uppercase text-[var(--m-text)] flex items-center gap-2 font-heading">
                Player Retirement & Auction Eligibility Review
              </h3>
              <p className="text-xs text-[var(--m-dim)] font-medium">
                Source-verified multi-scope retirement detection for Season {seasonYear}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[var(--m-raised)] hover:bg-[var(--m-line)] text-[var(--m-dim)] hover:text-[var(--m-text)] border border-[var(--m-line)] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metric Badges Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-[var(--m-panel)] border-b border-[var(--m-line)] text-center text-xs font-semibold">
          <div className="p-2 bg-[var(--m-raised)] rounded-lg border border-[var(--m-line)]">
            <div className="text-[var(--m-dim)] uppercase text-[10px]">Total Checked</div>
            <div className="text-base text-[var(--m-text)] font-bold tabular-nums">{auditReport.totalPlayersChecked}</div>
          </div>
          <div className="p-2 bg-[var(--m-raised)] rounded-lg border border-[var(--m-line)]">
            <div className="text-[var(--m-green)] uppercase text-[10px]">Verified Active</div>
            <div className="text-base text-[var(--m-green)] font-bold tabular-nums">{auditReport.verifiedActiveCount}</div>
          </div>
          <div className="p-2 bg-[var(--m-raised)] rounded-lg border border-[var(--m-line)]">
            <div className="text-[var(--m-red)] uppercase text-[10px]">Fully Retired</div>
            <div className="text-base text-[var(--m-red)] font-bold tabular-nums">{auditReport.verifiedRetiredCount}</div>
          </div>
          <div className="p-2 bg-[var(--m-panel)] rounded-xl border border-[var(--m-line)]">
            <div className="text-amber-400 uppercase text-[10px]">Intl Only (IPL Active)</div>
            <div className="text-base text-amber-400">{auditReport.internationalOnlyRetireesCount}</div>
          </div>
          <div className="p-2 bg-[var(--m-panel)] rounded-xl border border-[var(--m-line)]">
            <div className="text-rose-400 uppercase text-[10px]">Excluded 2026</div>
            <div className="text-base text-rose-400">{auditReport.excludedFromCurrentAuctionCount}</div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="px-4 py-2 border-b border-[var(--m-line)] bg-[var(--m-panel)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-amber-400 text-black border border-black shadow-[2px_2px_0px_#000]'
                  : 'text-[var(--m-dim)] hover:text-ink'
              }`}
            >
              Player Directory ({filteredPlayers.length})
            </button>
            <button
              onClick={() => setActiveTab('audit_log')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                activeTab === 'audit_log'
                  ? 'bg-amber-400 text-black border border-black shadow-[2px_2px_0px_#000]'
                  : 'text-[var(--m-dim)] hover:text-ink'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Audit Log ({auditLogs.length})
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <>
            {/* Filter Bar */}
            <div className="p-3 border-b border-[var(--m-line)] bg-[var(--m-panel)]/60 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--m-faint)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by cricketer name, country, or role..."
                    className="w-full pl-9 pr-3 py-1.5 bg-ink/40 border border-[var(--m-line)] rounded-xl text-xs text-ink placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1 flex-wrap text-[11px] font-bold">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'ACTIVE', label: 'Active' },
                  { id: 'FULLY_RETIRED', label: 'Fully Retired' },
                  { id: 'INT_RETIRED', label: 'Intl Only' },
                  { id: 'ELIGIBLE', label: 'Auction Eligible' },
                  { id: 'INELIGIBLE', label: 'Ineligible' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      statusFilter === f.id
                        ? 'bg-amber-400 text-black font-black shadow-[1.5px_1.5px_0px_#000]'
                        : 'bg-[var(--m-raised)] text-[var(--m-dim)] hover:text-ink'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                {/* Country Filter */}
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="bg-ink/40 border border-[var(--m-line)] text-ink/80 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Players Table */}
            <div className="flex-1 overflow-y-auto p-3">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--m-line)] text-[var(--m-dim)] uppercase text-[10px] font-black tracking-wider">
                    <th className="py-2.5 px-3">Player</th>
                    <th className="py-2.5 px-3">Country / Age</th>
                    <th className="py-2.5 px-3 text-center">Prof Status</th>
                    <th className="py-2.5 px-3 text-center">Retirement Scope</th>
                    <th className="py-2.5 px-3 text-center">IPL {seasonYear}</th>
                    <th className="py-2.5 px-3">Verification Source</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium">
                  {filteredPlayers.slice(0, 150).map((player) => {
                    const evalResult = isPlayerEligibleForAuction(player, seasonYear, { checkRetained: false });
                    const isFullyRetired = player.professionalStatus === 'RETIRED' || player.retirementScope === 'ALL_CRICKET';
                    const isIntlRetired = player.retirementScope === 'INTERNATIONAL_ONLY';

                    return (
                      <tr key={player.id} className="hover:bg-[var(--m-panel)]/60 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-bold text-ink">{player.name}</div>
                          <div className="text-[10px] text-[var(--m-dim)]">{player.role}</div>
                        </td>

                        <td className="py-2 px-3">
                          <div className="text-ink/80">{player.country}</div>
                          <div className="text-[10px] text-[var(--m-dim)]">{player.age} yrs</div>
                        </td>

                        <td className="py-2 px-3 text-center">
                          {isFullyRetired ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-950/80 text-red-400 border border-red-800">
                              RETIRED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                              ACTIVE
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              isIntlRetired
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : isFullyRetired
                                ? 'bg-[var(--m-raised)] text-ink/80'
                                : 'text-[var(--m-faint)]'
                            }`}
                          >
                            {player.retirementScope || (player.isRetired ? 'ALL_CRICKET' : 'NONE')}
                          </span>
                          {player.dateOfRetirement && (
                            <div className="text-[9px] text-[var(--m-dim)]">{player.dateOfRetirement}</div>
                          )}
                        </td>

                        <td className="py-2 px-3 text-center">
                          {evalResult.isEligible ? (
                            <div className="flex items-center justify-center gap-1 text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Eligible
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 text-red-400 font-bold" title={evalResult.reason}>
                              <XCircle className="w-3.5 h-3.5" />
                              Ineligible
                            </div>
                          )}
                        </td>

                        <td className="py-2 px-3 max-w-[200px] truncate text-[11px] text-[var(--m-dim)]" title={player.verificationSource || 'Verified Registry'}>
                          <div className="truncate">{player.verificationSource || 'BCCI & Cricsheet Playing Registry'}</div>
                          <div className="text-[9px] text-[var(--m-faint)]">
                            Confidence: {Math.round((player.verificationConfidence || 0.88) * 100)}%
                          </div>
                        </td>

                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleOpenEdit(player)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--m-raised)] hover:bg-[var(--m-line)] text-ink/80 text-xs font-black flex items-center gap-1 mx-auto"
                          >
                            <Edit3 className="w-3 h-3" />
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredPlayers.length === 0 && (
                <div className="p-8 text-center text-[var(--m-faint)] font-bold">
                  No cricketers matched the selected filter criteria.
                </div>
              )}
            </div>
          </>
        )}

        {/* Audit Log View */}
        {activeTab === 'audit_log' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-[var(--m-faint)] font-bold">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No administrative overrides recorded during this session.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-[var(--m-panel)] rounded-xl border border-[var(--m-line)] text-xs space-y-1">
                  <div className="flex items-center justify-between font-black text-amber-400">
                    <span>{log.playerName} ({log.playerId})</span>
                    <span className="text-[10px] text-[var(--m-faint)]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-ink/80">
                    <span className="font-bold">Change: </span>
                    {log.previousStatus.professionalStatus} ({log.previousStatus.retirementScope}) &rarr;{' '}
                    <span className="text-emerald-400 font-black">
                      {log.newStatus.professionalStatus} ({log.newStatus.retirementScope})
                    </span>
                  </div>
                  <div className="text-[var(--m-dim)]"><span className="font-bold">Reason: </span>{log.reason}</div>
                  <div className="text-[var(--m-faint)] text-[10px]"><span className="font-bold">Source Citation: </span>{log.sourceCitation}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Manual Override Modal */}
        {selectedPlayerForEdit && (
          <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="neo-box-lg bg-[var(--m-panel)] rounded-2xl max-w-lg w-full border-2 border-black p-5 space-y-4 text-ink/80">
              <div className="flex items-center justify-between border-b border-[var(--m-line)] pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  <h4 className="font-black text-base uppercase">
                    Review Status: {selectedPlayerForEdit.name}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedPlayerForEdit(null)}
                  className="text-[var(--m-dim)] hover:text-ink"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[var(--m-dim)] font-bold mb-1">Complete Professional Status</label>
                  <select
                    value={editProfStatus}
                    onChange={(e) => setEditProfStatus(e.target.value as any)}
                    className="w-full bg-ink/40 border border-[var(--m-line)] rounded-lg p-2 text-ink font-bold"
                  >
                    <option value="ACTIVE">ACTIVE (Active in professional cricket)</option>
                    <option value="RETIRED">RETIRED (Completely retired from all professional cricket)</option>
                    <option value="INACTIVE">INACTIVE (Not currently playing, unannounced)</option>
                    <option value="UNKNOWN">UNKNOWN (Requires further board confirmation)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--m-dim)] font-bold mb-1">IPL Participation Status</label>
                  <select
                    value={editIplStatus}
                    onChange={(e) => setEditIplStatus(e.target.value as any)}
                    className="w-full bg-ink/40 border border-[var(--m-line)] rounded-lg p-2 text-ink font-bold"
                  >
                    <option value="ACTIVE">ACTIVE (Eligible for IPL auction & matches)</option>
                    <option value="RETIRED">RETIRED (Specifically retired from the IPL)</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--m-dim)] font-bold mb-1">Retirement Scope</label>
                  <select
                    value={editScope}
                    onChange={(e) => setEditScope(e.target.value as any)}
                    className="w-full bg-ink/40 border border-[var(--m-line)] rounded-lg p-2 text-ink font-bold"
                  >
                    <option value="NONE">NONE (Fully active across all cricket)</option>
                    <option value="ALL_CRICKET">ALL_CRICKET (Complete global retirement)</option>
                    <option value="INTERNATIONAL_ONLY">INTERNATIONAL_ONLY (Retired international, ACTIVE in IPL)</option>
                    <option value="IPL_ONLY">IPL_ONLY (Retired from IPL, active in other leagues)</option>
                    <option value="DOMESTIC_ONLY">DOMESTIC_ONLY</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--m-dim)] font-bold mb-1">Date of Official Retirement (Optional)</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-ink/40 border border-[var(--m-line)] rounded-lg p-2 text-ink"
                  />
                </div>

                <div>
                  <label className="block text-[var(--m-dim)] font-bold mb-1">Official Evidence Source Citation *</label>
                  <input
                    type="text"
                    required
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="e.g. Official BCCI Announcement, Franchise Statement, Cricinfo"
                    className="w-full bg-ink/40 border border-[var(--m-line)] rounded-lg p-2 text-ink"
                  />
                </div>

                <div>
                  <label className="block text-[var(--m-dim)] font-bold mb-1">Administrative Audit Reason *</label>
                  <textarea
                    required
                    rows={2}
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Describe reason for this manual update..."
                    className="w-full bg-ink/40 border border-[var(--m-line)] rounded-lg p-2 text-ink"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--m-line)]">
                  <button
                    type="button"
                    onClick={() => setSelectedPlayerForEdit(null)}
                    className="px-4 py-2 rounded-xl bg-[var(--m-raised)] text-ink/80 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-400 text-black font-black uppercase shadow-[2px_2px_0px_#000]"
                  >
                    Save & Record Audit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

