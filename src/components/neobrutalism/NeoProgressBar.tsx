'use client';

import React from 'react';

export interface NeoProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'blue' | 'yellow' | 'green' | 'red' | 'purple';
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function NeoProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  color = 'blue',
  height = 'md',
  className = '',
}: NeoProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colorStyles = {
    blue: 'bg-[var(--m-accent-ink)]',
    yellow: 'bg-[var(--m-gold)]',
    green: 'bg-[var(--m-green)]',
    red: 'bg-[var(--m-red)]',
    purple: 'bg-[var(--m-purple)]',
  }[color];

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }[height];

  return (
    <div className={`w-full space-y-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs font-semibold">
          {label && <span className="text-[var(--m-dim)] uppercase tracking-wider text-[10px]">{label}</span>}
          {showValue && (
            <span className="font-mono text-[var(--m-text)] text-[11px] tabular-nums">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full rounded-full bg-[var(--m-raised)] border border-[var(--m-line)] overflow-hidden ${heightStyles}`}>
        <div
          className={`h-full ${colorStyles} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
