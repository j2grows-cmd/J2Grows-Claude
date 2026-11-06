// Automation: growers and robots perform tending, propagation, harvesting and sales on a budget
// of actions per second. Each automation stage is unlocked by research and can be toggled.

import type { GameState, Plant } from './types';
import { growerRate } from './mods';
import { irrigationRate, maxLight } from './config';
import { effectiveSpecies } from './species';
import { feedPlant, treatPlant, waterPlant } from './care';
import { firstFreeSlot, canCut, cutChance, startAnalysis, startTissue, takeCutting, placePropagule, tcCap, tcMaxCycles, tcCost, analysisSlots, type CutKind } from './propagation';
import { harvestToStock, marketIdx, plantValue, sellPlant } from './economy';
import { bestMedium } from './plants';
import { stockCap } from './core';
import { clamp } from './util';

const AUTO_FLAGS = ['autoWater', 'autoFeed', 'autoTreat', 'autoPlant', 'autoPropagate', 'autoHarvest', 'autoSell', 'autoAnalyse', 'autoTissue'];

export function tendRate(s: GameState): number {
  const anyAuto = AUTO_FLAGS.some((f) => s.mods.flags[f]);
  let irr = 0;
  for (const r of s.rooms) irr += irrigationRate(r.equip.irrigation);
  return growerRate(s) + (anyAuto ? s.mods.autoRate * (0.5 + irr) : 0);
}

const isOn = (s: GameState, k: string, flag: string): boolean => s.auto.on[k] !== false && (!!s.mods.flags[flag] || (['water', 'feed', 'treat'].includes(k) && growerRate(s) > 0));

// ---------------------------------------------------------------------------------------------
// Selling rules
// ---------------------------------------------------------------------------------------------

function protectedIds(s: GameState): Set<number> {
  const out = new Set<number>();
  const n = s.auto.sell.maxPerSpecies;
  if (n <= 0) return out;
  const groups = new Map<string, Plant[]>();
  for (const p of [...s.plants, ...s.stock]) {
    if (p.stage !== 'mature') continue;
    const k = p.hy ? `${p.sp}x${p.hy}` : p.sp;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => plantValue(s, b) - plantValue(s, a));
    arr.slice(0, n).forEach((p) => out.add(p.id));
  }
  return out;
}

