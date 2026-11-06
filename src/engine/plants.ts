// Plant simulation: room climate, suitability, growth, water, nutrients, roots, disease and discovery.

import type { GameState, Plant, Propagule, Room, Stage } from './types';
import { Ctx, addRp, log, uid } from './core';
import { DAY, MAX_HIST, MAX_RECORDS, MEDIA_DEFS, POT_DEFS, climateStrength, maxAirflow, maxLight } from './config';
import { effectiveSpecies, type Species } from './species';
import {
  phenotype, traitDisease, traitGrowth, traitNutrient, traitRoots, traitTolerance, traitWater, type Pheno,
} from './genetics';
import { DISC_BY_ID, discKey, qualifying } from './discoveries';
import { band, clamp, gauss, rand } from './util';

// ---------------------------------------------------------------------------------------------
// Phenotype cache (genomes are replaced, never mutated, when edited)
// ---------------------------------------------------------------------------------------------

const phenoCache = new WeakMap<object, Pheno>();
export function phenoOf(p: Plant): Pheno {
  let ph = phenoCache.get(p.genome);
  if (!ph) {
    ph = phenotype(p.genome);
    phenoCache.set(p.genome, ph);
  }
  return ph;
}

export const stageOfGrowth = (g: number): Stage => (g >= 1 ? 'mature' : g >= 0.3 ? 'juvenile' : 'seedling');
export const START_GROWTH: Record<string, number> = { seed: 0.02, stem: 0.15, leaf: 0.08, division: 0.4, clone: 0.2, tissue: 0.12, young: 0.45 };

export function addHist(s: GameState, p: Plant, msg: string): void {
  p.hist.push({ t: s.time, msg });
  if (p.hist.length > MAX_HIST) p.hist.splice(0, p.hist.length - MAX_HIST);
}

export function getPlant(s: GameState, id: number | null | undefined): Plant | undefined {
  if (id == null) return undefined;
  return s.plants.find((p) => p.id === id) ?? s.stock.find((p) => p.id === id);
}
export const getRoom = (s: GameState, id: number | null): Room | undefined => (id == null ? undefined : s.rooms.find((r) => r.id === id));

// ---------------------------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------------------------

export function ambient(time: number): { temp: number; rh: number } {
  const ph = (2 * Math.PI * time) / (DAY * 2);
  return { temp: 19 + 4 * Math.sin(ph), rh: 50 - 6 * Math.sin(ph) };
}

export function roomControl(s: GameState, room: Room): { t: number; h: number } {
  const bonus = s.mods.stability + (s.mods.flags.autoEnv ? 0.05 : 0);
  return {
    t: clamp(climateStrength(room.equip.climate) + bonus, 0, 0.98),
    h: clamp(climateStrength(room.equip.humidity) + bonus, 0, 0.98),
  };
}

export function stepRoom(s: GameState, room: Room, dt: number): void {
  const a = room.act;
  const set = room.set;
  const lightSet = Math.min(set.light, maxLight(room.equip.lighting));
  a.light = clamp(lightSet * (set.photoperiod / 12), 0, 140);
  const c = roomControl(s, room);
  const amb = ambient(s.time);
  const heat = (lightSet / 100) * 3 * (1 - c.t);
  const targetT = amb.temp + heat + (set.temp - amb.temp - heat) * c.t;
  const targetH = amb.rh + (set.humidity - amb.rh) * c.h;
  const k = 1 - Math.exp(-dt * 0.25);
  const sq = Math.sqrt(Math.min(dt, 5));
  a.temp += (targetT - a.temp) * k + gauss(s) * (1 - c.t) * 0.3 * sq;
  a.humidity = clamp(a.humidity + (targetH - a.humidity) * k + gauss(s) * (1 - c.h) * 1.2 * sq, 5, 100);
  a.airflow = Math.min(set.airflow, maxAirflow(room.equip.airflow));
  a.stability = (c.t + c.h) / 2;
  // running costs
  const e = room.equip;
  const cost =
    ((lightSet / 100) * (set.photoperiod / 12) * (0.006 + 0.004 * e.lighting) + 0.004 * e.climate + 0.003 * e.humidity + 0.002 * e.airflow + 0.002 * e.irrigation) * s.mods.energy;
  const paid = Math.min(s.money, cost * dt);
  s.money -= paid;
  s.stats.spent += paid;
  Ctx.exp += paid;
  if (Ctx.rep) Ctx.rep.money -= paid;
}

