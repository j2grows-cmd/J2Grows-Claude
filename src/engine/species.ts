// Botanical database: real-world species used as the foundation of the simulation.
// Numbers are game-scaled but ordered realistically (light-hungry succulents, humid-loving ferns, etc.).

import type { GeneId, MediumId } from './types';

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
// Archetype presets
// ---------------------------------------------------------------------------------------------

const MEDIA = {
  aroid: { aroidMix: 1, cocoPerlite: 0.85, peatMix: 0.8, leca: 0.8, sphagnum: 0.7, barkMix: 0.65, gritMix: 0.2 },
  succ: { gritMix: 1, aroidMix: 0.7, cocoPerlite: 0.6, barkMix: 0.4, peatMix: 0.35, leca: 0.25, sphagnum: 0.1 },
  humid: { sphagnum: 1, peatMix: 0.9, cocoPerlite: 0.8, aroidMix: 0.75, leca: 0.6, barkMix: 0.5, gritMix: 0.1 },
  epi: { barkMix: 1, sphagnum: 0.8, aroidMix: 0.7, leca: 0.7, cocoPerlite: 0.4, peatMix: 0.25, gritMix: 0.15 },
  carn: { sphagnum: 1, peatMix: 0.7, leca: 0.4, cocoPerlite: 0.3, aroidMix: 0.2, barkMix: 0.2, gritMix: 0.05 },
  air: { barkMix: 0.8, aroidMix: 0.7, leca: 0.7, sphagnum: 0.7, cocoPerlite: 0.6, gritMix: 0.6, peatMix: 0.4 },
  tuber: { aroidMix: 1, gritMix: 0.8, cocoPerlite: 0.8, peatMix: 0.6, leca: 0.6, barkMix: 0.5, sphagnum: 0.3 },
} satisfies Record<string, Partial<Record<MediumId, number>>>;

type EnvOver = Partial<Env>;
const ENV = {
  aroid: (o: EnvOver = {}): Env => ({ light: [40, 70], temp: [19, 29], lethal: [8, 38], rh: [55, 85], air: [20, 60], dryBack: 35, wetCap: 88, waterSec: 420, nutrient: [30, 70], hungry: 1, media: MEDIA.aroid, ...o }),
  succ: (o: EnvOver = {}): Env => ({ light: [60, 95], temp: [15, 30], lethal: [2, 42], rh: [20, 55], air: [30, 80], dryBack: 12, wetCap: 55, waterSec: 1100, nutrient: [15, 45], hungry: 0.6, media: MEDIA.succ, ...o }),
  humid: (o: EnvOver = {}): Env => ({ light: [30, 60], temp: [18, 28], lethal: [6, 36], rh: [65, 90], air: [20, 55], dryBack: 50, wetCap: 95, waterSec: 260, nutrient: [30, 65], hungry: 1.1, media: MEDIA.humid, ...o }),
  epi: (o: EnvOver = {}): Env => ({ light: [45, 70], temp: [20, 30], lethal: [10, 38], rh: [55, 80], air: [35, 75], dryBack: 40, wetCap: 70, waterSec: 400, nutrient: [20, 50], hungry: 0.7, media: MEDIA.epi, ...o }),
  carn: (o: EnvOver = {}): Env => ({ light: [55, 85], temp: [16, 27], lethal: [4, 34], rh: [70, 95], air: [25, 55], dryBack: 55, wetCap: 100, waterSec: 240, nutrient: [5, 25], hungry: 0.3, media: MEDIA.carn, ...o }),
  air: (o: EnvOver = {}): Env => ({ light: [50, 80], temp: [18, 30], lethal: [5, 40], rh: [40, 75], air: [40, 85], dryBack: 30, wetCap: 70, waterSec: 300, nutrient: [10, 35], hungry: 0.4, media: MEDIA.air, ...o }),
  tuber: (o: EnvOver = {}): Env => ({ light: [25, 60], temp: [16, 30], lethal: [4, 40], rh: [30, 70], air: [20, 60], dryBack: 15, wetCap: 70, waterSec: 900, nutrient: [20, 55], hungry: 0.7, media: MEDIA.tuber, ...o }),
};

