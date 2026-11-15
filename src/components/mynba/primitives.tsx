'use client';

// ============================================================
// IPL DYNASTY — Franchise Mode UI primitives (MyNBA-inspired)
// Sharp panels, condensed uppercase type, tiered OVR badges and
// team-coloured accents driven by the --team-primary CSS variable.
// ============================================================

import React from 'react';
import { getTeamTheme, getTeamWorld, contrast, readableOn, worldTokens } from '@/lib/theme/team-themes';
import { cn } from '@/lib/utils';

/** Pick black or white text for a background colour. */
export function onColor(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#14110f' : '#ffffff';
}

/**
 * Accent variables for showing another franchise inside the current world
 * (bidder chips, trade partners): its jersey colours, readable on this page.
 */
export function teamVars(franchiseId: string): React.CSSProperties {
  const w = getTeamWorld(franchiseId);
  return {
    ['--team-primary' as string]: w.accent,
    ['--team-secondary' as string]: w.accent2,
    ['--team-on-primary' as string]: contrast(w.accent, '#ffffff') >= 3.2 ? '#ffffff' : w.ink,
    ['--team-ink' as string]: w.accentInk ?? readableOn(w.accent, '#f6f4f1', w.ink),
  };
}

/** The full world (paper, ink, accents, semantic colours) of a franchise. */
export function worldVars(franchiseId: string | null | undefined): React.CSSProperties {
  return worldTokens(franchiseId) as React.CSSProperties;
}

// ------------------------------------------------------------
// OVR tiers — flat ink-outlined swatches
// ------------------------------------------------------------
export interface OvrTier {
  name: string;
  bg: string;
  fg: string;
  ring: string;
}

export function ovrTier(ovr: number): OvrTier {
  if (ovr >= 92) return { name: 'Galaxy', bg: 'linear-gradient(135deg,#d6457f,#5a3fd1)', fg: '#fff', ring: '#5a3fd1' };
  if (ovr >= 88) return { name: 'Diamond', bg: '#9fd8e6', fg: '#0c2a33', ring: '#1f6f86' };
  if (ovr >= 84) return { name: 'Amethyst', bg: '#7c55c9', fg: '#fff', ring: '#4b2e8a' };
  if (ovr >= 80) return { name: 'Ruby', bg: '#c8363f', fg: '#fff', ring: '#8a1d24' };
  if (ovr >= 76) return { name: 'Sapphire', bg: '#2f62c4', fg: '#fff', ring: '#1b3f86' };
  if (ovr >= 72) return { name: 'Emerald', bg: '#2f8f62', fg: '#fff', ring: '#1b5e3f' };
  if (ovr >= 66) return { name: 'Gold', bg: '#e2b94e', fg: '#2b1f00', ring: '#9a7314' };
  return { name: 'Silver', bg: '#d7d3cf', fg: '#2b2724', ring: '#8d8783' };
}

