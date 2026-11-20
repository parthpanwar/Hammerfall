'use client';

// ============================================================
// IPL DYNASTY — Title page (editorial, Peabody House-inspired)
// Boxed top bar · split hero (statement + eye tray | live line art) ·
// how a season plays · the ten franchises · closing card.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { FRANCHISES } from '@/lib/data/franchises';
import { getTeamWorld } from '@/lib/theme/team-themes';
import { MButton } from '@/components/mynba/primitives';
import { TeamEyes } from '@/components/fx/TeamEyes';
import { LiveLines } from '@/components/fx/LiveLines';
import { GavelArt, PodiumArt, RetainArt, StackArt, StumpsArt } from '@/components/fx/IsoLineArt';

const START_SEASON = 2027;

const ACTS = [
  {
    title: 'Retentions',
    art: RetainArt,
    body: 'Keep up to six from your squad. The first pick costs the most, so every name you keep is a name you can’t bid on.',
    fact: 'Mega years · up to 6 kept',
  },
  {
    title: 'The auction',
    art: GavelArt,
    body: 'Lots come up set by set. Nine CPU general managers bid on need, scarcity and budget. Push, pass, or let the hammer fall.',
    fact: 'Marquee to uncapped',
  },
  {
    title: 'The season',
    art: StumpsArt,
    body: 'Pick your XI and batting order, then play or simulate 70 league matches. The top four reach the playoffs.',
    fact: 'Four overseas in the XI',
  },
  {
    title: 'The dynasty',
    art: PodiumArt,
    body: 'Players grow, peak and retire. Purses rise. Two mini auctions later the next mega arrives, and you start again.',
    fact: 'Two auction cycles',
  },
];

