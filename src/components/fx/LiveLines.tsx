'use client';

// A tall field of horizontal ink lines with a few soft swells (the house line
// art), brought to life: the swells drift slowly and the lines part around the
// pointer like a hand pushed through them. Pure SVG, paths updated in place.

import React, { useEffect, useMemo, useRef } from 'react';

const W = 400;
const H = 600;
const STEP = 8;

function rng(seed: string) {
  let r = 0;
  for (let i = 0; i < seed.length; i++) r = (Math.imul(r ^ seed.charCodeAt(i), 2654435761) + i) >>> 0;
  return () => ((r = (Math.imul(r ^ (r >>> 15), 2246822507) ^ Math.imul(r ^ (r >>> 13), 3266489909)) >>> 0), r / 4294967296);
}

export function LiveLines({ seed = 'house', lines = 56, className = '' }: { seed?: string; lines?: number; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const field = useMemo(() => {
    const rnd = rng(seed);
    return {
      bumps: Array.from({ length: 3 }, () => ({
        x: 80 + rnd() * 260,
        y: 120 + rnd() * 380,
        sx: 60 + rnd() * 90,
        sy: 70 + rnd() * 120,
        a: (rnd() < 0.5 ? -1 : 1) * (22 + rnd() * 34),
      })),
      freq: 0.012 + rnd() * 0.01,
      phase: rnd() * Math.PI * 2,
    };
  }, [seed]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const paths = Array.from(svg.querySelectorAll('path'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gap = H / lines;
    // Pointer in viewBox units; `push` eases in and out as it enters and leaves.
    const ptr = { x: -999, y: -999, tx: -999, ty: -999, push: 0, target: 0 };
    let t = 0;
    let raf = 0;
    let visible = true;

    const draw = () => {
      for (let i = 0; i < paths.length; i++) {
        const y0 = i * gap;
        let d = '';
        for (let x = -10; x <= W + 10; x += STEP) {
          let dy = 0;
          for (const b of field.bumps) {
            const g = Math.exp(-(((x - b.x) / b.sx) ** 2) - ((y0 - b.y) / b.sy) ** 2);
            dy += b.a * g * (1 + 0.45 * Math.sin(x * field.freq + field.phase + i * 0.15 + t));
          }
          if (ptr.push > 0.001) {
            const dx = x - ptr.x;
            const py = y0 + dy - ptr.y;
            const g = Math.exp(-(dx * dx) / 3600 - (py * py) / 2500);
            dy += Math.tanh(py / 14) * 28 * g * ptr.push; // smooth parting, no kink at the centre line
          }
          d += `${d ? 'L' : 'M'}${x} ${(y0 + dy).toFixed(1)}`;
        }
        paths[i].setAttribute('d', d);
      }
    };

    const loop = () => {
      raf = 0;
      t += 0.006;
      ptr.x += (ptr.tx - ptr.x) * 0.14;
      ptr.y += (ptr.ty - ptr.y) * 0.14;
      ptr.push += (ptr.target - ptr.push) * 0.08;
      draw();
      if (visible) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * W;
      const ny = ((e.clientY - r.top) / r.height) * H;
      if (ptr.target === 0) {
        ptr.x = nx;
        ptr.y = ny;
      }
      ptr.tx = nx;
      ptr.ty = ny;
      ptr.target = 1;
    };
    const onLeave = () => (ptr.target = 0);

    draw();
    if (reduced) return;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(svg);
    const host: HTMLElement = svg.parentElement ?? (svg as unknown as HTMLElement);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    return () => {
      io.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [field, lines]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      {Array.from({ length: lines + 1 }, (_, i) => (
        <path key={i} fill="none" stroke="currentColor" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