export function matchesSellRules(s: GameState, p: Plant, prot: Set<number>, ignoreIndex = false): boolean {
  const r = s.auto.sell;
  if (p.keeper || p.mother || p.stage !== 'mature') return false;
  if (r.keepAnalysed && p.analysis > 0) return false;
  if (r.keepDiscoveries && p.tags.length > 0) return false;
  const sp = effectiveSpecies(p.sp, p.hy);
  if (sp.rarity >= r.keepRarity) return false;
  if (prot.has(p.id)) return false;
  if (plantValue(s, p) < r.minValue) return false;
  if (!ignoreIndex && marketIdx(s, sp.id) < r.holdForIndex) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Environment auto-tuning
// ---------------------------------------------------------------------------------------------

export function autoTuneRoom(s: GameState, roomId: number): boolean {
  const room = s.rooms.find((r) => r.id === roomId);
  if (!room) return false;
  const here = room.slots.map((id) => s.plants.find((p) => p.id === id)).filter(Boolean) as Plant[];
  if (!here.length) return false;
  let t = 0, h = 0, l = 0, a = 0;
  for (const p of here) {
    const e = effectiveSpecies(p.sp, p.hy).env;
    t += (e.temp[0] + e.temp[1]) / 2;
    h += (e.rh[0] + e.rh[1]) / 2;
    l += (e.light[0] + e.light[1]) / 2;
    a += (e.air[0] + e.air[1]) / 2;
  }
  const n = here.length;
  const lightMid = l / n;
  const cap = maxLight(room.equip.lighting);
  room.set.temp = Math.round((t / n) * 2) / 2;
  room.set.humidity = Math.round(h / n);
  room.set.airflow = Math.round(a / n);
  if (cap >= lightMid) {
    room.set.light = Math.round(lightMid);
    room.set.photoperiod = 12;
  } else {
    room.set.light = cap;
    room.set.photoperiod = clamp(Math.round((12 * lightMid) / cap), 12, 18);
  }
  room.set.feed = 60;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------------------------

export function runAutomation(s: GameState, dt: number): void {
  if (s.mods.flags.autoEnv && s.auto.on.env !== false && Math.floor(s.time / 20) !== Math.floor((s.time - dt) / 20)) {
    for (const r of s.rooms) autoTuneRoom(s, r.id);
  }
  const rate = tendRate(s);
  if (rate <= 0) {
    s.auto.budget = 0;
    return;
  }
  s.auto.budget = Math.min(s.auto.budget + rate * dt, Math.max(6, rate * 40));
  let n = Math.floor(s.auto.budget);
  if (n <= 0) return;
  const used0 = n;

  // --- tending ---
  if (isOn(s, 'treat', 'autoTreat')) {
    const sick = s.plants.filter((p) => p.inf).sort((a, b) => b.inf!.sev - a.inf!.sev);
    for (const p of sick) {
      if (n <= 0) break;
      if (treatPlant(s, p)) n--;
    }
  }
  if (n > 0 && isOn(s, 'water', 'autoWater')) {
    const thirsty = s.plants
      .filter((p) => p.hydration < effectiveSpecies(p.sp, p.hy).env.dryBack + 8)
      .sort((a, b) => a.hydration - b.hydration);
    for (const p of thirsty) {
      if (n <= 0) break;
      const e = effectiveSpecies(p.sp, p.hy).env;
      const target = clamp(e.wetCap - 3, e.dryBack + 30, 100);
      if (waterPlant(s, p)) {
        p.hydration = target;
        n--;
      }
    }
  }
  if (n > 0 && isOn(s, 'feed', 'autoFeed')) {
    const hungry = s.plants.filter((p) => {
      const e = effectiveSpecies(p.sp, p.hy).env;
      return p.nutrients < e.nutrient[0] + 6;
    });
    for (const p of hungry) {
      if (n <= 0) break;
      const e = effectiveSpecies(p.sp, p.hy).env;
      const room = s.rooms.find((r) => r.id === p.room);
      const dose = clamp((room?.set.feed ?? 50) / 60, 0.3, 1);
      if (feedPlant(s, p)) {
        p.nutrients = e.nutrient[0] + (e.nutrient[1] - e.nutrient[0]) * dose;
        n--;
      }
    }
  }

  // --- harvest & sales ---
  if (n > 0 && (s.mods.flags.autoHarvest || s.mods.flags.autoSell)) {
    const prot = protectedIds(s);
    if (s.mods.flags.autoHarvest && s.auto.on.harvest !== false) {
      for (const p of [...s.plants]) {
        if (n <= 0 || s.stock.length >= stockCap(s)) break;
        if (matchesSellRules(s, p, prot, true) && harvestToStock(s, p).ok) n--;
      }
    }
    if (s.mods.flags.autoSell && s.auto.on.sell !== false) {
      const pool: Plant[] = [...s.stock];
      if (!s.mods.flags.autoHarvest) pool.push(...s.plants);
      for (const p of pool) {
        if (n <= 0) break;
        if (matchesSellRules(s, p, prot) && sellPlant(s, p).ok) n--;
      }
    }
  }

  // --- planting ---
  if (n > 0 && s.mods.flags.autoPlant && s.auto.on.plant !== false) {
    while (n > 0 && s.props.length) {
      const slot = firstFreeSlot(s);
      if (!slot) break;
      const pr = s.props[0];
      const sp = effectiveSpecies(pr.sp, pr.hy);
      const med = bestMedium(sp, s);
      const pot = s.mods.flags.passiveHydro && sp.env.wetCap >= 80 ? 'passiveHydro' : s.mods.flags.selfWatering && sp.env.wetCap >= 70 ? 'selfWatering' : 'standard';
      const r = placePropagule(s, pr.id, slot.room, slot.slot, med, pot);
      n--;
      if (!r.ok && r.msg.includes('Potting costs')) break;
    }
  }

  // --- propagation from mother plants ---
  if (n > 0 && s.mods.flags.autoPropagate && s.auto.on.propagate !== false) {
    const free = s.rooms.reduce((a, r) => a + r.slots.filter((x) => x == null).length, 0);
    if (free > s.props.length) {
      for (const p of s.plants) {
        if (n <= 0) break;
        if (!p.mother) continue;
        const kinds: CutKind[] = (['stem', 'division', 'leaf'] as CutKind[]).filter((k) => canCut(s, p, k) === null).sort((a, b) => cutChance(s, p, b) - cutChance(s, p, a));
        if (!kinds.length) continue;
        takeCutting(s, p.id, kinds[0]);
        n--;
      }
    }
  }

  // --- analysis ---
  if (n > 0 && s.mods.flags.autoAnalyse && s.auto.on.analyse !== false && analysisSlots(s) > 0 && s.jobs.analysis.length < analysisSlots(s)) {
    for (const p of s.plants) {
      if (n <= 0 || s.jobs.analysis.length >= analysisSlots(s)) break;
      if (p.analysis === 0 && p.growth >= 0.6 && !s.jobs.analysis.some((j) => j.plant === p.id)) {
        if (startAnalysis(s, p.id).ok) n--;
      }
    }
  }

  // --- tissue culture ---
  if (n > 0 && s.mods.flags.autoTissue && s.auto.on.tissue !== false && tcCap(s) > 0 && s.jobs.tissue.length < tcCap(s) && s.props.length < 20) {
    const busy = new Set(s.jobs.tissue.map((b) => b.parents[0]));
    for (const p of s.plants) {
      if (n <= 0 || s.jobs.tissue.length >= tcCap(s)) break;
      if (!p.mother || p.growth < 0.4 || busy.has(p.id)) continue;
      const sp = effectiveSpecies(p.sp, p.hy);
      if (s.money < tcCost(sp, tcMaxCycles(s)) * 3) continue;
      if (startTissue(s, p.id, tcMaxCycles(s)).ok) n--;
    }
  }

  s.auto.budget = Math.max(0, s.auto.budget - (used0 - n));
}
