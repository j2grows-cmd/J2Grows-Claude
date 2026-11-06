// Manual plant care and plant management actions.

import type { GameState, MediumId, Plant, PotId } from './types';
import { fail, ok, spend, type Result } from './core';
import { MEDIA_DEFS, POT_DEFS } from './config';
import { INFECTION_NAME, addHist, getPlant, getRoom, removePlant } from './plants';
import { clamp } from './util';

export const WATER_COST = 0.2;
export const FEED_COST = 0.4;
export const TREAT_COST = 3;

export function waterPlant(s: GameState, p: Plant): boolean {
  if (!spend(s, WATER_COST)) return false;
  p.hydration = clamp(p.hydration + 65, 0, 100);
  return true;
}
export function feedPlant(s: GameState, p: Plant): boolean {
  if (!spend(s, FEED_COST)) return false;
  p.nutrients = clamp(p.nutrients + 45, 0, 100);
  return true;
}
export function treatPlant(s: GameState, p: Plant): boolean {
  if (!p.inf) return false;
  if (!spend(s, TREAT_COST)) return false;
  addHist(s, p, `Treated ${INFECTION_NAME[p.inf.kind]}`);
  p.inf = null;
  return true;
}

export function waterById(s: GameState, id: number): Result {
  const p = getPlant(s, id);
  if (!p || p.room == null) return fail('Plant not found.');
  return waterPlant(s, p) ? ok('Watered.') : fail('Not enough money.');
}
export function feedById(s: GameState, id: number): Result {
  const p = getPlant(s, id);
  if (!p || p.room == null) return fail('Plant not found.');
  return feedPlant(s, p) ? ok('Fed.') : fail('Not enough money.');
}
export function treatById(s: GameState, id: number): Result {
  const p = getPlant(s, id);
  if (!p) return fail('Plant not found.');
  if (!p.inf) return fail('This plant is healthy.');
  return treatPlant(s, p) ? ok('Treated.') : fail(`Treatment costs $${TREAT_COST}.`);
}

export function careRoom(s: GameState, roomId: number, what: 'water' | 'feed' | 'treat'): Result {
  const room = getRoom(s, roomId);
  if (!room) return fail('Room not found.');
  let n = 0;
  for (const id of room.slots) {
    const p = id == null ? undefined : s.plants.find((x) => x.id === id);
    if (!p) continue;
    const done = what === 'water' ? waterPlant(s, p) : what === 'feed' ? feedPlant(s, p) : treatPlant(s, p);
    if (done) n++;
  }
  return n ? ok(`${what === 'water' ? 'Watered' : what === 'feed' ? 'Fed' : 'Treated'} ${n} plant${n > 1 ? 's' : ''}.`) : fail('Nothing to do.');
}

export function repot(s: GameState, id: number, medium: MediumId, pot: PotId): Result {
  const p = getPlant(s, id);
  if (!p || p.room == null) return fail('Plant not found.');
  const m = MEDIA_DEFS[medium];
  const pt = POT_DEFS[pot];
  if (m.needs && !s.mods.flags[m.needs]) return fail(`${m.name} is not unlocked.`);
  if (pt.needs && !s.mods.flags[pt.needs]) return fail(`${pt.name} is not unlocked.`);
  const cost = m.cost + pt.cost;
  if (!spend(s, cost)) return fail(`Repotting costs $${cost.toFixed(2)}.`);
  p.medium = medium;
  p.pot = pot;
  p.roots = clamp(p.roots - 6, 0, 100);
  addHist(s, p, `Repotted into ${m.name} / ${pt.name}`);
  return ok('Repotted.');
}

export function movePlant(s: GameState, id: number, roomId: number, slot: number): Result {
  const p = getPlant(s, id);
  if (!p || p.room == null) return fail('Plant not found.');
  const dest = getRoom(s, roomId);
  if (!dest || slot < 0 || slot >= dest.slots.length) return fail('Invalid destination.');
  if (dest.slots[slot] != null) return fail('That slot is occupied.');
  const src = getRoom(s, p.room);
  if (src) src.slots[p.slot] = null;
  dest.slots[slot] = p.id;
  p.room = roomId;
  p.slot = slot;
  return ok('Moved.');
}

export function discardPlant(s: GameState, id: number): Result {
  const p = getPlant(s, id);
  if (!p) return fail('Plant not found.');
  if (s.stock.includes(p)) s.stock.splice(s.stock.indexOf(p), 1);
  else removePlant(s, p);
  return ok(`Discarded ${p.name}.`);
}

export function setFlag(s: GameState, id: number, flag: 'keeper' | 'mother'): void {
  const p = getPlant(s, id);
  if (p) p[flag] = !p[flag];
}

export function renamePlant(s: GameState, id: number, name: string): void {
  const p = getPlant(s, id);
  if (p && name.trim()) p.name = name.trim().slice(0, 40);
}
