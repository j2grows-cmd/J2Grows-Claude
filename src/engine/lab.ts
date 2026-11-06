// Laboratory management: stage progression, rooms, equipment, departments, upgrades and staff.

import type { DeptId, GameState, RoomSettings, StaffRole } from './types';
import {
  Result, discoveryCount, fail, log, maxRooms, ok, roomSlotCap, spend,
} from './core';
import {
  EQUIP, MAX_STAFF_LEVEL, ROLES, STAFF_NAMES, STAGES, UPGRADE_BY_ID, equipCost, hireCost, roomBuildCost, roomSlotCost,
  staffCap, trainCost, upgradeCost,
} from './config';
import { TECH_BY_ID } from './techs';
import { makeRoom } from './state';
import { clamp, pick } from './util';
import type { RoomEquipment } from './types';

// ---------------------------------------------------------------------------------------------
// Stage progression
// ---------------------------------------------------------------------------------------------

export interface Requirement {
  label: string;
  have: string;
  met: boolean;
}

export function stageRequirements(s: GameState): Requirement[] | null {
  const next = STAGES[s.stage];
  if (!next) return null;
  const reqs: Requirement[] = [];
  reqs.push({ label: `Pay $${next.cost.toLocaleString()}`, have: `$${Math.floor(s.money).toLocaleString()}`, met: s.money >= next.cost });
  if (next.needMatured) reqs.push({ label: `${next.needMatured} plants matured`, have: String(s.stats.matured), met: s.stats.matured >= next.needMatured });
  if (next.needDisc) reqs.push({ label: `${next.needDisc} discoveries`, have: String(discoveryCount(s)), met: discoveryCount(s) >= next.needDisc });
  if (next.needTech) reqs.push({ label: `Research: ${TECH_BY_ID[next.needTech]?.name ?? next.needTech}`, have: s.done[next.needTech] ? 'done' : 'not yet', met: !!s.done[next.needTech] });
  return reqs;
}

export function advanceStage(s: GameState): Result {
  const next = STAGES[s.stage];
  if (!next) return fail('You are already at the final stage.');
  const reqs = stageRequirements(s)!;
  const unmet = reqs.find((r) => !r.met);
  if (unmet) return fail(`Requirement not met: ${unmet.label}.`);
  spend(s, next.cost);
  s.stage = next.n;
  s.modsDirty = true;
  log(s, 'good', `Facility upgraded to Stage ${next.n}: ${next.name}!`);
  return ok(`Welcome to ${next.name}.`);
}

// ---------------------------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------------------------

export function nextRoomCost(s: GameState): number {
  return roomBuildCost(s.rooms.length);
}

export function buildRoom(s: GameState): Result {
  if (s.rooms.length >= maxRooms(s)) return fail('Raise your Cultivation Department level or advance the facility stage to build more rooms.');
  const cost = nextRoomCost(s);
  if (!spend(s, cost)) return fail(`A new room costs $${cost.toLocaleString()}.`);
  const id = s.nextId++;
  s.rooms.push(makeRoom(id, `Grow Room ${s.rooms.length + 1}`, Math.min(6, roomSlotCap(s))));
  return ok('New grow room built.');
}

export function roomExpandCost(slots: number): number {
  return roomSlotCost(slots);
}

export function expandRoom(s: GameState, roomId: number): Result {
  const r = s.rooms.find((x) => x.id === roomId);
  if (!r) return fail('Room not found.');
  if (r.slots.length >= roomSlotCap(s)) return fail('This room is at its capacity. Level up Cultivation or advance the stage.');
  const cost = roomSlotCost(r.slots.length);
  if (!spend(s, cost)) return fail(`Expansion costs $${cost.toLocaleString()}.`);
  r.slots.push(null);
  return ok('Added a growing slot.');
}

export function buyEquip(s: GameState, roomId: number, id: keyof RoomEquipment): Result {
  const r = s.rooms.find((x) => x.id === roomId);
  const def = EQUIP.find((e) => e.id === id);
  if (!r || !def) return fail('Not found.');
  const lvl = r.equip[id];
  if (lvl >= def.max) return fail('Already at maximum level.');
  const cost = equipCost(def, lvl);
  if (!spend(s, cost)) return fail(`${def.name} costs $${cost.toLocaleString()}.`);
  r.equip[id] = lvl + 1;
  return ok(`${def.name} upgraded to level ${lvl + 1}.`);
}

