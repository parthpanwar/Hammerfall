'use client';

// Isometric line drawings (paper faces, ink outlines, one accent detail),
// in the spirit of the house's editorial illustrations. Each scene is a list of
// boxes drawn back-to-front; the viewBox fits itself to the drawing.

import React from 'react';

const C = Math.cos(Math.PI / 6);
const U = 22; // one grid unit in SVG units

type Pt = [number, number];
const P = (x: number, y: number, z: number): Pt => [(x - y) * C * U, ((x + y) * 0.5 - z) * U];

interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  accent?: boolean;
  /** CSS class on the box group (used for hover motion). */
  cls?: string;
}

const poly = (pts: Pt[]) => pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');

function faces(b: Box) {
  const { x, y, z, w, d, h } = b;
  return {
    top: [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)],
    right: [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)],
    left: [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)],
  };
}

const PAPER = 'var(--m-bg)';
const shade = (pct: number) => `color-mix(in srgb, var(--m-ink) ${pct}%, var(--m-bg))`;
const accent = (pct: number) => `color-mix(in srgb, var(--team-primary, #C8553D) ${pct}%, var(--m-bg))`;

function Scene({ boxes, extra, className = '' }: { boxes: Box[]; extra?: React.ReactNode; className?: string }) {
  const all = boxes.flatMap((b) => Object.values(faces(b)).flat());
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = 6;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2];
  const order = [...boxes].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.z - b.z);
  return (
    <svg viewBox={vb.join(' ')} className={className} aria-hidden>
      <g stroke="var(--m-ink)" strokeWidth={1.1} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {order.map((b, i) => {
          const f = faces(b);
          return (
            <g key={i} className={b.cls}>
              <polygon points={poly(f.left)} fill={b.accent ? accent(55) : shade(10)} />
              <polygon points={poly(f.right)} fill={b.accent ? accent(75) : shade(4)} />
              <polygon points={poly(f.top)} fill={b.accent ? accent(30) : PAPER} />
            </g>
          );
        })}
        {extra}
      </g>
    </svg>
  );
}

/** Retentions: six slots, the first three kept (raised), one of them your marquee. */
export function RetainArt({ className }: { className?: string }) {
  const boxes: Box[] = Array.from({ length: 6 }, (_, i) => ({
    x: i * 1.4,
    y: 0,
    z: 0,
    w: 1,
    d: 1,
    h: i < 3 ? 1.6 - i * 0.25 : 0.35,
    accent: i === 0,
    cls: i < 3 ? 'art-bob' : undefined,
  }));
  boxes.unshift({ x: -0.4, y: -0.3, z: -0.25, w: 8.6, d: 1.6, h: 0.25 });
  return <Scene boxes={boxes} className={className} />;
}

/** The auction: a sound block and a gavel hovering over it. */
export function GavelArt({ className }: { className?: string }) {
  const boxes: Box[] = [
    { x: 0, y: 0, z: 0, w: 3, d: 3, h: 0.6 },
    { x: 0.9, y: 0.9, z: 0.6, w: 1.2, d: 1.2, h: 0.3 },
    { x: 0.2, y: 1.1, z: 2.3, w: 2.6, d: 0.8, h: 0.8, accent: true, cls: 'art-strike' },
  ];
  const [hx, hy] = P(1.5, 1.9, 2.7);
  const [ex, ey] = P(1.5, 4.6, 2.7);
  return (
    <Scene
      boxes={boxes}
      className={className}
      extra={
        <g className="art-strike">
          <line x1={hx} y1={hy} x2={ex} y2={ey} strokeWidth={3.2} stroke="var(--m-ink)" strokeLinecap="round" />
        </g>
      }
    />
  );
}

/** The season: three stumps and bails on a strip of pitch. */
export function StumpsArt({ className }: { className?: string }) {
  const boxes: Box[] = [
    { x: 0, y: 0, z: -0.2, w: 2.4, d: 5, h: 0.2 },
    ...[0, 1, 2].map((i) => ({ x: 0.45 + i * 0.6, y: 1.2, z: 0, w: 0.26, d: 0.26, h: 2.8 })),
    { x: 0.42, y: 1.21, z: 2.8, w: 0.6, d: 0.24, h: 0.14, accent: true, cls: 'art-bail' },
    { x: 1.02, y: 1.21, z: 2.8, w: 0.6, d: 0.24, h: 0.14, accent: true, cls: 'art-bail' },
  ];
  return <Scene boxes={boxes} className={className} />;
}

/** The dynasty: a three-step podium with the trophy block on top. */
export function PodiumArt({ className }: { className?: string }) {
  const boxes: Box[] = [
    { x: 0, y: 0, z: 0, w: 4, d: 4, h: 0.7 },
    { x: 0.6, y: 0.6, z: 0.7, w: 2.8, d: 2.8, h: 0.7 },
    { x: 1.2, y: 1.2, z: 1.4, w: 1.6, d: 1.6, h: 0.7 },
    { x: 1.55, y: 1.55, z: 2.1, w: 0.9, d: 0.9, h: 1.3, accent: true, cls: 'art-bob' },
  ];
  return <Scene boxes={boxes} className={className} />;
}

/** A loose stack of franchise blocks for the hero statement section. */
export function StackArt({ className }: { className?: string }) {
  const boxes: Box[] = [];
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < 3 - k; i++) for (let j = 0; j < 3 - k - i; j++) boxes.push({ x: i * 1.08, y: j * 1.08, z: k, w: 1, d: 1, h: 1, accent: k === 2, cls: 'art-bob' });
  return <Scene boxes={boxes} className={className} />;
}
