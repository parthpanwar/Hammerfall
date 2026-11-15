'use client';

import React from 'react';

export interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export const NeoInput = React.forwardRef<HTMLInputElement, NeoInputProps>(
  ({ label, error, icon: Icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="text-[11px] font-semibold text-[var(--m-dim)] uppercase tracking-wider block">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {Icon && (
            <div className="absolute left-3 text-[var(--m-dim)] pointer-events-none">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <input
            ref={ref}
            className={`terminal-input w-full px-3 py-2 text-xs sm:text-sm ${
              Icon ? 'pl-9' : ''
            } ${error ? 'border-[var(--m-red)] focus:border-[var(--m-red)]' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-[10px] text-[var(--m-red)] font-semibold">{error}</p>}
      </div>
    );
  }
);

NeoInput.displayName = 'NeoInput';

export interface NeoSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const NeoSelect = React.forwardRef<HTMLSelectElement, NeoSelectProps>(
  ({ label, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="text-[11px] font-semibold text-[var(--m-dim)] uppercase tracking-wider block">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`terminal-input w-full px-3 py-2 text-xs sm:text-sm ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[var(--m-panel)] text-[var(--m-text)]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

NeoSelect.displayName = 'NeoSelect';
