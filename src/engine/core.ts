// Shared helpers used by every simulation module (no imports of other engine modules except data).

import type { GameState, LogKind, OfflineReport } from './types';
import { MAX_LOG, STAGES } from './config';
import { SPECIES_LIST, type Species } from './species';

/** Module-level context so deep sim code can know whether it is running an offline catch-up. */
export const Ctx = {
  offline: false,
  rep: null as OfflineReport | null,
  inc: 0,
  exp: 0,
  quiet: false,
};

export function uid(s: GameState): number {
  return s.nextId++;
}

export function log(s: GameState, kind: LogKind, msg: string): void {
  if (Ctx.quiet) return;
  s.log.push({ id: uid(s), t: s.time, kind, msg });
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

export function earn(s: GameState, amt: number): void {
  if (amt <= 0) return;
  s.money += amt;
  s.stats.earned += amt;
  s.stats.earnedRun += amt;
  Ctx.inc += amt;
  if (Ctx.rep) Ctx.rep.money += amt;
}

/** Spend money if affordable. Returns false (and spends nothing) otherwise. */
export function spend(s: GameState, amt: number): boolean {
  if (amt <= 0) return true;
  if (s.money + 1e-9 < amt) return false;
  s.money -= amt;
  s.stats.spent += amt;
  Ctx.exp += amt;
  return true;
}

/** Operating costs that may push money slightly negative-clamped at zero. */
export function drain(s: GameState, amt: number): void {
  if (amt <= 0) return;
  const a = Math.min(s.money, amt);
  s.money -= a;
  s.stats.spent += a;
  Ctx.exp += a;
  if (Ctx.rep) Ctx.rep.money -= a;
}

export function addRp(s: GameState, amt: number): void {
  if (amt <= 0) return;
  s.rp += amt;
  s.stats.rpEarned += amt;
  if (Ctx.rep) Ctx.rep.rp += amt;
}

export const hasFlag = (s: GameState, f: string): boolean => !!s.mods.flags[f];

export function speciesAvailable(s: GameState, sp: Species): boolean {
  if (s.stage < sp.unlock.stage) return false;
  if (sp.unlock.expedition && !s.done[sp.unlock.expedition]) return false;
  if (sp.unlock.legacy && !(s.legacy.ups.species > 0)) return false;
  return true;
}
export const availableSpecies = (s: GameState): Species[] => SPECIES_LIST.filter((sp) => speciesAvailable(s, sp));

export const stageDef = (s: GameState) => STAGES[Math.min(s.stage, STAGES.length) - 1];

export const discoveryCount = (s: GameState): number => Object.keys(s.discoveries).length;

export function maxRooms(s: GameState): number {
  return stageDef(s).baseRooms + Math.max(0, s.mods.maxRooms - 1);
}
export function roomSlotCap(s: GameState): number {
  return stageDef(s).baseSlots + s.mods.roomSlots + 2 * Math.max(0, (s.upgrades.lvl_cultivation ?? 1) - 1);
}
export const propCap = (s: GameState): number => 40 + s.mods.storage;
export const stockCap = (s: GameState): number => 24 + Math.floor(s.mods.storage / 2);

export function fmt2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Result {
  ok: boolean;
  msg: string;
}
export const ok = (msg = 'Done.'): Result => ({ ok: true, msg });
export const fail = (msg: string): Result => ({ ok: false, msg });
