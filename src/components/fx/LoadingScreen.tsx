'use client';

// "The room opens": ten franchise cubes stack into a pyramid while Lot 001 is
// bid up, the hammer falls, SOLD lands and the paper curtain lifts on the game.
// Full sequence once per browser session; later reloads get a quick fade.
// Click or press any key to skip.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IsoPyramid } from './IsoPyramid';
import { LineField } from '@/components/mynba/primitives';
import { formatPrice } from '@/lib/utils';

const SESSION_KEY = 'ipl-dynasty-intro-seen';
const BUILD_S = 1.5;
const BID_FROM = 20; // ₹20 L base price
const BID_TO = 2475; // ₹24.75 Cr
const T_BID_START = 250;
const T_BID_END = 2000;
const T_SOLD = 2100;
const T_LIFT = 2750;
const LIFT_MS = 700;

const STATUS = ['Seating ten franchises', 'Shuffling the marquee set', 'Lot 001 is on the block'];

type Stage = 'intro' | 'sold' | 'lift' | 'fade' | 'done';

function seenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function LoadingScreen() {
  const [stage, setStage] = useState<Stage>('intro');
  const [bid, setBid] = useState(BID_FROM);
  const [status, setStatus] = useState(0);
  const timers = useRef<number[]>([]);

  const finish = useCallback((how: 'lift' | 'fade') => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* private mode: the intro simply plays again next time */
    }
    setStage(how);
    timers.current.push(window.setTimeout(() => setStage('done'), how === 'lift' ? LIFT_MS : 350));
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seenThisSession() || reduced) {
      // Deferred a tick so the paint underneath is ready before the fade.
      const t = window.setTimeout(() => finish('fade'), reduced ? 600 : 250);
      return () => clearTimeout(t);
    }
    const t = timers.current;
    t.push(window.setTimeout(() => setStatus(1), 700));
    t.push(window.setTimeout(() => setStatus(2), 1450));
    t.push(window.setTimeout(() => setStage('sold'), T_SOLD));
    t.push(window.setTimeout(() => finish('lift'), T_LIFT));

    // The bid climbs on an ease-out curve, in real IPL increments.
    let raf = 0;
    const start = performance.now() + T_BID_START;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / (T_BID_END - T_BID_START)));
      const eased = 1 - Math.pow(1 - p, 3);
      const raw = BID_FROM + (BID_TO - BID_FROM) * eased;
      setBid(raw < 100 ? Math.round(raw / 5) * 5 : Math.round(raw / 25) * 25);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      t.forEach(clearTimeout);
    };
  }, [finish]);

  useEffect(() => {
    if (stage !== 'intro' && stage !== 'sold') return;
    const skip = () => finish('lift');
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [stage, finish]);

  if (stage === 'done') return null;

  return (
    <div
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
          <IsoPyramid mode={stage === 'fade' ? 'idle' : 'build'} duration={BUILD_S} className="relative w-full h-auto overflow-visible" />
          <div className="fx-shadow absolute left-[8%] right-[8%] -bottom-2 h-3 rounded-[50%] bg-[var(--m-ink,#26211E)] opacity-10 blur-[2px]" aria-hidden />
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
