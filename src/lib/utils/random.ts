// Seeded Random Number Generator - Mulberry32
// Deterministic RNG for reproducible simulations

import { SeededRandom } from '@/lib/types/game';

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: number): SeededRandom {
  const rng = mulberry32(seed);

  return {
    next(): number {
      return rng();
    },

    nextInt(min: number, max: number): number {
      return Math.floor(rng() * (max - min + 1)) + min;
    },

    nextBool(probability: number = 0.5): boolean {
      return rng() < probability;
    },

    pick<T>(arr: T[]): T {
      if (arr.length === 0) throw new Error('Cannot pick from empty array');
      return arr[Math.floor(rng() * arr.length)];
    },

    shuffle<T>(arr: T[]): T[] {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
  };
}

// Generate a seed from current time
export function generateSeed(): number {
  return Date.now() ^ (Math.random() * 0x100000000);
}

