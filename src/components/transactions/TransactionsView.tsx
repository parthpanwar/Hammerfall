'use client';

// ============================================================
// IPL DYNASTY — League Transactions
// Every move between franchises across the campaign: trades (from the
// permanent trade history), retentions, releases and auction signings.
// ============================================================

import React, { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useGameStore } from '@/lib/store/game-store';
import { formatPrice } from '@/lib/utils';
import { Empty, OvrBadge, PageHeader, Panel, TeamCrest } from '@/components/mynba/primitives';
import type { TransactionRecord, TransactionType } from '@/lib/types/career';
import type { TradeRecord } from '@/lib/types/trade';

type Kind = 'all' | 'trades' | TransactionType;
const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trades', label: 'Trades' },
  { id: 'Signed', label: 'Auction signings' },
  { id: 'Released', label: 'Releases' },
  { id: 'Retained', label: 'Retentions' },
];

export function TransactionsView() {
  const { careerState, franchises, humanFranchiseId, currentSeason, settings } = useGameStore();
  const trades = careerState.trade?.history ?? [];
  const log = careerState.transactions ?? [];

  const seasons = useMemo(() => {
    const set = new Set<number>([currentSeason, ...trades.map((t) => t.season), ...log.map((t) => t.season)]);
    return [...set].filter((y) => y >= settings.startingSeason).sort((a, b) => b - a);
  }, [trades, log, currentSeason, settings.startingSeason]);

  const [season, setSeason] = useState<number | 'all'>('all');
  const [team, setTeam] = useState<string>('all');
  const [kind, setKind] = useState<Kind>('all');

  const name = (id: string) => franchises.find((f) => f.id === id)?.shortName ?? id.toUpperCase();
  const inSeason = (y: number) => season === 'all' || season === y;
  const forTeam = (ids: string[]) => team === 'all' || ids.includes(team);

  const tradeRows = trades.filter((t) => inSeason(t.season) && forTeam(t.franchiseIds));
  const logRows = log.filter((t) => inSeason(t.season) && forTeam([t.franchiseId]));
  const count = (k: TransactionType) => logRows.filter((t) => t.type === k).length;

  const visibleSeasons = seasons.filter(inSeason);
  const showTrades = kind === 'all' || kind === 'trades';
  const show = (k: TransactionType) => kind === 'all' || kind === k;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        kicker="League office"
        title="Transactions"
        subtitle="Every move between franchises this campaign: trades, retentions, releases and auction signings."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Trades" value={tradeRows.length} />
        <Tile label="Auction signings" value={count('Signed')} />
        <Tile label="Releases" value={count('Released')} />
        <Tile label="Retentions" value={count('Retained')} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`px-3 py-1 rounded-full text-sm ${kind === k.id ? 'bg-ink text-[var(--m-bg)] font-semibold' : 'text-[var(--m-dim)] hover:text-ink'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <select className="m-input !py-1.5 !w-auto" value={String(season)} onChange={(e) => setSeason(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Season">
            <option value="all">All seasons</option>
            {seasons.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="m-input !py-1.5 !w-auto" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
            <option value="all">All teams</option>
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {visibleSeasons.map((y) => {
        const yTrades = showTrades ? tradeRows.filter((t) => t.season === y) : [];
        const yLog = logRows.filter((t) => t.season === y && show(t.type));
        if (!yTrades.length && !yLog.length) return null;
        const signed = yLog.filter((t) => t.type === 'Signed').sort((a, b) => b.amountLakhs - a.amountLakhs);
        const released = yLog.filter((t) => t.type === 'Released');
        const retained = yLog.filter((t) => t.type === 'Retained').sort((a, b) => b.amountLakhs - a.amountLakhs);
        const windowType = yLog[0]?.window;
        return (
          <section key={y} className="space-y-4">
            <h2 className="m-display text-2xl italic">
              {y} {windowType && <span className="m-label !text-[0.7rem] ml-2 align-middle">{windowType} auction</span>}
            </h2>

            {yTrades.length > 0 && (
              <Panel title={`Trades · ${yTrades.length}`} bodyClassName="p-0">
                <ul>
                  {yTrades.map((t) => (
                    <TradeRow key={t.id} t={t} name={name} human={humanFranchiseId} />
                  ))}
                </ul>
              </Panel>
            )}
            {released.length > 0 && <LogTable title={`Releases · ${released.length}`} rows={released} amountLabel="Salary" human={humanFranchiseId} />}
            {retained.length > 0 && <LogTable title={`Retentions · ${retained.length}`} rows={retained} amountLabel="Cost" human={humanFranchiseId} />}
            {signed.length > 0 && <LogTable title={`Auction signings · ${signed.length}`} rows={signed} amountLabel="Price" human={humanFranchiseId} />}
          </section>
        );
      })}

      {visibleSeasons.every((y) => !tradeRows.some((t) => t.season === y) && !logRows.some((t) => t.season === y)) && (
        <Panel>
          <Empty title="No transactions yet" hint="Retentions, releases, auction signings and trades will appear here as they happen." />
        </Panel>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="m-panel px-4 py-3">
      <div className="m-label !text-[0.62rem]">{label}</div>
      <div className="font-display font-extrabold text-2xl tabular-nums">{value}</div>
    </div>
  );
}

function TradeRow({ t, name, human }: { t: TradeRecord; name: (id: string) => string; human: string }) {
  const [a, b] = t.franchiseIds;
  const toA = t.players.filter((p) => p.toFranchiseId === a);
  const toB = t.players.filter((p) => p.toFranchiseId === b);
  const side = (fid: string, gets: typeof toA) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <TeamCrest franchiseId={fid} size="xs" />
        <span className={`font-semibold text-sm ${fid === human ? 'text-ink' : ''}`}>{name(fid)} get</span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {gets.map((p) => (
          <li key={p.playerId} className="flex items-center gap-2 text-sm">
            <OvrBadge ovr={p.overall} size="sm" />
            <span className="truncate">{p.playerName}</span>
            <span className="text-xs text-[var(--m-faint)] ml-auto tabular-nums">
              {p.previousSalaryLakhs ? <span className="line-through mr-1">{formatPrice(p.previousSalaryLakhs)}</span> : null}
              {formatPrice(p.salaryLakhs)}
            </span>
          </li>
        ))}
        {t.cash && t.cash.toFranchiseId === fid && <li className="text-xs text-[var(--m-gold)]">+ {formatPrice(t.cash.amountLakhs)} trade cash</li>}
      </ul>
    </div>
  );
  return (
    <li className="px-4 py-4 border-b border-[var(--m-line)]/60 last:border-0">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
        {side(a, toA)}
        <ArrowLeftRight className="w-4 h-4 text-[var(--m-faint)] self-center shrink-0" />
        {side(b, toB)}
      </div>
      <div className="text-[11px] text-[var(--m-faint)] mt-2">
        {t.isCpuToCpu ? 'CPU ↔ CPU' : t.initiatedBy === 'human' ? 'Your offer' : 'CPU offer'} · {t.phase === 'SquadManagement' ? 'Pre-season' : t.phase}
      </div>
    </li>
  );
}

function LogTable({ title, rows, amountLabel, human }: { title: string; rows: TransactionRecord[]; amountLabel: string; human: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <Panel
      title={title}
      bodyClassName="p-0"
      right={rows.length > 12 ? <button className="text-xs text-[var(--m-dim)] hover:text-ink" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button> : undefined}
    >
      <table className="w-full text-sm">
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} className={`border-b border-[var(--m-line)]/50 ${r.franchiseId === human ? 'bg-ink/[0.04]' : ''}`}>
              <td className="py-2 pl-4 w-10"><TeamCrest franchiseId={r.franchiseId} size="xs" /></td>
              <td className="py-2"><OvrBadge ovr={r.overall} size="sm" /></td>
              <td className="py-2 w-full">
                <span className="font-semibold">{r.playerName}</span>
                <span className="text-xs text-[var(--m-faint)] ml-2">{r.role}</span>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                <span className="text-[10px] text-[var(--m-faint)] mr-1.5">{amountLabel}</span>
                {formatPrice(r.amountLakhs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
