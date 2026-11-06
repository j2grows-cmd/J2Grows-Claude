// Persistence: localStorage saves (with rolling backups), text export/import and repair of damaged saves.

import type { GameState, Plant, Propagule } from './types';
import { GENE_IDS } from './types';
import { SAVE_KEY, SAVE_VERSION } from './config';
import { newGame, newSeries, newShows } from './state';
import { baseMods, refreshMods } from './mods';
import { migrateLegacySpecies } from './legacy-species';
import { SPECIES } from './species';
import { clamp } from './util';

type Dict = Record<string, unknown>;

export function serialize(s: GameState): string {
  const copy: Dict = { ...(s as unknown as Dict) };
  delete copy.mods;
  delete copy.modsDirty;
  copy.savedAt = Date.now();
  return JSON.stringify(copy);
}

// ---------------------------------------------------------------------------------------------
// Repair: a loaded save is untrusted. Anything that could crash or poison the simulation is
// fixed or dropped, and every repair is reported.
// ---------------------------------------------------------------------------------------------

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isObj = (x: unknown): x is Dict => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, d: number, lo = -Infinity, hi = Infinity): number => (isNum(x) ? Math.min(hi, Math.max(lo, x)) : d);

function genomeOk(g: unknown): boolean {
  if (!isObj(g)) return false;
  for (const id of GENE_IDS) {
    const gene = g[id];
    if (!Array.isArray(gene) || gene.length !== 2) return false;
    for (const a of gene) if (!isObj(a) || !isNum(a.v) || !isNum(a.d)) return false;
  }
  return true;
}
const speciesOk = (sp: unknown, hy: unknown): boolean => typeof sp === 'string' && !!SPECIES[sp] && (hy == null || (typeof hy === 'string' && !!SPECIES[hy]));

function fixPlant(p: Plant): void {
  p.health = num(p.health, 60, 0, 100);
  p.hydration = num(p.hydration, 60, 0, 100);
  p.nutrients = num(p.nutrients, 40, 0, 100);
  p.roots = num(p.roots, 60, 0, 100);
  p.growth = num(p.growth, 0.1, 0, 1);
  p.vigor = num(p.vigor, 1, 0.1, 3);
  p.cool = num(p.cool, 0, 0, 1e6);
  p.born = num(p.born, 0);
  p.gen = num(p.gen, 0, 0, 1e4);
  p.analysis = clamp(Math.round(num(p.analysis, 0)), 0, 3) as Plant['analysis'];
  if (!Array.isArray(p.tags)) p.tags = [];
  p.tags = p.tags.filter((t) => typeof t === 'string');
  if (!Array.isArray(p.hist)) p.hist = [];
  if (!Array.isArray(p.parents) || p.parents.length !== 2) p.parents = [null, null];
  if (typeof p.name !== 'string' || !p.name) p.name = SPECIES[p.sp]?.common[0] ?? 'Plant';
  if (typeof p.origin !== 'string') p.origin = 'unknown';
  p.stage = p.growth >= 1 ? 'mature' : p.growth >= 0.3 ? 'juvenile' : 'seedling';
  p.keeper = !!p.keeper;
  p.mother = !!p.mother;
  p.sport = !!p.sport;
  if (p.inf && (!isObj(p.inf) || !['fungal', 'pests', 'rot'].includes(p.inf.kind))) p.inf = null;
  if (p.inf) p.inf.sev = num(p.inf.sev, 0.1, 0, 1);
}

