'use client';

import React from 'react';

export interface NeoStatBlockProps {
  label: string;
  value: string | number;
  subtext?: string;
  subValue?: string;
  variant?: 'blue' | 'yellow' | 'green' | 'orange' | 'red' | 'dark' | 'white';
  accent?: string;
  size?: 'sm' | 'md' | 'lg' | string;
  className?: string;
}

export function NeoStatBlock({
  label,
  value,
  subtext,
  subValue,
  variant = 'blue',
  accent,
  size,
  className = '',
}: NeoStatBlockProps) {
  const chosenVariant = (accent as any) || variant;
  const accentColors: Record<string, string> = {
    blue: 'text-[var(--m-accent-ink)]',
    yellow: 'text-[var(--m-gold)]',
    green: 'text-[var(--m-green)]',
    orange: 'text-[var(--m-orange)]',
    red: 'text-[var(--m-red)]',
    dark: 'text-[var(--m-text)]',
    white: 'text-[var(--m-text)]',
  };
  const textColor = accentColors[chosenVariant] || 'text-[var(--m-accent-ink)]';
  const subtitle = subtext || subValue;

  return (
    <div
      className={`rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] p-3.5 flex flex-col justify-between ${className}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--m-dim)]">
        {label}
      </div>
      <div className={`text-xl sm:text-2xl font-mono font-black tabular-nums my-1 ${textColor}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[11px] text-[var(--m-dim)] font-medium">
          {subtitle}
        </div>
      )}
    </div>
  );
}
