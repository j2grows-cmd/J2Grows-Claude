// Economy: plant valuation, market indices and events, shop, collector contracts and cultivar royalties.

import type { Contract, ContractReq, GameState, Plant, PropKind, Propagule } from './types';
import { addRp, availableSpecies, earn, fail, hasFlag, log, ok, propCap, spend, stockCap, uid, type Result } from './core';
import {
  PRICE_CUTTING, PRICE_FLASK, PRICE_SEED, PRICE_YOUNG, SEED_PACK, TC_FLASK,
} from './config';
import { effectiveSpecies, SPECIES, speciesName } from './species';
import { wildGenome } from './genetics';
import { addHist, getPlant, phenoOf, recordSpecimen, removePlant, tagBonus } from './plants';
import { DISC_BY_ID } from './discoveries';
import { clamp, gauss, pick, range, chance } from './util';

// ---------------------------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------------------------

export function marketIdx(s: GameState, spId: string): number {
  let m = s.market.index[spId] ?? 1;
  for (const e of s.market.events) if (e.sp === 'all' || e.sp === spId) m *= e.mag;
  return m;
}

export function repMult(s: GameState): number {
  return 1 + Math.min(0.5, s.market.rep * 0.004);
}

/** Value of a plant if sold now. */
export function plantValue(s: GameState, p: Plant): number {
  const sp = effectiveSpecies(p.sp, p.hy);
  const ph = phenoOf(p);
  const mat = Math.pow(clamp(p.growth), 1.6);
  const healthF = 0.4 + 0.6 * (p.health / 100);
  const traitF = 0.8 + 0.25 * ph.leafSize + 0.12 * ph.leafShape + 0.15 * ph.variegation + 0.05 * ph.leafColour;
  const cultivarF = p.cultivar ? 1.5 : 1;
  const rare = sp.rarity >= 4 ? s.mods.rareBonus : 1;
  const v = sp.baseValue * mat * healthF * traitF * (1 + tagBonus(p)) * cultivarF * marketIdx(s, sp.id) * s.mods.sellPrice * repMult(s) * rare;
  return Math.max(0, v);
}

/** What the shop charges per unit, as a share of the species' base value. */
const SHOP_UNIT: Partial<Record<PropKind, number>> = {
  seed: PRICE_SEED / SEED_PACK, young: PRICE_YOUNG, stem: PRICE_CUTTING, division: PRICE_CUTTING, leaf: PRICE_CUTTING, tissue: PRICE_FLASK / TC_FLASK,
};
/** Something bought from the shop never sells back for more than this share of what it cost. */
export const RESALE_LIMIT = 0.6;

export function propValue(s: GameState, pr: Propagule): number {
  const sp = effectiveSpecies(pr.sp, pr.hy);
  const f: Record<PropKind, number> = { seed: 0.1, tissue: 0.09, stem: 0.15, leaf: 0.1, division: 0.3, clone: 0.35, young: 0.5 };
  let v = sp.baseValue * f[pr.kind] * (pr.kind === 'seed' ? s.mods.seedPrice * pr.q : 1) * s.mods.sellPrice * marketIdx(s, sp.id);
  if (pr.cultivar) v *= 1.4;
  // Late-game price bonuses must not turn "buy it, sell it straight back" into free money.
  if (pr.origin === 'purchase') v = Math.min(v, sp.baseValue * (SHOP_UNIT[pr.kind] ?? 0) * RESALE_LIMIT);
  return v;
}

function bumpIdx(s: GameState, spId: string, factor: number): void {
  s.market.index[spId] = clamp((s.market.index[spId] ?? 1) * factor, 0.45, 1.8);
}

// ---------------------------------------------------------------------------------------------
// Selling
// ---------------------------------------------------------------------------------------------

export function sellPlant(s: GameState, p: Plant): Result {
  if (p.growth < 0.3) return fail('That plant is too young to sell.');
  const v = plantValue(s, p);
  if (p.tags.length) recordSpecimen(s, p, v);
  const fromStock = s.stock.indexOf(p);
  if (fromStock >= 0) s.stock.splice(fromStock, 1);
  else removePlant(s, p);
  earn(s, v);
  s.stats.sold++;
  bumpIdx(s, effectiveSpecies(p.sp, p.hy).id, 0.985);
  return ok(`Sold ${p.name} for $${v.toFixed(2)}.`);
}

export function sellProp(s: GameState, pr: Propagule): Result {
  if (pr.kind === 'seed' && !hasFlag(s, 'seedSales')) return fail('Selling seed needs Commercial Seed Lines.');
  if (pr.kind === 'tissue' && !hasFlag(s, 'sellTissue')) return fail('Selling plantlets needs the Wholesale Liners Programme.');
  const i = s.props.indexOf(pr);
  if (i < 0) return fail('Item not found.');
  const v = propValue(s, pr);
  s.props.splice(i, 1);
  earn(s, v);
  return ok(`Sold for $${v.toFixed(2)}.`);
}

