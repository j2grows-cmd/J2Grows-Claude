// Genetic discoveries. A discovery is credited per (discovery, species) pair, so every species
// has its own codex to fill. Each plant also carries the discovery ids it qualifies for as tags.

import { GENE_IDS, type GeneId, type Genome, type Plant } from './types';
import { heterozygosity, hiddenIndex, type Pheno } from './genetics';
import { SPECIES } from './species';

export type DiscCat = 'Morphology' | 'Physiology' | 'Resilience' | 'Lineage' | 'Composite' | 'Origin' | 'Hidden alleles';

export interface DiscCtx {
  p: Pheno;
  genome: Genome;
  plant: Plant;
}
export interface DiscoveryDef {
  id: string;
  name: string;
  desc: string;
  cat: DiscCat;
  needs: 0 | 1 | 2; // analysis level required before it can be credited
  rp: number; // base research points
  value: number; // market value bonus for plants carrying the tag
  test: (c: DiscCtx) => boolean;
}

const VISIBLE: GeneId[] = ['leafSize', 'leafShape', 'leafColour', 'variegation'];
const geneCat = (g: GeneId): DiscCat => {
  if (['leafSize', 'leafShape', 'leafColour', 'variegation'].includes(g)) return 'Morphology';
  if (['envTolerance', 'diseaseResistance'].includes(g)) return 'Resilience';
  if (['propagationEfficiency', 'mutationPotential'].includes(g)) return 'Lineage';
  return 'Physiology';
};

interface Ladder {
  gene: GeneId;
  hi?: [string, string];
  lo?: [string, string];
}
const LADDERS: Ladder[] = [
  { gene: 'growthRate', hi: ['Vigorous Strain', 'Hyper-Growth Strain'], lo: ['Slow Habit', 'Dwarfing Habit'] },
  { gene: 'leafSize', hi: ['Large-Leaved Form', 'Giant Form'], lo: ['Compact Form', 'Miniature Form'] },
  { gene: 'leafShape', hi: ['Lobed Form', 'Dissected Form'], lo: ['Simple Form', 'Entire-Leaved Extreme'] },
  { gene: 'leafColour', hi: ['Bronzed Hue', 'Chromatic Anomaly'], lo: ['Lime Form', 'Neon Lime Form'] },
  { gene: 'rootDevelopment', hi: ['Robust Rooter', 'Hyper-Rooting'] },
  { gene: 'envTolerance', hi: ['Hardy Strain', 'Extremophile Strain'] },
  { gene: 'waterReq', hi: ['Thirsty Strain', 'Hydrophile'], lo: ['Drought-Hardy Strain', 'Xeric Adapted'] },
  { gene: 'nutrientReq', hi: ['Hungry Feeder', 'Heavy Feeder'], lo: ['Thrifty Feeder', 'Oligotrophic Strain'] },
  { gene: 'diseaseResistance', hi: ['Resistant Strain', 'Ironclad Strain'] },
  { gene: 'propagationEfficiency', hi: ['Eager Propagator', 'Prolific Propagator'] },
  { gene: 'mutationPotential', hi: ['Unstable Genome', 'Mutator Strain'], lo: ['Stable Genome', 'Locked Genome'] },
];

const defs: DiscoveryDef[] = [];