// ---------------------------------------------------------------------------------------------
// Suitability
// ---------------------------------------------------------------------------------------------

export interface Suit {
  light: number;
  temp: number;
  rh: number;
  air: number;
  water: number;
  nut: number;
  medium: number;
  total: number;
  min: number;
  lethal: boolean;
}

export function waterScore(h: number, sp: Species): number {
  const lo = sp.env.dryBack;
  const hi = sp.env.wetCap;
  if (h < lo) return clamp(h / lo);
  if (h > hi) return clamp(1 - ((h - hi) / (100 - hi + 8)) * 0.7);
  return 1;
}

export function suitability(p: Plant, sp: Species, room: Room): Suit {
  const ph = phenoOf(p);
  const w = traitTolerance(ph);
  const a = room.act;
  const e = sp.env;
  const light = band(a.light, e.light[0], e.light[1], 28 * w);
  const temp = band(a.temp, e.temp[0], e.temp[1], 6 * w);
  const rh = band(a.humidity, e.rh[0], e.rh[1], 22 * w);
  const air = band(a.airflow, e.air[0], e.air[1], 30 * w);
  const water = waterScore(p.hydration, sp);
  const nut = band(p.nutrients, e.nutrient[0], e.nutrient[1], 25);
  const medium = 0.55 + 0.45 * (e.media[p.medium] ?? 0.45);
  const f = [light, temp, rh, air, water, nut, medium];
  const wts = [0.24, 0.24, 0.14, 0.06, 0.16, 0.08, 0.08];
  let ln = 0;
  let min = 1;
  for (let i = 0; i < f.length; i++) {
    ln += wts[i] * Math.log(Math.max(f[i], 0.02));
    if (f[i] < min) min = f[i];
  }
  const total = Math.exp(ln) * (0.35 + 0.65 * min);
  const lethal = a.temp < e.lethal[0] || a.temp > e.lethal[1];
  return { light, temp, rh, air, water, nut, medium, total, min, lethal };
}

// ---------------------------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------------------------

export function tagBonus(p: Plant): number {
  const vals = p.tags.map((t) => DISC_BY_ID[t]?.value ?? 0).sort((a, b) => b - a);
  return (vals[0] ?? 0) + (vals[1] ?? 0) * 0.6 + (vals[2] ?? 0) * 0.3;
}

export function recordSpecimen(s: GameState, p: Plant, value: number): void {
  if (s.records.some((r) => r.id === p.id)) return;
  s.records.push({ id: p.id, sp: p.sp, hy: p.hy, name: p.name, t: s.time, genome: p.genome, tags: [...p.tags], origin: p.origin, gen: p.gen, value: Math.round(value) });
  if (s.records.length > MAX_RECORDS) {
    const idx = s.records.findIndex((r) => r.tags.length === 0);
    s.records.splice(idx >= 0 ? idx : 0, 1);
  }
}

/** What the player can read off a plant: mature plants are always measured informally (level 1). */
export const INFECTION_NAME: Record<'fungal' | 'pests' | 'rot', string> = { fungal: 'fungal infection', pests: 'pest infestation', rot: 'root rot' };
export const effAnalysis = (p: Plant): 0 | 1 | 2 | 3 => (p.analysis < 1 && p.growth >= 1 ? 1 : p.analysis);

export function discover(s: GameState, p: Plant): number {
  const sp = effectiveSpecies(p.sp, p.hy);
  // A mature plant always gets a basic record-keeping look (analysis level 1); deeper levels need lab work.
  const seen = effAnalysis(p) !== p.analysis ? { ...p, analysis: effAnalysis(p) } : p;
  const hits = qualifying(seen, phenoOf(p));
  let fresh = 0;
  for (const d of hits) {
    if (!p.tags.includes(d.id)) p.tags.push(d.id);
    const key = discKey(d.id, sp.id);
    if (s.discoveries[key]) continue;
    s.discoveries[key] = { t: s.time, plant: p.id, plantName: p.name };
    fresh++;
    const rp = d.rp * (0.6 + 0.4 * sp.rarity) * s.mods.discovery;
    addRp(s, rp);
    if (Ctx.rep) Ctx.rep.discoveries++;
    addHist(s, p, `Discovery: ${d.name}`);
    log(s, 'discovery', `Discovery! ${d.name} in ${sp.common[0]} (+${rp.toFixed(0)} RP)`);
  }
  if (p.tags.length) recordSpecimen(s, p, 0);
  return fresh;
}

