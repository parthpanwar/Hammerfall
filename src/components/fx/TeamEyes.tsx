'use client';

// The ten franchises as a tray of "eyes" (jersey-colour iris, ink pupil, a glint).
// The pupils follow the pointer and each eye blinks on its own clock. Clicking
// an eye dresses the site in that team's world; clicking it again resets it.

import React, { useEffect, useRef } from 'react';
import { FRANCHISES } from '@/lib/data/franchises';
import { getTeamWorld } from '@/lib/theme/team-themes';

const PUPIL_TRAVEL = 0.16; // share of the iris the pupil may move

export function TeamEyes({
  className = '',
  selected,
  onSelect,
}: {
  className?: string;
  /** The team whose theme is applied (its cell turns ink, its eye turns paper). */
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const trayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tray = trayRef.current;
    if (!tray) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const irises = Array.from(tray.querySelectorAll<HTMLElement>('[data-iris]'));
    let frame = 0;
    let px = window.innerWidth / 2;
    let py = window.innerHeight * 0.6;

    const update = () => {
      frame = 0;
      for (const iris of irises) {
        const r = iris.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.hypot(dx, dy) || 1;
        // Eases toward full travel as the pointer moves away from the eye.
        const reach = Math.min(1, dist / 260) * r.width * PUPIL_TRAVEL;
        iris.style.setProperty('--look-x', `${(dx / dist) * reach}px`);
        iris.style.setProperty('--look-y', `${(dy / dist) * reach}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', update);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={className || 'relative'}>
      {/* The hairline the tray hangs from, running the full width */}
      <div className="absolute left-0 right-0 top-0 h-px bg-[var(--m-ink)]" aria-hidden />
      <div
        ref={trayRef}
        role="radiogroup"
        aria-label="Site theme: pick a franchise"
        className="relative inline-flex border-y border-r border-[var(--m-ink)] rounded-br-[1.5rem] overflow-hidden bg-[var(--m-bg)] transition-colors duration-500"
      >
        {FRANCHISES.map((f, i) => {
          const w = getTeamWorld(f.id);
          const active = selected === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${f.name} theme`}
              title={active ? `${f.name} · click again for the house theme` : `${f.name} theme`}
              onClick={() => onSelect(active ? null : f.id)}
              className={`fx-eye-cell group grid place-items-center p-1 sm:p-1.5 lg:p-2 transition-colors duration-300 ${
                i > 0 ? 'border-l border-[var(--m-ink)]' : ''
              } ${active ? 'bg-[var(--m-ink)]' : 'hover:bg-[var(--m-raised)]'}`}
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <span className="block transition-transform duration-300 ease-out group-hover:scale-110">
                <span
                  className="fx-eye relative block w-5 h-5 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-full"
                  style={{ background: active ? w.paper : w.accent, animationDelay: `${(i * 1.37) % 5}s`, animationDuration: `${5.5 + (i % 4) * 1.3}s` }}
                >
                  <span
                    data-iris
                    className="fx-pupil absolute left-1/2 top-1/2 w-[48%] h-[48%] rounded-full"
                    style={{ background: active ? w.accent : '#221F1D' }}
                  >
                    <span className="absolute right-[18%] top-[16%] w-[24%] h-[24%] rounded-full" style={{ background: w.paper }} />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
