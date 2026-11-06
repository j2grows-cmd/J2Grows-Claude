// Genetics: diploid genomes with value+dominance alleles, recombination, mutation and phenotype.

import { GENE_IDS, type Allele, type Gene, type GeneId, type Genome } from './types';
import { SHAPE_LABELS, VARIEGATION_HUES, type Species } from './species';
import { chance, clamp, gauss, pick, rand, range, round, type Rng } from './util';

export interface GeneMeta {
  id: GeneId;
  name: string;
  group: 'Morphology' | 'Physiology' | 'Resilience' | 'Lineage';
  desc: string;
  low: string;
  high: string;
}

export const GENES: Record<GeneId, GeneMeta> = {
  growthRate: { id: 'growthRate', name: 'Growth Rate', group: 'Physiology', desc: 'How quickly the plant converts light and nutrients into biomass.', low: 'Sluggish', high: 'Vigorous' },
  leafSize: { id: 'leafSize', name: 'Maximum Leaf Size', group: 'Morphology', desc: 'Upper bound on leaf area at maturity. Extremes give giant or miniature forms.', low: 'Miniature', high: 'Giant' },
  leafShape: { id: 'leafShape', name: 'Leaf Shape', group: 'Morphology', desc: 'Form of the leaf blade: lobing, fenestration and dissection.', low: 'Entire', high: 'Dissected' },
  leafColour: { id: 'leafColour', name: 'Leaf Colour', group: 'Morphology', desc: 'Pigment balance from pale lime through deep green to exotic hues.', low: 'Pale', high: 'Exotic hue' },
  variegation: { id: 'variegation', name: 'Variegation', group: 'Morphology', desc: 'Chlorophyll-deficient patches. Beautiful, valuable, and slower to grow.', low: 'Solid green', high: 'Heavily variegated' },
  rootDevelopment: { id: 'rootDevelopment', name: 'Root Development', group: 'Physiology', desc: 'Root mass and recovery speed; helps with drought and waterlogging.', low: 'Shallow', high: 'Robust' },
  envTolerance: { id: 'envTolerance', name: 'Environmental Tolerance', group: 'Resilience', desc: 'Width of the comfortable temperature, humidity and light window.', low: 'Fussy', high: 'Hardy' },
  waterReq: { id: 'waterReq', name: 'Water Requirement', group: 'Physiology', desc: 'How fast the plant dries its substrate. Low = drought hardy.', low: 'Drought hardy', high: 'Thirsty' },
  nutrientReq: { id: 'nutrientReq', name: 'Nutrient Requirement', group: 'Physiology', desc: 'Appetite for fertiliser. Low = thrifty.', low: 'Thrifty', high: 'Hungry' },
  diseaseResistance: { id: 'diseaseResistance', name: 'Disease Resistance', group: 'Resilience', desc: 'Resistance to fungal, pest and rot infections.', low: 'Susceptible', high: 'Ironclad' },
  propagationEfficiency: { id: 'propagationEfficiency', name: 'Propagation Efficiency', group: 'Lineage', desc: 'Success and speed when cuttings, divisions, seed or tissue are taken.', low: 'Reluctant', high: 'Prolific' },
  mutationPotential: { id: 'mutationPotential', name: 'Mutation Potential', group: 'Lineage', desc: 'Genomic instability. Raises the chance of novel alleles and sports.', low: 'Stable', high: 'Unstable' },
};

export const BASE_MUT = 0.02;

/** Show traits are the most mutable, so variegation and colour sports appear at a satisfying rate. */
export const MUT_WEIGHT: Record<GeneId, number> = {
  growthRate: 1, leafSize: 1.4, leafShape: 1.4, leafColour: 1.8, variegation: 2.5, rootDevelopment: 1, envTolerance: 1,
  waterReq: 1, nutrientReq: 1, diseaseResistance: 1, propagationEfficiency: 1, mutationPotential: 1,
};
const MUT_TOTAL = (Object.values(MUT_WEIGHT) as number[]).reduce((a, b) => a + b, 0);

const r3 = (x: number) => round(x, 3);
const allele = (v: number, d: number): Allele => ({ v: r3(clamp(v)), d: r3(clamp(d)) });

export function geneDefaults(sp: Species, g: GeneId): { mean: number; sd: number } {
  const t = sp.traits[g];
  if (t) return t;
  if (g === 'variegation') return { mean: 0.08, sd: 0.09 };
  if (g === 'mutationPotential') return { mean: 0.4, sd: 0.12 };
  return { mean: 0.5, sd: 0.13 };
}