for (const L of LADDERS) {
  const g = L.gene;
  const needs = VISIBLE.includes(g) ? 0 : 1;
  const meta = geneCat(g);
  const thresholds = [
    { hi: 0.78, lo: 0.22, rp: 6, value: 0.12 },
    { hi: 0.9, lo: 0.1, rp: 20, value: 0.4 },
  ];
  if (L.hi)
    L.hi.forEach((name, i) =>
      defs.push({ id: `${g}_hi${i + 1}`, name, desc: `${GENE_LABEL(g)} expressed at ${(thresholds[i].hi * 100).toFixed(0)}% or above.`, cat: meta, needs, rp: thresholds[i].rp, value: thresholds[i].value, test: (c) => c.p[g] >= thresholds[i].hi }),
    );
  if (L.lo)
    L.lo.forEach((name, i) =>
      defs.push({ id: `${g}_lo${i + 1}`, name, desc: `${GENE_LABEL(g)} expressed at ${(thresholds[i].lo * 100).toFixed(0)}% or below.`, cat: meta, needs, rp: thresholds[i].rp, value: thresholds[i].value * 0.8, test: (c) => c.p[g] <= thresholds[i].lo }),
    );
}
function GENE_LABEL(g: GeneId): string {
  return g.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

// Variegation tiers -------------------------------------------------------------------------
[
  ['Faint Variegation', 0.45, 8, 0.35],
  ['Marbled Variegation', 0.65, 25, 0.9],
  ['Strong Variegation', 0.8, 70, 2.2],
  ['Exceptional Variegation', 0.92, 200, 5],
].forEach(([name, t, rp, value], i) => {
  defs.push({ id: `variegation_t${i + 1}`, name: name as string, desc: `Variegation expressed at ${Math.round((t as number) * 100)}% or above.`, cat: 'Morphology', needs: 0, rp: rp as number, value: value as number, test: (c) => c.p.variegation >= (t as number) });
});

// Composites --------------------------------------------------------------------------------
const comp = (id: string, name: string, desc: string, needs: 0 | 1, rp: number, value: number, test: (c: DiscCtx) => boolean) =>
  defs.push({ id, name, desc, cat: 'Composite', needs, rp, value, test });
comp('giant_variegated', 'Giant Variegated Form', 'Large leaves (85%+) with marbled or stronger variegation.', 0, 120, 3, (c) => c.p.leafSize >= 0.85 && c.p.variegation >= 0.65);
comp('miniature_variegated', 'Miniature Variegated Form', 'Compact leaves (20% or less) with marbled or stronger variegation.', 0, 110, 2.6, (c) => c.p.leafSize <= 0.2 && c.p.variegation >= 0.65);
comp('fenestrated_giant', 'Giant Fenestrated Form', 'Large leaves with heavily dissected blades.', 0, 100, 2.2, (c) => c.p.leafShape >= 0.85 && c.p.leafSize >= 0.85);
comp('rainbow_chimera', 'Rainbow Chimera', 'Strong variegation combined with a vivid exotic hue.', 0, 180, 4, (c) => c.p.variegation >= 0.8 && c.p.leafColour >= 0.8);
comp('living_jewel', 'Living Jewel', 'An exotic hue, dissected leaves and substantial size.', 0, 90, 1.8, (c) => c.p.leafColour >= 0.9 && c.p.leafShape >= 0.7 && c.p.leafSize >= 0.6);
comp('triple_threat', 'Triple Threat', 'Giant, deeply dissected and strongly variegated at once.', 0, 400, 8, (c) => c.p.leafSize >= 0.85 && c.p.leafShape >= 0.8 && c.p.variegation >= 0.65);
comp('ironclad_giant', 'Ironclad Giant', 'Giant, vigorous and highly disease resistant.', 1, 150, 2.5, (c) => c.p.diseaseResistance >= 0.85 && c.p.leafSize >= 0.85 && c.p.growthRate >= 0.85);
comp('hardy_prolific', 'Hardy Prolific Line', 'Tolerant, vigorous and a prolific propagator.', 1, 80, 1.4, (c) => c.p.envTolerance >= 0.85 && c.p.propagationEfficiency >= 0.85 && c.p.growthRate >= 0.75);
comp('efficient_machine', 'Efficient Machine', 'Fast-growing yet frugal with water and nutrients.', 1, 90, 1.6, (c) => c.p.waterReq <= 0.2 && c.p.nutrientReq <= 0.2 && c.p.growthRate >= 0.7);
comp('perfect_specimen', 'Perfect Specimen', 'Every one of the twelve genes expressed at 72% or better.', 1, 600, 10, (c) => GENE_IDS.every((g) => c.p[g] >= 0.72));

// Origin ------------------------------------------------------------------------------------
const orig = (id: string, name: string, desc: string, needs: 0 | 1 | 2, rp: number, value: number, test: (c: DiscCtx) => boolean) =>
  defs.push({ id, name, desc, cat: 'Origin', needs, rp, value, test });
orig('bud_sport', 'Spontaneous Sport', 'A plant that arose as a vegetative mutation.', 0, 40, 0.6, (c) => c.plant.sport);
orig('novel_hybrid', 'Novel Hybrid', 'The first hybrid between two species.', 0, 60, 0.8, (c) => !!c.plant.hy);
orig('intergeneric_hybrid', 'Intergeneric Hybrid', 'A cross between two different genera.', 0, 300, 3, (c) => !!c.plant.hy && SPECIES[c.plant.sp].genus !== SPECIES[c.plant.hy].genus);
orig('hybrid_vigor', 'Hybrid Vigour', 'A hybrid showing marked heterosis.', 0, 80, 1, (c) => !!c.plant.hy && c.plant.vigor >= 1.1);
orig('stable_line', 'Stable Line', 'Five generations of selection with a stable genome.', 1, 100, 1.2, (c) => c.plant.gen >= 5 && c.p.mutationPotential <= 0.25);
orig('true_breeding', 'True-Breeding Line', 'A near-homozygous line after repeated selection.', 2, 120, 1.5, (c) => c.plant.gen >= 3 && heterozygosity(c.genome) <= 0.1);

// Hidden alleles ----------------------------------------------------------------------------
for (const g of GENE_IDS) {
  defs.push({
    id: `hidden_${g}`,
    name: `Cryptic ${GENE_LABEL(g)} Allele`,
    desc: `A carrier hiding a strongly divergent ${GENE_LABEL(g).toLowerCase()} allele behind a dominant partner.`,
    cat: 'Hidden alleles',
    needs: 2,
    rp: 25,
    value: 0.15,
    test: (c) => {
      const idx = hiddenIndex(c.genome[g]);
      if (idx < 0) return false;
      const v = c.genome[g][idx].v;
      return v >= 0.8 || v <= 0.15;
    },
  });
}

export const DISCOVERIES: DiscoveryDef[] = defs;
export const DISC_BY_ID: Record<string, DiscoveryDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

export function qualifying(plant: Plant, p: Pheno): DiscoveryDef[] {
  const out: DiscoveryDef[] = [];
  const ctx: DiscCtx = { p, genome: plant.genome, plant };
  for (const d of DISCOVERIES) {
    if (d.needs > plant.analysis) continue;
    if (d.test(ctx)) out.push(d);
  }
  return out;
}

export const discKey = (id: string, sp: string): string => `${id}|${sp}`;
