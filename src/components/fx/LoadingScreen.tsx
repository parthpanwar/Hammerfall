'use client';

// "The room opens": ten franchise cubes stack into a pyramid while Lot 001 is
// bid up, the hammer falls, SOLD lands and the paper curtain lifts on the game.
// Plays in full on every load (about 5 s); click or press any key to skip.
// Reduced-motion users get a short fade instead.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IsoPyramid } from './IsoPyramid';
import { LineField } from '@/components/mynba/primitives';
import { formatPrice } from '@/lib/utils';

const BUILD_S = 3; // ten cubes, 0.3 s apart
const BID_FROM = 20; // ₹20 L base price
const BID_TO = 2475; // ₹24.75 Cr
const T_BID_START = 500;
const T_BID_END = 3500;
const T_SOLD = 3800;
const T_LIFT = 5000;
const LIFT_MS = 800;

const STATUS = ['Seating ten franchises', 'Shuffling the marquee set', 'Lot 001 is on the block'];

type Stage = 'intro' | 'sold' | 'lift' | 'fade' | 'done';

export function LoadingScreen() {
  const [stage, setStage] = useState<Stage>('intro');
  const [bid, setBid] = useState(BID_FROM);
  const [status, setStatus] = useState(0);
  // The cubes and the bid start on the same tick (after hydration), so they stay in step.
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const finish = useCallback((how: 'lift' | 'fade') => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStage(how);
    timers.current.push(window.setTimeout(() => setStage('done'), how === 'lift' ? LIFT_MS : 350));
  }, []);

  // Hold the opening beat until the app underneath has mounted (its first render
  // is heavy and would stall the clock), then start cubes and bid together.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => (reduced ? finish('fade') : setPlaying(true)), reduced ? 600 : 400);
    return () => clearTimeout(t);
  }, [finish]);

  // One timeline, started in the same commit that drops the first cube.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let raf = 0;
    const t = timers.current;
    // Wait until the browser has actually started the first cube's drop (it can
    // resolve a frame or more late), so the bid and SOLD land with the stack.
    const first = rootRef.current?.querySelector('g.fx-cube-drop')?.getAnimations()[0];
    const begin = () => {
      if (cancelled) return;
      t.push(window.setTimeout(() => setStatus(1), 1300));
      t.push(window.setTimeout(() => setStatus(2), 2600));
      // SOLD waits for both the bid clock and the last cube to land, then the curtain lifts.
      const cubes = rootRef.current?.querySelectorAll('g.fx-cube-drop') ?? [];
      const last = cubes[cubes.length - 1]?.getAnimations()[0];
      const atSold = new Promise<void>((r) => t.push(window.setTimeout(r, T_SOLD)));
      Promise.all([
        atSold,
        Promise.race([last ? last.finished.catch(() => undefined) : undefined, new Promise((r) => t.push(window.setTimeout(r, T_SOLD + 1500)))]),
      ]).then(() => {
        if (cancelled) return;
        setStage('sold');
        t.push(window.setTimeout(() => finish('lift'), T_LIFT - T_SOLD));
      });

      // The bid climbs on an ease-out curve, in real IPL increments.
      const start = performance.now() + T_BID_START;
      const tick = (now: number) => {
        const p = Math.min(1, Math.max(0, (now - start) / (T_BID_END - T_BID_START)));
        const eased = 1 - Math.pow(1 - p, 3);
        const raw = BID_FROM + (BID_TO - BID_FROM) * eased;
        setBid(raw < 100 ? Math.round(raw / 5) * 5 : Math.round(raw / 25) * 25);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    // Never hang: if the browser hasn't painted (background tab), go anyway.
    let begun = false;
    const once = () => {
      if (begun) return;
      begun = true;
      begin();
    };
    if (first) first.ready.then(once, once);
    t.push(window.setTimeout(once, 600));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      t.forEach(clearTimeout);
    };
  }, [playing, finish]);

  useEffect(() => {
    if (stage !== 'intro' && stage !== 'sold') return;
    const skip = () => finish('lift');
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [stage, finish]);

  if (stage === 'done') return null;

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-[100] bg-[var(--m-bg,#FAF6F3)] text-[var(--m-text,#26211E)] overflow-hidden select-none cursor-pointer ${
        stage === 'lift' ? 'fx-curtain' : stage === 'fade' ? 'fx-fade-out' : ''
      }`}
      onClick={() => (stage === 'intro' || stage === 'sold') && finish('lift')}
      role="status"
      aria-live="polite"
      aria-label="Loading IPL Dynasty"
    >
      <div className="absolute inset-0 text-[var(--m-ink,#26211E)] opacity-[0.12]" aria-hidden>
        <LineField seed="house" lines={36} className="w-full h-full" />
      </div>

      <div className="relative h-full flex flex-col items-center justify-center px-6">
        <div className="m-label tracking-[0.3em]">IPL Dynasty</div>

        {/* The stack: one cube per franchise */}
        <div className="relative mt-6 w-[210px] sm:w-[260px]">
          <IsoPyramid
            mode={stage === 'fade' ? 'idle' : 'build'}
            playing={playing}
            duration={BUILD_S}
            className="relative w-full h-auto overflow-visible"
          />
          <div
            className="fx-shadow absolute left-[8%] right-[8%] -bottom-2 h-3 rounded-[50%] bg-[var(--m-ink,#26211E)] opacity-[0.06] blur-[3px]"
            aria-hidden
          />
        </div>

        {/* Lot 001 */}
        <div className="mt-10 flex flex-col items-center">
          <div className="text-xs text-[var(--m-faint,#8a817b)] tabular-nums">Lot 001 · Marquee set</div>
          <div className="relative mt-1">
            <div className="m-display text-5xl sm:text-6xl tabular-nums leading-none">{formatPrice(bid)}</div>
            {stage !== 'intro' && (
              <span className="m-stamp absolute -right-16 sm:-right-20 -top-3 px-2.5 py-1 border-2 border-[var(--m-accent,#C8553D)] text-[var(--m-accent,#C8553D)] font-bold text-sm tracking-[0.2em] rounded-[3px]">
                SOLD
              </span>
            )}
            {stage !== 'intro' && <Gavel />}
          </div>
          <div className="mt-4 h-5 text-sm text-[var(--m-dim,#6b625c)]" key={stage === 'intro' ? status : 'sold'}>
            <span className="m-rise inline-block">{stage === 'intro' ? `${STATUS[status]}…` : 'Welcome to the auction room.'}</span>
          </div>
        </div>

        <div className="absolute bottom-6 text-[11px] text-[var(--m-faint,#8a817b)]">Click or press any key to skip</div>
      </div>
    </div>
  );
}

function Gavel() {
  return (
    <svg viewBox="0 0 64 64" className="fx-gavel absolute -left-14 sm:-left-16 -top-6 w-11 h-11 sm:w-12 sm:h-12" aria-hidden>
      <g stroke="var(--m-ink,#26211E)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
        <rect x={10} y={10} width={26} height={14} rx={3} transform="rotate(-35 23 17)" fill="var(--m-accent,#C8553D)" />
        <line x1={28} y1={26} x2={50} y2={52} />
      </g>
    </svg>
  );
}