export function harvestToStock(s: GameState, p: Plant): Result {
  if (p.stage !== 'mature') return fail('Only mature plants can be harvested.');
  if (s.stock.length >= stockCap(s)) return fail('Sale stock is full.');
  removePlant(s, p);
  s.stock.push(p);
  addHist(s, p, 'Moved to sale stock');
  return ok(`${p.name} moved to sale stock.`);
}

// ---------------------------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------------------------

export type ShopKind = 'seed' | 'young' | 'cutting' | 'flask';

export function shopOffer(s: GameState, spId: string, kind: ShopKind): { price: number; units: number; available: boolean; why?: string } {
  const sp = SPECIES[spId];
  const bv = sp.baseValue;
  switch (kind) {
    case 'seed':
      return { price: bv * PRICE_SEED, units: SEED_PACK, available: sp.prop.seed > 0.05, why: 'This species rarely sets seed.' };
    case 'young':
      return { price: bv * PRICE_YOUNG, units: 1, available: true };
    case 'cutting': {
      const ok2 = hasFlag(s, 'stemCuttings') && sp.prop.stem > 0;
      return { price: bv * PRICE_CUTTING, units: 1, available: ok2, why: sp.prop.stem > 0 ? 'Needs the Cutting Technique research.' : 'This species cannot be grown from stem cuttings.' };
    }
    case 'flask': {
      const ok2 = hasFlag(s, 'tissueCulture') && sp.prop.tissue > 0;
      return { price: bv * PRICE_FLASK, units: TC_FLASK, available: ok2, why: 'Needs Aseptic Technique research.' };
    }
  }
}

export function makePropagule(s: GameState, spId: string, kind: PropKind, genome = wildGenome(s, SPECIES[spId]), extra: Partial<Propagule> = {}): Propagule {
  return {
    id: uid(s), kind, sp: spId, genome, gen: 0, parents: [null, null], origin: kind, sport: false,
    q: kind === 'seed' ? clamp(0.9 + s.mods.germination, 0, 1) : 1, vigor: 1, ...extra,
  };
}

/** Never let the player soft-lock: with nothing growing and nearly no money, a neighbour sends a few seeds. */
export function rescue(s: GameState): void {
  if (s.money >= 20 || s.plants.length || s.props.length || s.stock.length) return;
  if (Object.values(s.jobs).some((j) => j.length)) return;
  for (let i = 0; i < 3; i++) s.props.push(makePropagule(s, 'philodendron-brasil', 'seed', undefined, { origin: 'gift' }));
  log(s, 'info', 'A neighbour who heard about your troubles dropped off three packets of Philodendron Brasil seed. Start again!');
}

export function buy(s: GameState, spId: string, kind: ShopKind): Result {
  const sp = SPECIES[spId];
  if (!sp || !availableSpecies(s).includes(sp)) return fail('That species is not available yet.');
  const offer = shopOffer(s, spId, kind);
  if (!offer.available) return fail(offer.why ?? 'Not available.');
  const free = propCap(s) - s.props.length;
  if (free < offer.units) return fail('Not enough storage for those items. Plant or sell something first.');
  if (!spend(s, offer.price)) return fail(`You need $${offer.price.toFixed(2)}.`);
  const propKind: PropKind = kind === 'seed' ? 'seed' : kind === 'young' ? 'young' : kind === 'flask' ? 'tissue' : sp.prop.stem > 0 ? 'stem' : sp.prop.division > 0 ? 'division' : 'leaf';
  for (let i = 0; i < offer.units; i++) s.props.push(makePropagule(s, spId, propKind, wildGenome(s, sp), { origin: 'purchase' }));
  s.seen[spId] = s.seen[spId] ?? 0;
  return ok(`Bought ${offer.units} x ${sp.common[0]} (${kind}) for $${offer.price.toFixed(2)}.`);
}

// ---------------------------------------------------------------------------------------------
// Market dynamics
// ---------------------------------------------------------------------------------------------

const BUYERS = ['Harlow & Sons Nursery', 'The Fern Society', 'Maya Okafor, Collector', 'Greenhouse Weekly', 'Kew-Tillery Botanicals', 'Oliver Park, Hobbyist', 'Verdant Co-operative', 'Lena Vogel, Plant Stylist', 'Atlas Garden Centres', 'Dr. Mireille Aubert'];

