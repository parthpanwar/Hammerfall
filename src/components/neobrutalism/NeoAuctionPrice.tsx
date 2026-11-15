'use client';

import React from 'react';
import { formatPrice } from '@/lib/utils';

export interface NeoAuctionPriceProps {
  amountInLakhs: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'giant';
  variant?: 'highlight' | 'electric' | 'green' | 'dark' | 'white';
  className?: string;
}

export function NeoAuctionPrice({
  amountInLakhs,
  label,
  size = 'lg',
  variant = 'electric',
  className = '',
}: NeoAuctionPriceProps) {
  const formatted = formatPrice(amountInLakhs);

  const variantStyles = {
    electric: 'text-[var(--m-accent-ink)]',
    highlight: 'text-[var(--m-gold)]',
    green: 'text-[var(--m-green)]',
    dark: 'text-[var(--m-text)]',
    white: 'text-[var(--m-text)]',
  }[variant];

  const sizeStyles = {
    sm: 'text-sm sm:text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-3xl sm:text-4xl',
    giant: 'text-4xl sm:text-6xl tracking-tight',
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {label && (
        <span className="text-[10px] font-semibold tracking-wider text-[var(--m-dim)] uppercase mb-1">
          {label}
        </span>
      )}
      <div className={`font-mono font-black tabular-nums ${sizeStyles} ${variantStyles}`}>
        {formatted}
      </div>
    </div>
  );
}
