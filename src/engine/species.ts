// Botanical database: the 99 aroids (Alocasia, Anthurium, Monstera, Philodendron) of the collection.
// Numbers are game-scaled but ordered realistically (velvet cloud-forest species are fussy, tough heartleaf
// climbers are forgiving). The rows themselves live in aroids.ts.

import type { GeneId, MediumId } from './types';
import { ARCHS, PACING, ROWS, UNLOCKS, type Row } from './aroids';

export type LeafForm =
  | 'heart' | 'split' | 'oval' | 'lance' | 'paddle' | 'peltate' | 'strap'
  | 'round' | 'fleshy' | 'pinnate' | 'frond' | 'spike' | 'pitcher';
export type Habit = 'climber' | 'upright' | 'rosette' | 'trailing' | 'clump' | 'epiphyte';
export type Pair = [number, number];

export interface Env {
  light: Pair; // effective light 0..100 (intensity x photoperiod/12)
  temp: Pair; // ideal band, deg C
  lethal: Pair; // survivable limits
  rh: Pair; // relative humidity %
  air: Pair; // airflow %
  dryBack: number; // hydration % below which the plant is thirsty
  wetCap: number; // hydration % above which roots suffer
  waterSec: number; // seconds for 100 -> 0 hydration at standard conditions
  nutrient: Pair; // ideal nutrient band
  hungry: number; // nutrient consumption multiplier
  media: Partial<Record<MediumId, number>>;
}

export interface PropSuccess {
  seed: number;
  stem: number;
  leaf: number;
  division: number;
  clone: number;
  tissue: number;
}

export interface Species {
  id: string;
  sci: string;
  genus: string;
  epithet: string;
  family: string;
  common: string[];
  region: string;
  habitat: string;
  notes: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  unlock: { stage: number; tech?: string; expedition?: string; legacy?: boolean };
  baseValue: number;
  growSec: number;
  habit: Habit;
  leaf: LeafForm;
  env: Env;
  prop: PropSuccess;
  traits: Partial<Record<GeneId, { mean: number; sd: number }>>;
  palette: [string, string, string, string];
  exotic: string;
  seedMult: number;
  hybrid?: [string, string];
}

export const SHAPE_LABELS: Record<LeafForm, string[]> = {
  heart: ['Narrow Heart', 'Heart-shaped', 'Broad Heart', 'Deeply Cordate', 'Lobed Cordate'],
  split: ['Entire Juvenile', 'Notched', 'Pinnate Split', 'Fenestrated', 'Deeply Fenestrated'],
  oval: ['Narrow Oval', 'Oval', 'Broad Oval', 'Rounded', 'Obovate'],
  lance: ['Needle-like', 'Narrow Lance', 'Lanceolate', 'Broad Lance', 'Sword-like'],
  paddle: ['Narrow Paddle', 'Paddle', 'Violin-shaped', 'Broad Violin', 'Fiddle-lobed'],
  peltate: ['Narrow Shield', 'Shield', 'Broad Shield', 'Ruffled Shield', 'Sinuate Shield'],
  strap: ['Short Sword', 'Standard Blade', 'Tall Blade', 'Twisted Blade', 'Cylindrical Spear'],
  round: ['Oval-round', 'Round', 'Coin-like', 'Broad Disc', 'Cupped Disc'],
  fleshy: ['Narrow Rosette', 'Compact Rosette', 'Open Rosette', 'Ruffled Rosette', 'Crested Rosette'],
  pinnate: ['Few Leaflets', 'Standard Pinnate', 'Dense Pinnate', 'Arching', 'Drooping Plume'],
  frond: ['Entire Fronds', 'Forked Fronds', 'Antlered Fronds', 'Deeply Divided', 'Lacy Fronds'],
  spike: ['Short Spike', 'Narrow Rosette', 'Curled Rosette', 'Twisted', 'Corkscrew Rosette'],
  pitcher: ['Narrow Pitcher', 'Standard Pitcher', 'Flared Pitcher', 'Large Pitcher', 'Giant Pitcher'],
};

export const VARIEGATION_HUES = ['#f4f0dd', '#f2d96a', '#f1a3b8'];

// ---------------------------------------------------------------------------------------------
// The 99 species (data in aroids.ts; each id is also the folder of its hero artwork)
// ---------------------------------------------------------------------------------------------

