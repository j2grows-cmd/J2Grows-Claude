// Propagation and genetics jobs: planting, cuttings, division, self/cross/hybrid breeding,
// cloning chambers, tissue culture pipelines, specimen analysis and gene editing.

import type { AnalysisJob, BreedJob, CloneJob, GameState, GeneId, Plant, Propagule, TissueBatch } from './types';
import { Ctx, addRp, earn, fail, hasFlag, log, ok, propCap, spend, uid, type Result } from './core';
import { MEDIA_DEFS, POT_DEFS } from './config';
import { compat, effectiveSpecies, SPECIES, type Species } from './species';
import { cloneGenome, copyGenome, heterozygosity, recombine, traitMutation, traitPropagation, type MutParams } from './genetics';
import { addHist, bestMedium, discover, getPlant, getRoom, makePlant, phenoOf, recordSpecimen } from './plants';
import { propValue } from './economy';
import { chance, clamp, range, round } from './util';

const failXp = (s: GameState, sp: Species, amount = 0.5): void => addRp(s, amount * sp.rarity);

export function mutParams(s: GameState, pheno?: { mutationPotential: number }): MutParams {
  const mp = pheno ? 0.5 + pheno.mutationPotential : 1;
  return { rate: s.mods.mutation * mp, novel: s.mods.novel };
}

// ---------------------------------------------------------------------------------------------
// Planting
// ---------------------------------------------------------------------------------------------

export function placePropagule(s: GameState, propId: number, roomId: number, slot: number, medium?: Plant['medium'], pot: Plant['pot'] = 'standard'): Result {
  const i = s.props.findIndex((x) => x.id === propId);
  if (i < 0) return fail('Item not found.');
  const pr = s.props[i];
  const room = getRoom(s, roomId);
  if (!room) return fail('Room not found.');
  if (slot < 0 || slot >= room.slots.length || room.slots[slot] != null) return fail('That slot is not free.');
  const sp = effectiveSpecies(pr.sp, pr.hy);
  const med = medium ?? bestMedium(sp, s);
  const mdef = MEDIA_DEFS[med];
  if (mdef.needs && !hasFlag(s, mdef.needs)) return fail(`${mdef.name} needs the ${mdef.needs} technology.`);
  const pdef = POT_DEFS[pot];
  if (pdef.needs && !hasFlag(s, pdef.needs)) return fail(`${pdef.name} is not unlocked yet.`);
  const cost = mdef.cost + pdef.cost;
  if (!spend(s, cost)) return fail(`Potting costs $${cost.toFixed(2)}.`);
  s.props.splice(i, 1);

  // Germination / establishment roll
  if (pr.kind === 'seed') {
    const p = clamp(0.55 + 0.4 * pr.q * Math.max(0.4, sp.prop.seed + 0.4) + s.mods.germination, 0.1, 0.98);
    if (!chance(s, p)) {
      failXp(s, sp, 0.3);
      return fail('The seed failed to germinate (+ a little research).');
    }
  } else if (pr.kind === 'tissue') {
    if (!chance(s, clamp(0.88 + s.mods.germination, 0.5, 0.99))) {
      failXp(s, sp, 0.2);
      return fail('The plantlet did not survive deflasking.');
    }
  }
  const plant = makePlant(s, pr);
  plant.medium = med;
  plant.pot = pot;
  plant.room = roomId;
  plant.slot = slot;
  room.slots[slot] = plant.id;
  s.plants.push(plant);
  s.stats.maxPlants = Math.max(s.stats.maxPlants, s.plants.length);
  return ok(`Planted ${plant.name}.`);
}

