'use client';

import React from 'react';
import { Gavel, CheckCircle2, AlertTriangle, Shield, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Franchise, Player } from '@/lib/types/game';

export interface NeoCountdownProps {
  state: 'Active' | 'Sold' | 'Unsold' | 'Upcoming';
  finalCallCount: number; // 0 = open bidding, 1 = going once (3), 2 = going twice (2), 3 = final call (1)
  currentBid: number;
  highestBidder: Franchise | null;
  currentPlayer: Player | null;
  className?: string;
}

export function NeoCountdown({
  state,
  finalCallCount,
  currentBid,
  highestBidder,
  currentPlayer,
  className = '',
}: NeoCountdownProps) {
  // If lot is finished as SOLD
  if (state === 'Sold') {
    return (
      <div
        className={`terminal-card-elevated bg-[var(--m-panel)] p-4 sm:p-5 border border-[var(--m-green)]/60 rounded-lg relative overflow-hidden neo-stamp-animation ${className}`}
        style={{
          boxShadow: '0 0 24px rgba(25, 200, 154, 0.15)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="sports-stamp-sold px-3.5 py-1 text-xl sm:text-2xl font-black">
              SOLD
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--m-dim)]">
                HAMMER CONFIRMED ACQUISITION
              </div>
              <div className="text-base sm:text-lg font-black text-[var(--m-text)] uppercase tracking-tight">
                {currentPlayer?.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {highestBidder && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
                style={{
                  backgroundColor: 'rgba(25, 31, 41, 0.8)',
                  borderColor: highestBidder.colors.primary,
                }}
              >
                <span
                  className="w-6 h-6 rounded flex items-center justify-center font-black text-xs"
                  style={{
                    backgroundColor: highestBidder.colors.primary,
                    color: highestBidder.colors.text,
                  }}
                >
                  {highestBidder.abbreviation}
                </span>
                <span className="text-xs font-bold uppercase text-[var(--m-text)]">
                  {highestBidder.name}
                </span>
              </div>
            )}

            <div className="px-3.5 py-1.5 rounded-md bg-[var(--m-green)]/20 border border-[var(--m-green)] text-[var(--m-green)] text-sm sm:text-base font-mono font-bold tabular-nums">
              {formatPrice(currentBid)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If lot is finished as UNSOLD
  if (state === 'Unsold') {
    return (
      <div
        className={`terminal-card bg-[var(--m-panel)] p-4 sm:p-5 border border-[var(--m-line)] rounded-lg relative overflow-hidden ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="sports-stamp-unsold px-3 py-1 text-lg sm:text-xl font-bold">
              UNSOLD
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--m-dim)]">
                PASSED LOT
              </div>
              <div className="text-base sm:text-lg font-bold text-[var(--m-text)] uppercase">
                {currentPlayer?.name}
              </div>
            </div>
          </div>

          <div className="telemetry-badge bg-[var(--m-raised)] border border-[var(--m-line)] text-[var(--m-dim)] px-3 py-1 text-xs font-semibold">
            AVAILABLE IN ACCELERATED RE-AUCTION
          </div>
        </div>
      </div>
    );
  }

  // Active / Countdown Urgency Stages:
  // finalCallCount: 0 = Open, 1 = Going Once (3), 2 = Going Twice (2), 3 = Final Call (1)
  const isFinalCall = finalCallCount >= 3;
  const isGoingTwice = finalCallCount === 2;
  const isGoingOnce = finalCallCount === 1;
  const isOpenBidding = finalCallCount === 0;

  const stageConfig = {
    open: {
      label: 'BIDDING OPEN',
      sublabel: 'Active Market Floor',
      borderColor: 'border-[var(--m-line)]',
      barColor: 'bg-[var(--m-accent-ink)]',
      progressWidth: 'w-full',
      textColor: 'text-[var(--m-accent-ink)]',
      pillBg: 'bg-[var(--m-accent-ink)]/15 border-[var(--m-accent-ink)]/40 text-[var(--m-accent-ink)]',
      containerAnim: '',
    },
    count3: {
      label: 'GOING ONCE',
      sublabel: 'Awaiting Counter-Offers',
      borderColor: 'border-[var(--m-gold)]/60',
      barColor: 'bg-[var(--m-gold)]',
      progressWidth: 'w-2/3',
      textColor: 'text-[var(--m-gold)]',
      pillBg: 'bg-[var(--m-gold)]/20 border-[var(--m-gold)]/60 text-[var(--m-gold)]',
      containerAnim: 'neo-pulse-3',
    },
    count2: {
      label: 'GOING TWICE',
      sublabel: 'Closing Fast — Last Opportunity',
      borderColor: 'border-[var(--m-orange)]/70',
      barColor: 'bg-[var(--m-orange)]',
      progressWidth: 'w-1/3',
      textColor: 'text-[var(--m-orange)]',
      pillBg: 'bg-[var(--m-orange)]/20 border-[var(--m-orange)]/70 text-[var(--m-orange)]',
      containerAnim: 'neo-snap-2',
    },
    count1: {
      label: 'FINAL CALL',
      sublabel: 'Gavel Falling — Confirm Bid Immediately',
      borderColor: 'border-[var(--m-red)]',
      barColor: 'bg-[var(--m-red)]',
      progressWidth: 'w-1/12',
      textColor: 'text-[var(--m-red)]',
      pillBg: 'bg-[var(--m-red)]/25 border-[var(--m-red)] text-[var(--m-red)]',
      containerAnim: 'neo-shake-1',
    },
  }[
    isFinalCall
      ? 'count1'
      : isGoingTwice
      ? 'count2'
      : isGoingOnce
      ? 'count3'
      : 'open'
  ];

  return (
    <div
      className={`terminal-card p-4 rounded-lg bg-[var(--m-panel)] border ${stageConfig.borderColor} ${stageConfig.containerAnim} transition-all duration-200 relative overflow-hidden ${className}`}
    >
      {/* Top Countdown Progress Gauge Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--m-raised)]">
        <div
          className={`h-full ${stageConfig.barColor} transition-all duration-500 ease-out ${stageConfig.progressWidth}`}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-0.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[var(--m-raised)] border border-[var(--m-line)] flex items-center justify-center">
            <Clock className={`w-4 h-4 ${stageConfig.textColor}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs sm:text-sm font-black tracking-wider uppercase ${stageConfig.textColor}`}>
                {stageConfig.label}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${stageConfig.pillBg}`}>
                {isFinalCall ? 'CALL 3' : isGoingTwice ? 'CALL 2' : isGoingOnce ? 'CALL 1' : 'ACTIVE'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--m-dim)] font-medium mt-0.5">
              {stageConfig.sublabel}
            </p>
          </div>
        </div>

        {/* Highest Bidder Telemetry Pill */}
        <div className="flex items-center gap-3">
          {highestBidder ? (
            <div className="flex items-center gap-2 bg-[var(--m-raised)] px-3 py-1.5 rounded-md border border-[var(--m-line)]">
              <span
                className="w-5 h-5 rounded-sm flex items-center justify-center font-bold text-[10px]"
                style={{
                  backgroundColor: highestBidder.colors.primary,
                  color: highestBidder.colors.text,
                }}
              >
                {highestBidder.abbreviation}
              </span>
              <div className="text-left">
                <span className="text-[10px] text-[var(--m-dim)] block uppercase font-medium">Leading Paddle</span>
                <span className="text-xs font-bold text-[var(--m-text)] uppercase">{highestBidder.name}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--m-dim)] font-medium px-3 py-1.5 rounded bg-[var(--m-raised)]">
              Base Price Lot
            </div>
          )}

          <div className="text-right">
            <span className="text-[10px] text-[var(--m-dim)] block uppercase font-medium">Under Hammer</span>
            <span className="text-base sm:text-lg font-mono font-bold text-[var(--m-text)] tabular-nums">
              {formatPrice(currentBid)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