// ---------------------------------------------------------------------------------------------
// Plant creation
// ---------------------------------------------------------------------------------------------

export function makePlant(s: GameState, pr: Propagule): Plant {
  const sp = effectiveSpecies(pr.sp, pr.hy);
  const id = uid(s);
  const g = START_GROWTH[pr.kind] ?? 0.1;
  const plant: Plant = {
    id, sp: pr.sp, hy: pr.hy, name: `${sp.common[0]} #${id}`, genome: pr.genome, gen: pr.gen, parents: pr.parents,
    origin: pr.origin, sport: pr.sport, born: s.time, growth: g, stage: stageOfGrowth(g), health: 85, hydration: 80,
    nutrients: 40, roots: 55, inf: null, room: null, slot: -1, medium: 'aroidMix', pot: 'standard', analysis: 0,
    tags: [], cultivar: pr.cultivar, keeper: false, mother: false, cool: 0, vigor: pr.vigor, hist: [],
  };
  addHist(s, plant, `Started as ${labelKind(pr.kind)}`);
  s.seen[pr.hy ? `${pr.sp}x${pr.hy}` : pr.sp] = (s.seen[pr.hy ? `${pr.sp}x${pr.hy}` : pr.sp] ?? 0) + 1;
  return plant;
}

export const labelKind = (k: string): string =>
  ({ seed: 'seed', stem: 'stem cutting', leaf: 'leaf cutting', division: 'division', clone: 'clone', tissue: 'tissue-culture plantlet', young: 'young plant' } as Record<string, string>)[k] ?? k;

