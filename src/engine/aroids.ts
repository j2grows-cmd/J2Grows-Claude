// The species database: 99 aroids (Alocasia, Anthurium, Monstera, Philodendron).
// Each id is the folder name of the species' artwork in the Supabase `plant-images` bucket
// (species/<id>/hero.png), so the art and the data can never drift apart.
//
// Real-world facts (origin, habit) are included where they are well established; for garden hybrids and
// trade cultivars the region says so. Prices, rarities and growth times are game design.

import type { Env, Habit, LeafForm, PropSuccess, Species } from './species';

export type Unlock = 's1' | 's2' | 's3' | 'neo' | 'sea' | 'andes' | 'atl' | 'legacy';

export const UNLOCKS: Record<Unlock, Species['unlock']> = {
  s1: { stage: 1 },
  s2: { stage: 2 },
  s3: { stage: 3 },
  neo: { stage: 4, expedition: 'exp_neotropics' },
  sea: { stage: 4, expedition: 'exp_sea' },
  andes: { stage: 5, expedition: 'exp_andes' },
  atl: { stage: 5, expedition: 'exp_atlantic' },
  legacy: { stage: 5, legacy: true },
};

/** Archetypes: shared husbandry for groups of related plants. */
export type Arch =
  | 'aloc' | 'alocHard' | 'alocTough'
  | 'antEpi' | 'antVelvet'
  | 'monst'
  | 'phiClimb' | 'phiSelf' | 'phiVelvet' | 'phiVar' | 'phiRhizome';

type Palette = [string, string, string, string];
const GREEN: Palette = ['#8fbf4d', '#2f8a4a', '#14543a', '#6b3f6e'];
const DARK: Palette = ['#4f8f5a', '#1f5d3c', '#0a2a1c', '#7a9f8a'];
const SILVER: Palette = ['#9fc4b0', '#6f9f8a', '#2f6a55', '#d8ece4'];
const COPPER: Palette = ['#9bbf55', '#3f8a45', '#8a3a2f', '#d0603a'];
const PURPLE: Palette = ['#7aa86a', '#3d7a52', '#4d2f5f', '#8a4fa0'];
const PINK: Palette = ['#a6cf6a', '#3f9a52', '#1f6a3f', '#d86a96'];
const LIME: Palette = ['#c4e070', '#8fc24d', '#3f8a40', '#e0d060'];
const BLUEGREY: Palette = ['#8fb8b0', '#4f8f8f', '#1f5a60', '#6fa0c8'];
const ORANGE: Palette = ['#b8c84a', '#78a83a', '#c07030', '#e08a30'];
const BLACKRED: Palette = ['#7a8f4a', '#3a5a3a', '#3a1a22', '#8a2a3a'];
const BURGUNDY: Palette = ['#9aa84a', '#5a8a3a', '#7a2a3a', '#a8405a'];

const AROID_MEDIA = { aroidMix: 1, cocoPerlite: 0.85, peatMix: 0.8, leca: 0.8, sphagnum: 0.7, barkMix: 0.65, gritMix: 0.2 };
const EPI_MEDIA = { barkMix: 1, sphagnum: 0.8, aroidMix: 0.7, leca: 0.7, cocoPerlite: 0.4, peatMix: 0.25, gritMix: 0.15 };
const HUMID_MEDIA = { sphagnum: 1, peatMix: 0.9, cocoPerlite: 0.8, aroidMix: 0.75, leca: 0.6, barkMix: 0.5, gritMix: 0.1 };

const env = (e: Partial<Env> & Pick<Env, 'light' | 'temp' | 'rh'>, media = AROID_MEDIA): Env => ({
  lethal: [9, 38], air: [20, 60], dryBack: 35, wetCap: 85, waterSec: 400, nutrient: [30, 70], hungry: 1, media, ...e,
});
const P = (seed: number, stem: number, leaf: number, division: number, clone: number, tissue: number): PropSuccess => ({ seed, stem, leaf, division, clone, tissue });

interface ArchDef { env: Env; prop: PropSuccess; habitat: string; palette: Palette; habit: Habit }
export const ARCHS: Record<Arch, ArchDef> = {
  aloc: { env: env({ light: [45, 75], temp: [21, 30], lethal: [11, 38], rh: [58, 88], dryBack: 38, wetCap: 82, waterSec: 340, hungry: 1.15 }), prop: P(0.3, 0, 0, 0.8, 0.9, 0.9), habitat: 'Shaded, humid forest floor and clearings, growing from a corm.', palette: GREEN, habit: 'upright' },
  alocHard: { env: env({ light: [40, 70], temp: [22, 30], lethal: [13, 38], rh: [65, 92], dryBack: 42, wetCap: 80, waterSec: 300, hungry: 1.1 }), prop: P(0.2, 0, 0, 0.7, 0.85, 0.9), habitat: 'Deep, warm, humid understory; sulks when the air is dry or cool.', palette: SILVER, habit: 'clump' },
  alocTough: { env: env({ light: [35, 75], temp: [17, 31], lethal: [5, 40], rh: [45, 85], dryBack: 32, wetCap: 85, waterSec: 380, hungry: 1.3, nutrient: [35, 75] }), prop: P(0.4, 0, 0, 0.9, 0.9, 0.9), habitat: 'Open, sunny forest edges and disturbed ground; large, hungry and forgiving.', palette: GREEN, habit: 'upright' },
  antEpi: { env: env({ light: [40, 70], temp: [19, 30], lethal: [9, 37], rh: [60, 90], air: [30, 70], dryBack: 40, wetCap: 72, waterSec: 380, nutrient: [20, 55], hungry: 0.85 }, EPI_MEDIA), prop: P(0.35, 0.55, 0, 0.65, 0.9, 0.85), habitat: 'Epiphytic or terrestrial in humid cloud and rain forest.', palette: GREEN, habit: 'epiphyte' },
  antVelvet: { env: env({ light: [30, 60], temp: [18, 28], lethal: [10, 34], rh: [70, 92], air: [30, 65], dryBack: 45, wetCap: 70, waterSec: 340, nutrient: [20, 50], hungry: 0.8 }, EPI_MEDIA), prop: P(0.3, 0.45, 0, 0.6, 0.9, 0.85), habitat: 'Cool, wet cloud-forest slopes, rooted in moss and leaf litter.', palette: DARK, habit: 'epiphyte' },
  monst: { env: env({ light: [40, 72], temp: [18, 30], lethal: [8, 38], rh: [45, 85], dryBack: 35, wetCap: 85, waterSec: 420, hungry: 1.1 }), prop: P(0.5, 0.9, 0, 0.1, 0.95, 0.9), habitat: 'Hemiepiphytic climber that grows up tree trunks in lowland and montane forest.', palette: GREEN, habit: 'climber' },
  phiClimb: { env: env({ light: [30, 65], temp: [18, 30], lethal: [8, 38], rh: [40, 80], dryBack: 30, waterSec: 440 }), prop: P(0.5, 0.93, 0, 0.15, 0.95, 0.9), habitat: 'Climbs and trails through humid forest; one of the most forgiving houseplants.', palette: GREEN, habit: 'climber' },
  phiSelf: { env: env({ light: [35, 70], temp: [18, 30], lethal: [9, 38], rh: [45, 85], dryBack: 32, hungry: 1.1 }), prop: P(0.3, 0.45, 0, 0.4, 0.9, 0.9), habitat: 'Self-heading (non-vining) philodendron; grows as a tidy, upright rosette.', palette: GREEN, habit: 'upright' },
  phiVelvet: { env: env({ light: [30, 60], temp: [19, 29], lethal: [11, 36], rh: [65, 92], dryBack: 42, wetCap: 85, waterSec: 320 }, HUMID_MEDIA), prop: P(0.3, 0.8, 0, 0.2, 0.9, 0.85), habitat: 'Warm, wet forest where velvet leaves stay dry under a canopy of moss.', palette: DARK, habit: 'climber' },
  phiVar: { env: env({ light: [45, 75], temp: [19, 30], lethal: [10, 38], rh: [50, 85], dryBack: 36, hungry: 1.05 }), prop: P(0.1, 0.7, 0, 0.3, 0.9, 0.8), habitat: 'Variegated line: needs brighter light to keep its colour, and does not come true from seed.', palette: PINK, habit: 'climber' },
  phiRhizome: { env: env({ light: [30, 60], temp: [19, 30], lethal: [10, 37], rh: [55, 90], dryBack: 38, wetCap: 80, waterSec: 380 }), prop: P(0.35, 0.2, 0, 0.8, 0.9, 0.85), habitat: 'Creeping rhizome that crawls across the forest floor and low trunks.', palette: GREEN, habit: 'clump' },
};

