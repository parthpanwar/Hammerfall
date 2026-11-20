'use client';

// Ten isometric cubes, one per franchise, stacked into a tetrahedral pyramid
// (6 + 3 + 1). `mode="build"` drops them in layer by layer (loading screen);
// `mode="idle"` lets the finished stack breathe (menu art).

import React from 'react';
import { FRANCHISES } from '@/lib/data/franchises';
import { getTeamWorld, mixHex } from '@/lib/theme/team-themes';

const S = 40; // cube edge in SVG units
const CX = S * Math.cos(Math.PI / 6); // horizontal step per grid cell
const CY = S / 2; // vertical step per grid cell

interface Cube {
  i: number;
  j: number;
  k: number;
  order: number; // build order (bottom layer first)
}

/** Grid cells of a 3-high tetrahedral stack: 6 on the floor, 3 above, 1 on top. */
const CUBES: Cube[] = (() => {
  const out: Cube[] = [];
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < 3 - k; i++)
      for (let j = 0; j < 3 - k - i; j++) out.push({ i, j, k, order: out.length });
  return out;
})();

// Painter's order: far cells first, lower layers before higher ones.
const DRAW = [...CUBES].sort((a, b) => a.i + a.j + a.k - (b.i + b.j + b.k) || a.k - b.k);

function cubePaths(c: Cube) {
  // Screen position of the cube's top vertex (back corner of the top face).
  const x = (c.i - c.j) * CX;
  const y = (c.i + c.j) * CY - c.k * S;
  const top = `M${x},${y} l${CX},${CY} l${-CX},${CY} l${-CX},${-CY}Z`;
  const left = `M${x - CX},${y + CY} l${CX},${CY} l0,${S} l${-CX},${-CY}Z`;
  const right = `M${x + CX},${y + CY} l${-CX},${CY} l0,${S} l${CX},${-CY}Z`;
  return { top, left, right };
}

export function IsoPyramid({
  mode = 'idle',
  className = '',
  duration = 1.6,
}: {
  mode?: 'build' | 'idle';
  className?: string;
  /** Build mode: total seconds for all ten cubes to land. */
  duration?: number;
}) {
  const step = duration / CUBES.length;
  return (
    <svg viewBox={`${-3 * CX - 6} ${-2 * S - 6} ${6 * CX + 12} ${5 * S + 12}`} className={className} aria-hidden>
      {DRAW.map((c) => {
        const f = FRANCHISES[c.order];
        const w = getTeamWorld(f?.id);
        const p = cubePaths(c);
        const style: React.CSSProperties =
          mode === 'build'
            ? { animationDelay: `${c.order * step}s` }
            : { animationDelay: `${-(c.order * 0.37)}s`, animationDuration: `${3.2 + (c.order % 3) * 0.6}s` };
        return (
          <g key={`${c.i}${c.j}${c.k}`} className={mode === 'build' ? 'fx-cube-drop' : 'fx-cube-bob'} style={style}>
            <path d={p.left} fill={w.accent} stroke={w.ink} strokeWidth={1.2} strokeLinejoin="round" />
            <path d={p.right} fill={mixHex(w.accent, '#000000', 0.28)} stroke={w.ink} strokeWidth={1.2} strokeLinejoin="round" />
            <path d={p.top} fill={mixHex(w.accent, '#ffffff', 0.32)} stroke={w.ink} strokeWidth={1.2} strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}
