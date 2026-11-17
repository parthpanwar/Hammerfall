// ============================================================
// IPL DYNASTY - Save-file compaction
// A career save holds ~1,600 player objects (registry, squads, auction
// pool). At ~2.4 KB each that blew past the ~5 MB localStorage quota and
// crashed the auction with QuotaExceededError. Players that exist in the
// bundled database are now written as `{ __p: id, ...changedFields }` and
// re-expanded on load.
// ============================================================

import type { Player } from '@/lib/types/game';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { GLOBAL_PLAYERS, RAW_GLOBAL_PLAYERS } from '@/lib/data/players';
import { RATING_REMAP_VERSION } from '@/lib/data/rating-distribution';

const BASE = new Map<string, Player>(GLOBAL_PLAYERS.map((p) => [p.id, p]));
/** Saves written before the rating remap diffed against the shipped data. */
const RAW_BASE = new Map<string, Player>(RAW_GLOBAL_PLAYERS.map((p) => [p.id, p]));
const REF_KEY = '__p';
/** Rating-remap version the reference was written against (absent = pre-remap save). */
const VER_KEY = '__v';

function isPlayerLike(v: unknown): v is Player {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof (v as Player).id === 'string' &&
    typeof (v as Player).name === 'string' &&
    typeof (v as Player).ratings === 'object' &&
    typeof (v as Player).stats === 'object'
  );
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** JSON.stringify replacer: shrink known players to a reference + diff. */
export function compactReplacer(_key: string, value: unknown): unknown {
  if (!isPlayerLike(value)) return value;
  const base = BASE.get(value.id);
  if (!base) return value; // generated/regen players are stored in full
  const out: Record<string, unknown> = { [REF_KEY]: value.id, [VER_KEY]: RATING_REMAP_VERSION };
  for (const [k, v] of Object.entries(value)) {
    if (k === 'id') continue;
    if (!same(v, (base as unknown as Record<string, unknown>)[k])) out[k] = v;
  }
  return out;
}

/** JSON.parse reviver: expand `{ __p }` references back into full players. */
export function compactReviver(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const ref = (value as Record<string, unknown>)[REF_KEY];
  if (typeof ref !== 'string') return value;
  const { [REF_KEY]: _omit, [VER_KEY]: ver, ...diff } = value as Record<string, unknown>;
  void _omit;
  // Old saves keep the ratings they were made with: never remap a save twice (or half of it).
  const base = ver === RATING_REMAP_VERSION ? BASE.get(ref) : RAW_BASE.get(ref);
  if (!base) return { id: ref, ...diff };
  // Fresh copies so engine mutations never touch the bundled database.
  return {
    ...base,
    ratings: { ...base.ratings },
    stats: { ...base.stats },
    previousFranchises: [...base.previousFranchises],
    ...diff,
    id: ref,
  };
}

export function serializeCompact(value: unknown): string {
  return JSON.stringify(value, compactReplacer);
}

export function parseCompact<T>(raw: string): T {
  return JSON.parse(raw, compactReviver) as T;
}

/**
 * zustand persist storage: compacts players, debounces writes (the auction
 * can update state several times per second) and never throws on quota.
 */
export function createCompactStorage<S>(delayMs = 400): PersistStorage<S> | undefined {
  if (typeof window === 'undefined') return undefined;
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const { name, value } = pending;
    pending = null;
    try {
      window.localStorage.setItem(name, serializeCompact(value));
    } catch (err) {
      console.warn('[IPL Dynasty] Could not persist game state (storage full?)', err);
    }
  };

  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  return {
    getItem: (name) => {
      const raw = window.localStorage.getItem(name);
      if (!raw) return null;
      try {
        return parseCompact<StorageValue<S>>(raw);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: (name) => {
      pending = null;
      window.localStorage.removeItem(name);
    },
  };
}