/** Repairs `s` in place and returns a human-readable list of what had to be fixed. */
export function sanitize(s: GameState): string[] {
  const fixes: string[] = [];
  const note = (m: string) => {
    if (fixes.length < 40) fixes.push(m);
  };

  s.money = num(s.money, 200, 0);
  s.rp = num(s.rp, 0, 0);
  s.time = num(s.time, 0, 0);
  s.totalTime = num(s.totalTime, 0, 0);
  s.savedAt = num(s.savedAt, Date.now());
  s.stage = Math.round(num(s.stage, 1, 1, 6));
  s.income = num(s.income, 0);
  s.expense = num(s.expense, 0);
  for (const k of Object.keys(s.stats)) if (!isNum((s.stats as unknown as Dict)[k])) (s.stats as unknown as Dict)[k] = 0;
  if (!isObj(s.settings)) s.settings = { speed: 1, autosave: true, compact: false };
  if (![1, 2, 5, 10].includes(s.settings.speed)) s.settings.speed = 1;
  for (const k of ['done', 'upgrades', 'depts', 'discoveries', 'seen', 'ach'] as const) if (!isObj(s[k])) (s as unknown as Dict)[k] = {};
  for (const k of Object.keys(s.done)) if (!isNum(s.done[k])) delete s.done[k];
  for (const k of ['staff', 'active', 'unlocked', 'records', 'cultivars', 'log', 'stock', 'props'] as const) if (!Array.isArray(s[k])) (s as unknown as Dict)[k] = [];
  if (!isObj(s.jobs)) s.jobs = { analysis: [], breeding: [], cloning: [], tissue: [] };
  for (const k of ['analysis', 'breeding', 'cloning', 'tissue'] as const) if (!Array.isArray(s.jobs[k])) s.jobs[k] = [];
  if (!isObj(s.legacy)) s.legacy = { points: 0, spent: 0, ups: {}, runs: 0, discPaid: 0 };
  s.legacy.points = num(s.legacy.points, 0, 0);
  s.legacy.spent = num(s.legacy.spent, 0, 0);
  s.legacy.runs = Math.round(num(s.legacy.runs, 0, 0));
  if (!isObj(s.legacy.ups)) s.legacy.ups = {};
  if (!isObj(s.market)) s.market = newGame(1).market;
  for (const k of ['events', 'contracts'] as const) if (!Array.isArray(s.market[k])) s.market[k] = [];
  if (!isObj(s.market.index)) s.market.index = {};
  if (!isObj(s.market.hist)) s.market.hist = {};
  s.market.rep = num(s.market.rep, 0, 0);
  if (!isObj(s.shows) || !Array.isArray(s.shows.hist)) s.shows = newShows();
  if (!isObj(s.series) || !Array.isArray(s.series.t)) s.series = newSeries();
  if (typeof s.challenge !== 'string') s.challenge = '';

  // staff, projects and jobs that refer to things that no longer exist
  s.staff = s.staff.filter((x) => isObj(x) && isNum(x.id) && isNum(x.level));
  s.active = s.active.filter((a) => isObj(a) && typeof a.id === 'string' && isNum(a.progress) && isNum(a.total));
  for (const k of ['analysis', 'breeding', 'cloning', 'tissue'] as const) {
    const before = s.jobs[k].length;
    (s.jobs[k] as { sp?: string }[]) = (s.jobs[k] as { sp?: string }[]).filter((j) => isObj(j) && (j.sp == null || !!SPECIES[j.sp]));
    if (s.jobs[k].length !== before) note(`dropped ${before - s.jobs[k].length} ${k} job(s) for unknown species`);
  }

  // plants, stock and propagules
  const goodPlant = (p: Plant): boolean => isObj(p) && isNum(p.id) && speciesOk(p.sp, p.hy) && genomeOk(p.genome);
  const nPlants = s.plants.length + s.stock.length;
  s.plants = s.plants.filter(goodPlant);
  s.stock = s.stock.filter(goodPlant);
  if (s.plants.length + s.stock.length !== nPlants) note(`removed ${nPlants - s.plants.length - s.stock.length} plant(s) that could not be read`);
  const nProps = s.props.length;
  s.props = s.props.filter((p: Propagule) => isObj(p) && isNum(p.id) && speciesOk(p.sp, p.hy) && genomeOk(p.genome));
  if (s.props.length !== nProps) note(`removed ${nProps - s.props.length} cutting(s)/seed(s) that could not be read`);
  for (const p of s.plants) fixPlant(p);
  for (const p of s.stock) fixPlant(p);
  for (const p of s.props) {
    p.q = num(p.q, 0.7, 0, 1);
    p.vigor = num(p.vigor, 1, 0.1, 3);
  }

  // unique ids, and a counter that is ahead of all of them
  s.nextId = Math.round(num(s.nextId, 1, 1));
  const seen = new Set<number>();
  let maxId = 0;
  for (const list of [s.plants, s.stock, s.props] as { id: number }[][]) for (const x of list) maxId = Math.max(maxId, x.id);
  s.nextId = Math.max(s.nextId, maxId + 1);
  for (const list of [s.plants, s.stock, s.props] as { id: number }[][]) {
    for (const x of list) {
      if (seen.has(x.id)) {
        x.id = s.nextId++;
        note('gave a duplicate id a fresh number');
      }
      seen.add(x.id);
    }
  }

  // rooms: slots must be an array of unique plant ids that exist, and every placed plant must sit in its slot
  s.rooms = (Array.isArray(s.rooms) ? s.rooms : []).filter((r) => isObj(r) && isNum(r.id));
  if (!s.rooms.length) {
    s.rooms = newGame(1).rooms;
    note('rebuilt the missing growing room');
  }
  const defaults = newGame(1).rooms[0];
  const byId = new Map(s.plants.map((p) => [p.id, p]));
  const taken = new Set<number>();
  for (const r of s.rooms) {
    if (!Array.isArray(r.slots)) r.slots = new Array(6).fill(null);
    r.slots = r.slots.slice(0, 64).map((id) => (isNum(id) && byId.has(id) && !taken.has(id) ? id : null));
    for (const id of r.slots) if (id != null) taken.add(id);
    if (typeof r.name !== 'string') r.name = 'Room';
    r.set = { ...defaults.set, ...(isObj(r.set) ? r.set : {}) };
    r.act = { ...defaults.act, ...(isObj(r.act) ? r.act : {}) };
    r.equip = { ...defaults.equip, ...(isObj(r.equip) ? r.equip : {}) };
    for (const k of Object.keys(r.set) as (keyof typeof r.set)[]) if (!isNum(r.set[k])) r.set[k] = defaults.set[k];
    for (const k of Object.keys(r.act) as (keyof typeof r.act)[]) if (!isNum(r.act[k])) r.act[k] = defaults.act[k];
    for (const k of Object.keys(r.equip) as (keyof typeof r.equip)[]) if (!isNum(r.equip[k])) r.equip[k] = 0;
  }
  // every placed plant must sit in the slot it names: the room slots are the truth
  const where = new Map<number, [number, number]>();
  for (const r of s.rooms) r.slots.forEach((id, i) => id != null && where.set(id, [r.id, i]));
  let homeless = 0;
  for (const p of s.plants) {
    let at = where.get(p.id);
    if (!at) {
      for (const r of s.rooms) {
        const i = r.slots.indexOf(null);
        if (i >= 0) {
          r.slots[i] = p.id;
          at = [r.id, i];
          where.set(p.id, at);
          break;
        }
      }
    }
    if (at) {
      p.room = at[0];
      p.slot = at[1];
    } else {
      p.room = null;
      homeless++;
    }
  }
  if (homeless) {
    s.plants = s.plants.filter((p) => p.room != null);
    note(`${homeless} plant(s) had no room and were removed`);
  }
  for (const p of s.stock) p.room = null;
  return fixes;
}

