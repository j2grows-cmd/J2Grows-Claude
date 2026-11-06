// Aggregates every permanent source of bonuses into one Mods object:
// researched techs, facility upgrades, staff, and legacy upgrades.

import type { GameState, Mods, NumMod } from './types';
import { LEGACY, UPGRADES, wageOf } from './config';
import { TECH_BY_ID, type Effect } from './techs';

export function baseMods(): Mods {
  return {
    growth: 1, research: 1, rpFlat: 0.05, analysisSpeed: 1, analysisSlots: 0, breedSlots: 0, breedSpeed: 1,
    cloneSlots: 0, cloneYield: 0, tcSlots: 0, tcYield: 1, tcSpeed: 1, tcContam: 1, tcMutation: 1,
    propSuccess: 0, propSpeed: 1, mutation: 1, novel: 1, discovery: 1, sellPrice: 1, seedPrice: 1,
    offlineCap: 0, offlineEff: 0, stability: 0, diseaseResist: 0, researchSlots: 1, maxRooms: 0,
    roomSlots: 0, germination: 0, contractSlots: 1, royalty: 1, wage: 1, energy: 1, staffCap: 0,
    autoRate: 1, storage: 0, rareBonus: 1, waterUse: 1, nutrientUse: 1, analysisCost: 1, flags: {},
  };
}

function apply(m: Mods, e: Effect, level = 1): void {
  if (e.flag) {
    m.flags[e.flag] = true;
    return;
  }
  if (!e.k) return;
  const k: NumMod = e.k;
  if (e.add != null) m[k] += e.add * level;
  if (e.mul != null) m[k] *= e.mul ** level;
}

export function computeMods(s: GameState): Mods {
  const m = baseMods();
  for (const id of Object.keys(s.done)) {
    const t = TECH_BY_ID[id];
    if (t) for (const e of t.effects) apply(m, e);
  }
  for (const u of UPGRADES) {
    const lvl = s.upgrades[u.id] ?? 0;
    if (lvl > 0) for (const e of u.effects) apply(m, e, lvl);
  }
  for (const l of LEGACY) {
    const lvl = s.legacy.ups[l.id] ?? 0;
    if (lvl > 0) for (const e of l.effects) apply(m, e, lvl);
  }
  for (const st of s.staff) {
    const L = st.level;
    switch (st.role) {
      case 'technician':
        m.tcSpeed *= 1 + 0.06 * L;
        m.tcContam *= Math.max(0.5, 1 - 0.04 * L);
        break;
      case 'geneticist':
        m.analysisSpeed *= 1 + 0.1 * L;
        m.discovery *= 1 + 0.02 * L;
        break;
      case 'researcher':
        m.rpFlat += 0.07 * L;
        break;
      case 'manager':
        m.sellPrice *= 1 + 0.012 * L;
        m.autoRate *= 1 + 0.04 * L;
        break;
      default:
        break;
    }
  }
  m.stability = Math.min(0.9, m.stability);
  m.diseaseResist = Math.min(0.9, m.diseaseResist);
  m.germination = Math.min(0.5, m.germination);
  m.propSuccess = Math.min(0.4, m.propSuccess);
  return m;
}

export function totalWages(s: GameState): number {
  let w = 0;
  for (const st of s.staff) w += wageOf(st.role, st.level);
  return w * s.mods.wage;
}

export function growerRate(s: GameState): number {
  let r = 0;
  for (const st of s.staff) if (st.role === 'grower') r += 0.18 * st.level;
  return r;
}

export function refreshMods(s: GameState): void {
  s.mods = computeMods(s);
  s.modsDirty = false;
}
