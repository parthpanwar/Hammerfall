'use client';

// The ten franchises as a tray of "eyes" (jersey-colour iris, ink pupil, a glint).
// Purely decorative: the pupils follow the pointer and each eye blinks on its
// own clock. Nothing here is clickable.

import React, { useEffect, useRef } from 'react';
import { FRANCHISES } from '@/lib/data/franchises';
import { getTeamWorld } from '@/lib/theme/team-themes';

const PUPIL_TRAVEL = 0.16; // share of the iris the pupil may move

export function TeamEyes({ className = '' }: { className?: string }) {
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
    <div className={className || 'relative'} role="img" aria-label="The ten IPL franchises">
      {/* The hairline the tray hangs from, running the full width */}
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-[var(--m-ink)]" aria-hidden />
      <div
        ref={trayRef}
        className="relative inline-flex border-y-2 border-r-2 border-[var(--m-ink)] rounded-br-[2.5rem] overflow-hidden bg-[var(--m-bg)]"
        aria-hidden
      >
        {FRANCHISES.map((f, i) => {
          const w = getTeamWorld(f.id);
          return (
            <div
              key={f.id}
              title={f.name}
              className={`fx-eye-cell group grid place-items-center p-1 sm:p-2.5 xl:p-3 ${i > 0 ? 'border-l-2 border-[var(--m-ink)]' : ''}`}
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <span className="block transition-transform duration-300 ease-out group-hover:scale-110">
                <span
                  className="fx-eye relative block w-6 h-6 sm:w-10 sm:h-10 lg:w-14 lg:h-14 xl:w-[4.25rem] xl:h-[4.25rem] rounded-full"
                  style={{ background: w.accent, animationDelay: `${(i * 1.37) % 5}s`, animationDuration: `${5.5 + (i % 4) * 1.3}s` }}
                >
                  <span
                    data-iris
                    className="fx-pupil absolute left-1/2 top-1/2 w-[48%] h-[48%] rounded-full"
                    style={{ background: '#221F1D' }}
                  >
                    <span className="absolute right-[18%] top-[16%] w-[22%] h-[22%] rounded-full" style={{ background: w.paper }} />
                  </span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
