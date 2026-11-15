'use client';

import React from 'react';

export interface NeoTabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export interface NeoTabsProps {
  items: NeoTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function NeoTabs({ items, activeTab, onChange, className = '' }: NeoTabsProps) {
  return (
    <div className={`flex items-center gap-1.5 p-1 rounded-lg bg-[var(--m-bg)] border border-[var(--m-line)] overflow-x-auto ${className}`}>
      {items.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all select-none whitespace-nowrap ${
              isActive
                ? 'bg-[var(--m-raised)] text-[var(--m-text)] border border-[var(--m-line-strong)] shadow-sm'
                : 'text-[var(--m-dim)] hover:text-[var(--m-text)] hover:bg-[var(--m-panel)]'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 stroke-[2]" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isActive ? 'bg-[var(--m-accent-ink)]/20 text-[var(--m-accent-ink)]' : 'bg-[var(--m-raised)] text-[var(--m-dim)]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