export function firstFreeSlot(s: GameState): { room: number; slot: number } | null {
  for (const r of s.rooms) {
    const i = r.slots.findIndex((x) => x == null);
    if (i >= 0) return { room: r.id, slot: i };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Cuttings, leaf cuttings and division
// ---------------------------------------------------------------------------------------------

export type CutKind = 'stem' | 'leaf' | 'division';
export const CUT_RULES: Record<CutKind, { growth: number; cost: number; cool: number; flag: string; label: string }> = {
  stem: { growth: 0.6, cost: 2, cool: 45, flag: 'stemCuttings', label: 'Stem cutting' },
  leaf: { growth: 0.7, cost: 2, cool: 60, flag: 'leafCuttings', label: 'Leaf cutting' },
  division: { growth: 0.9, cost: 3, cool: 120, flag: 'leafCuttings', label: 'Division' },
};

export function cutChance(s: GameState, p: Plant, kind: CutKind): number {
  const sp = effectiveSpecies(p.sp, p.hy);
  return clamp(sp.prop[kind] + s.mods.propSuccess + (traitPropagation(phenoOf(p)) - 0.5) * 0.3, 0, 0.98) * (sp.prop[kind] > 0 ? 1 : 0);
}

export function canCut(s: GameState, p: Plant, kind: CutKind): string | null {
  const r = CUT_RULES[kind];
  const sp = effectiveSpecies(p.sp, p.hy);
  if (!hasFlag(s, r.flag)) return `Needs ${kind === 'stem' ? 'Cutting Technique' : 'Leaf & Division Techniques'} research.`;
  if (sp.prop[kind] <= 0) return `${sp.common[0]} cannot be propagated by ${kind === 'stem' ? 'stem cuttings' : kind === 'leaf' ? 'leaf cuttings' : 'division'}.`;
  if (p.room == null) return 'Only plants growing in a room can be cut.';
  if (p.growth < r.growth) return `The plant must be ${Math.round(r.growth * 100)}% grown first.`;
  if (kind === 'division' && p.stage !== 'mature') return 'Only mature plants can be divided.';
  if (p.cool > 0) return `Recovering for ${Math.ceil(p.cool)}s.`;
  if (s.props.length >= propCap(s)) return 'Propagule storage is full.';
  return null;
}

export function takeCutting(s: GameState, plantId: number, kind: CutKind): Result {
  const p = getPlant(s, plantId);
  if (!p) return fail('Plant not found.');
  const why = canCut(s, p, kind);
  if (why) return fail(why);
  const r = CUT_RULES[kind];
  if (!spend(s, r.cost)) return fail(`Supplies cost $${r.cost}.`);
  const sp = effectiveSpecies(p.sp, p.hy);
  const ph = phenoOf(p);
  const eff = traitPropagation(ph);
  p.cool = r.cool * s.mods.propSpeed * (1.4 - 0.8 * eff);
  if (kind === 'division') p.growth = Math.max(0.4, p.growth * 0.75);
  else p.growth = Math.max(0.5, p.growth - (kind === 'stem' ? 0.04 : 0.03));
  if (!chance(s, cutChance(s, p, kind))) {
    failXp(s, sp);
    addHist(s, p, `${r.label} failed`);
    return fail(`The ${r.label.toLowerCase()} did not take (+ a little research).`);
  }
  const count = kind === 'division' && chance(s, Math.max(0, eff - 0.3)) ? 2 : 1;
  for (let i = 0; i < count; i++) {
    if (s.props.length >= propCap(s)) break;
    const sport = cloneGenome(s, p.genome, 0.01 * s.mods.mutation * traitMutation(ph), mutParams(s, ph));
    s.props.push({
      id: uid(s), kind: kind, sp: p.sp, hy: p.hy, genome: sport.genome, gen: p.gen, parents: [p.id, null],
      origin: kind, sport: sport.sport, q: 1, vigor: p.vigor, cultivar: sport.sport ? undefined : p.cultivar,
    });
    if (sport.sport) log(s, 'discovery', `A bud sport appeared on ${p.name}! Check the new cutting.`);
  }
  addHist(s, p, `${r.label} taken`);
  return ok(`${r.label} taken from ${p.name}.`);
}

// ---------------------------------------------------------------------------------------------
// Breeding
// ---------------------------------------------------------------------------------------------

export const breedCap = (s: GameState): number => (hasFlag(s, 'selfing') ? 1 : 0) + s.mods.breedSlots + ((s.upgrades.lvl_genetics ?? 0) >= 1 ? 1 : 0);

export function crossKind(s: GameState, a: Plant, b: Plant): { kind: 'self' | 'same' | 'hybrid'; err?: string } {
  if (a.id === b.id) {
    if (!hasFlag(s, 'selfing')) return { kind: 'self', err: 'Self-pollination needs Seed Saving & Selfing research.' };
    return { kind: 'self' };
  }
  if (a.sp === b.sp && a.hy === b.hy) {
    if ((s.upgrades.lvl_genetics ?? 0) < 1) return { kind: 'same', err: 'Cross-pollination needs the Genetics Laboratory.' };
    return { kind: 'same' };
  }
  if (a.hy || b.hy) return { kind: 'hybrid', err: 'Hybrids can only be crossed with plants of their own kind.' };
  const c = compat(a.sp, b.sp);
  if (c === 'none') return { kind: 'hybrid', err: 'These species are too distantly related to cross.' };
  if (c === 'congeneric' && !hasFlag(s, 'hybridisation')) return { kind: 'hybrid', err: 'Needs Interspecific Hybridisation research.' };
  if (c === 'intergeneric' && !hasFlag(s, 'intergeneric')) return { kind: 'hybrid', err: 'Needs Intergeneric Crosses research.' };
  if ((s.upgrades.lvl_genetics ?? 0) < 1) return { kind: 'hybrid', err: 'Hybridisation needs the Genetics Laboratory.' };
  return { kind: 'hybrid' };
}

export function hybridSuccess(s: GameState, a: Plant, b: Plant): number {
  const c = compat(a.sp, b.sp);
  return clamp((c === 'congeneric' ? 0.6 : 0.3) + s.mods.propSuccess, 0.1, 0.9);
}

export interface BreedEstimate {
  kind: 'self' | 'same' | 'hybrid';
  err?: string;
  cost: number;
  seeds: number;
  total: number;
  viability: number;
}

/** What a cross would cost and yield, without starting it. */
export function breedEstimate(s: GameState, a: Plant, b: Plant): BreedEstimate {
  const k = crossKind(s, a, b);
  const sp = effectiveSpecies(a.sp, a.hy);
  const cost = k.kind === 'hybrid' ? 60 : k.kind === 'self' ? 12 : 20;
  const effAvg = (traitPropagation(phenoOf(a)) + traitPropagation(phenoOf(b))) / 2;
  const mult = (k.kind === 'hybrid' ? 0.6 : k.kind === 'self' ? 0.75 : 1) * (a.sp === b.sp ? sp.seedMult : (SPECIES[a.sp].seedMult + SPECIES[b.sp].seedMult) / 2);
  return {
    kind: k.kind,
    err: k.err,
    cost,
    seeds: Math.max(1, Math.round((3 + 4 * effAvg) * mult)),
    total: Math.max(30, (sp.growSec * 0.12) / s.mods.breedSpeed),
    viability: clamp(0.85 + s.mods.germination - (k.kind === 'self' ? 0.15 : 0) - (k.kind === 'hybrid' ? 0.1 : 0), 0.3, 1),
  };
}

export function startBreeding(s: GameState, aId: number, bId: number): Result {
  const a = getPlant(s, aId);
  const b = getPlant(s, bId);
  if (!a || !b) return fail('Parent plant not found.');
  const est = breedEstimate(s, a, b);
  if (est.err) return fail(est.err);
  for (const p of [a, b]) {
    if (p.stage !== 'mature') return fail(`${p.name} must be mature.`);
    if (p.health < 40) return fail(`${p.name} is too unhealthy to breed.`);
  }
  if (s.jobs.breeding.length >= breedCap(s) + 4) return fail('The breeding queue is full.');
  if (breedCap(s) <= 0) return fail('You have no breeding capacity yet.');
  if (!spend(s, est.cost)) return fail(`Pollination supplies cost $${est.cost}.`);
  const job: BreedJob = {
    id: uid(s), a: a.id, b: b.id, sp: a.sp, hy: est.kind === 'hybrid' ? b.sp : a.hy, kind: est.kind, progress: 0, total: est.total, seeds: est.seeds,
    viability: est.viability,
    ga: copyGenome(a.genome), gb: copyGenome(b.genome), genA: a.gen, genB: b.gen, nameA: a.name, nameB: b.name,
  };
  s.jobs.breeding.push(job);
  addHist(s, a, est.kind === 'self' ? 'Self-pollinated' : `Crossed with ${b.name}`);
  if (a !== b) addHist(s, b, `Crossed with ${a.name}`);
  return ok(`Pollination started (${est.kind}). Seeds ready in ${Math.round(est.total)}s.`);
}

function finishBreeding(s: GameState, j: BreedJob): void {
  const sp = effectiveSpecies(j.sp, j.hy);
  const a = getPlant(s, j.a);
  const b = getPlant(s, j.b);
  if (j.kind === 'hybrid') {
    const pa = a ?? ({ sp: j.sp } as Plant);
    const pb = b ?? ({ sp: j.hy! } as Plant);
    if (!chance(s, hybridSuccess(s, pa, pb))) {
      failXp(s, sp, 2);
      log(s, 'warn', `The ${sp.common[0]} cross failed to set seed (+ research).`);
      return;
    }
  }
  const phA = a ? phenoOf(a) : { mutationPotential: 0.5 };
  const phB = b ? phenoOf(b) : { mutationPotential: 0.5 };
  const mp = { mutationPotential: (phA.mutationPotential + phB.mutationPotential) / 2 };
  let made = 0;
  for (let i = 0; i < j.seeds; i++) {
    if (s.props.length >= propCap(s)) break;
    const { genome } = recombine(s, j.ga, j.gb, mutParams(s, mp));
    const het = heterozygosity(genome);
    const vigor = j.kind === 'hybrid' ? 1 + 0.15 * het : j.kind === 'self' ? 0.9 + 0.05 * het : 1 + 0.06 * het;
    s.props.push({
      id: uid(s), kind: 'seed', sp: j.sp, hy: j.hy, genome, gen: Math.max(j.genA, j.genB) + 1, parents: [j.a, j.b],
      origin: j.kind === 'hybrid' ? 'hybrid' : j.kind === 'self' ? 'selfed' : 'bred', sport: false, q: j.viability, vigor,
    });
    made++;
  }
  s.stats.bred++;
  s.stats.seedsMade += made;
  addRp(s, 1.5 * sp.rarity);
  if (made) log(s, 'good', `Pollination complete: ${made} ${sp.common[0]} seed${made > 1 ? 's' : ''} ready.`);
  else log(s, 'warn', 'Seeds were produced but there was no storage space for them.');
}

// ---------------------------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------------------------

export const analysisSlots = (s: GameState): number => ((s.upgrades.lvl_genetics ?? 0) >= 1 ? s.mods.analysisSlots : 0);
export const ANALYSIS_BASE = [
  { cost: 30, time: 40, name: 'Phenotype scan', desc: 'Reveals every expressed trait value.' },
  { cost: 120, time: 120, name: 'Genotype scan', desc: 'Reveals both alleles of every gene, their dominance and hidden carriers.' },
  { cost: 450, time: 300, name: 'Full sequencing', desc: 'Adds mutation origin marks and inheritance modelling data.' },
];

export function analysisCost(s: GameState, p: Plant, level: number): number {
  const sp = effectiveSpecies(p.sp, p.hy);
  return Math.round(ANALYSIS_BASE[level - 1].cost * (1 + 0.6 * (sp.rarity - 1)) * s.mods.analysisCost);
}

export function startAnalysis(s: GameState, plantId: number): Result {
  const p = getPlant(s, plantId);
  if (!p) return fail('Plant not found.');
  if ((s.upgrades.lvl_genetics ?? 0) < 1) return fail('Build the Genetics Laboratory first.');
  const level = (p.analysis + 1) as 1 | 2 | 3;
  if (p.analysis >= 3) return fail('This plant is fully sequenced.');
  if (level === 2 && !hasFlag(s, 'analysis2')) return fail('Genotype scans need Marker Genotyping research.');
  if (level === 3 && !hasFlag(s, 'analysis3')) return fail('Sequencing needs Genome Sequencing research.');
  if (s.jobs.analysis.some((j) => j.plant === plantId)) return fail('Already queued for analysis.');
  if (p.growth < 0.3) return fail('The plant is too young to analyse.');
  if (s.jobs.analysis.length >= analysisSlots(s) + 6) return fail('The analysis queue is full.');
  const cost = analysisCost(s, p, level);
  if (!spend(s, cost)) return fail(`Analysis costs $${cost}.`);
  const total = ANALYSIS_BASE[level - 1].time;
  s.jobs.analysis.push({ id: uid(s), plant: plantId, level, progress: 0, total });
  return ok(`${ANALYSIS_BASE[level - 1].name} queued.`);
}

function finishAnalysis(s: GameState, j: AnalysisJob): void {
  const p = getPlant(s, j.plant);
  if (!p) return;
  p.analysis = j.level;
  s.stats.analysed++;
  addHist(s, p, `${ANALYSIS_BASE[j.level - 1].name} completed`);
  const sp = effectiveSpecies(p.sp, p.hy);
  addRp(s, 1.5 * j.level * sp.rarity);
  const fresh = discover(s, p);
  recordSpecimen(s, p, 0);
  log(s, 'info', `${ANALYSIS_BASE[j.level - 1].name} complete for ${p.name}${fresh ? ` (${fresh} new discover${fresh > 1 ? 'ies' : 'y'})` : ''}.`);
}

// ---------------------------------------------------------------------------------------------
// Cloning chambers
// ---------------------------------------------------------------------------------------------

export const cloneCap = (s: GameState): number => (hasFlag(s, 'cloning') ? 1 : 0) + s.mods.cloneSlots;

export function cloneCost(p: Plant): number {
  return Math.round(25 * (1 + 0.3 * (effectiveSpecies(p.sp, p.hy).rarity - 1)));
}

export function startClone(s: GameState, plantId: number): Result {
  const p = getPlant(s, plantId);
  if (!p) return fail('Plant not found.');
  if (!hasFlag(s, 'cloning')) return fail('Needs Clonal Propagation research.');
  if (p.growth < 0.5) return fail('The plant must be at least 50% grown.');
  if (p.health < 30) return fail('The plant is too unhealthy to clone.');
  if (s.jobs.cloning.length >= cloneCap(s) + 4) return fail('The cloning queue is full.');
  const cost = cloneCost(p);
  if (!spend(s, cost)) return fail(`Cloning costs $${cost}.`);
  const ph = phenoOf(p);
  const n = Math.max(1, Math.floor(1 + s.mods.cloneYield + (traitPropagation(ph) > 0.7 ? 1 : 0)));
  s.jobs.cloning.push({
    id: uid(s), plant: p.id, name: p.name, sp: p.sp, hy: p.hy, genome: copyGenome(p.genome), gen: p.gen, cultivar: p.cultivar,
    parents: [p.id, null], progress: 0, total: 45 * s.mods.propSpeed, n,
  });
  addHist(s, p, 'Cloning started');
  return ok(`Cloning ${p.name} (${n} clone${n > 1 ? 's' : ''}).`);
}

function finishClone(s: GameState, j: CloneJob): void {
  const sp = effectiveSpecies(j.sp, j.hy);
  let made = 0;
  for (let i = 0; i < j.n; i++) {
    if (s.props.length >= propCap(s)) break;
    const c = cloneGenome(s, j.genome, 0.004 * s.mods.mutation, mutParams(s));
    s.props.push({ id: uid(s), kind: 'clone', sp: j.sp, hy: j.hy, genome: c.genome, gen: j.gen, parents: j.parents, origin: 'clone', sport: c.sport, q: 1, vigor: 1, cultivar: c.sport ? undefined : j.cultivar });
    made++;
    if (c.sport) log(s, 'discovery', `A clone of ${j.name} turned out to be a sport!`);
  }
  s.stats.cloned += made;
  if (made) log(s, 'good', `${made} clone${made > 1 ? 's' : ''} of ${j.name} ready.`);
  else log(s, 'warn', `Cloning of ${sp.common[0]} finished but storage is full.`);
}

// ---------------------------------------------------------------------------------------------
// Tissue culture
// ---------------------------------------------------------------------------------------------

export const tcCap = (s: GameState): number => ((s.upgrades.lvl_tissue ?? 0) >= 1 && hasFlag(s, 'tissueCulture') ? s.mods.tcSlots : 0);
export const tcMaxCycles = (s: GameState): number => 2 + (s.done.prop_bioreactor ? 1 : 0);
export const TC_PHASES = ['Initiation', 'Multiplication', 'Rooting', 'Acclimatisation'];
const TC_BASE = [45, 60, 50, 60];

export function tcUnits(s: GameState, sp: Species, cycles: number): number {
  return Math.max(2, Math.round(4 * 2.4 ** cycles * s.mods.tcYield * (0.6 + 0.5 * sp.prop.tissue)));
}
export function tcCost(sp: Species, cycles: number): number {
  return Math.round(60 * (1 + 0.3 * (sp.rarity - 1)) * cycles);
}
export const tcPhaseTime = (s: GameState, phase: number, cycles: number): number => (TC_BASE[phase] * (phase === 1 ? cycles : 1)) / s.mods.tcSpeed;

export function startTissue(s: GameState, plantId: number, cycles: number): Result {
  const p = getPlant(s, plantId);
  if (!p) return fail('Plant not found.');
  if (!hasFlag(s, 'tissueCulture') || (s.upgrades.lvl_tissue ?? 0) < 1) return fail('Build the Tissue Culture Laboratory first.');
  const sp = effectiveSpecies(p.sp, p.hy);
  if (sp.prop.tissue <= 0) return fail('This species is not suited to tissue culture.');
  if (p.growth < 0.4) return fail('Choose a plant that is at least 40% grown for explant material.');
  if (cycles < 1 || cycles > tcMaxCycles(s)) return fail(`Choose 1 to ${tcMaxCycles(s)} multiplication cycles.`);
  if (s.jobs.tissue.length >= tcCap(s) + 4) return fail('The tissue culture queue is full.');
  const cost = tcCost(sp, cycles);
  if (!spend(s, cost)) return fail(`Initiation costs $${cost}.`);
  const b: TissueBatch = {
    id: uid(s), sp: p.sp, hy: p.hy, genome: copyGenome(p.genome), gen: p.gen, cultivar: p.cultivar, srcName: p.name, cycles,
    phase: 0, progress: 0, total: tcPhaseTime(s, 0, cycles), units: tcUnits(s, sp, cycles), lost: 0, parents: [p.id, null],
  };
  s.jobs.tissue.push(b);
  addHist(s, p, 'Explants taken for tissue culture');
  return ok(`Tissue culture started for ${p.name}.`);
}

function advanceTissue(s: GameState, b: TissueBatch): boolean {
  // returns true when the batch is complete and should be removed
  const sp = effectiveSpecies(b.sp, b.hy);
  if (b.phase < 3) {
    if (b.phase === 1) {
      const p = 1 - (1 - clamp(0.12 * s.mods.tcContam, 0, 1)) ** b.cycles;
      if (chance(s, p)) {
        const frac = range(s, 0.15, 0.6);
        const before = b.units;
        b.units = Math.max(1, Math.round(b.units * frac));
        b.lost = before - b.units;
        log(s, 'warn', `Contamination in a ${sp.common[0]} culture: ${b.lost} plantlets lost.`);
      }
    }
    b.phase = (b.phase + 1) as 0 | 1 | 2 | 3;
    b.progress = 0;
    b.total = tcPhaseTime(s, b.phase, b.cycles);
    return false;
  }
  // deliver
  let delivered = 0;
  let sold = 0;
  let variants = 0;
  while (b.units > 0) {
    if (s.props.length >= propCap(s)) {
      if (hasFlag(s, 'sellTissue')) {
        const wholesale = { sp: b.sp, hy: b.hy, kind: 'tissue', q: 1 } as Propagule;
        earn(s, propValue(s, wholesale));
        sold++;
        b.units--;
        continue;
      }
      break;
    }
    const c = cloneGenome(s, b.genome, 0.03 * s.mods.tcMutation * s.mods.mutation, mutParams(s));
    if (c.sport) variants++;
    s.props.push({ id: uid(s), kind: 'tissue', sp: b.sp, hy: b.hy, genome: c.genome, gen: b.gen, parents: b.parents, origin: 'tissue', sport: c.sport, q: 1, vigor: 1, cultivar: c.sport ? undefined : b.cultivar });
    delivered++;
    b.units--;
  }
  s.stats.tissueMade += delivered;
  if (delivered || sold) log(s, 'good', `Tissue culture of ${b.srcName}: ${delivered} plantlets${sold ? `, ${sold} sold as liners` : ''}${variants ? `, ${variants} somaclonal variant${variants > 1 ? 's' : ''}!` : '.'}`);
  if (b.units > 0) {
    log(s, 'warn', `${b.units} plantlets are waiting for storage space.`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Gene editing
// ---------------------------------------------------------------------------------------------

export function editCost(p: Plant): { money: number; rp: number } {
  const sp = effectiveSpecies(p.sp, p.hy);
  return { money: Math.round(3000 * sp.rarity * (1 + 0.2 * (p.tags.length))), rp: 150 * sp.rarity };
}

export function editGene(s: GameState, plantId: number, gene: GeneId, allele: 0 | 1, delta: number): Result {
  const p = getPlant(s, plantId);
  if (!p) return fail('Plant not found.');
  if (!hasFlag(s, 'geneEdit')) return fail('Needs Targeted Gene Editing research.');
  if (p.analysis < 3) return fail('The plant must be fully sequenced before editing.');
  const cost = editCost(p);
  if (s.rp < cost.rp) return fail(`Editing needs ${cost.rp} research points.`);
  if (!spend(s, cost.money)) return fail(`Editing costs $${cost.money.toLocaleString()}.`);
  s.rp -= cost.rp;
  const g = copyGenome(p.genome);
  g[gene][allele].v = round(clamp(g[gene][allele].v + delta), 3);
  p.genome = g;
  p.tags = [];
  discover(s, p);
  addHist(s, p, `Gene edit: ${gene}`);
  return ok(`Edited ${gene} in ${p.name}.`);
}

// ---------------------------------------------------------------------------------------------
// Job ticking
// ---------------------------------------------------------------------------------------------

function runQueue<T extends { progress: number; total: number }>(list: T[], slots: number, dt: number, speed: number, done: (j: T) => boolean | void): void {
  const n = Math.min(slots, list.length);
  const finished: T[] = [];
  for (let i = 0; i < n; i++) {
    const j = list[i];
    j.progress += dt * speed;
    if (j.progress >= j.total) finished.push(j);
  }
  for (const j of finished) {
    const keep = done(j);
    if (!keep) list.splice(list.indexOf(j), 1);
  }
}

export function tickJobs(s: GameState, dt: number): void {
  const before = s.jobs.analysis.length + s.jobs.breeding.length + s.jobs.cloning.length + s.jobs.tissue.length;
  runQueue(s.jobs.analysis, analysisSlots(s), dt, s.mods.analysisSpeed, (j) => { finishAnalysis(s, j); });
  runQueue(s.jobs.breeding, breedCap(s), dt, 1, (j) => { finishBreeding(s, j); });
  runQueue(s.jobs.cloning, cloneCap(s), dt, 1, (j) => { finishClone(s, j); });
  runQueue(s.jobs.tissue, tcCap(s), dt, 1, (j) => !advanceTissue(s, j) ? true : undefined);
  const after = s.jobs.analysis.length + s.jobs.breeding.length + s.jobs.cloning.length + s.jobs.tissue.length;
  if (Ctx.rep && before > after) Ctx.rep.jobs += before - after;
}