function build(r: Row): Species {
  const a = ARCHS[r.arch];
  const g = r.id.split('-')[0];
  const genus = g[0].toUpperCase() + g.slice(1);
  const epithet = r.sci.slice(genus.length + 1).replace(/^× /, '');
  return {
    id: r.id, sci: r.sci, genus, epithet, family: 'Araceae', common: r.common, region: r.region, habitat: a.habitat,
    notes: r.notes, rarity: r.rarity, unlock: UNLOCKS[r.unlock], baseValue: Math.round(r.value * (PACING[r.rarity] ?? 1)), growSec: r.growSec,
    habit: r.habit ?? a.habit, leaf: r.leaf, env: a.env, prop: { ...a.prop, ...r.prop }, traits: r.traits ?? {},
    palette: r.palette ?? a.palette, exotic: r.exotic, seedMult: r.seedMult ?? 1,
  };
}

export const SPECIES_LIST: Species[] = ROWS.map(build);
export const SPECIES: Record<string, Species> = Object.fromEntries(SPECIES_LIST.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------------------------
// Hybrids: a blended virtual species, cached by pair key
// ---------------------------------------------------------------------------------------------

const hybridCache: Record<string, Species> = {};
const avg = (a: number, b: number) => (a + b) / 2;
const avgPair = (a: Pair, b: Pair): Pair => [avg(a[0], b[0]), avg(a[1], b[1])];

export function effectiveSpecies(sp: string, hy?: string): Species {
  if (!hy) return SPECIES[sp];
  const key = `${sp}x${hy}`;
  if (hybridCache[key]) return hybridCache[key];
  const a = SPECIES[sp];
  const b = SPECIES[hy];
  const media: Partial<Record<MediumId, number>> = {};
  (Object.keys({ ...a.env.media, ...b.env.media }) as MediumId[]).forEach((m) => {
    media[m] = avg(a.env.media[m] ?? 0.4, b.env.media[m] ?? 0.4);
  });
  const h: Species = {
    ...a,
    id: key,
    sci: `${a.genus} ${a.epithet} × ${b.genus === a.genus ? b.genus[0] + '.' : b.genus} ${b.epithet}`,
    common: [`${a.common[0]} × ${b.common[0]}`],
    rarity: Math.min(5, Math.max(a.rarity, b.rarity)) as Species['rarity'],
    baseValue: Math.sqrt(a.baseValue * b.baseValue) * 1.3,
    growSec: avg(a.growSec, b.growSec),
    env: {
      light: avgPair(a.env.light, b.env.light),
      temp: avgPair(a.env.temp, b.env.temp),
      lethal: avgPair(a.env.lethal, b.env.lethal),
      rh: avgPair(a.env.rh, b.env.rh),
      air: avgPair(a.env.air, b.env.air),
      dryBack: avg(a.env.dryBack, b.env.dryBack),
      wetCap: avg(a.env.wetCap, b.env.wetCap),
      waterSec: avg(a.env.waterSec, b.env.waterSec),
      nutrient: avgPair(a.env.nutrient, b.env.nutrient),
      hungry: avg(a.env.hungry, b.env.hungry),
      media,
    },
    prop: {
      seed: avg(a.prop.seed, b.prop.seed),
      stem: Math.max(a.prop.stem, b.prop.stem) * 0.9,
      leaf: Math.max(a.prop.leaf, b.prop.leaf) * 0.9,
      division: Math.max(a.prop.division, b.prop.division) * 0.9,
      clone: avg(a.prop.clone, b.prop.clone),
      tissue: avg(a.prop.tissue, b.prop.tissue),
    },
    palette: a.palette,
    hybrid: [sp, hy],
    notes: `Interspecific hybrid of ${a.sci} and ${b.sci}.`,
    region: `${a.region} / ${b.region}`,
    habitat: 'Cultivated hybrid.',
  };
  hybridCache[key] = h;
  return h;
}

export type Compat = 'same' | 'congeneric' | 'intergeneric' | 'none';
export function compat(a: string, b: string): Compat {
  if (a === b) return 'same';
  const A = SPECIES[a];
  const B = SPECIES[b];
  if (!A || !B) return 'none';
  if (A.genus === B.genus) return 'congeneric';
  if (A.family === B.family) return 'intergeneric';
  return 'none';
}

export const speciesName = (sp: string, hy?: string): string => effectiveSpecies(sp, hy).common[0];
export const speciesSci = (sp: string, hy?: string): string => effectiveSpecies(sp, hy).sci;