const PAL = {
  aroid: ['#8fbf4d', '#2f8a4a', '#14543a', '#6b3f6e'] as [string, string, string, string],
  succ: ['#a8c97a', '#6fae8a', '#4f8f9c', '#c0627a'] as [string, string, string, string],
  humid: ['#9cc65b', '#3f9a4e', '#1c6a3c', '#7a8f3a'] as [string, string, string, string],
  mar: ['#8cc55a', '#3a8f4a', '#1e5f3a', '#8b2f4f'] as [string, string, string, string],
  epi: ['#9cc860', '#3f8f48', '#1f6a3a', '#6a5a2a'] as [string, string, string, string],
  carn: ['#9cc86a', '#4f9a4f', '#2f6f3f', '#a0405a'] as [string, string, string, string],
  air: ['#b8cfa0', '#8fb59a', '#6a9a8a', '#c78aa6'] as [string, string, string, string],
};

interface SpecDef {
  id: string; sci: string; common: string[]; family: string; region: string; habitat: string; notes: string;
  rarity: 1 | 2 | 3 | 4 | 5; unlock: Species['unlock']; value: number; growSec: number;
  habit: Habit; leaf: LeafForm; env: Env; prop: PropSuccess;
  traits?: Species['traits']; palette: [string, string, string, string]; exotic: string; seedMult?: number;
}

const P = (seed: number, stem: number, leaf: number, division: number, clone: number, tissue: number): PropSuccess => ({ seed, stem, leaf, division, clone, tissue });
const T = (mean: number, sd = 0.13) => ({ mean, sd });

function build(d: SpecDef): Species {
  const [genus, epithet] = d.sci.split(' ');
  return {
    id: d.id, sci: d.sci, genus, epithet, family: d.family, common: d.common, region: d.region, habitat: d.habitat,
    notes: d.notes, rarity: d.rarity, unlock: d.unlock, baseValue: d.value, growSec: d.growSec, habit: d.habit,
    leaf: d.leaf, env: d.env, prop: d.prop, traits: d.traits ?? {}, palette: d.palette, exotic: d.exotic, seedMult: d.seedMult ?? 1,
  };
}

