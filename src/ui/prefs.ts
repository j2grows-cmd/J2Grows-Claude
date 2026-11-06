// Device preferences (sound, motion, text size, theme, telemetry consent). They belong to the browser, not
// the save, so they survive new games and imports. Every access is guarded: storage can be unavailable.

import { useSyncExternalStore } from 'react';

export interface Prefs {
  /** Interface sound effects, 0..1. */
  sfx: number;
  /** Ambient laboratory sound, 0..1. */
  ambient: number;
  /** Replace animation with instant changes. */
  reduceMotion: boolean;
  /** Text size multiplier. */
  textScale: number;
  theme: string;
  /** The opening guide card on the Overview. */
  guide: boolean;
  /** Anonymous progress statistics: undecided until the player answers. */
  telemetry: 'ask' | 'on' | 'off';
  /** Random id for anonymous statistics and cloud saves; never derived from anything about the person. */
  deviceId: string;
}

const KEY = 'j2grows.prefs.v1';
const rid = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
};
const reducedByOs = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

function read(): Prefs {
  const d: Prefs = { sfx: 0.5, ambient: 0, reduceMotion: reducedByOs(), textScale: 1, theme: 'forest', guide: true, telemetry: 'ask', deviceId: rid() };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<Prefs>;
      const num = (x: unknown, lo: number, hi: number, f: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : f);
      return {
        sfx: num(j.sfx, 0, 1, d.sfx),
        ambient: num(j.ambient, 0, 1, d.ambient),
        reduceMotion: typeof j.reduceMotion === 'boolean' ? j.reduceMotion : d.reduceMotion,
        textScale: num(j.textScale, 0.85, 1.4, 1),
        theme: typeof j.theme === 'string' ? j.theme : d.theme,
        guide: j.guide !== false,
        telemetry: j.telemetry === 'on' || j.telemetry === 'off' ? j.telemetry : 'ask',
        deviceId: typeof j.deviceId === 'string' && j.deviceId.length > 8 ? j.deviceId : d.deviceId,
      };
    }
  } catch {
    /* storage unavailable: defaults */
  }
  return d;
}

let prefs: Prefs = read();
let version = 0;
const listeners = new Set<() => void>();

export const getPrefs = (): Prefs => prefs;

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  apply();
  version++;
  listeners.forEach((l) => l());
}

/** Pushes the display preferences onto the page. */
export function apply(): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.dataset.theme = prefs.theme;
  el.dataset.motion = prefs.reduceMotion ? 'off' : 'on';
  el.style.setProperty('--text-scale', String(prefs.textScale));
}

export function usePrefs(): Prefs {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return prefs;
}
apply();