export function tickMarket(s: GameState, dt: number): void {
  const m = s.market;
  const rec = 1 - Math.exp(-dt * 0.004);
  for (const sp of availableSpecies(s)) {
    const cur = m.index[sp.id] ?? 1;
    m.index[sp.id] = clamp(cur + (1 - cur) * rec + gauss(s) * 0.0025 * Math.sqrt(Math.min(dt, 30)), 0.45, 1.8);
  }
  // expire events
  m.events = m.events.filter((e) => e.until > s.time);
  if (s.time >= m.nextEvent) {
    m.nextEvent = s.time + range(s, 240, 480);
    const av = availableSpecies(s);
    if (av.length && m.events.length < 4) {
      const all = chance(s, 0.12);
      const seen = av.filter((x) => (s.seen[x.id] ?? 0) > 0);
      const sp = pick(s, seen.length && chance(s, 0.7) ? seen : av);
      const up = chance(s, 0.6);
      const mag = up ? range(s, 1.2, 1.55) : range(s, 0.72, 0.88);
      const msg = all
        ? up ? 'Garden show season: demand is up across the board.' : 'A quiet market week: prices are soft.'
        : up ? `Collectors are chasing ${sp.common[0]} (+${Math.round((mag - 1) * 100)}%).` : `Oversupply of ${sp.common[0]} (${Math.round((mag - 1) * 100)}%).`;
      m.events.push({ id: uid(s), t: s.time, until: s.time + range(s, 240, 420), sp: all ? 'all' : sp.id, mag: all ? 1 + (mag - 1) * 0.5 : mag, msg });
      log(s, up ? 'good' : 'info', msg);
    }
  }
  // sparkline history
  if (Math.floor(s.time / 15) !== Math.floor((s.time - dt) / 15)) {
    for (const sp of availableSpecies(s)) {
      const h = (m.hist[sp.id] ??= []);
      h.push(Math.round(marketIdx(s, sp.id) * 1000) / 1000);
      if (h.length > 40) h.shift();
    }
  }
  // contracts
  m.contracts = m.contracts.filter((c) => c.expires > s.time);
  if (hasFlag(s, 'contracts') && m.contracts.length < s.mods.contractSlots && s.time >= m.nextContract) {
    m.nextContract = s.time + range(s, 60, 150);
    const c = genContract(s);
    if (c) {
      m.contracts.push(c);
      log(s, 'info', `New commission from ${c.buyer}: ${speciesName(c.sp)}.`);
    }
  }
}

const VIS_GENES = ['leafSize', 'leafShape', 'leafColour', 'variegation'] as const;

export function genContract(s: GameState): Contract | null {
  const av = availableSpecies(s).filter((sp) => sp.rarity <= Math.min(5, s.stage));
  if (!av.length) return null;
  const sp = pick(s, av);
  const reqs: ContractReq[] = [];
  const n = 1 + (chance(s, 0.35) ? 1 : 0) + (s.stage >= 4 && chance(s, 0.25) ? 1 : 0);
  const used = new Set<string>();
  let diff = 0;
  for (let i = 0; i < n; i++) {
    if (s.stage >= 3 && chance(s, 0.22)) {
      const disc = Object.keys(DISC_BY_ID).filter((id) => !id.startsWith('hidden_') && DISC_BY_ID[id].needs === 0);
      const tag = pick(s, disc);
      if (!used.has(tag)) {
        used.add(tag);
        reqs.push({ kind: 'tag', tag });
        diff += 0.3 + DISC_BY_ID[tag].value * 0.2;
        continue;
      }
    }
    const gene = pick(s, VIS_GENES);
    if (used.has(gene)) continue;
    used.add(gene);
    const min = gene === 'variegation' ? range(s, 0.45, 0.7) : range(s, 0.6, 0.82);
    reqs.push({ kind: 'gene', gene, min: Math.round(min * 100) / 100 });
    diff += (min - 0.45) * 2.4;
  }
  if (!reqs.length) return null;
  const mult = 1.8 + reqs.length * 0.9 + diff;
  const reward = Math.round(sp.baseValue * mult * s.mods.sellPrice * repMult(s));
  return {
    id: uid(s), sp: sp.id, buyer: pick(s, BUYERS), reqs, reward,
    rp: Math.round(4 * sp.rarity * (1 + reqs.length) * (1 + diff)), rep: 1 + Math.floor(diff), expires: s.time + range(s, 900, 1500),
  };
}

export function matchesContract(c: Contract, p: Plant): boolean {
  if (p.sp !== c.sp || p.hy) return false;
  if (p.stage !== 'mature' || p.health < 50) return false;
  const ph = phenoOf(p);
  return c.reqs.every((r) => (r.kind === 'gene' ? ph[r.gene] >= r.min : r.kind === 'tag' ? p.tags.includes(r.tag) : !!p.hy));
}