const DEFS: SpecDef[] = [
  // ---- Stage 1: accessible houseplants ------------------------------------------------------
  { id: 'epipremnum_aureum', sci: 'Epipremnum aureum', common: ['Golden Pothos', "Devil's Ivy"], family: 'Araceae', region: "Mo'orea, Society Islands (French Polynesia)", habitat: 'Climbs tree trunks in lowland tropical forest; naturalised across the tropics.', notes: 'Tolerant and fast. Rarely flowers in cultivation, so seed set is poor.', rarity: 1, unlock: { stage: 1 }, value: 30, growSec: 170, habit: 'trailing', leaf: 'heart', env: ENV.aroid({ light: [30, 65], rh: [40, 80], dryBack: 30 }), prop: P(0.3, 0.92, 0, 0.1, 0.95, 0.85), traits: { envTolerance: T(0.65), diseaseResistance: T(0.6) }, palette: PAL.aroid, exotic: 'Golden Marble', seedMult: 0.5 },
  { id: 'tradescantia_zebrina', sci: 'Tradescantia zebrina', common: ['Inch Plant', 'Wandering Jew'], family: 'Commelinaceae', region: 'Mexico, Central America & Colombia', habitat: 'Shaded forest floors and disturbed ground.', notes: 'Rapid trailing growth with purple-striped foliage.', rarity: 1, unlock: { stage: 1 }, value: 26, growSec: 150, habit: 'trailing', leaf: 'oval', env: ENV.aroid({ light: [45, 80], rh: [40, 75], dryBack: 30, waterSec: 330 }), prop: P(0.6, 0.95, 0, 0.5, 0.95, 0.8), traits: { growthRate: T(0.62), leafColour: T(0.55, 0.15) }, palette: ['#8fc06a', '#4f9a5a', '#7a4a9a', '#b0408a'], exotic: 'Magenta Flush' },
  { id: 'chlorophytum_comosum', sci: 'Chlorophytum comosum', common: ['Spider Plant', 'Airplane Plant'], family: 'Asparagaceae', region: 'Tropical & southern Africa', habitat: 'Forest margins and rocky slopes from the Cape to KwaZulu-Natal.', notes: 'Produces arching runners with plantlets, which makes division easy.', rarity: 1, unlock: { stage: 1 }, value: 34, growSec: 190, habit: 'rosette', leaf: 'lance', env: ENV.aroid({ light: [35, 70], rh: [35, 70], dryBack: 25, waterSec: 500 }), prop: P(0.6, 0, 0, 0.95, 0.9, 0.85), traits: { envTolerance: T(0.7), diseaseResistance: T(0.6) }, palette: PAL.aroid, exotic: 'Dark Banded' },
  { id: 'dracaena_trifasciata', sci: 'Dracaena trifasciata', common: ['Snake Plant', "Mother-in-law's Tongue"], family: 'Asparagaceae', region: 'Tropical West Africa (Nigeria to the Congo)', habitat: 'Dry, rocky open ground and forest edges.', notes: 'Formerly Sansevieria. Thrives on neglect; rots if overwatered.', rarity: 1, unlock: { stage: 1 }, value: 44, growSec: 300, habit: 'upright', leaf: 'strap', env: ENV.tuber({ light: [20, 75], dryBack: 10, wetCap: 60, waterSec: 1200 }), prop: P(0.4, 0, 0.8, 0.92, 0.9, 0.7), traits: { waterReq: T(0.25), envTolerance: T(0.75), growthRate: T(0.35) }, palette: ['#9fc47a', '#4f8f5a', '#1e5a40', '#6a7a3a'], exotic: 'Golden Edge' },
  { id: 'peperomia_obtusifolia', sci: 'Peperomia obtusifolia', common: ['Baby Rubber Plant'], family: 'Piperaceae', region: 'Florida, Mexico, Caribbean & northern South America', habitat: 'Epiphytic and terrestrial in humid forest.', notes: 'Compact, succulent-ish leaves that root readily from leaf cuttings.', rarity: 1, unlock: { stage: 1 }, value: 40, growSec: 240, habit: 'clump', leaf: 'round', env: ENV.aroid({ light: [40, 70], dryBack: 22, wetCap: 75, waterSec: 650, rh: [40, 75] }), prop: P(0.5, 0.88, 0.85, 0.3, 0.9, 0.8), palette: PAL.aroid, exotic: 'Jade Bronze' },
  { id: 'syngonium_podophyllum', sci: 'Syngonium podophyllum', common: ['Arrowhead Vine', 'Goosefoot Plant'], family: 'Araceae', region: 'Mexico to Bolivia', habitat: 'Lowland tropical forest, climbing and scrambling.', notes: 'Juvenile arrow leaves lobe as the plant matures. Pink cultivars are famous.', rarity: 1, unlock: { stage: 1 }, value: 38, growSec: 200, habit: 'climber', leaf: 'heart', env: ENV.aroid({ light: [35, 65] }), prop: P(0.6, 0.92, 0, 0.3, 0.95, 0.9), traits: { leafShape: T(0.45), variegation: T(0.14, 0.12) }, palette: ['#a6d066', '#4aa05a', '#1f6a40', '#c4607a'], exotic: 'Neon Pink' },
  // ---- Stage 2: propagation staples ---------------------------------------------------------
  { id: 'philodendron_hederaceum', sci: 'Philodendron hederaceum', common: ['Heartleaf Philodendron', 'Sweetheart Plant'], family: 'Araceae', region: 'Mexico, Caribbean, Central & northern South America', habitat: 'Hemiepiphytic climber in humid forest.', notes: 'Velvety heart leaves. Lime and brasil forms are well-known sports.', rarity: 1, unlock: { stage: 2 }, value: 55, growSec: 230, habit: 'trailing', leaf: 'heart', env: ENV.aroid({ light: [35, 65] }), prop: P(0.5, 0.93, 0, 0.15, 0.95, 0.9), palette: ['#b5d95a', '#3f9a50', '#17573a', '#7a4a66'], exotic: 'Burgundy Cast' },
  { id: 'ficus_elastica', sci: 'Ficus elastica', common: ['Rubber Fig', 'Rubber Plant'], family: 'Moraceae', region: 'North-east India to Indonesia', habitat: 'Hemiepiphytic tree of monsoon forest, forming huge buttresses.', notes: 'Glossy leaves; tolerates indoor air better than most figs.', rarity: 2, unlock: { stage: 2 }, value: 75, growSec: 330, habit: 'upright', leaf: 'oval', env: ENV.aroid({ light: [50, 80], rh: [40, 75], dryBack: 30, waterSec: 560 }), prop: P(0.45, 0.7, 0.3, 0, 0.9, 0.8), traits: { leafSize: T(0.55), leafColour: T(0.5, 0.16) }, palette: ['#7dad4c', '#2e6a3a', '#173d2a', '#6a2a3a'], exotic: 'Burgundy Black' },
  { id: 'zamioculcas_zamiifolia', sci: 'Zamioculcas zamiifolia', common: ['ZZ Plant', 'Zanzibar Gem'], family: 'Araceae', region: 'Eastern Africa (Kenya to north-east South Africa)', habitat: 'Seasonally dry forest and rocky ground; stores water in rhizomes.', notes: 'Extremely drought tolerant. Slow, with glossy pinnate leaves.', rarity: 2, unlock: { stage: 2 }, value: 95, growSec: 520, habit: 'upright', leaf: 'pinnate', env: ENV.tuber({ light: [20, 60], dryBack: 8, wetCap: 62, waterSec: 1500 }), prop: P(0.25, 0, 0.75, 0.9, 0.9, 0.75), traits: { growthRate: T(0.28), envTolerance: T(0.8), waterReq: T(0.2) }, palette: ['#8dc36a', '#2f8a4a', '#123f2a', '#1a1a22'], exotic: 'Raven Black' },
  { id: 'pilea_peperomioides', sci: 'Pilea peperomioides', common: ['Chinese Money Plant', 'UFO Plant'], family: 'Urticaceae', region: 'Yunnan & Sichuan, China', habitat: 'Shaded, rocky slopes at 1,500-3,000 m.', notes: 'Coin leaves on slender stalks; famously shares pups.', rarity: 2, unlock: { stage: 2 }, value: 90, growSec: 300, habit: 'upright', leaf: 'round', env: ENV.aroid({ light: [40, 70], temp: [15, 26], rh: [40, 70], dryBack: 30, waterSec: 480 }), prop: P(0.1, 0.5, 0, 0.95, 0.92, 0.85), palette: ['#b0d86a', '#4aa05a', '#1f6a45', '#7a8a3a'], exotic: 'Bronze Coin' },
  { id: 'crassula_ovata', sci: 'Crassula ovata', common: ['Jade Plant', 'Money Tree'], family: 'Crassulaceae', region: 'South Africa & Mozambique', habitat: 'Dry scrub and rocky slopes.', notes: 'Woody succulent. Reddens in strong light.', rarity: 2, unlock: { stage: 2 }, value: 85, growSec: 400, habit: 'upright', leaf: 'fleshy', env: ENV.succ(), prop: P(0.3, 0.9, 0.85, 0.3, 0.9, 0.7), palette: PAL.succ, exotic: 'Red-Tipped Gollum' },
  { id: 'echeveria_elegans', sci: 'Echeveria elegans', common: ['Mexican Snowball', 'Mexican Gem'], family: 'Crassulaceae', region: 'Hidalgo, Mexico', habitat: 'Semi-desert rocky slopes.', notes: 'Tight blue-white rosettes. Overwatering is fatal.', rarity: 2, unlock: { stage: 2 }, value: 80, growSec: 380, habit: 'rosette', leaf: 'fleshy', env: ENV.succ({ light: [65, 100], dryBack: 10, wetCap: 50 }), prop: P(0.6, 0.3, 0.92, 0.85, 0.9, 0.75), traits: { waterReq: T(0.22) }, palette: ['#c4dcc0', '#86b5a8', '#5a8fa8', '#c9708c'], exotic: 'Rose Blush' },
  { id: 'monstera_deliciosa', sci: 'Monstera deliciosa', common: ['Swiss Cheese Plant', 'Split-leaf Philodendron'], family: 'Araceae', region: 'Southern Mexico to Panama', habitat: 'Hemiepiphytic climber in tropical rainforest; leaves fenestrate with age.', notes: 'The icon of modern houseplant collecting. Albo and Thai Constellation sports command premium prices.', rarity: 2, unlock: { stage: 2 }, value: 120, growSec: 420, habit: 'climber', leaf: 'split', env: ENV.aroid({ light: [45, 75], rh: [50, 85], waterSec: 440 }), prop: P(0.6, 0.88, 0, 0.1, 0.95, 0.9), traits: { leafShape: T(0.6), leafSize: T(0.55), variegation: T(0.1, 0.1) }, palette: PAL.aroid, exotic: 'Aureo-Plum' },
  { id: 'maranta_leuconeura', sci: 'Maranta leuconeura', common: ['Prayer Plant', "Rabbit's Tracks"], family: 'Marantaceae', region: 'Atlantic Forest, Brazil', habitat: 'Shaded forest understory; leaves fold upward at night.', notes: 'Likes humidity and steady moisture.', rarity: 2, unlock: { stage: 2 }, value: 90, growSec: 320, habit: 'clump', leaf: 'oval', env: ENV.humid({ light: [30, 55], rh: [60, 85], dryBack: 45 }), prop: P(0.2, 0.5, 0, 0.9, 0.9, 0.85), traits: { envTolerance: T(0.4), variegation: T(0.2, 0.12) }, palette: PAL.mar, exotic: 'Crimson Veined' },
  { id: 'hoya_carnosa', sci: 'Hoya carnosa', common: ['Wax Plant', 'Porcelain Flower'], family: 'Apocynaceae', region: 'Southern China, Japan (Ryukyu), Taiwan, Vietnam & northern Australia', habitat: 'Epiphytic and lithophytic vine on trees and rocks.', notes: 'Waxy leaves and scented flowers. Tricolor and Krimson Queen are variegated cultivars.', rarity: 2, unlock: { stage: 2 }, value: 110, growSec: 480, habit: 'trailing', leaf: 'oval', env: ENV.epi({ light: [50, 80], dryBack: 25, wetCap: 68, waterSec: 650, rh: [40, 75] }), prop: P(0.2, 0.85, 0.2, 0, 0.85, 0.7), traits: { variegation: T(0.16, 0.12), growthRate: T(0.4) }, palette: ['#a7c86a', '#4a8f4a', '#2a6a3a', '#b06a7a'], exotic: 'Pink Tricolor' },
  { id: 'begonia_maculata', sci: 'Begonia maculata', common: ['Polka Dot Begonia', 'Angel Wing Begonia'], family: 'Begoniaceae', region: 'Atlantic Forest, Brazil', habitat: 'Moist, shaded forest floor and stream banks.', notes: 'Silver-spotted leaves with red undersides.', rarity: 2, unlock: { stage: 2 }, value: 130, growSec: 360, habit: 'upright', leaf: 'lance', env: ENV.humid({ light: [40, 65], rh: [55, 80], dryBack: 40, waterSec: 340 }), prop: P(0.4, 0.8, 0.9, 0.4, 0.9, 0.85), traits: { variegation: T(0.3, 0.14), envTolerance: T(0.4) }, palette: ['#a3cc66', '#3f8f55', '#1b5a3a', '#9a2f50'], exotic: 'Ruby Spotted' },
  { id: 'tillandsia_ionantha', sci: 'Tillandsia ionantha', common: ['Sky Plant', 'Air Plant'], family: 'Bromeliaceae', region: 'Mexico to Nicaragua', habitat: 'Epiphytic on trees and cacti in dry-to-humid forest.', notes: 'Blushes red before flowering. Offsets form clumps.', rarity: 2, unlock: { stage: 2 }, value: 70, growSec: 300, habit: 'rosette', leaf: 'spike', env: ENV.air(), prop: P(0.3, 0, 0, 0.9, 0.85, 0.7), palette: PAL.air, exotic: 'Blush Red' },
  // ---- Stage 3: collector favourites ---------------------------------------------------------
  { id: 'monstera_adansonii', sci: 'Monstera adansonii', common: ['Swiss Cheese Vine', 'Five Holes Plant'], family: 'Araceae', region: 'Central America to northern South America', habitat: 'Climbs in humid rainforest.', notes: 'Lacy fenestrated leaves on a vigorous vine.', rarity: 3, unlock: { stage: 3 }, value: 190, growSec: 420, habit: 'climber', leaf: 'split', env: ENV.aroid({ light: [40, 70], rh: [55, 85] }), prop: P(0.5, 0.9, 0, 0.1, 0.95, 0.9), traits: { leafShape: T(0.65) }, palette: PAL.aroid, exotic: 'Aureo Marble' },
  { id: 'scindapsus_pictus', sci: 'Scindapsus pictus', common: ['Satin Pothos', 'Silver Vine'], family: 'Araceae', region: 'Thailand, Malaysia, Borneo & Sumatra', habitat: 'Climbs tree trunks in lowland forest.', notes: 'Matte silver-splashed leaves.', rarity: 3, unlock: { stage: 3 }, value: 170, growSec: 380, habit: 'trailing', leaf: 'heart', env: ENV.aroid({ light: [35, 65] }), prop: P(0.3, 0.92, 0, 0.1, 0.95, 0.88), traits: { variegation: T(0.3, 0.15), leafColour: T(0.55) }, palette: ['#9cc46a', '#3f8a5a', '#1c5a42', '#5a6a8a'], exotic: 'Blue-Silver' },
  { id: 'rhaphidophora_tetrasperma', sci: 'Rhaphidophora tetrasperma', common: ['Mini Monstera'], family: 'Araceae', region: 'Southern Thailand & Peninsular Malaysia', habitat: 'Climbs in humid lowland rainforest.', notes: 'Small split leaves. Not a true Monstera.', rarity: 3, unlock: { stage: 3 }, value: 200, growSec: 440, habit: 'climber', leaf: 'split', env: ENV.aroid(), prop: P(0.45, 0.9, 0, 0.1, 0.95, 0.9), traits: { leafSize: T(0.4), leafShape: T(0.55) }, palette: PAL.aroid, exotic: 'Aureo Fleck' },
  { id: 'ceropegia_woodii', sci: 'Ceropegia woodii', common: ['String of Hearts', 'Rosary Vine'], family: 'Apocynaceae', region: 'South Africa, Eswatini & Zimbabwe', habitat: 'Rocky ground and forest edges; forms tubers.', notes: 'Trailing strings of marbled hearts. Rots if kept wet.', rarity: 3, unlock: { stage: 3 }, value: 210, growSec: 400, habit: 'trailing', leaf: 'heart', env: ENV.succ({ light: [50, 85], rh: [30, 65], dryBack: 18, wetCap: 62, waterSec: 900 }), prop: P(0.1, 0.9, 0.1, 0.5, 0.9, 0.75), traits: { variegation: T(0.3, 0.15), leafSize: T(0.35) }, palette: ['#a7c88a', '#6a9a7a', '#4a6a6a', '#b0708a'], exotic: 'Rose Variegate' },
  { id: 'ficus_lyrata', sci: 'Ficus lyrata', common: ['Fiddle-leaf Fig'], family: 'Moraceae', region: 'West & Central African lowland rainforest', habitat: 'Hemiepiphytic tree in humid lowland forest.', notes: 'Large violin-shaped leaves. Notoriously fussy indoors.', rarity: 3, unlock: { stage: 3 }, value: 260, growSec: 620, habit: 'upright', leaf: 'paddle', env: ENV.aroid({ light: [55, 85], rh: [45, 75], waterSec: 520, dryBack: 38 }), prop: P(0.35, 0.55, 0.1, 0, 0.9, 0.75), traits: { envTolerance: T(0.35), leafSize: T(0.6), diseaseResistance: T(0.4) }, palette: ['#82b04a', '#2e7a3a', '#15462c', '#6a3a2a'], exotic: 'Bronze Flush' },
  { id: 'goeppertia_orbifolia', sci: 'Goeppertia orbifolia', common: ['Round-leaf Prayer Plant', 'Calathea Orbifolia'], family: 'Marantaceae', region: 'Bolivia', habitat: 'Humid forest floor under dense canopy.', notes: 'Formerly Calathea orbifolia. Demands high humidity.', rarity: 3, unlock: { stage: 3 }, value: 280, growSec: 520, habit: 'clump', leaf: 'oval', env: ENV.humid({ light: [28, 52], rh: [70, 92], dryBack: 55, wetCap: 95, waterSec: 250 }), prop: P(0.2, 0, 0, 0.9, 0.9, 0.85), traits: { envTolerance: T(0.3), leafSize: T(0.62), variegation: T(0.15, 0.1) }, palette: PAL.mar, exotic: 'Silver Banded' },
  { id: 'alocasia_zebrina', sci: 'Alocasia zebrina', common: ['Zebra Alocasia', 'Elephant Ear'], family: 'Araceae', region: 'Philippines', habitat: 'Tropical understory with zebra-striped petioles.', notes: 'Arrow leaves on striped stems; prone to spider mites.', rarity: 3, unlock: { stage: 3 }, value: 330, growSec: 560, habit: 'upright', leaf: 'peltate', env: ENV.aroid({ light: [45, 75], rh: [60, 85], dryBack: 38, waterSec: 380 }), prop: P(0.4, 0, 0, 0.75, 0.9, 0.9), traits: { diseaseResistance: T(0.4), leafSize: T(0.58) }, palette: ['#9cc860', '#3a8a4a', '#17503a', '#5a2f5a'], exotic: 'Plum Shade' },
  { id: 'platycerium_bifurcatum', sci: 'Platycerium bifurcatum', common: ['Common Staghorn Fern', 'Elkhorn Fern'], family: 'Polypodiaceae', region: 'Queensland & New South Wales (Australia), New Guinea', habitat: 'Epiphytic on tree trunks and branches.', notes: 'Antler fronds and a shield-like basal frond.', rarity: 3, unlock: { stage: 3 }, value: 340, growSec: 700, habit: 'epiphyte', leaf: 'frond', env: ENV.epi({ light: [40, 65], rh: [50, 80], dryBack: 35, wetCap: 80, waterSec: 380 }), prop: P(0.2, 0, 0, 0.8, 0.85, 0.7), palette: ['#a8c870', '#6a9a60', '#3a6a45', '#8a9a7a'], exotic: 'Silver Frost' },
  { id: 'phalaenopsis_amabilis', sci: 'Phalaenopsis amabilis', common: ['Moth Orchid'], family: 'Orchidaceae', region: 'Indonesia, Philippines & northern Australia', habitat: 'Epiphytic on shaded lowland tree trunks.', notes: 'Commercial orchids are propagated almost entirely via tissue culture.', rarity: 3, unlock: { stage: 3 }, value: 380, growSec: 800, habit: 'epiphyte', leaf: 'paddle', env: ENV.epi({ light: [35, 60], rh: [55, 80], dryBack: 38, wetCap: 65, waterSec: 450 }), prop: P(0.1, 0, 0, 0.3, 0.85, 0.95), traits: { variegation: T(0.1, 0.08), growthRate: T(0.38) }, palette: PAL.epi, exotic: 'Mottled Olive' },
  // ---- Stage 4: premium aroids and carnivores --------------------------------------------------
  { id: 'anthurium_clarinervium', sci: 'Anthurium clarinervium', common: ['Velvet Cardboard Anthurium'], family: 'Araceae', region: 'Chiapas, Mexico', habitat: 'Limestone karst forest, epiphytic or lithophytic.', notes: 'Heart-shaped velvet leaves with silver veins.', rarity: 4, unlock: { stage: 4, expedition: 'exp_neotropics' }, value: 650, growSec: 900, habit: 'rosette', leaf: 'heart', env: ENV.aroid({ light: [40, 65], rh: [60, 85], dryBack: 38, wetCap: 80, waterSec: 450 }), prop: P(0.4, 0.5, 0, 0.7, 0.9, 0.85), traits: { envTolerance: T(0.35), leafSize: T(0.55) }, palette: ['#8cc060', '#2e7a46', '#0f3f2e', '#4a2a4a'], exotic: 'Midnight Velvet' },
  { id: 'philodendron_gloriosum', sci: 'Philodendron gloriosum', common: ['Velvet Philodendron', 'Glorious Philodendron'], family: 'Araceae', region: 'Colombia', habitat: 'Creeping terrestrial in humid forest.', notes: 'Giant velvet-green leaves with white veins on creeping stems.', rarity: 4, unlock: { stage: 4, expedition: 'exp_neotropics' }, value: 720, growSec: 950, habit: 'clump', leaf: 'heart', env: ENV.aroid({ light: [35, 65], rh: [60, 85], waterSec: 420 }), prop: P(0.35, 0.3, 0, 0.8, 0.9, 0.85), traits: { leafSize: T(0.65), growthRate: T(0.4) }, palette: ['#7ab45a', '#2a7a42', '#0e4a30', '#4a3a5a'], exotic: 'Bronze Velvet' },
  { id: 'nepenthes_ventricosa', sci: 'Nepenthes ventricosa', common: ['Tropical Pitcher Plant'], family: 'Nepenthaceae', region: 'Luzon, Philippines', habitat: 'Cool mossy highland forest.', notes: 'Sensitive to minerals: keep feeding light and humidity high.', rarity: 4, unlock: { stage: 4, expedition: 'exp_sea' }, value: 700, growSec: 1000, habit: 'climber', leaf: 'pitcher', env: ENV.carn(), prop: P(0.3, 0.7, 0, 0, 0.8, 0.95), traits: { envTolerance: T(0.3), diseaseResistance: T(0.4) }, palette: PAL.carn, exotic: 'Crimson Pitcher' },
  // ---- Stage 5: expedition rarities ------------------------------------------------------------
  { id: 'anthurium_warocqueanum', sci: 'Anthurium warocqueanum', common: ['Queen Anthurium'], family: 'Araceae', region: 'Colombia', habitat: 'Cloud-forest epiphyte with pendant velvet leaves.', notes: 'Prized for metre-long leaves. Extremely fussy.', rarity: 5, unlock: { stage: 5, expedition: 'exp_andes' }, value: 2400, growSec: 1600, habit: 'climber', leaf: 'lance', env: ENV.aroid({ light: [35, 60], rh: [70, 92], temp: [18, 26], dryBack: 42, wetCap: 82, waterSec: 380 }), prop: P(0.25, 0.4, 0, 0.5, 0.85, 0.8), traits: { envTolerance: T(0.25, 0.1), leafSize: T(0.7), mutationPotential: T(0.4) }, palette: ['#6aa84a', '#1f6a3a', '#0a3a28', '#3a2a3a'], exotic: 'Obsidian Velvet' },
  { id: 'monstera_obliqua', sci: 'Monstera obliqua', common: ['Window Leaf Monstera'], family: 'Araceae', region: 'Central America to northern South America', habitat: 'Shaded rainforest understory; the Peru form is nearly all hole.', notes: 'Paper-thin leaves that are mostly fenestration. Very hard to grow.', rarity: 5, unlock: { stage: 5, expedition: 'exp_andes' }, value: 4200, growSec: 2000, habit: 'climber', leaf: 'split', env: ENV.aroid({ light: [35, 60], rh: [75, 95], temp: [20, 28], dryBack: 48, wetCap: 85, waterSec: 300 }), prop: P(0.2, 0.7, 0, 0, 0.85, 0.8), traits: { envTolerance: T(0.2, 0.08), leafShape: T(0.8, 0.1), diseaseResistance: T(0.35) }, palette: ['#98c868', '#3a8a4a', '#1a5a3a', '#6a4a6a'], exotic: 'Aureo Veil' },
  { id: 'philodendron_spiritus_sancti', sci: 'Philodendron spiritus-sancti', common: ['Spirit of the Holy Ghost Philodendron'], family: 'Araceae', region: 'Espirito Santo, Brazil', habitat: 'Critically endangered; known from a tiny range of humid forest.', notes: 'Pendant, elongated glossy leaves. A legendary collector plant.', rarity: 5, unlock: { stage: 5, expedition: 'exp_atlantic' }, value: 5200, growSec: 2200, habit: 'climber', leaf: 'lance', env: ENV.aroid({ light: [40, 65], rh: [70, 90], temp: [19, 27], dryBack: 42, waterSec: 380 }), prop: P(0.2, 0.6, 0, 0.1, 0.85, 0.8), traits: { envTolerance: T(0.25, 0.1), growthRate: T(0.3), leafSize: T(0.65) }, palette: ['#88b858', '#2e7a46', '#13503a', '#6a3a4a'], exotic: 'Garnet Gloss' },
  // ---- Legacy species (prestige) ----------------------------------------------------------------
  { id: 'philodendron_patriciae', sci: 'Philodendron patriciae', common: ["Patricia's Philodendron"], family: 'Araceae', region: 'Andean foothill forests of north-western South America', habitat: 'Terrestrial and hemiepiphytic in cool humid forest.', notes: 'Enormous sword-shaped leaves on sturdy stems.', rarity: 5, unlock: { stage: 5, legacy: true }, value: 3600, growSec: 1800, habit: 'upright', leaf: 'heart', env: ENV.aroid({ light: [40, 65], rh: [65, 88], waterSec: 380 }), prop: P(0.3, 0.5, 0, 0.3, 0.85, 0.8), traits: { leafSize: T(0.75), envTolerance: T(0.3) }, palette: ['#7ab45a', '#2a7a42', '#0e4a30', '#4a3a5a'], exotic: 'Garnet Veil' },
  { id: 'alocasia_azlanii', sci: 'Alocasia azlanii', common: ['Red Secret Alocasia'], family: 'Araceae', region: 'Sarawak, Borneo', habitat: 'Lowland rainforest understory.', notes: 'Metallic bronze-purple leaves with silver veins.', rarity: 5, unlock: { stage: 5, legacy: true }, value: 3000, growSec: 1500, habit: 'upright', leaf: 'peltate', env: ENV.aroid({ light: [40, 65], rh: [65, 90], dryBack: 40, waterSec: 340 }), prop: P(0.3, 0, 0, 0.6, 0.85, 0.85), traits: { envTolerance: T(0.3), leafColour: T(0.75) }, palette: ['#8aa060', '#5a6a4a', '#4a3a4a', '#8a2a50'], exotic: 'Ruby Metallic' },
  { id: 'nepenthes_rajah', sci: 'Nepenthes rajah', common: ['King Pitcher Plant'], family: 'Nepenthaceae', region: 'Mount Kinabalu & Mount Tambuyukon, Sabah (Borneo)', habitat: 'Ultramafic cloud forest at 1,500-2,650 m.', notes: 'Produces the largest pitchers of any carnivorous plant.', rarity: 5, unlock: { stage: 5, legacy: true }, value: 6500, growSec: 2600, habit: 'climber', leaf: 'pitcher', env: ENV.carn({ temp: [14, 24], rh: [78, 96], lethal: [4, 30] }), prop: P(0.2, 0.6, 0, 0, 0.8, 0.9), traits: { envTolerance: T(0.2, 0.08), diseaseResistance: T(0.35) }, palette: PAL.carn, exotic: 'Blood Red' },
];

export const SPECIES_LIST: Species[] = DEFS.map(build);
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