export interface Row {
  id: string;
  sci: string;
  common: string[];
  arch: Arch;
  leaf: LeafForm;
  rarity: Species['rarity'];
  value: number;
  growSec: number;
  unlock: Unlock;
  region: string;
  notes: string;
  exotic: string;
  habit?: Habit;
  palette?: Palette;
  seedMult?: number;
  prop?: Partial<PropSuccess>;
  traits?: Species['traits'];
}

/** Price multipliers per rarity, set from the pacing simulator (npm run balance) so stage times stay on target. */
export const PACING: Record<number, number> = { 1: 1, 2: 1.05, 3: 1.15, 4: 1.2, 5: 1 };

const t = (mean: number, sd = 0.13) => ({ mean, sd });

const BORNEO = 'Borneo';
const SEA = 'South-East Asia';
const HYBRID = 'Garden hybrid (cultivated worldwide)';
const CULTIVAR = 'Trade cultivar (cultivated worldwide)';
const ANDES = 'Northern Andes (Colombia and Ecuador)';

export const ROWS: Row[] = [
  // =============================== ALOCASIA ====================================================
  { id: 'alocasia-polly', sci: "Alocasia × amazonica 'Polly'", common: ['Alocasia Polly', 'African Mask'], arch: 'aloc', leaf: 'peltate', rarity: 1, value: 48, growSec: 230, unlock: 's1', region: HYBRID, notes: 'The houseplant-aisle Alocasia: compact, glossy arrow leaves with pale veins.', exotic: 'Silver Veined', traits: { envTolerance: t(0.55) } },
  { id: 'alocasia-cucullata', sci: 'Alocasia cucullata', common: ["Buddha's Hand", 'Chinese Taro'], arch: 'alocTough', leaf: 'heart', rarity: 1, value: 42, growSec: 210, unlock: 's1', region: 'Southern Asia (India to southern China)', notes: 'The easiest Alocasia: glossy heart-shaped leaves, tolerant of cooler rooms.', exotic: 'Emerald Gloss', traits: { envTolerance: t(0.7), diseaseResistance: t(0.6) } },
  { id: 'alocasia-longiloba', sci: 'Alocasia longiloba', common: ['Tigrina', 'Tiger Taro'], arch: 'aloc', leaf: 'lance', rarity: 1, value: 46, growSec: 240, unlock: 's1', region: 'Malay Peninsula, Sumatra and Borneo', notes: 'Long, arrow-shaped leaves with pale veins on striped, tiger-marked stalks.', exotic: 'Pale Veined' },
  { id: 'alocasia-amazonica', sci: 'Alocasia × amazonica', common: ['African Mask', 'Amazonian Elephant Ear'], arch: 'aloc', leaf: 'peltate', rarity: 2, value: 85, growSec: 380, unlock: 's2', region: HYBRID, notes: 'Dark, shield-shaped leaves with bold ivory veins on a stout upright plant.', exotic: 'Ivory Veined', palette: DARK },
  { id: 'alocasia-odora', sci: 'Alocasia odora', common: ['Night-scented Lily', 'Asian Taro'], arch: 'alocTough', leaf: 'heart', rarity: 2, value: 65, growSec: 360, unlock: 's2', region: 'Southern China to Malesia', notes: 'A big, easy, fast-growing species with upward-facing leaves.', exotic: 'Jade Green' },
  { id: 'alocasia-wentii', sci: 'Alocasia wentii', common: ['Hardy Elephant Ear'], arch: 'alocTough', leaf: 'paddle', rarity: 2, value: 80, growSec: 400, unlock: 's2', region: 'New Guinea', notes: 'Leathery leaves, purple underneath; hardier than most of its genus.', exotic: 'Violet Underside', palette: PURPLE, traits: { envTolerance: t(0.62) } },
  { id: 'alocasia-frydek', sci: "Alocasia micholitziana 'Frydek'", common: ['Green Velvet Alocasia'], arch: 'alocHard', leaf: 'peltate', rarity: 2, value: 120, growSec: 420, unlock: 's2', region: 'Philippines', notes: 'Velvety green arrowheads with white veins; a houseplant favourite.', exotic: 'Frosted Velvet', palette: DARK },
  { id: 'alocasia-black-velvet', sci: "Alocasia reginula 'Black Velvet'", common: ['Black Velvet', 'Little Queen'], arch: 'alocHard', leaf: 'heart', rarity: 2, value: 115, growSec: 400, unlock: 's2', region: BORNEO, notes: 'Compact plant with near-black velvet leaves and ivory veins.', exotic: 'Ink Black', palette: DARK, traits: { leafColour: t(0.2, 0.1), leafSize: t(0.3) } },
  { id: 'alocasia-zebrina', sci: 'Alocasia zebrina', common: ['Zebra Alocasia', 'Elephant Ear'], arch: 'aloc', leaf: 'peltate', rarity: 2, value: 125, growSec: 450, unlock: 's2', region: 'Philippines', notes: 'Tall, tiger-striped leaf stalks carrying arrow-shaped leaves.', exotic: 'Striped Stalk' },
  { id: 'alocasia-macrorrhizos', sci: 'Alocasia macrorrhizos', common: ['Giant Taro', 'Elephant Ear'], arch: 'alocTough', leaf: 'heart', rarity: 2, value: 170, growSec: 520, unlock: 's3', region: 'Malesia to the Pacific', notes: 'A giant: leaves can reach a metre or more in warm, wet gardens.', exotic: 'Giant Green', traits: { leafSize: t(0.8) } },
  { id: 'alocasia-tiny-dancer', sci: "Alocasia 'Tiny Dancer'", common: ['Tiny Dancer'], arch: 'aloc', leaf: 'lance', rarity: 2, value: 190, growSec: 440, unlock: 's3', region: CULTIVAR, notes: 'A compact cultivar with narrow, wavy-edged leaves.', exotic: 'Pewter Frill', traits: { leafSize: t(0.3) } },
  { id: 'alocasia-jacklyn', sci: "Alocasia 'Jacklyn'", common: ['Jacklyn'], arch: 'aloc', leaf: 'split', rarity: 2, value: 200, growSec: 460, unlock: 's3', region: CULTIVAR, notes: 'Deeply lobed, finger-like leaves in a dark, glossy green.', exotic: 'Lacquer Green', traits: { leafShape: t(0.75) } },
  { id: 'alocasia-ninja', sci: "Alocasia 'Ninja'", common: ['Ninja'], arch: 'aloc', leaf: 'peltate', rarity: 3, value: 230, growSec: 460, unlock: 's3', region: CULTIVAR, notes: 'A sleek, dark, spear-leaved cultivar with pale veins.', exotic: 'Shadow Green', palette: DARK },
  { id: 'alocasia-yucatan-princess', sci: "Alocasia 'Yucatan Princess'", common: ['Yucatan Princess'], arch: 'alocHard', leaf: 'heart', rarity: 3, value: 210, growSec: 470, unlock: 's3', region: CULTIVAR, notes: 'Small, crinkled, velvety leaves with a silvery sheen.', exotic: 'Silver Sheen', palette: SILVER },
  { id: 'alocasia-stingray', sci: "Alocasia macrorrhizos 'Stingray'", common: ['Stingray Alocasia'], arch: 'aloc', leaf: 'strap', rarity: 3, value: 260, growSec: 500, unlock: 's3', region: CULTIVAR, notes: 'Long, tapering, stingray-tail leaves that fan out from the base.', exotic: 'Rippled Teal', traits: { leafShape: t(0.7) } },
  { id: 'alocasia-flying-squid', sci: "Alocasia 'Flying Squid'", common: ['Flying Squid'], arch: 'alocHard', leaf: 'strap', rarity: 3, value: 240, growSec: 480, unlock: 's3', region: CULTIVAR, notes: 'Narrow, tentacle-like wavy leaves on a clumping plant.', exotic: 'Ink Teal', traits: { leafShape: t(0.8) } },
  { id: 'alocasia-bisma', sci: "Alocasia 'Bisma'", common: ['Bisma'], arch: 'aloc', leaf: 'peltate', rarity: 3, value: 290, growSec: 480, unlock: 's3', region: CULTIVAR, notes: 'A dark, deeply veined cultivar with ruffled leaf margins.', exotic: 'Charcoal Ruffle', palette: DARK },
  { id: 'alocasia-curvy-zebrina', sci: "Alocasia zebrina 'Curvy'", common: ['Curvy Zebrina'], arch: 'aloc', leaf: 'peltate', rarity: 3, value: 250, growSec: 470, unlock: 's3', region: CULTIVAR, notes: 'A zebrina line with curving, twisting leaves and striped stems.', exotic: 'Twisted Stripe', traits: { leafShape: t(0.65) } },
  { id: 'alocasia-brancifolia', sci: 'Alocasia brancifolia', common: ['Brancifolia'], arch: 'aloc', leaf: 'lance', rarity: 3, value: 300, growSec: 480, unlock: 's3', region: SEA, notes: 'An upright, arrow-leaved Alocasia that makes a tidy clump.', exotic: 'Bronze Edge' },
  { id: 'alocasia-calidora', sci: 'Alocasia × calidora', common: ['Calidora', 'Giant Elephant Ear'], arch: 'alocTough', leaf: 'heart', rarity: 3, value: 270, growSec: 520, unlock: 's3', region: HYBRID, notes: 'A vigorous hybrid grown for sheer size and big, glossy leaves.', exotic: 'Gloss Giant', traits: { leafSize: t(0.75) } },
  { id: 'alocasia-portodora', sci: 'Alocasia × portodora', common: ['Portodora'], arch: 'alocTough', leaf: 'heart', rarity: 3, value: 280, growSec: 540, unlock: 's3', region: HYBRID, notes: 'A large garden hybrid of A. portei and A. odora with a bold, upright habit.', exotic: 'Jungle Gloss', traits: { leafSize: t(0.8) } },
  // ---- Alocasia: South-East Asian highlands expedition
  { id: 'alocasia-cuprea-red-secret', sci: 'Alocasia cuprea', common: ['Red Secret', 'Mirror Plant'], arch: 'alocHard', leaf: 'peltate', rarity: 4, value: 520, growSec: 850, unlock: 'sea', region: BORNEO, notes: 'Metallic copper-purple leaves with a mirror-like sheen.', exotic: 'Copper Mirror', palette: COPPER },
  { id: 'alocasia-dragon-scale', sci: "Alocasia baginda 'Dragon Scale'", common: ['Dragon Scale'], arch: 'alocHard', leaf: 'heart', rarity: 4, value: 560, growSec: 880, unlock: 'sea', region: BORNEO, notes: 'Deeply embossed, scaly leaves in dark green with silver edges.', exotic: 'Dragon Silver', palette: SILVER },
  { id: 'alocasia-silver-dragon', sci: "Alocasia baginda 'Silver Dragon'", common: ['Silver Dragon'], arch: 'alocHard', leaf: 'heart', rarity: 4, value: 650, growSec: 900, unlock: 'sea', region: BORNEO, notes: 'The silvery form of Dragon Scale, with sharply dark veining.', exotic: 'Quicksilver', palette: SILVER, traits: { leafColour: t(0.7) } },
  { id: 'alocasia-melo', sci: 'Alocasia melo', common: ['Melo'], arch: 'alocHard', leaf: 'round', rarity: 4, value: 700, growSec: 960, unlock: 'sea', region: BORNEO, notes: 'Thick, rounded, blistered leaves with a powdery bloom.', exotic: 'Frosted Grey', palette: BLUEGREY },
  { id: 'alocasia-nebula', sci: "Alocasia 'Nebula'", common: ['Nebula'], arch: 'alocHard', leaf: 'heart', rarity: 4, value: 600, growSec: 900, unlock: 'sea', region: HYBRID, notes: 'Velvet-textured leaves with a misty, smoky silver bloom.', exotic: 'Smoke Grey', palette: BLUEGREY },
  { id: 'alocasia-sarian', sci: "Alocasia 'Sarian'", common: ['Sarian'], arch: 'alocTough', leaf: 'peltate', rarity: 4, value: 520, growSec: 840, unlock: 'sea', region: HYBRID, notes: 'Big, dramatic, upward-pointing arrowheads on a fast clump.', exotic: 'Bold Arrow', traits: { leafSize: t(0.75) } },
  { id: 'alocasia-scalprum', sci: 'Alocasia scalprum', common: ['Scalprum'], arch: 'alocHard', leaf: 'strap', rarity: 4, value: 660, growSec: 920, unlock: 'sea', region: 'Philippines', notes: 'Narrow, blade-like leaves with a dark leathery finish.', exotic: 'Blade Black', palette: DARK },
  { id: 'alocasia-sinuata', sci: 'Alocasia sinuata', common: ['Sinuata'], arch: 'alocHard', leaf: 'split', rarity: 4, value: 540, growSec: 860, unlock: 'sea', region: 'Philippines', notes: 'Strongly wavy, scalloped leaf edges and a deeply veined surface.', exotic: 'Wave Green', traits: { leafShape: t(0.75) } },
  { id: 'alocasia-venom', sci: "Alocasia 'Venom'", common: ['Venom'], arch: 'alocHard', leaf: 'strap', rarity: 4, value: 580, growSec: 880, unlock: 'sea', region: CULTIVAR, notes: 'A dark cultivar with narrow, rippling, almost reptilian leaves.', exotic: 'Viper Dark', palette: DARK },
  { id: 'alocasia-watsoniana', sci: 'Alocasia watsoniana', common: ['Watsoniana'], arch: 'aloc', leaf: 'heart', rarity: 4, value: 740, growSec: 980, unlock: 'sea', region: SEA, notes: 'Massive, deeply puckered leaves with a quilted texture.', exotic: 'Quilted Giant', traits: { leafSize: t(0.8) } },
  { id: 'alocasia-lauterbachiana', sci: 'Alocasia lauterbachiana', common: ['Purple Sword'], arch: 'aloc', leaf: 'strap', rarity: 4, value: 480, growSec: 820, unlock: 'sea', region: BORNEO, notes: 'Long, scalloped swords with a purple underside.', exotic: 'Purple Blade', palette: PURPLE },
  { id: 'alocasia-gageana', sci: 'Alocasia gageana', common: ["Gage's Alocasia"], arch: 'alocTough', leaf: 'heart', rarity: 4, value: 500, growSec: 860, unlock: 'sea', region: SEA, notes: 'A large species with broad leaves and speckled, patterned stalks.', exotic: 'Mottled Stalk' },
  { id: 'alocasia-nobilis', sci: 'Alocasia nobilis', common: ['Nobilis'], arch: 'aloc', leaf: 'heart', rarity: 4, value: 540, growSec: 860, unlock: 'sea', region: SEA, notes: 'Thick, glossy, pleated leaves that stand out from the stem.', exotic: 'Pleated Jade' },
  { id: 'alocasia-regal-shield', sci: "Alocasia 'Regal Shield'", common: ['Regal Shield'], arch: 'alocTough', leaf: 'peltate', rarity: 4, value: 620, growSec: 900, unlock: 'sea', region: HYBRID, notes: 'Massive shield leaves in thick, deeply veined dark green.', exotic: 'Royal Green', traits: { leafSize: t(0.8) } },
  { id: 'alocasia-maharani', sci: "Alocasia 'Maharani'", common: ['Maharani', 'Grey Dragon'], arch: 'alocHard', leaf: 'round', rarity: 4, value: 700, growSec: 940, unlock: 'sea', region: CULTIVAR, notes: 'Thick, stiff, silver-grey leaves with a rippled surface.', exotic: 'Pewter Silver', palette: SILVER },
  // ---- Alocasia: legacy pack
  { id: 'alocasia-azlanii', sci: 'Alocasia azlanii', common: ['Jewel Alocasia'], arch: 'alocHard', leaf: 'peltate', rarity: 5, value: 3000, growSec: 1500, unlock: 'legacy', region: BORNEO, notes: 'Metallic plum-and-green leaves with sharp lime veins; small and demanding.', exotic: 'Metallic Plum', palette: PURPLE, seedMult: 0.7 },

  // =============================== ANTHURIUM ===================================================
  { id: 'anthurium-hookeri', sci: 'Anthurium hookeri', common: ["Bird's Nest Anthurium"], arch: 'antEpi', leaf: 'paddle', rarity: 2, value: 90, growSec: 420, unlock: 's2', region: 'Caribbean and northern South America', notes: 'A rosette of broad, glossy, spoon-shaped leaves; the easy Anthurium.', exotic: 'Glossy Lime', habit: 'rosette', traits: { envTolerance: t(0.6) } },
  { id: 'anthurium-clavigerum', sci: 'Anthurium clavigerum', common: ['Palm-leaf Anthurium'], arch: 'antEpi', leaf: 'split', rarity: 3, value: 180, growSec: 560, unlock: 's3', region: 'Amazonia and northern South America', notes: 'Hand-shaped leaves divided into long, narrow leaflets.', exotic: 'Jade Palm', habit: 'climber', traits: { leafShape: t(0.75) } },
  { id: 'anthurium-radicans', sci: 'Anthurium radicans', common: ['Radicans'], arch: 'antEpi', leaf: 'heart', rarity: 3, value: 200, growSec: 580, unlock: 's3', region: 'Brazil', notes: 'A creeping epiphyte with small, heart-shaped, quilted leaves.', exotic: 'Quilted Green', habit: 'climber' },
  { id: 'anthurium-pedatoradiatum', sci: 'Anthurium pedatoradiatum', common: ['Fingers Anthurium'], arch: 'antEpi', leaf: 'split', rarity: 3, value: 260, growSec: 620, unlock: 's3', region: 'Southern Mexico', notes: 'Finger-like, deeply divided leaves on arching stems.', exotic: 'Finger Green', habit: 'upright', traits: { leafShape: t(0.85) } },
  { id: 'anthurium-crystallinum', sci: 'Anthurium crystallinum', common: ['Crystal Anthurium'], arch: 'antVelvet', leaf: 'heart', rarity: 3, value: 340, growSec: 700, unlock: 's3', region: 'Colombia and Panama', notes: 'Velvet hearts with silver-white veins that catch the light.', exotic: 'Crystal Veined', habit: 'rosette', palette: DARK },
  { id: 'anthurium-clarinervium', sci: 'Anthurium clarinervium', common: ['Velvet Cardboard Anthurium'], arch: 'antVelvet', leaf: 'heart', rarity: 3, value: 380, growSec: 740, unlock: 's3', region: 'Chiapas, Mexico', notes: 'Thick, velvety hearts with bright white veining; grows on limestone.', exotic: 'White Veined', habit: 'rosette', palette: DARK },
  { id: 'anthurium-magnificum', sci: 'Anthurium magnificum', common: ['Magnificum'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 800, growSec: 1000, unlock: 'neo', region: 'Colombia', notes: 'Large velvet leaves with a dramatic, ruffled, pale-veined surface.', exotic: 'Velvet Ruffle', habit: 'rosette', palette: DARK, traits: { leafSize: t(0.75) } },
  { id: 'anthurium-forgetii', sci: 'Anthurium forgetii', common: ['Forgetii'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 850, growSec: 1000, unlock: 'neo', region: 'Colombia', notes: 'Rounded, velvety leaves with prominent white veins.', exotic: 'White Veined', habit: 'rosette', palette: DARK },
  { id: 'anthurium-veitchii', sci: 'Anthurium veitchii', common: ['King Anthurium'], arch: 'antVelvet', leaf: 'lance', rarity: 4, value: 950, growSec: 1100, unlock: 'neo', region: 'Colombia', notes: 'Long, pendent, deeply corrugated leaves that hang like ribbed banners.', exotic: 'Corrugated King', habit: 'epiphyte', traits: { leafSize: t(0.8) } },
  { id: 'anthurium-luxurians', sci: 'Anthurium luxurians', common: ['Luxurians'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 700, growSec: 960, unlock: 'neo', region: ANDES, notes: 'Quilted, puckered, bumpy leaves that look hand-embossed.', exotic: 'Quilted Velvet', habit: 'rosette' },
  { id: 'anthurium-papillilaminum', sci: 'Anthurium papillilaminum', common: ['Papillilaminum'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 780, growSec: 980, unlock: 'neo', region: ANDES, notes: 'Velvet leaves with a papery, finely textured, bubbled surface.', exotic: 'Papillate Velvet', habit: 'rosette', palette: DARK },
  { id: 'anthurium-pallidiflorum', sci: 'Anthurium pallidiflorum', common: ['Pallidiflorum'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 600, growSec: 940, unlock: 'neo', region: ANDES, notes: 'Broad, velvety leaves with a pale flower spike.', exotic: 'Pale Velvet', habit: 'rosette' },
  { id: 'anthurium-corrugatum', sci: 'Anthurium corrugatum', common: ['Corrugatum'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 650, growSec: 960, unlock: 'neo', region: ANDES, notes: 'Heavily wrinkled leaves, as if pressed between ridged plates.', exotic: 'Ridged Velvet', habit: 'rosette' },
  { id: 'anthurium-cutucuense', sci: 'Anthurium cutucuense', common: ['Cutucuense'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 900, growSec: 1040, unlock: 'neo', region: 'Eastern Ecuador (Cordillera de Cutucú)', notes: 'A shining, dark velvet species from a remote Ecuadorian range.', exotic: 'Cutucú Dark', habit: 'rosette', palette: DARK },
  { id: 'anthurium-rugulosum', sci: 'Anthurium rugulosum', common: ['Rugulosum'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 700, growSec: 960, unlock: 'neo', region: ANDES, notes: 'Finely wrinkled leaves with a soft velvet texture.', exotic: 'Wrinkled Velvet', habit: 'rosette' },
  { id: 'anthurium-metallicum', sci: 'Anthurium metallicum', common: ['Metallicum'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 740, growSec: 980, unlock: 'neo', region: 'Colombia', notes: 'Leaves with a bluish, metallic sheen and pale veins.', exotic: 'Steel Blue', habit: 'rosette', palette: BLUEGREY },
  { id: 'anthurium-besseae', sci: 'Anthurium besseae', common: ['Besseae'], arch: 'antVelvet', leaf: 'heart', rarity: 4, value: 820, growSec: 1000, unlock: 'neo', region: ANDES, notes: 'A silver-backed, velvety species with a refined, compact habit.', exotic: 'Silver Back', habit: 'rosette', palette: SILVER },
  { id: 'anthurium-wendlingeri', sci: 'Anthurium wendlingeri', common: ['Wendlingeri', 'Twisted Anthurium'], arch: 'antEpi', leaf: 'strap', rarity: 4, value: 560, growSec: 900, unlock: 'neo', region: 'Costa Rica', notes: 'Long, twisting, corkscrew leaves on an epiphytic plant.', exotic: 'Corkscrew', habit: 'epiphyte', traits: { leafShape: t(0.85) } },
  { id: 'anthurium-warocqueanum', sci: 'Anthurium warocqueanum', common: ['Queen Anthurium'], arch: 'antVelvet', leaf: 'lance', rarity: 5, value: 2400, growSec: 1600, unlock: 'andes', region: 'Colombia', notes: 'Enormous, narrow, velvet leaves up to a metre long, with silver veins.', exotic: 'Queen Velvet', habit: 'epiphyte', palette: DARK, seedMult: 0.8, traits: { leafSize: t(0.85) } },
  { id: 'anthurium-regale', sci: 'Anthurium regale', common: ['Royal Anthurium'], arch: 'antVelvet', leaf: 'heart', rarity: 5, value: 2000, growSec: 1500, unlock: 'andes', region: 'Peru', notes: 'Huge, arrow-shaped velvet leaves with broad white veins.', exotic: 'Royal Velvet', habit: 'epiphyte', palette: DARK, seedMult: 0.8, traits: { leafSize: t(0.85) } },
  { id: 'anthurium-balaoanum', sci: 'Anthurium balaoanum', common: ['Balaoanum'], arch: 'antVelvet', leaf: 'heart', rarity: 5, value: 3200, growSec: 1700, unlock: 'legacy', region: ANDES, notes: 'A velvety, ruffled showpiece valued by collectors for its sculpted leaves.', exotic: 'Sculpted Velvet', habit: 'epiphyte', palette: DARK, seedMult: 0.7 },

  // =============================== MONSTERA ====================================================
  { id: 'monstera-adansonii', sci: 'Monstera adansonii', common: ['Swiss Cheese Vine', 'Five Holes Plant'], arch: 'monst', leaf: 'split', rarity: 1, value: 38, growSec: 220, unlock: 's1', region: 'Central America, the Caribbean and northern South America', notes: 'A fast, fenestrated climber: oval leaves full of natural holes.', exotic: 'Holey Emerald', traits: { leafShape: t(0.55), growthRate: t(0.6) } },
  { id: 'monstera-dubia', sci: 'Monstera dubia', common: ['Shingle Plant'], arch: 'monst', leaf: 'heart', rarity: 2, value: 95, growSec: 400, unlock: 's2', region: 'Mexico to Peru and Brazil', notes: 'Flat, silver-patterned juvenile leaves shingle up the trunk before the plant matures.', exotic: 'Silver Shingle', palette: SILVER, traits: { leafColour: t(0.45) } },
  { id: 'monstera-standleyana', sci: 'Monstera standleyana', common: ['Five Holes Plant'], arch: 'monst', leaf: 'lance', rarity: 2, value: 110, growSec: 420, unlock: 's2', region: 'Nicaragua to Colombia', notes: 'Long, glossy leaves; popular in cream-variegated forms.', exotic: 'Cream Splash', traits: { variegation: t(0.2, 0.15) } },
  { id: 'monstera-siltepecana', sci: 'Monstera siltepecana', common: ['Silver Monstera'], arch: 'monst', leaf: 'oval', rarity: 2, value: 105, growSec: 400, unlock: 's2', region: 'Mexico to Panama', notes: 'Silver-blue juvenile leaves with green veins; adult leaves turn green and split.', exotic: 'Silver Blue', palette: SILVER },
  { id: 'monstera-pinnatipartita', sci: 'Monstera pinnatipartita', common: ['Pinnatipartita'], arch: 'monst', leaf: 'split', rarity: 4, value: 880, growSec: 1050, unlock: 'neo', region: ANDES + ' and Peru', notes: 'Deeply divided, feather-like adult leaves on a slender climber.', exotic: 'Feathered Green', traits: { leafShape: t(0.85) } },
  { id: 'monstera-obliqua', sci: 'Monstera obliqua', common: ['Obliqua', 'Swiss Cheese Vine (Peru form)'], arch: 'monst', leaf: 'split', rarity: 5, value: 4200, growSec: 2000, unlock: 'andes', region: 'Amazonia and the Andes', notes: 'More hole than leaf: a paper-thin lattice that is famously hard to keep alive.', exotic: 'Lace Lattice', seedMult: 0.8, traits: { leafShape: t(0.95), envTolerance: t(0.35) } },

  // =============================== PHILODENDRON ================================================
  { id: 'philodendron-brasil', sci: "Philodendron hederaceum 'Brasil'", common: ['Philodendron Brasil'], arch: 'phiClimb', leaf: 'heart', rarity: 1, value: 30, growSec: 170, unlock: 's1', region: 'Cultivar of a Mexican and Caribbean species', notes: 'A heartleaf philodendron with lime-and-green striped leaves; almost impossible to kill.', exotic: 'Lime Splash', habit: 'trailing', traits: { variegation: t(0.35, 0.14), envTolerance: t(0.7), diseaseResistance: t(0.6) } },
  { id: 'philodendron-lemon-lime', sci: "Philodendron hederaceum 'Lemon Lime'", common: ['Lemon Lime Philodendron'], arch: 'phiClimb', leaf: 'heart', rarity: 1, value: 33, growSec: 180, unlock: 's1', region: 'Cultivar of a Mexican and Caribbean species', notes: 'Bright chartreuse leaves that glow in low light.', exotic: 'Neon Lime', habit: 'trailing', palette: LIME, traits: { leafColour: t(0.18, 0.1), envTolerance: t(0.7) } },
  { id: 'philodendron-micans', sci: "Philodendron hederaceum var. 'Micans'", common: ['Velvet Leaf Philodendron'], arch: 'phiClimb', leaf: 'heart', rarity: 1, value: 40, growSec: 200, unlock: 's1', region: 'Mexico and Central America', notes: 'Soft, velvety, bronze-tinted heartleaves that trail gracefully.', exotic: 'Bronze Velvet', habit: 'trailing', palette: BURGUNDY, traits: { envTolerance: t(0.62) } },
  { id: 'philodendron-florida-green', sci: "Philodendron pedatum 'Florida Green'", common: ['Florida Green'], arch: 'phiClimb', leaf: 'split', rarity: 1, value: 44, growSec: 210, unlock: 's1', region: 'Venezuela, the Guianas and Trinidad (species)', notes: 'Lobed, oak-like leaves that become deeply divided as the plant climbs.', exotic: 'Oak Green', traits: { leafShape: t(0.55) } },
  { id: 'philodendron-birkin', sci: "Philodendron 'Birkin'", common: ['Birkin'], arch: 'phiSelf', leaf: 'oval', rarity: 2, value: 60, growSec: 360, unlock: 's2', region: HYBRID, notes: 'A sport with white pinstripes on dark leaves; stripes fade or return with the light.', exotic: 'Pinstripe White', traits: { variegation: t(0.3, 0.14) } },
  { id: 'philodendron-congo-rojo', sci: "Philodendron 'Congo Rojo'", common: ['Congo Rojo'], arch: 'phiSelf', leaf: 'paddle', rarity: 2, value: 70, growSec: 380, unlock: 's2', region: HYBRID, notes: 'Sturdy red-tinged paddle leaves that mature to a deep green.', exotic: 'Cardinal Red', palette: COPPER },
  { id: 'philodendron-imperial-green', sci: "Philodendron 'Imperial Green'", common: ['Imperial Green'], arch: 'phiSelf', leaf: 'paddle', rarity: 2, value: 75, growSec: 380, unlock: 's2', region: HYBRID, notes: 'Thick, glossy emerald paddles on a tough, upright plant.', exotic: 'Imperial Emerald', traits: { envTolerance: t(0.65) } },
  { id: 'philodendron-florida-beauty', sci: "Philodendron pedatum 'Florida Beauty'", common: ['Florida Beauty'], arch: 'phiVar', leaf: 'split', rarity: 2, value: 95, growSec: 420, unlock: 's2', region: CULTIVAR, notes: 'A variegated Florida line splashed with cream across lobed leaves.', exotic: 'Cream Splash', seedMult: 0.6 },
  { id: 'philodendron-red-emerald', sci: "Philodendron erubescens 'Red Emerald'", common: ['Red Emerald'], arch: 'phiClimb', leaf: 'heart', rarity: 2, value: 80, growSec: 330, unlock: 's2', region: 'Colombia (species)', notes: 'Dark green leaves with red-flushed stems and new growth.', exotic: 'Ruby Flush', habit: 'climber', palette: COPPER },
  { id: 'philodendron-silver-sword', sci: "Philodendron hastatum 'Silver Sword'", common: ['Silver Sword'], arch: 'phiClimb', leaf: 'lance', rarity: 2, value: 90, growSec: 380, unlock: 's2', region: 'Brazil (Atlantic Forest)', notes: 'Long, spear-shaped, frosted silver-blue leaves on a slow climber.', exotic: 'Frosted Silver', palette: SILVER, traits: { leafColour: t(0.7) } },
  { id: 'philodendron-painted-lady', sci: "Philodendron 'Painted Lady'", common: ['Painted Lady'], arch: 'phiVar', leaf: 'heart', rarity: 2, value: 85, growSec: 400, unlock: 's2', region: CULTIVAR, notes: 'Lime-yellow and green leaves with a painted look and red petioles.', exotic: 'Painted Gold', palette: LIME, seedMult: 0.6, traits: { variegation: t(0.4, 0.14) } },
  { id: 'philodendron-black-cardinal', sci: "Philodendron 'Black Cardinal'", common: ['Black Cardinal'], arch: 'phiSelf', leaf: 'paddle', rarity: 2, value: 100, growSec: 420, unlock: 's2', region: HYBRID, notes: 'New leaves flush bronze-red and settle into a near-black burgundy.', exotic: 'Black Cardinal', palette: BLACKRED, traits: { leafColour: t(0.82, 0.1) } },
  { id: 'philodendron-burle-marx-fantasy', sci: "Philodendron 'Burle Marx Fantasy'", common: ['Burle Marx Fantasy'], arch: 'phiSelf', leaf: 'split', rarity: 3, value: 150, growSec: 440, unlock: 's3', region: HYBRID, notes: 'Broad, wavy, lobed leaves on a dense self-heading plant.', exotic: 'Fantasy Green', traits: { leafShape: t(0.6) } },
  { id: 'philodendron-dean-mcdowell', sci: "Philodendron 'Dean McDowell'", common: ['Dean McDowell'], arch: 'phiClimb', leaf: 'heart', rarity: 3, value: 170, growSec: 450, unlock: 's3', region: HYBRID, notes: 'Large, thick hearts with a distinctive blue-green cast.', exotic: 'Blue Green', palette: BLUEGREY },
  { id: 'philodendron-moonlight', sci: "Philodendron 'Moonlight'", common: ['Moonlight'], arch: 'phiSelf', leaf: 'paddle', rarity: 3, value: 200, growSec: 420, unlock: 's3', region: HYBRID, notes: 'Neon-lime, glowing new leaves on a compact, bushy plant.', exotic: 'Moonglow Lime', palette: LIME, traits: { leafColour: t(0.15, 0.1) } },
  { id: 'philodendron-majestic', sci: "Philodendron 'Majestic'", common: ['Majestic'], arch: 'phiSelf', leaf: 'paddle', rarity: 3, value: 190, growSec: 480, unlock: 's3', region: HYBRID, notes: 'Huge, wide, deep-green leaves on a statement self-heading plant.', exotic: 'Majestic Green', traits: { leafSize: t(0.8) } },
  { id: 'philodendron-imperial-red', sci: "Philodendron 'Imperial Red'", common: ['Imperial Red'], arch: 'phiSelf', leaf: 'paddle', rarity: 3, value: 210, growSec: 450, unlock: 's3', region: HYBRID, notes: 'Burgundy new growth on glossy, thick paddles.', exotic: 'Imperial Burgundy', palette: BURGUNDY },
  { id: 'philodendron-prince-of-orange', sci: "Philodendron 'Prince of Orange'", common: ['Prince of Orange'], arch: 'phiSelf', leaf: 'paddle', rarity: 3, value: 240, growSec: 440, unlock: 's3', region: HYBRID, notes: 'Each new leaf opens in shades of orange before turning green.', exotic: 'Orange Flush', palette: ORANGE },
  { id: 'philodendron-white-princess', sci: "Philodendron erubescens 'White Princess'", common: ['White Princess'], arch: 'phiVar', leaf: 'heart', rarity: 3, value: 300, growSec: 520, unlock: 's3', region: CULTIVAR, notes: 'Marbled white-and-green leaves on a slow, collectable climber.', exotic: 'Marbled White', seedMult: 0.5, traits: { variegation: t(0.55, 0.15) } },
  { id: 'philodendron-pink-princess', sci: "Philodendron erubescens 'Pink Princess'", common: ['Pink Princess'], arch: 'phiVar', leaf: 'heart', rarity: 3, value: 350, growSec: 540, unlock: 's3', region: CULTIVAR, notes: 'Near-black leaves splashed with bubblegum pink; each plant is unique.', exotic: 'Bubblegum Pink', palette: PINK, seedMult: 0.5, traits: { variegation: t(0.6, 0.15) } },
  { id: 'philodendron-florida-ghost', sci: "Philodendron pedatum 'Florida Ghost'", common: ['Florida Ghost'], arch: 'phiClimb', leaf: 'split', rarity: 3, value: 240, growSec: 460, unlock: 's3', region: CULTIVAR, notes: 'New leaves emerge ghostly white, then slowly turn green.', exotic: 'Ghost White', palette: LIME, traits: { leafColour: t(0.2, 0.1), leafShape: t(0.6) } },
  { id: 'philodendron-caramel-marble', sci: "Philodendron 'Caramel Marble'", common: ['Caramel Marble'], arch: 'phiVar', leaf: 'heart', rarity: 3, value: 270, growSec: 480, unlock: 's3', region: CULTIVAR, notes: 'Variegated leaves marbled with cream and caramel tones.', exotic: 'Caramel Swirl', palette: ORANGE, seedMult: 0.5, traits: { variegation: t(0.5, 0.15) } },
  { id: 'philodendron-strawberry-shake', sci: "Philodendron 'Strawberry Shake'", common: ['Strawberry Shake'], arch: 'phiVar', leaf: 'heart', rarity: 3, value: 320, growSec: 520, unlock: 's3', region: HYBRID, notes: 'Pink, cream and orange blotches that fade to green as leaves age.', exotic: 'Strawberry Cream', palette: PINK, seedMult: 0.5, traits: { variegation: t(0.55, 0.15) } },
  { id: 'philodendron-jose-buono', sci: "Philodendron 'Jose Buono'", common: ['Jose Buono'], arch: 'phiVar', leaf: 'heart', rarity: 3, value: 380, growSec: 540, unlock: 's3', region: HYBRID, notes: 'Large, thick, dramatically splashed white variegation on glossy leaves.', exotic: 'Snow Splash', seedMult: 0.5, traits: { variegation: t(0.6, 0.15) } },
  { id: 'philodendron-el-choco-red', sci: "Philodendron erubescens 'El Choco Red'", common: ['El Choco Red'], arch: 'phiClimb', leaf: 'heart', rarity: 3, value: 260, growSec: 480, unlock: 's3', region: 'Chocó, Colombia', notes: 'Deep red petioles and a burgundy back on thick, glossy leaves.', exotic: 'Chocó Red', palette: COPPER },
  { id: 'philodendron-gloriosum', sci: 'Philodendron gloriosum', common: ['Gloriosum'], arch: 'phiRhizome', leaf: 'heart', rarity: 4, value: 720, growSec: 950, unlock: 'neo', region: 'Colombia', notes: 'Huge velvety hearts with white veins, carried on a creeping rhizome.', exotic: 'Velvet Ivory', palette: DARK, traits: { leafSize: t(0.75) } },
  { id: 'philodendron-melanochrysum', sci: 'Philodendron melanochrysum', common: ['Black Gold Philodendron'], arch: 'phiVelvet', leaf: 'heart', rarity: 4, value: 900, growSec: 1000, unlock: 'neo', region: 'Colombia', notes: 'Velvety black-green leaves with a golden sheen that elongate as it climbs.', exotic: 'Black Gold', palette: DARK },
  { id: 'philodendron-mamei', sci: "Philodendron mamei", common: ['Silver Cloud', 'Quilted Silver Leaf'], arch: 'phiRhizome', leaf: 'heart', rarity: 4, value: 560, growSec: 880, unlock: 'neo', region: 'Ecuador', notes: 'Heart leaves puckered and mottled with silver on a creeping stem.', exotic: 'Silver Cloud', palette: SILVER },
  { id: 'philodendron-luxurians', sci: 'Philodendron luxurians', common: ['Luxurians'], arch: 'phiVelvet', leaf: 'heart', rarity: 4, value: 640, growSec: 900, unlock: 'neo', region: ANDES, notes: 'A velvet-leaf species with distinctive pale markings along the veins.', exotic: 'Velvet Ghost', palette: DARK },
  { id: 'philodendron-white-knight', sci: "Philodendron 'White Knight'", common: ['White Knight'], arch: 'phiVar', leaf: 'heart', rarity: 4, value: 700, growSec: 950, unlock: 'neo', region: CULTIVAR, notes: 'Dark leaves and stems with crisp white variegation; slower and costlier than its cousins.', exotic: 'Knight White', seedMult: 0.4, traits: { variegation: t(0.65, 0.15) } },
  { id: 'philodendron-white-wizard', sci: "Philodendron 'White Wizard'", common: ['White Wizard'], arch: 'phiVar', leaf: 'split', rarity: 4, value: 850, growSec: 980, unlock: 'neo', region: CULTIVAR, notes: 'Self-heading, wavy leaves painted white and green in unpredictable patterns.', exotic: 'Wizard White', seedMult: 0.4, traits: { variegation: t(0.7, 0.15) } },
  { id: 'philodendron-ring-of-fire', sci: "Philodendron 'Ring of Fire'", common: ['Ring of Fire'], arch: 'phiVar', leaf: 'split', rarity: 4, value: 620, growSec: 900, unlock: 'neo', region: HYBRID, notes: 'Lobed leaves splashed with orange, red and cream when grown in bright light.', exotic: 'Fire Ring', palette: ORANGE, seedMult: 0.5, traits: { variegation: t(0.55, 0.15) } },
  { id: 'philodendron-tortum', sci: 'Philodendron tortum', common: ['Tortum'], arch: 'phiClimb', leaf: 'split', rarity: 4, value: 1400, growSec: 1100, unlock: 'atl', region: 'Brazil (Atlantic Forest)', notes: 'Finely divided, narrow, twisting leaves on a slow climber.', exotic: 'Twisted Lace', habit: 'climber', traits: { leafShape: t(0.9) } },
  { id: 'philodendron-mayoi', sci: 'Philodendron mayoi', common: ['Palm-leaf Philodendron', 'Mayoi'], arch: 'phiClimb', leaf: 'split', rarity: 4, value: 1500, growSec: 1100, unlock: 'atl', region: 'Brazil', notes: 'Palm-like, divided leaves dangling like ribbons from a climbing stem.', exotic: 'Palm Ribbon', habit: 'climber', traits: { leafShape: t(0.85) } },
  { id: 'philodendron-gigas', sci: 'Philodendron gigas', common: ['Giant Philodendron', 'Gigas'], arch: 'phiVelvet', leaf: 'heart', rarity: 5, value: 3600, growSec: 1800, unlock: 'legacy', region: 'Panama and Colombia', notes: 'Enormous velvet hearts that grow bigger with every leaf on a climbing stem.', exotic: 'Velvet Giant', palette: DARK, seedMult: 0.7, traits: { leafSize: t(0.9) } },
];
