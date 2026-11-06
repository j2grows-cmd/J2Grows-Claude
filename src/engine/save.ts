// Persistence: localStorage saves plus text export/import.

import type { GameState } from './types';
import { SAVE_KEY, SAVE_VERSION } from './config';
import { newGame } from './state';
import { baseMods, refreshMods } from './mods';

type Dict = Record<string, unknown>;

export function serialize(s: GameState): string {
  const copy: Dict = { ...(s as unknown as Dict) };
  delete copy.mods;
  delete copy.modsDirty;
  copy.savedAt = Date.now();
  return JSON.stringify(copy);
}

export function deserialize(json: string): GameState | null {
  try {
    const data = JSON.parse(json) as Dict;
    if (!data || typeof data !== 'object' || !Array.isArray(data.rooms) || !Array.isArray(data.plants)) return null;
    const base = newGame(1) as unknown as Dict;
    const out: Dict = { ...base };
    for (const k of Object.keys(data)) {
      const v = data[k];
      // merge one level deep for record-like sections so new keys added in later versions survive
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = { ...(base[k] as Dict), ...(v as Dict) };
      } else out[k] = v;
    }
    const s = out as unknown as GameState;
    s.mods = baseMods();
    s.modsDirty = true;
    s.v = SAVE_VERSION;
    if (!Number.isFinite(s.rng)) s.rng = 12345;
    refreshMods(s);
    return s;
  } catch {
    return null;
  }
}

const hasStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export function saveGame(s: GameState): boolean {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  if (hasStorage()) localStorage.removeItem(SAVE_KEY);
}

export function exportSave(s: GameState): string {
  return btoa(unescape(encodeURIComponent(serialize(s))));
}

export function importSave(text: string): GameState | null {
  try {
    return deserialize(decodeURIComponent(escape(atob(text.trim()))));
  } catch {
    return deserialize(text);
  }
}