export function fulfillContract(s: GameState, contractId: number, plantId: number): Result {
  const c = s.market.contracts.find((x) => x.id === contractId);
  const p = getPlant(s, plantId);
  if (!c || !p) return fail('Commission or plant not found.');
  if (!matchesContract(c, p)) return fail('That plant does not meet the commission requirements.');
  if (s.stock.includes(p)) s.stock.splice(s.stock.indexOf(p), 1);
  else removePlant(s, p);
  if (p.tags.length) recordSpecimen(s, p, c.reward);
  earn(s, c.reward);
  addRp(s, c.rp);
  s.market.rep += c.rep;
  s.market.contracts = s.market.contracts.filter((x) => x.id !== c.id);
  s.stats.contracts++;
  log(s, 'good', `Commission complete for ${c.buyer}: +$${c.reward.toLocaleString()}, +${c.rp} RP, +${c.rep} reputation.`);
  return ok(`Commission delivered for $${c.reward.toLocaleString()}.`);
}

export function describeReq(r: ContractReq): string {
  if (r.kind === 'gene') return `${r.gene.replace(/([A-Z])/g, ' $1').toLowerCase()} >= ${Math.round(r.min * 100)}%`;
  if (r.kind === 'tag') return DISC_BY_ID[r.tag]?.name ?? r.tag;
  return 'hybrid';
}

// ---------------------------------------------------------------------------------------------
// Cultivars
// ---------------------------------------------------------------------------------------------

export function cultivarCost(s: GameState, p: Plant): number {
  const sp = effectiveSpecies(p.sp, p.hy);
  return Math.round(plantValue(s, p) * 0.6 + 150 * sp.rarity);
}

/** A species can carry only a few registered lines, and each trait line can be registered once. */
export const CULTIVARS_PER_SPECIES = 3;
/** Royalty per second as a share of (base value x trait bonus): about a quarter of a plant's worth per hour. */
export const ROYALTY_SHARE = 0.25 / 3600;

const topTag = (tags: string[]): string => [...tags].sort((a, b) => (DISC_BY_ID[b]?.value ?? 0) - (DISC_BY_ID[a]?.value ?? 0) || a.localeCompare(b))[0] ?? '';
export const cultivarLine = (c: { sp: string; hy?: string; tags: string[] }): string => `${c.sp}|${c.hy ?? ''}|${topTag(c.tags)}`;

export function registerCultivar(s: GameState, plantId: number, name: string): Result {
  const p = getPlant(s, plantId);
  if (!p) return fail('Plant not found.');
  if (!hasFlag(s, 'cultivars')) return fail('Requires Cultivar Registration research.');
  if (p.cultivar) return fail('Already a registered cultivar.');
  if (p.stage !== 'mature') return fail('Only mature plants can be registered.');
  if (!p.tags.length) return fail('A cultivar needs at least one discovery.');
  if (p.analysis < 1) return fail('Analyse the plant first so it can be documented.');
  const sp = effectiveSpecies(p.sp, p.hy);
  const line = cultivarLine(p);
  if (s.cultivars.some((c) => cultivarLine(c) === line)) return fail('This trait line is already registered for the species.');
  if (s.cultivars.filter((c) => c.sp === p.sp && c.hy === p.hy).length >= CULTIVARS_PER_SPECIES) return fail(`${sp.common[0]} already has ${CULTIVARS_PER_SPECIES} registered cultivars.`);
  const cost = cultivarCost(s, p);
  if (!spend(s, cost)) return fail(`Registration costs $${cost.toLocaleString()}.`);
  const id = `cv_${uid(s)}`;
  const clean = name.trim() || `${DISC_BY_ID[p.tags[0]]?.name ?? 'Select'} ${sp.common[0]}`;
  const royalty = sp.baseValue * (1 + tagBonus(p)) * ROYALTY_SHARE;
  s.cultivars.push({ id, name: clean, sp: p.sp, hy: p.hy, tags: [...p.tags], t: s.time, royalty, rarity: sp.rarity });
  p.cultivar = id;
  p.name = clean;
  addHist(s, p, `Registered as cultivar "${clean}"`);
  log(s, 'good', `Registered cultivar "${clean}". It will now earn royalties.`);
  return ok(`Registered "${clean}".`);
}

export function royaltyRate(s: GameState): number {
  let r = 0;
  for (const c of s.cultivars) r += c.royalty;
  return r * s.mods.royalty;
}

export function tickRoyalties(s: GameState, dt: number): void {
  const r = royaltyRate(s) * dt;
  if (r > 0) earn(s, r);
}

