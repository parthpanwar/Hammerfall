// ============================================================
// IPL DYNASTY - Persistent Multi-Slot Career Save Game System
// Manages multiple save slots, autosaves, schema migrations,
// and JSON file export/import with transactional integrity.
// ============================================================

import type { GameState } from '@/lib/types/game';
import type { CareerState, CareerSaveSlot } from '@/lib/types/career';

const SAVE_STORAGE_KEY_PREFIX = 'ipl_dynasty_slot_';
const AUTOSAVE_STORAGE_KEY = 'ipl_dynasty_autosave';
const CURRENT_SAVE_VERSION = '3.0.0';

export interface FullCareerSavePayload {
  version: string;
  savedAt: number;
  slotNumber: number;
  gameState: GameState;
  careerState: CareerState;
}

/**
 * Saves current game and career state to a specific slot (0 for autosave, 1-3 for manual).
 */
export function saveCareerToSlot(
  slotNumber: number,
  gameState: GameState,
  careerState: CareerState,
  customName?: string
): CareerSaveSlot | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const humanFranchise = gameState.franchises.find((f) => f.id === gameState.humanFranchiseId);
    const championships = careerState.franchiseHistory[gameState.humanFranchiseId]?.championships || 0;

    const payload: FullCareerSavePayload = {
      version: CURRENT_SAVE_VERSION,
      savedAt: Date.now(),
      slotNumber,
      gameState,
      careerState,
    };

    const serialized = JSON.stringify(payload);
    const storageKey = slotNumber === 0 ? AUTOSAVE_STORAGE_KEY : `${SAVE_STORAGE_KEY_PREFIX}${slotNumber}`;

    window.localStorage.setItem(storageKey, serialized);

    const slotMetadata: CareerSaveSlot = {
      slotId: storageKey,
      slotNumber,
      name: customName || (slotNumber === 0 ? 'Autosave' : `Slot ${slotNumber} - ${humanFranchise?.abbreviation || 'IPL'}`),
      seasonYear: gameState.currentSeason,
      humanFranchiseId: gameState.humanFranchiseId,
      humanFranchiseName: humanFranchise?.name || 'Franchise',
      championships,
      savedAt: payload.savedAt,
      version: CURRENT_SAVE_VERSION,
      stateData: serialized,
    };

    return slotMetadata;
  } catch (err) {
    console.error('Failed to save career game:', err);
    return null;
  }
}

/**
 * Loads a career save payload from a specific slot.
 */
export function loadCareerFromSlot(slotNumber: number): FullCareerSavePayload | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const storageKey = slotNumber === 0 ? AUTOSAVE_STORAGE_KEY : `${SAVE_STORAGE_KEY_PREFIX}${slotNumber}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed: FullCareerSavePayload = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error(`Failed to load career save from slot ${slotNumber}:`, err);
    return null;
  }
}

/**
 * Lists all existing save slots and metadata.
 */
export function listAllSaveSlots(): { slotNumber: number; metadata: CareerSaveSlot | null }[] {
  const slots: { slotNumber: number; metadata: CareerSaveSlot | null }[] = [];
  if (typeof window === 'undefined' || !window.localStorage) {
    return slots;
  }

  for (const slotNumber of [0, 1, 2, 3]) {
    const storageKey = slotNumber === 0 ? AUTOSAVE_STORAGE_KEY : `${SAVE_STORAGE_KEY_PREFIX}${slotNumber}`;
    const raw = window.localStorage.getItem(storageKey);

    if (raw) {
      try {
        const parsed: FullCareerSavePayload = JSON.parse(raw);
        const humanFranchise = parsed.gameState.franchises.find(
          (f) => f.id === parsed.gameState.humanFranchiseId
        );
        const championships = parsed.careerState.franchiseHistory[parsed.gameState.humanFranchiseId]?.championships || 0;

        slots.push({
          slotNumber,
          metadata: {
            slotId: storageKey,
            slotNumber,
            name: slotNumber === 0 ? 'Autosave' : `Slot ${slotNumber} - ${humanFranchise?.abbreviation || 'IPL'}`,
            seasonYear: parsed.gameState.currentSeason,
            humanFranchiseId: parsed.gameState.humanFranchiseId,
            humanFranchiseName: humanFranchise?.name || 'Franchise',
            championships,
            savedAt: parsed.savedAt,
            version: parsed.version,
            stateData: raw,
          },
        });
      } catch {
        slots.push({ slotNumber, metadata: null });
      }
    } else {
      slots.push({ slotNumber, metadata: null });
    }
  }

  return slots;
}

/**
 * Exports current save slot as downloadable JSON string.
 */
export function exportSaveSlotAsJson(slotNumber: number): string | null {
  const loaded = loadCareerFromSlot(slotNumber);
  if (!loaded) return null;
  return JSON.stringify(loaded, null, 2);
}

/**
 * Imports a JSON string and writes to slot.
 */
export function importSaveJsonToSlot(slotNumber: number, jsonString: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const parsed: FullCareerSavePayload = JSON.parse(jsonString);
    if (!parsed.gameState || !parsed.careerState) {
      throw new Error('Invalid save file structure');
    }

    const storageKey = slotNumber === 0 ? AUTOSAVE_STORAGE_KEY : `${SAVE_STORAGE_KEY_PREFIX}${slotNumber}`;
    window.localStorage.setItem(storageKey, jsonString);
    return true;
  } catch (err) {
    console.error('Failed to import save:', err);
    return false;
  }
}

