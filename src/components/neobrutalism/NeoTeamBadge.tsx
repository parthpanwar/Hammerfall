'use client';

import React from 'react';
import { getTeamTheme } from '@/lib/theme/team-themes';

export interface NeoTeamBadgeProps {
  franchiseId: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export function NeoTeamBadge({
  franchiseId,
  size = 'md',
  showName = true,
  className = '',
}: NeoTeamBadgeProps) {
  const theme = getTeamTheme(franchiseId);

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`rounded flex items-center justify-center font-bold tracking-wider border border-ink/10 ${sizeClasses}`}
        style={{
          backgroundColor: theme.primary,
          color: theme.textLight,
        }}
      >
        {theme.abbreviation}
      </span>
      {showName && (
        <span className="font-semibold text-xs sm:text-sm text-[var(--m-text)] uppercase tracking-wide">
          {theme.name}
        </span>
      )}
    </div>
  );
}
