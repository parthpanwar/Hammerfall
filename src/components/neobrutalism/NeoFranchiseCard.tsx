'use client';

import React from 'react';
import { Franchise } from '@/lib/types/game';
import { getTeamTheme } from '@/lib/theme/team-themes';
import { formatPrice } from '@/lib/utils';
import { Shield, Users, Trophy } from 'lucide-react';

export interface NeoFranchiseCardProps {
  franchise: Franchise;
  selected?: boolean;
  onSelect?: (franchise: Franchise) => void;
  showPurse?: boolean;
  className?: string;
}

export function NeoFranchiseCard({
  franchise,
  selected = false,
  onSelect,
  showPurse = true,
  className = '',
}: NeoFranchiseCardProps) {
  const theme = getTeamTheme(franchise.id);
  const overseasCount = franchise.players?.filter((p) => p.nationality === 'Overseas').length || 0;

  return (
    <div
      onClick={() => onSelect && onSelect(franchise)}
      className={`rounded-lg bg-[var(--m-panel)] border p-3.5 relative flex flex-col justify-between transition-all duration-150 cursor-pointer select-none overflow-hidden ${
        selected
          ? 'border-[var(--m-accent-ink)] bg-[var(--m-raised)] shadow-lg shadow-blue-500/10 ring-1 ring-[var(--m-accent-ink)]'
          : 'border-[var(--m-line)] hover:border-[var(--m-line-strong)] hover:bg-[var(--m-panel)]'
      } ${className}`}
    >
      {/* Top Brand Accent Trim */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: theme.primary }}
      />

      {/* Team Crest & Name */}
      <div className="flex items-center justify-between mt-1 pb-2 border-b border-[var(--m-line)]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded flex items-center justify-center font-bold text-xs tracking-wider"
            style={{
              backgroundColor: theme.primary,
              color: theme.textLight,
            }}
          >
            {franchise.abbreviation}
          </div>

          <div>
            <h4 className="font-bold text-xs sm:text-sm text-[var(--m-text)] truncate max-w-[130px]">
              {franchise.name}
            </h4>
            <div className="text-[10px] text-[var(--m-dim)] truncate">
              {franchise.city}
            </div>
          </div>
        </div>

        {selected && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--m-accent-ink)]/20 text-[var(--m-accent-ink)] border border-[var(--m-accent-ink)]/40">
            ACTIVE
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="mt-2.5 pt-1 space-y-1.5 text-xs">
        {showPurse && (
          <div className="flex items-center justify-between font-mono">
            <span className="text-[11px] text-[var(--m-dim)]">Purse</span>
            <span className="font-bold text-[var(--m-green)] tabular-nums">
              {formatPrice(franchise.remainingPurse)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--m-dim)]">Squad Slots</span>
          <span className="font-medium text-[var(--m-text)] tabular-nums text-[11px]">
            {franchise.players?.length || 0} / {franchise.maxSquadSize}
          </span>
        </div>

        {/* Overseas Capacity Bar */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--m-dim)]">Overseas</span>
          <span className={`text-[11px] font-bold tabular-nums ${overseasCount >= franchise.maxOverseas ? 'text-[var(--m-gold)]' : 'text-[var(--m-text)]'}`}>
            {overseasCount} / {franchise.maxOverseas}
          </span>
        </div>
      </div>
    </div>
  );
}
