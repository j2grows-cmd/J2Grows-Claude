// The browser-side game store: owns the GameState, runs the clock, saves, and notifies React.

import { useSyncExternalStore } from 'react';
import {
  deserialize, exportSave, importSave, loadGame, newGame, refreshMods, run, saveGame, serialize, simulateOffline, deleteSave,
  type GameState, type OfflineReport, type Result,
} from './engine';

export interface Toast {
  id: number;
  kind: 'good' | 'bad' | 'info' | 'discovery';
  msg: string;
}

// `offline` must exist before boot() runs: boot() fills it in when the save is old.
let offline: OfflineReport | null = null;
let state: GameState = boot();
let version = 0;
let toastId = 1;
let toasts: Toast[] = [];
let lastLog = state.log.length ? state.log[state.log.length - 1].id : 0;
let last = performance.now();
let lastSave = performance.now();
const listeners = new Set<() => void>();

function boot(): GameState {
  const loaded = loadGame();
  const s = loaded ?? newGame();
  refreshMods(s);
  if (loaded) {
    const away = (Date.now() - (loaded.savedAt || Date.now())) / 1000;
    offline = simulateOffline(s, away);
  }
  return s;
}

export const game = (): GameState => state;
export const getToasts = (): Toast[] => toasts;
export const getOffline = (): OfflineReport | null => offline;
export const dismissOffline = (): void => {
  offline = null;
  notify();
};

// In-app replacements for confirm() / prompt(): the browser's own dialogs are blocked in embedded viewers.
export interface Ask {
  title: string;
  message?: string;
  /** When set, the dialog shows a text field starting with this value. */
  input?: string;
  confirm: string;
  danger?: boolean;
  yes: (value: string) => void;
}
let ask: Ask | null = null;
export const getAsk = (): Ask | null => ask;
export function askConfirm(message: string, yes: () => void, opts: { title?: string; confirm?: string; danger?: boolean } = {}): void {
  ask = { title: opts.title ?? 'Are you sure?', message, confirm: opts.confirm ?? 'Confirm', danger: opts.danger, yes: () => yes() };
  notify();
}
export function askText(title: string, initial: string, yes: (value: string) => void, confirm = 'Save', message?: string): void {
  ask = { title, message, input: initial, confirm, yes };
  notify();
}
export function closeAsk(): void {
  ask = null;
  notify();
}

function notify(): void {
  version++;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-render when anything in the game changes. Returns the (mutable) state. */
export function useGame(): GameState {
  useSyncExternalStore(subscribe, () => version);
  return state;
}

export function toast(msg: string, kind: Toast['kind'] = 'info'): void {
  const t: Toast = { id: toastId++, kind, msg };
  toasts = [...toasts.slice(-3), t];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    notify();
  }, kind === 'discovery' ? 6000 : 3600);
}

/** Run an engine action, surface its result as a toast and refresh the UI. */
export function act(fn: (s: GameState) => Result | boolean | void, quiet = false): Result | undefined {
  const r = fn(state);
  if (state.modsDirty) refreshMods(state);
  let out: Result | undefined;
  if (r && typeof r === 'object') {
    out = r;
    if (!quiet || !r.ok) toast(r.msg, r.ok ? 'good' : 'bad');
  }
  notify();
  return out;
}

function pumpLog(): void {
  const s = state;
  for (const e of s.log) {
    if (e.id <= lastLog) continue;
    lastLog = e.id;
    if (e.kind === 'discovery') toast(e.msg, 'discovery');
    else if (e.kind === 'bad') toast(e.msg, 'bad');
  }
}

export function save(): void {
  state.savedAt = Date.now();
  saveGame(state);
  lastSave = performance.now();
}

function frame(): void {
  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt <= 0) return;
  if (dt > 20) {
    // The tab was suspended: treat it as time away.
    offline = simulateOffline(state, dt);
    dt = 0;
  } else {
    run(state, Math.min(dt, 10) * state.settings.speed, 0.5);
  }
  pumpLog();
  notify();
  if (state.settings.autosave && now - lastSave > 15000) save();
}

setInterval(frame, 250);
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
}

// ----- save management -----

export function replaceState(s: GameState): void {
  refreshMods(s);
  state = s;
  lastLog = s.log.length ? s.log[s.log.length - 1].id : 0;
  save();
  notify();
}

export function newRun(): void {
  deleteSave();
  replaceState(newGame());
}

export function exportText(): string {
  return exportSave(state);
}

export function importText(text: string): boolean {
  const s = importSave(text);
  if (!s) return false;
  replaceState(s);
  return true;
}

export function raw(): string {
  return serialize(state);
}

export { deserialize };

// ----- tiny UI store (navigation + selection) -----

export interface UiState {
  view: string;
  room: number | null;
  plant: number | null;
  tab: Record<string, string>;
}
let ui: UiState = { view: 'overview', room: null, plant: null, tab: {} };
let uiVersion = 0;
const uiListeners = new Set<() => void>();
export function setUi(patch: Partial<UiState>): void {
  ui = { ...ui, ...patch };
  uiVersion++;
  uiListeners.forEach((l) => l());
}
export function setTab(group: string, tab: string): void {
  setUi({ tab: { ...ui.tab, [group]: tab } });
}
export function useUi(): UiState {
  useSyncExternalStore((l) => {
    uiListeners.add(l);
    return () => uiListeners.delete(l);
  }, () => uiVersion);
  return ui;
}