/** A wild-type genome for a species. Alleles scatter around the species mean with random dominance. */
export function wildGenome(h: Rng, sp: Species): Genome {
  const out = {} as Genome;
  for (const g of GENE_IDS) {
    const { mean, sd } = geneDefaults(sp, g);
    const mk = (): Allele => {
      const v = mean + sd * gauss(h);
      // Wild-type variegation alleles are normally dominant-green; rarer variants arrive via mutation.
      const d = g === 'variegation' ? range(h, 0.5, 1) : rand(h);
      return allele(v, d);
    };
    out[g] = [mk(), mk()];
  }
  return out;
}

/** Complete dominance when the dominance gap is large, otherwise a dominance-weighted blend. */
export function express(g: Gene): number {
  const [a, b] = g;
  const diff = a.d - b.d;
  if (Math.abs(diff) >= 0.3) return diff > 0 ? a.v : b.v;
  const wa = a.d + 0.05;
  const wb = b.d + 0.05;
  return (a.v * wa + b.v * wb) / (wa + wb);
}

export type Pheno = Record<GeneId, number>;
export function phenotype(genome: Genome): Pheno {
  const out = {} as Pheno;
  for (const g of GENE_IDS) out[g] = express(genome[g]);
  return out;
}

/** The index (0/1) of the allele that is masked, or -1 when the gene shows no hidden variation. */
export function hiddenIndex(g: Gene): number {
  const [a, b] = g;
  const diff = a.d - b.d;
  if (Math.abs(diff) < 0.3) return -1;
  const dominant = diff > 0 ? a : b;
  const recessive = diff > 0 ? b : a;
  if (Math.abs(dominant.v - recessive.v) < 0.25) return -1;
  return diff > 0 ? 1 : 0;
}
export const isHiddenCarrier = (g: Gene): boolean => hiddenIndex(g) >= 0;

export function heterozygosity(genome: Genome): number {
  let n = 0;
  for (const g of GENE_IDS) {
    const [a, b] = genome[g];
    if (Math.abs(a.v - b.v) > 0.12 || Math.abs(a.d - b.d) > 0.3) n++;
  }
  return n / GENE_IDS.length;
}

export const copyGenome = (g: Genome): Genome => {
  const out = {} as Genome;
  for (const id of GENE_IDS) out[id] = [{ ...g[id][0] }, { ...g[id][1] }];
  return out;
};

// ---------------------------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------------------------

export interface MutParams {
  rate: number; // multiplier on BASE_MUT
  novel: number; // multiplier on novel-allele share
}
export type MutKind = 'drift' | 'jump' | 'novel';
export interface MutEvent {
  gene: GeneId;
  kind: MutKind;
}

function applyMutation(h: Rng, a: Allele, kind: MutKind): Allele {
  if (kind === 'drift') return allele(a.v + 0.1 * gauss(h), a.d + 0.04 * gauss(h));
  if (kind === 'jump') return allele(a.v + 0.33 * gauss(h), a.d + 0.12 * gauss(h));
  // novel: an extreme value on a recessive background, so it hides until paired.
  const high = chance(h, 0.6);
  return allele(high ? range(h, 0.82, 1) : range(h, 0, 0.1), range(h, 0, 0.22));
}

export function mutateAllele(h: Rng, a: Allele, mp: MutParams, gene: GeneId, events?: MutEvent[]): Allele {
  if (!chance(h, clamp(BASE_MUT * mp.rate * MUT_WEIGHT[gene], 0, 0.5))) return a;
  const r = rand(h);
  const novelShare = clamp(0.05 * mp.novel, 0, 0.5);
  const kind: MutKind = r < novelShare ? 'novel' : r < novelShare + 0.24 ? 'jump' : 'drift';
  events?.push({ gene, kind });
  return applyMutation(h, a, kind);
}

/** Meiosis + fertilisation: one random allele from each parent, each subject to mutation. */
export function recombine(h: Rng, a: Genome, b: Genome, mp: MutParams): { genome: Genome; events: MutEvent[] } {
  const events: MutEvent[] = [];
  const genome = {} as Genome;
  for (const g of GENE_IDS) {
    const fromA = { ...pick(h, a[g]) };
    const fromB = { ...pick(h, b[g]) };
    const x = mutateAllele(h, fromA, mp, g, events);
    const y = mutateAllele(h, fromB, mp, g, events);
    genome[g] = chance(h, 0.5) ? [x, y] : [y, x];
  }
  return { genome, events };
}