export function OvrBadge({
  ovr,
  size = 'md',
  className,
}: {
  ovr: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const t = ovrTier(ovr);
  const dims = {
    sm: 'w-7 h-7 text-[14px]',
    md: 'w-9 h-9 text-[18px]',
    lg: 'w-14 h-14 text-[28px]',
    xl: 'w-20 h-20 text-[42px]',
  }[size];
  return (
    <span
      title={`${t.name} tier`}
      className={cn('inline-flex items-center justify-center font-display shrink-0 leading-none rounded-full tabular-nums', dims, className)}
      style={{ background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}
    >
      {ovr}
    </span>
  );
}

// ------------------------------------------------------------
// Team crest — a round jersey "eye": accent disc, trim ring, ink outline
// ------------------------------------------------------------
export function TeamCrest({
  franchiseId,
  size = 'md',
  className,
}: {
  franchiseId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const t = getTeamTheme(franchiseId);
  const w = getTeamWorld(franchiseId);
  const dims = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-11 h-11 text-[13px]',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  }[size];
  const ring = size === 'xs' || size === 'sm' ? 2 : size === 'md' ? 3 : 4;
  return (
    <span
      className={cn('relative inline-flex items-center justify-center rounded-full font-semibold tracking-tight shrink-0', dims, className)}
      style={{
        background: w.accent,
        color: contrast(w.accent, '#ffffff') >= 3.2 ? '#ffffff' : w.ink,
        boxShadow: `inset 0 0 0 ${ring}px ${w.accent2}, inset 0 0 0 ${ring + 1}px ${w.ink}, 0 0 0 1px ${w.ink}`,
      }}
      title={t.name}
    >
      {t.abbreviation}
    </span>
  );
}

// ------------------------------------------------------------
// Line field — generative contour lines (Peabody House-style hero art).
// The distortion is seeded by the franchise, so every team's field differs.
// ------------------------------------------------------------
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildLineField(seed: string, lines: number): string[] {
  let r = hashSeed(seed);
  const rnd = () => ((r = Math.imul(r ^ (r >>> 15), 2246822507) ^ Math.imul(r ^ (r >>> 13), 3266489909)), (r >>> 0) / 4294967296);
  const W = 400;
  const H = 600;
  const bumps = Array.from({ length: 3 }, () => ({
    x: 80 + rnd() * 260,
    y: 120 + rnd() * 380,
    sx: 50 + rnd() * 90,
    sy: 60 + rnd() * 120,
    a: (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 34),
  }));
  const freq = 0.012 + rnd() * 0.01;
  const phase = rnd() * Math.PI * 2;
  const gap = H / lines;
  const out: string[] = [];
  for (let i = 0; i <= lines; i++) {
    const y0 = i * gap;
    let d = '';
    for (let x = -10; x <= W + 10; x += 8) {
      let dy = 0;
      for (const b of bumps) {
        const g = Math.exp(-(((x - b.x) / b.sx) ** 2) - ((y0 - b.y) / b.sy) ** 2);
        dy += b.a * g * (1 + 0.4 * Math.sin(x * freq + phase + i * 0.15));
      }
      d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${(y0 + dy).toFixed(1)}`;
    }
    out.push(d);
  }
  return out;
}

export function LineField({
  seed = 'house',
  lines = 44,
  className,
  accentEvery = 0,
  vertical = false,
}: {
  seed?: string;
  lines?: number;
  className?: string;
  /** Draw every n-th line in the team accent (0 = all ink). */
  accentEvery?: number;
  vertical?: boolean;
}) {
  const paths = React.useMemo(() => buildLineField(seed, lines), [seed, lines]);
  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="none"
      className={cn('pointer-events-none', className)}
      style={vertical ? { transform: 'rotate(90deg)' } : undefined}
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={accentEvery && i % accentEvery === accentEvery - 1 ? 'var(--team-primary)' : 'currentColor'}
          strokeWidth={accentEvery && i % accentEvery === accentEvery - 1 ? 2.2 : 1.1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

// ------------------------------------------------------------
// Layout
// ------------------------------------------------------------
export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
  style,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={cn('m-panel', className)} style={style}>
      {title !== undefined && (
        <header className="m-panel-head">
          <h3 className="text-[0.86rem] font-semibold text-[var(--m-text)]">{title}</h3>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Editorial page hero: serif title on paper, team line-field on the right. */
export function PageHero({
  franchiseId,
  kicker,
  title,
  subtitle,
  right,
}: {
  franchiseId: string;
  kicker: string;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border border-[var(--m-ink)] bg-[var(--m-panel)]">
      <div className="absolute inset-y-0 right-0 w-[42%] hidden md:block border-l border-[var(--m-ink)] text-[var(--m-ink)]">
        <LineField seed={franchiseId} lines={26} accentEvery={7} className="w-full h-full m-drift" />
      </div>
      <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5 px-5 sm:px-8 py-7 md:pr-[44%]">
        <div className="flex items-start gap-4 min-w-0">
          <TeamCrest franchiseId={franchiseId} size="md" className="hidden sm:inline-flex mt-1" />
          <div className="min-w-0">
            <div className="m-label">{kicker}</div>
            <h1 className="m-display text-4xl sm:text-5xl mt-1">{title}</h1>
            {subtitle && <div className="text-sm text-[var(--m-dim)] mt-3 max-w-xl leading-relaxed">{subtitle}</div>}
            {right && <div className="flex flex-wrap items-center gap-2 mt-5">{right}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Small atoms
// ------------------------------------------------------------
type BtnVariant = 'default' | 'primary' | 'team' | 'go' | 'danger' | 'ghost';
type BtnSize = 'sm' | 'md' | 'lg' | 'xl';

export const MButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }
>(function MButton({ variant = 'default', size = 'md', className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'm-btn',
        variant !== 'default' && `m-btn-${variant}`,
        size !== 'md' && `m-btn-${size}`,
        className
      )}
      {...props}
    />
  );
});

export function StatTile({
  label,
  value,
  sub,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'green' | 'gold' | 'red' | 'team';
  className?: string;
}) {
  const color = {
    default: 'var(--m-text)',
    green: 'var(--m-green)',
    gold: 'var(--m-gold)',
    red: 'var(--m-red)',
    team: 'var(--team-ink)',
  }[tone];
  return (
    <div className={cn('border-t border-[var(--m-ink)] pt-2 pb-1', className)}>
      <div className="m-label !text-[0.62rem]">{label}</div>
      <div className="font-display text-[1.9rem] leading-none mt-1 tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-[var(--m-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}

export function RatingBar({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="m-label !text-[0.62rem]">{label}</span>
        <span className="font-display font-bold text-sm tabular-nums">{value}</span>
      </div>
      <div className="m-meter">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('m-tabs border-b border-[var(--m-line)]', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          data-active={value === t.id}
          onClick={() => onChange(t.id)}
          className="m-tab"
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-[var(--m-faint)]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function RoleTag({ role }: { role: string }) {
  const short: Record<string, string> = {
    Batter: 'BAT',
    Bowler: 'BOWL',
    'All-Rounder': 'AR',
    Wicketkeeper: 'WK',
  };
  const color: Record<string, string> = {
    Batter: 'var(--m-cyan)',
    Bowler: 'var(--m-green)',
    'All-Rounder': 'var(--m-gold)',
    Wicketkeeper: 'var(--m-purple)',
  };
  return (
    <span
      className="m-chip !text-[0.62rem]"
      style={{ color: color[role] || 'var(--m-dim)', borderColor: `color-mix(in srgb, ${color[role] || 'var(--m-dim)'} 45%, transparent)` }}
    >
      {short[role] || role}
    </span>
  );
}

export function OverseasTag() {
  return (
    <span className="m-chip !text-[0.6rem] !text-[var(--m-gold)] !border-[var(--m-gold)]/40" title="Overseas player">
      OS
    </span>
  );
}

export function Modal({
  open,
  onClose,
  children,
  width = 'max-w-5xl',
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  labelledBy?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={cn('m-panel w-full max-h-[92vh] flex flex-col overflow-hidden m-rise shadow-[8px_8px_0_var(--m-ink)]', width)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-10 text-center">
      <div className="m-display text-xl text-[var(--m-dim)]">{title}</div>
      {hint && <div className="text-xs text-[var(--m-faint)] mt-1">{hint}</div>}
    </div>
  );
}

/**
 * Quiet page title: kicker, title, one line of help and the page's actions.
 * Used where a full team-colour hero would add noise (in-season screens).
 */
export function PageHeader({
  kicker,
  title,
  subtitle,
  right,
}: {
  kicker?: string;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
      <div className="min-w-0">
        {kicker && <div className="m-label">{kicker}</div>}
        <h1 className="m-display text-4xl sm:text-5xl mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--m-dim)] mt-2 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
