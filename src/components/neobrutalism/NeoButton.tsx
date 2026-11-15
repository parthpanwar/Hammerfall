'use client';

import React from 'react';

export type NeoButtonVariant =
  | 'primary'      // Electric blue
  | 'highlight'    // Motorsport amber / yellow
  | 'success'      // Fintech emerald green
  | 'warning'      // Orange
  | 'urgent'       // F1 coral red
  | 'lavender'     // Purple
  | 'dark'         // Elevated surface
  | 'outline'      // Subtle border outline
  | 'ghost';       // Minimalist text button

export type NeoButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeoButtonVariant;
  size?: NeoButtonSize;
  fullWidth?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

export const NeoButton = React.forwardRef<HTMLButtonElement, NeoButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      active = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs font-semibold rounded',
      md: 'px-4 py-2 text-xs sm:text-sm font-semibold rounded-md',
      lg: 'px-6 py-2.5 text-sm sm:text-base font-bold rounded-md',
      xl: 'px-8 py-3.5 text-base sm:text-lg font-bold rounded-lg',
    }[size];

    const variantStyles: Record<NeoButtonVariant, string> = {
      primary: 'bg-[var(--m-accent-ink)] text-white hover:bg-[#3B76E1] shadow-md shadow-blue-500/20 border border-blue-400/30',
      highlight: 'bg-[var(--m-gold)] text-white hover:bg-[#E5A534] font-bold border border-amber-300/30',
      success: 'bg-[var(--m-green)] text-white hover:bg-[#14B289] font-bold shadow-md shadow-emerald-500/20 border border-emerald-400/30',
      warning: 'bg-[var(--m-orange)] text-white hover:bg-[#EA580C] font-bold border border-orange-400/30',
      urgent: 'bg-[var(--m-red)] text-white hover:bg-[#D44751] font-bold shadow-md shadow-red-500/20 border border-red-400/30',
      lavender: 'bg-[var(--m-purple)] text-white hover:bg-[var(--m-purple)] font-bold border border-purple-400/30',
      dark: 'bg-[var(--m-raised)] text-[var(--m-text)] hover:bg-[var(--m-raised)] border border-[var(--m-line)] hover:border-[var(--m-line-strong)]',
      outline: 'bg-transparent text-[var(--m-text)] border border-[var(--m-line)] hover:bg-[var(--m-raised)] hover:border-[var(--m-accent-ink)]/50',
      ghost: 'bg-transparent text-[var(--m-dim)] hover:text-[var(--m-text)] hover:bg-[var(--m-raised)]/60 border border-transparent',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`sports-btn inline-flex items-center justify-center gap-2 tracking-wide transition-all select-none ${
          variantStyles[variant]
        } ${sizeClasses} ${fullWidth ? 'w-full' : ''} ${
          active ? 'ring-2 ring-[var(--m-accent-ink)] bg-[var(--m-raised)]' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

NeoButton.displayName = 'NeoButton';