/** Vegetative copy. With small probability the copy is a bud sport / somaclonal variant. */
export function cloneGenome(h: Rng, src: Genome, sportChance: number, mp: MutParams): { genome: Genome; sport: boolean; events: MutEvent[] } {
  const genome = copyGenome(src);
  const events: MutEvent[] = [];
  if (!chance(h, clamp(sportChance, 0, 0.9))) return { genome, sport: false, events };
  const n = chance(h, 0.25) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    let r = rand(h) * MUT_TOTAL;
    let g: GeneId = GENE_IDS[0];
    for (const id of GENE_IDS) {
      r -= MUT_WEIGHT[id];
      if (r <= 0) {
        g = id;
        break;
      }
    }
    const idx = chance(h, 0.5) ? 0 : 1;
    const novelShare = clamp(0.3 * mp.novel, 0, 0.8);
    const kind: MutKind = chance(h, novelShare) ? 'novel' : 'jump';
    events.push({ gene: g, kind });
    genome[g][idx] = applyMutation(h, genome[g][idx], kind);
    // Sports are dominant in the tissue they arise in, which is how a plant can show them at once.
    if (kind === 'novel') genome[g][idx].d = r3(range(h, 0.6, 0.95));
  }
  return { genome, sport: true, events };
}

// ---------------------------------------------------------------------------------------------
// Phenotype helpers
// ---------------------------------------------------------------------------------------------

export const bandIndex = (v: number): number => Math.min(4, Math.floor(v * 5));
export const BAND_NAMES = ['Very low', 'Low', 'Average', 'High', 'Very high'];

export function variegationTier(v: number): 0 | 1 | 2 | 3 | 4 {
  if (v >= 0.92) return 4;
  if (v >= 0.8) return 3;
  if (v >= 0.65) return 2;
  if (v >= 0.45) return 1;
  return 0;
}
export const VAR_TIER_NAMES = ['Solid green', 'Faint flecks', 'Marbled', 'Strong variegation', 'Exceptional (albo-grade)'];
export const PATTERNS = ['Speckled', 'Marbled', 'Splash', 'Sectoral', 'Half-moon'];

function hashGenome(genome: Genome): number {
  let x = 0;
  for (const g of GENE_IDS) x = (x * 31 + Math.floor(genome[g][0].v * 997) + Math.floor(genome[g][1].v * 613)) >>> 0;
  return x;
}

export function patternOf(genome: Genome, tier: number): string {
  if (tier <= 0) return 'None';
  const pool = tier === 1 ? [0, 1] : tier === 2 ? [1, 2] : tier === 3 ? [2, 3] : [3, 4];
  return PATTERNS[pool[hashGenome(genome) % pool.length]];
}

export function variegationHue(colour: number): { hex: string; name: string } {
  if (colour < 0.33) return { hex: VARIEGATION_HUES[0], name: 'Alba (white)' };
  if (colour < 0.66) return { hex: VARIEGATION_HUES[1], name: 'Aurea (yellow)' };
  return { hex: VARIEGATION_HUES[2], name: 'Roseo (pink)' };
}

const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
export function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((c, i) => hex2(c + (pb[i] - c) * t)).join('');
}

export function leafColourHex(sp: Species, v: number): string {
  const p = sp.palette;
  if (v < 0.3) return mixHex(p[0], p[1], v / 0.3);
  if (v < 0.65) return mixHex(p[1], p[2], (v - 0.3) / 0.35);
  return mixHex(p[2], p[3], (v - 0.65) / 0.35);
}

export function colourLabel(sp: Species, v: number): string {
  if (v < 0.25) return 'Pale lime';
  if (v < 0.6) return 'Standard green';
  if (v < 0.85) return 'Deep green';
  return sp.exotic;
}

export function shapeLabel(sp: Species, v: number): string {
  return SHAPE_LABELS[sp.leaf][bandIndex(v)];
}

export function sizeLabel(v: number): string {
  if (v >= 0.9) return 'Giant';
  if (v >= 0.75) return 'Large';
  if (v <= 0.12) return 'Miniature';
  if (v <= 0.25) return 'Compact';
  return 'Typical';
}

// Trait effects used by the growth simulation -------------------------------------------------

export const traitGrowth = (p: Pheno): number => (0.6 + 0.8 * p.growthRate) * (1 - 0.3 * Math.max(0, p.variegation - 0.4));
export const traitRoots = (p: Pheno): number => 0.6 + 0.8 * p.rootDevelopment;
export const traitTolerance = (p: Pheno): number => 0.75 + 0.75 * p.envTolerance;
export const traitWater = (p: Pheno): number => 0.6 + 0.8 * p.waterReq;
export const traitNutrient = (p: Pheno): number => 0.6 + 0.8 * p.nutrientReq;
export const traitDisease = (p: Pheno): number => 1.5 - 1.2 * p.diseaseResistance;
export const traitPropagation = (p: Pheno): number => p.propagationEfficiency;
export const traitMutation = (p: Pheno): number => 0.5 + p.mutationPotential;