export function bestMedium(sp: Species, s: GameState): keyof typeof MEDIA_DEFS {
  let best: keyof typeof MEDIA_DEFS = 'aroidMix';
  let score = -1;
  for (const k of Object.keys(MEDIA_DEFS) as (keyof typeof MEDIA_DEFS)[]) {
    const need = MEDIA_DEFS[k].needs;
    if (need && !s.mods.flags[need]) continue;
    const v = sp.env.media[k] ?? 0.4;
    if (v > score) {
      score = v;
      best = k;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Stepping a plant
// ---------------------------------------------------------------------------------------------

export function evapRate(s: GameState, p: Plant, sp: Species, room: Room): number {
  const ph = phenoOf(p);
  const a = room.act;
  const base = (100 / sp.env.waterSec) * traitWater(ph) * MEDIA_DEFS[p.medium].evap * POT_DEFS[p.pot].evap * s.mods.waterUse;
  const size = 0.4 + 0.6 * p.growth;
  const tempF = clamp(a.temp / 24, 0.4, 1.8);
  const rhF = 1.35 - 0.7 * (a.humidity / 100);
  const airF = 0.7 + 0.6 * (a.airflow / 50);
  const lightF = 0.7 + 0.5 * (a.light / 60);
  return base * size * tempF * rhF * airF * lightF;
}

export function stepPlant(s: GameState, p: Plant, room: Room, dt: number, infectedInRoom: number): void {
  const sp = effectiveSpecies(p.sp, p.hy);
  const ph = phenoOf(p);
  const a = room.act;
  const mods = s.mods;
  if (p.cool > 0) p.cool = Math.max(0, p.cool - dt);

  // --- water ---
  p.hydration = Math.max(0, p.hydration - evapRate(s, p, sp, room) * dt);

  const suit = suitability(p, sp, room);

  // --- roots ---
  const rootTrait = traitRoots(ph);
  const excess = Math.max(0, p.hydration - sp.env.wetCap);
  const drainF = 1 - MEDIA_DEFS[p.medium].drain;
  let dRoot = 0;
  if (excess > 0) dRoot -= (excess / 100) * (0.25 + drainF) * 0.7 / rootTrait;
  if (p.hydration < 10) dRoot -= ((10 - p.hydration) / 10) * 0.5 / rootTrait;
  if (p.inf?.kind === 'rot') dRoot -= p.inf.sev * 0.35;
  if (excess === 0 && p.hydration >= 10 && !(p.inf?.kind === 'rot')) dRoot += 0.1 * rootTrait * suit.total;
  p.roots = clamp(p.roots + dRoot * dt, 0, 100);
  const rootF = 0.35 + 0.65 * (p.roots / 100);

  // --- nutrients ---
  const gfForUse = Math.pow(suit.total, 1.4);
  p.nutrients = Math.max(0, p.nutrients - (0.025 + 0.06 * gfForUse) * traitNutrient(ph) * sp.env.hungry * mods.nutrientUse * dt);
  const burnLine = sp.env.nutrient[1] + 15;
  let burn = 0;
  if (p.nutrients > burnLine) burn = ((p.nutrients - burnLine) / 100) * 0.6;

  // --- disease ---
  const weak = 1 + (1 - p.health / 100) * 2;
  const resist = traitDisease(ph) * (1 - mods.diseaseResist);
  if (!p.inf) {
    // While the player is away only genuinely poor conditions cause outbreaks (no background risk, no spread): a well-kept lab is
    // not wrecked by a night's absence, but a badly-run one still suffers.
    const bg = Ctx.offline ? 0 : 1;
    const fungal = bg * 0.0004 + 0.003 * clamp((a.humidity - 70) / 30) * clamp(1 - a.airflow / 45);
    const pests = bg * 0.0003 + 0.003 * clamp((45 - a.humidity) / 30) * clamp((a.temp - 22) / 10);
    const rot = bg * 0.0002 + 0.004 * clamp(excess / 30) * drainF;
    const spread = Ctx.offline ? 0 : 0.0006 * infectedInRoom;
    const total = (fungal + pests + rot + spread) * resist * weak;
    if (rand(s) < 1 - Math.exp(-total * dt)) {
      const r = rand(s) * (fungal + pests + rot + 1e-9);
      p.inf = { kind: r < fungal ? 'fungal' : r < fungal + pests ? 'pests' : 'rot', sev: 0.1 };
      addHist(s, p, `Infection: ${INFECTION_NAME[p.inf.kind]}`);
      if (!Ctx.offline) log(s, 'warn', `${p.name} has developed ${p.inf.kind === 'rot' ? '' : 'a '}${INFECTION_NAME[p.inf.kind]}.`);
    }
  } else {
    p.inf.sev = clamp(p.inf.sev + (0.012 - 0.01 * ph.diseaseResistance - (p.health > 70 ? 0.004 : 0)) * dt * (Ctx.offline ? 0.3 : 1), 0, 1);
    if (p.inf.sev <= 0.0001) p.inf = null;
  }

  // --- health ---
  const stress = Math.max(0, 0.55 - suit.total) / 0.55;
  let dH = -stress * 0.9;
  if (suit.total > 0.6) dH += (suit.total - 0.6) * 0.9;
  if (suit.lethal) dH -= 3;
  if (p.inf) dH -= p.inf.sev * 0.35;
  dH -= burn;
  p.health = clamp(p.health + dH * dt, 0, 100);
  // Offline safety net: unattended plants decline but are never lost while you are away.
  if (Ctx.offline && p.health < 12) p.health = 12;

  // --- growth ---
  if (p.growth < 1) {
    const gf = Math.pow(suit.total, 1.4) * rootF * Math.sqrt(p.health / 100);
    const before = p.growth;
    p.growth = Math.min(1, p.growth + (gf * traitGrowth(ph) * mods.growth * p.vigor * dt) / sp.growSec);
    const next = stageOfGrowth(p.growth);
    if (before < 0.45 && p.growth >= 0.45) discover(s, p);
    if (next !== p.stage) {
      p.stage = next;
      if (next === 'mature') onMature(s, p);
    }
  }
}

function onMature(s: GameState, p: Plant): void {
  s.stats.matured++;
  if (Ctx.rep) Ctx.rep.matured++;
  addHist(s, p, 'Reached maturity');
  discover(s, p);
}

export function removePlant(s: GameState, p: Plant): void {
  const i = s.plants.indexOf(p);
  if (i >= 0) s.plants.splice(i, 1);
  const r = getRoom(s, p.room);
  if (r && r.slots[p.slot] === p.id) r.slots[p.slot] = null;
  p.room = null;
  p.slot = -1;
}

export function stepRooms(s: GameState, dt: number): void {
  for (const room of s.rooms) stepRoom(s, room, dt);
  const dead: Plant[] = [];
  const counts = new Map<number, number>();
  for (const p of s.plants) if (p.inf && p.room != null) counts.set(p.room, (counts.get(p.room) ?? 0) + 1);
  for (const p of s.plants) {
    const room = getRoom(s, p.room);
    if (!room) continue;
    stepPlant(s, p, room, dt, counts.get(room.id) ?? 0);
    if (p.health <= 0) dead.push(p);
  }
  for (const p of dead) {
    removePlant(s, p);
    s.stats.died++;
    if (Ctx.rep) Ctx.rep.died++;
    log(s, 'bad', `${p.name} died.`);
  }
}