export interface LoadReport {
  state: GameState;
  repairs: string[];
}

export function deserializeWithReport(json: string): LoadReport | null {
  try {
    const data = JSON.parse(migrateLegacySpecies(json)) as Dict;
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
    const repairs = sanitize(s);
    refreshMods(s);
    return { state: s, repairs };
  } catch {
    return null;
  }
}

export function deserialize(json: string): GameState | null {
  return deserializeWithReport(json)?.state ?? null;
}

// ---------------------------------------------------------------------------------------------
// localStorage with rolling backups
// ---------------------------------------------------------------------------------------------

export const BACKUP_COUNT = 3;
/** A new backup is rotated in at most this often (seconds), so the newest are never all identical autosaves. */
export const BACKUP_EVERY = 10 * 60;
const backupKey = (i: number): string => `${SAVE_KEY}.bak${i}`;
const BACKUP_META = `${SAVE_KEY}.baktime`;

const hasStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export type SaveResult = { ok: true } | { ok: false; why: string };

/** Writes the save. The previous good save is kept as a backup now and then, and a failed write never destroys it. */
export function saveGame(s: GameState): boolean {
  return saveGameResult(s).ok;
}
export function saveGameResult(s: GameState): SaveResult {
  if (!hasStorage()) return { ok: false, why: 'Browser storage is not available here.' };
  let text: string;
  try {
    text = serialize(s);
  } catch (e) {
    return { ok: false, why: 'The game could not be written out: ' + (e as Error).message };
  }
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    const last = Number(localStorage.getItem(BACKUP_META) ?? 0);
    if (prev && Date.now() - last > BACKUP_EVERY * 1000 && prev !== text) {
      for (let i = BACKUP_COUNT; i > 1; i--) {
        const older = localStorage.getItem(backupKey(i - 1));
        if (older) localStorage.setItem(backupKey(i), older);
      }
      localStorage.setItem(backupKey(1), prev);
      localStorage.setItem(BACKUP_META, String(Date.now()));
    }
    localStorage.setItem(SAVE_KEY, text);
    return { ok: true };
  } catch (e) {
    const err = e as Error;
    const full = err.name === 'QuotaExceededError' || /quota/i.test(err.message);
    return { ok: false, why: full ? 'Browser storage is full. Export your save from Settings.' : 'The browser refused to store the save: ' + err.message };
  }
}