/** Adds `data-shown` once an element scrolls into view (CSS does the rest). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.shown = 'true';
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

export function HomeScreen({ onBegin, theme, onTheme }: { onBegin: () => void; theme: string | null; onTheme: (id: string | null) => void }) {
  const root = useReveal<HTMLDivElement>();
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div ref={root} className="relative">
      {/* Boxed top bar */}
      <header className="sticky top-0 z-30 px-1.5 pt-1.5 bg-[var(--m-bg)] transition-colors duration-500">
        <nav className="h-9 flex items-stretch border border-[var(--m-ink)] rounded-[4px] bg-[var(--m-bg)] text-[15px]" aria-label="Title page">
          <button className="flex items-center gap-2 px-2.5 font-medium" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="w-[18px] h-[18px] rounded-full border border-[var(--m-ink)] grid place-items-center" aria-hidden>
              <span className="w-2 h-2 rounded-full bg-[var(--m-accent)]" />
            </span>
            IPL Dynasty
          </button>
          <button className="hidden sm:flex items-center px-2 hover:underline underline-offset-4" onClick={() => jump('how')}>
            How it plays
          </button>
          <button className="hidden sm:flex items-center px-2 hover:underline underline-offset-4" onClick={() => jump('franchises')}>
            Franchises
          </button>
          <span className="ml-auto hidden md:flex items-center px-3 text-sm text-[var(--m-dim)] border-l border-[var(--m-ink)]">IPL {START_SEASON} offseason</span>
          <button
            onClick={onBegin}
            className="group flex items-center gap-1 px-3 border-l border-[var(--m-ink)] bg-[var(--m-ink)] text-[var(--m-bg)] font-medium rounded-r-[3px] ml-auto md:ml-0"
          >
            Begin <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </nav>
      </header>

      {/* Hero: statement and tray | live line art */}
      <section className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] min-h-[calc(100dvh-2.625rem)]">
        <div className="flex flex-col min-w-0">
          <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 py-14">
            <span className="m-rise m-label">IPL {START_SEASON} · Offseason</span>
            <h1 className="m-rise m-display text-[3.2rem] sm:text-[4.6rem] xl:text-[5.4rem] leading-[0.95] mt-4 max-w-[14ch]" style={{ animationDelay: '60ms' }}>
              IPL Dynasty is a front office for the richest league in cricket.
            </h1>
            <p className="m-rise text-[var(--m-dim)] text-lg leading-relaxed mt-8 max-w-[34ch]" style={{ animationDelay: '140ms' }}>
              Retain your core, out-bid nine CPU general managers, then live with every rupee for three seasons.
            </p>
            <div className="m-rise mt-10" style={{ animationDelay: '220ms' }}>
              <MButton variant="primary" size="xl" onClick={onBegin} className="group min-w-[200px] justify-center" autoFocus>
                Begin <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </MButton>
            </div>
          </div>
          {/* The tray hangs from a hairline that runs to the column rule */}
          <div className="pb-8 lg:pb-10">
            <TeamEyes className="relative text-left" selected={theme} onSelect={onTheme} />
            <div className="px-6 sm:px-12 mt-3 text-xs text-[var(--m-faint)]">Click a franchise to wear its colours.</div>
          </div>
        </div>
        <div className="relative hidden lg:block border-l border-[var(--m-ink)] text-[var(--m-ink)] overflow-hidden">
          <LiveLines seed={theme ?? 'house'} lines={60} className="absolute inset-0 w-full h-full" />
        </div>
      </section>

      {/* Statement */}
      <section className="border-t border-[var(--m-ink)] grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 px-6 sm:px-12 py-20">
        <h2 data-reveal className="fx-reveal m-display text-[2.4rem] leading-[1.02] self-end max-w-[12ch]">
          Every rupee is remembered.
        </h2>
        <div data-reveal className="fx-reveal space-y-5 text-[var(--m-dim)] leading-relaxed max-w-[44ch]" style={{ transitionDelay: '80ms' }}>
          <p>
            A mega auction sets your squad for three seasons. Overpay for a star in November and you feel it every December after: in the purse, in the mini
            auctions, in the trades nobody will take.
          </p>
          <p>Ten franchises, each with its own general manager, budget and plans. You run one of them.</p>
          <div className="text-[var(--m-text)] font-semibold text-sm flex items-center gap-3 pt-2">
            The hammer always falls <Squiggle />
          </div>
        </div>
        <div data-reveal className="fx-reveal art-host hidden md:flex items-end justify-center" style={{ transitionDelay: '160ms' }}>
          <StackArt className="w-full max-w-[260px] h-auto overflow-visible" />
        </div>
      </section>

      {/* How a season plays */}
      <section id="how" className="border-t border-[var(--m-ink)] grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] gap-10 px-6 sm:px-12 py-20 scroll-mt-12">
        <div className="lg:sticky lg:top-24 self-start">
          <div className="text-sm font-semibold">How it plays</div>
          <h2 className="m-display text-[2.4rem] leading-[1.02] mt-3 max-w-[11ch]">What does a season look like?</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-16">
          {ACTS.map((a, i) => {
            const Art = a.art;
            return (
              <article key={a.title} data-reveal className="fx-reveal art-host group" style={{ transitionDelay: `${(i % 2) * 90}ms` }}>
                <div className="h-44 flex items-end justify-center pb-4">
                  <Art className="max-h-full w-auto max-w-[78%] overflow-visible" />
                </div>
                <h3 className="m-display text-[1.9rem] leading-none border-t border-[var(--m-ink)] pt-3">{a.title}</h3>
                <p className="text-[var(--m-dim)] leading-relaxed mt-3 max-w-[38ch]">{a.body}</p>
                <div className="text-sm font-semibold mt-5 flex items-center gap-3">
                  {a.fact} <Squiggle />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* The ten franchises */}
      <section id="franchises" className="border-t border-[var(--m-ink)] grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] gap-10 px-6 sm:px-12 py-20 scroll-mt-12">
        <div className="lg:sticky lg:top-24 self-start">
          <div className="text-sm font-semibold">Franchises</div>
          <h2 className="m-display text-[2.4rem] leading-[1.02] mt-3 max-w-[11ch]">Who are you playing for?</h2>
          <p className="text-sm text-[var(--m-dim)] mt-4 max-w-[30ch]">Click a franchise to dress the site in its colours. You pick the one you manage after Begin.</p>
        </div>
        <ul data-reveal className="fx-reveal border-t border-[var(--m-ink)]">
          {FRANCHISES.map((f) => {
            const w = getTeamWorld(f.id);
            const active = theme === f.id;
            return (
              <li key={f.id}>
                <button
                  onClick={() => onTheme(active ? null : f.id)}
                  aria-pressed={active}
                  className={`group w-full grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-4 py-3 px-1 text-left border-b border-[var(--m-line)] transition-colors ${
                    active ? 'bg-[var(--m-raised)]' : 'hover:bg-[var(--m-raised)]'
                  }`}
                >
                  <span className="truncate group-hover:translate-x-1 transition-transform">{f.name}</span>
                  <span className="text-[var(--m-dim)] truncate">{f.city}</span>
                  <span className="hidden sm:block text-[var(--m-faint)] text-sm truncate">{f.homeStadium.split(',')[0]}</span>
                  <span className="flex items-center gap-1.5 pr-1" aria-hidden>
                    <span className="w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125" style={{ background: w.accent }} />
                    <span className="w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125 delay-75" style={{ background: w.accent2 }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Closing card */}
      <section className="border-t border-[var(--m-ink)] grid md:grid-cols-2 gap-10 px-6 sm:px-12 py-20 items-end">
        <div data-reveal className="fx-reveal">
          <div className="text-sm font-semibold">Enough about us.</div>
          <h2 className="m-display text-[3rem] sm:text-[3.6rem] leading-[0.98] mt-3 max-w-[12ch]">The auction room is open.</h2>
        </div>
        <button
          data-reveal
          onClick={onBegin}
          className="fx-reveal group text-left rounded-[4px] bg-[var(--m-ink)] text-[var(--m-bg)] p-6 min-h-[190px] flex flex-col justify-between shadow-[6px_6px_0_var(--m-accent)] transition-transform hover:-translate-y-1"
          style={{ transitionDelay: '100ms' }}
        >
          <span className="opacity-80 max-w-[34ch]">Ten franchises. One purse each. A marquee set waiting on the block.</span>
          <span className="flex items-center gap-3 font-semibold">
            Begin your dynasty <Squiggle className="transition-all duration-500 group-hover:w-40" />
          </span>
        </button>
      </section>

      <footer className="border-t border-[var(--m-ink)] px-6 sm:px-12 py-6 text-xs text-[var(--m-faint)] flex flex-wrap justify-between gap-2">
        <span>IPL Dynasty · a fan-made franchise simulator</span>
        <span>Not affiliated with the IPL or the BCCI.</span>
      </footer>
    </div>
  );
}

/** The hand-drawn arrow rule used under captions. */
function Squiggle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 10" className={`w-24 h-2.5 overflow-visible ${className}`} preserveAspectRatio="none" aria-hidden>
      <path d="M0 5 H44 C50 5 52 2 57 2 S64 8 70 8 S76 5 82 5 H116" fill="none" stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <path d="M112 2 L117 5 L112 8" fill="none" stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