export function setRoom(s: GameState, roomId: number, patch: Partial<RoomSettings>): void {
  const r = s.rooms.find((x) => x.id === roomId);
  if (!r) return;
  const c = r.set;
  for (const k of Object.keys(patch) as (keyof RoomSettings)[]) if (!Number.isFinite(patch[k])) delete patch[k];
  if (patch.light != null) c.light = clamp(patch.light, 0, 100);
  if (patch.photoperiod != null) c.photoperiod = clamp(patch.photoperiod, 8, 20);
  if (patch.temp != null) c.temp = clamp(patch.temp, 10, 35);
  if (patch.humidity != null) c.humidity = clamp(patch.humidity, 20, 95);
  if (patch.airflow != null) c.airflow = clamp(patch.airflow, 0, 100);
  if (patch.feed != null) c.feed = clamp(patch.feed, 0, 100);
}

export function renameRoom(s: GameState, roomId: number, name: string): void {
  const r = s.rooms.find((x) => x.id === roomId);
  if (r && name.trim()) r.name = name.trim().slice(0, 28);
}

// ---------------------------------------------------------------------------------------------
// Departments and upgrades
// ---------------------------------------------------------------------------------------------

export function deptStatus(s: GameState, dept: DeptId): { unlocked: boolean; why?: string } {
  switch (dept) {
    case 'cultivation':
    case 'research':
      return { unlocked: true };
    case 'tissue':
      if (s.stage < 2) return { unlocked: false, why: 'Requires Stage 2.' };
      if (!s.mods.flags.tissueCulture) return { unlocked: false, why: 'Research Aseptic Technique first.' };
      return { unlocked: true };
    case 'genetics':
      if (s.stage < 3) return { unlocked: false, why: 'Requires Stage 3.' };
      return { unlocked: true };
  }
}

export function upgradeStatus(s: GameState, id: string): { ok: boolean; why?: string; cost: number; level: number; max: number } {
  const u = UPGRADE_BY_ID[id];
  const level = s.upgrades[id] ?? 0;
  const cost = u ? upgradeCost(u, level) : 0;
  if (!u) return { ok: false, why: 'Unknown upgrade.', cost, level, max: 0 };
  if (level >= u.max) return { ok: false, why: 'Maximum level.', cost, level, max: u.max };
  if (s.stage < u.stage) return { ok: false, why: `Requires Stage ${u.stage}.`, cost, level, max: u.max };
  if (u.needFlag && !s.mods.flags[u.needFlag]) return { ok: false, why: 'Requires further research.', cost, level, max: u.max };
  if (u.needUpgrade && (s.upgrades[u.needUpgrade[0]] ?? 0) < u.needUpgrade[1]) {
    return { ok: false, why: `Requires ${UPGRADE_BY_ID[u.needUpgrade[0]].name} level ${u.needUpgrade[1]}.`, cost, level, max: u.max };
  }
  return { ok: true, cost, level, max: u.max };
}

export function buyUpgrade(s: GameState, id: string): Result {
  const st = upgradeStatus(s, id);
  if (!st.ok) return fail(st.why ?? 'Cannot upgrade.');
  const u = UPGRADE_BY_ID[id];
  if (!spend(s, st.cost)) return fail(`${u.name} costs $${st.cost.toLocaleString()}.`);
  s.upgrades[id] = st.level + 1;
  if (id.startsWith('lvl_')) s.depts[id.slice(4) as DeptId] = st.level + 1;
  s.modsDirty = true;
  return ok(`${u.name} is now level ${st.level + 1}.`);
}

// ---------------------------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------------------------

export const currentStaffCap = (s: GameState): number => staffCap(s.stage) + s.mods.staffCap;

export function hire(s: GameState, role: StaffRole): Result {
  if (s.staff.length >= currentStaffCap(s)) return fail(s.stage < 3 ? 'Staff are available from Stage 3.' : 'You have reached your staffing limit for this stage.');
  const cost = hireCost(role, s.staff.length);
  if (!spend(s, cost)) return fail(`Hiring costs $${cost.toLocaleString()}.`);
  const used = new Set(s.staff.map((x) => x.name));
  const free = STAFF_NAMES.filter((n) => !used.has(n));
  s.staff.push({ id: s.nextId++, role, name: pick(s, free.length ? free : STAFF_NAMES), level: 1 });
  s.modsDirty = true;
  return ok(`Hired a new ${ROLES[role].name}.`);
}

export function trainStaff(s: GameState, id: number): Result {
  const st = s.staff.find((x) => x.id === id);
  if (!st) return fail('Staff member not found.');
  if (st.level >= MAX_STAFF_LEVEL) return fail('Already at maximum skill.');
  const cost = trainCost(st.role, st.level);
  if (!spend(s, cost)) return fail(`Training costs $${cost.toLocaleString()}.`);
  st.level++;
  s.modsDirty = true;
  return ok(`${st.name} is now level ${st.level}.`);
}

export function fireStaff(s: GameState, id: number): void {
  s.staff = s.staff.filter((x) => x.id !== id);
  s.modsDirty = true;
}