export function loadGame(): GameState | null {
  return loadGameReport()?.state ?? null;
}

/** Loads the current save, falling back to the newest readable backup. `fromBackup` is set when that happened. */
export function loadGameReport(): (LoadReport & { fromBackup: number }) | null {
  if (!hasStorage()) return null;
  try {
    const keys = [SAVE_KEY, ...Array.from({ length: BACKUP_COUNT }, (_, i) => backupKey(i + 1))];
    for (let i = 0; i < keys.length; i++) {
      const raw = localStorage.getItem(keys[i]);
      if (!raw) continue;
      const r = deserializeWithReport(raw);
      if (r) return { ...r, fromBackup: i };
    }
  } catch {
    /* storage unreadable */
  }
  return null;
}

export interface BackupInfo {
  slot: number;
  savedAt: number;
  playedSeconds: number;
  stage: number;
  money: number;
}
export function listBackups(): BackupInfo[] {
  const out: BackupInfo[] = [];
  if (!hasStorage()) return out;
  for (let i = 1; i <= BACKUP_COUNT; i++) {
    try {
      const raw = localStorage.getItem(backupKey(i));
      if (!raw) continue;
      const d = JSON.parse(raw) as Dict;
      out.push({ slot: i, savedAt: num(d.savedAt, 0), playedSeconds: num(d.totalTime, 0), stage: num(d.stage, 1), money: num(d.money, 0) });
    } catch {
      /* skip unreadable backup */
    }
  }
  return out;
}
export function loadBackup(slot: number): GameState | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(backupKey(slot));
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  if (!hasStorage()) return;
  localStorage.removeItem(SAVE_KEY);
  for (let i = 1; i <= BACKUP_COUNT; i++) localStorage.removeItem(backupKey(i));
  localStorage.removeItem(BACKUP_META);
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
