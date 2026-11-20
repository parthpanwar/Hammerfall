'use client';

// The house theme for the screens outside a career (title, menu, mode, loader).
// Picked by clicking a team eye on the title screen; saved per device.
// Inside a career the world always follows the franchise you manage.

import { useSyncExternalStore } from 'react';
import { TEAM_WORLDS } from './team-themes';

const KEY = 'ipl-dynasty-site-theme';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && TEAM_WORLDS[v] ? v : null;
  } catch {
    return null;
  }
}

let current: string | null | undefined;

function snapshot(): string | null {
  if (current === undefined) current = read();
  return current;
}

export function setSiteTheme(id: string | null) {
  current = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the theme still applies for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The picked team id, or null for the neutral house theme. */
export function useSiteTheme(): string | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
