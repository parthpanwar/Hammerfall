'use client';

import React from 'react';
import { Player } from '@/lib/types/game';
import { formatPrice } from '@/lib/utils';
import { Sparkles, Shield, Flame, Activity } from 'lucide-react';

export interface NeoPlayerCardProps {
  player: Player;
  onClick?: () => void;
  showPrice?: boolean;
  featured?: boolean;
  className?: string;
}

export function NeoPlayerCard({
  player,
  onClick,
  showPrice = true,
  featured = false,
  className = '',
}: NeoPlayerCardProps) {
  const isElite = player.ratings.overall >= 88;
  const isHighPotential = player.ratings.potential >= 88;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg bg-[var(--m-panel)] border p-4 relative flex flex-col justify-between transition-all duration-150 cursor-pointer overflow-hidden ${
        featured
          ? 'border-[var(--m-accent-ink)] shadow-lg shadow-blue-500/10'
          : 'border-[var(--m-line)] hover:border-[var(--m-line-strong)] hover:bg-[var(--m-panel)]'
      } ${className}`}
    >
      {/* Top Header: Overall Badge & Role */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--m-line)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--m-dim)] block">
            {player.role}
          </span>
          <h4 className="font-bold text-sm sm:text-base text-[var(--m-text)] truncate max-w-[150px] mt-0.5">
            {player.name}
          </h4>
          <div className="text-[11px] text-[var(--m-dim)] mt-0.5 flex items-center gap-1.5">
            <span>{player.country}</span>
            <span>•</span>
            <span>{player.age} yrs</span>
            {player.status === 'Uncapped' && (
              <>
                <span>•</span>
                <span className="text-[var(--m-gold)] font-semibold text-[10px]">UNCAPPED</span>
              </>
            )}
          </div>
        </div>

        {/* Rating Badge */}
        <div
          className={`w-11 h-11 rounded-md flex flex-col items-center justify-center border font-mono font-black ${
            isElite
              ? 'bg-[var(--m-accent-ink)]/20 border-[var(--m-accent-ink)] text-[var(--m-accent-ink)]'
              : 'bg-[var(--m-raised)] border-[var(--m-line)] text-[var(--m-text)]'
          }`}
        >
          <span className="text-base leading-none tabular-nums">{player.ratings.overall}</span>
          <span className="text-[8px] text-[var(--m-dim)] uppercase tracking-tighter">OVR</span>
        </div>
      </div>

      {/* Ratings Telemetry Row */}
      <div className="grid grid-cols-3 gap-2 my-3 text-center">
        <div className="p-1.5 rounded bg-[var(--m-bg)] border border-[var(--m-line)]/80">
          <span className="text-[9px] text-[var(--m-dim)] block font-medium">BAT</span>
          <span className="font-mono font-bold text-xs text-[var(--m-text)] tabular-nums">
            {player.ratings.batting}
          </span>
        </div>
        <div className="p-1.5 rounded bg-[var(--m-bg)] border border-[var(--m-line)]/80">
          <span className="text-[9px] text-[var(--m-dim)] block font-medium">BOWL</span>
          <span className="font-mono font-bold text-xs text-[var(--m-text)] tabular-nums">
            {player.ratings.bowling}
          </span>
        </div>
        <div className="p-1.5 rounded bg-[var(--m-bg)] border border-[var(--m-line)]/80">
          <span className="text-[9px] text-[var(--m-dim)] block font-medium">POT</span>
          <span className={`font-mono font-bold text-xs tabular-nums ${isHighPotential ? 'text-[var(--m-green)]' : 'text-[var(--m-text)]'}`}>
            {player.ratings.potential}
          </span>
        </div>
      </div>

      {/* Valuation / Base Price */}
      {showPrice && (
        <div className="flex items-center justify-between pt-2 border-t border-[var(--m-line)] text-xs font-mono">
          <span className="text-[10px] text-[var(--m-dim)]">Base Price</span>
          <span className="font-bold text-[var(--m-gold)] tabular-nums">
            {formatPrice(player.basePrice)}
          </span>
        </div>
      )}
    </div>
  );
}
