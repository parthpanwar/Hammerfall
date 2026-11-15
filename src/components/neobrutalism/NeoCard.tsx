'use client';

import React from 'react';

export type NeoCardElevation = 'sm' | 'md' | 'lg' | 'xl';
export type NeoCardAccent = 'yellow' | 'blue' | 'green' | 'orange' | 'red' | 'lavender' | 'dark' | 'none';

export interface NeoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: NeoCardElevation;
  accent?: NeoCardAccent;
  accentTitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export function NeoCard({
  elevation = 'md',
  accent = 'none',
  accentTitle,
  headerRight,
  className = '',
  children,
  ...props
}: NeoCardProps) {
  const elevationClass = {
    sm: 'terminal-card-sm',
    md: 'terminal-card',
    lg: 'terminal-card-elevated',
    xl: 'terminal-card-elevated shadow-2xl shadow-black/60',
  }[elevation];

  const accentStyles: Record<NeoCardAccent, string> = {
    none: '',
    yellow: 'border-t-2 border-t-[var(--m-gold)]',
    blue: 'border-t-2 border-t-[var(--m-accent-ink)]',
    green: 'border-t-2 border-t-[var(--m-green)]',
    orange: 'border-t-2 border-t-[var(--m-orange)]',
    red: 'border-t-2 border-t-[var(--m-red)]',
    lavender: 'border-t-2 border-t-[var(--m-purple)]',
    dark: 'border-t-2 border-t-[var(--m-line-strong)]',
  };

  return (
    <div
      className={`rounded-lg relative overflow-hidden bg-[var(--m-panel)] border border-[var(--m-line)] ${elevationClass} ${
        accent !== 'none' ? accentStyles[accent] : ''
      } ${className}`}
      {...props}
    >
      {accentTitle && (
        <div className="flex items-center justify-between border-b border-[var(--m-line)] px-4 py-3 bg-[var(--m-panel)]/70">
          <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[var(--m-text)]">
            {accentTitle}
          </span>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
