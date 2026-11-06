// Static game configuration: stages, facility upgrades, equipment, media, pots, staff and legacy.

import type { DeptId, MediumId, NumMod, PotId, RoomEquipment, StaffRole } from './types';
import type { Effect } from './techs';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'j2grows.save.v1';
export const DAY = 60; // real seconds per in-game day (cosmetic)
export const MAX_LOG = 80;
export const MAX_RECORDS = 300;
export const MAX_HIST = 14;
export const BASE_OFFLINE_HOURS = 4;
export const BASE_OFFLINE_EFF = 0.5;
export const BASE_PROP_CAP = 40;
export const BASE_STOCK_CAP = 24;

// ---------------------------------------------------------------------------------------------
// Facility stages
// ---------------------------------------------------------------------------------------------

export interface StageDef {
  n: number;
  name: string;
  blurb: string;
  cost: number;
  needMatured: number;
  needDisc: number;
  needTech?: string;
  baseRooms: number;
  baseSlots: number;
  perks: string[];
}

export const STAGES: StageDef[] = [
  { n: 1, name: 'Personal Growing Room', blurb: 'A small collection of plants, basic equipment and manual cultivation.', cost: 0, needMatured: 0, needDisc: 0, baseRooms: 1, baseSlots: 6, perks: ['Buy seeds and young plants', 'Manual watering and feeding', 'Basic research'] },
  { n: 2, name: 'Propagation Facility', blurb: 'Cuttings, cloning, tissue culture and small-scale production.', cost: 400, needMatured: 10, needDisc: 0, baseRooms: 2, baseSlots: 8, perks: ['Cuttings, division and leaf propagation', 'Cloning and the tissue culture lab (via research)', 'More species', 'Watering automation (via research)'] },
  { n: 3, name: 'Genetics Laboratory', blurb: 'Genetic analysis, breeding experiments and rare trait discovery.', cost: 2500, needMatured: 25, needDisc: 3, needTech: 'prop_cuttings', baseRooms: 3, baseSlots: 10, perks: ['Genetics department: analysis and cross-breeding', 'Hire your first staff', 'Collector contracts (via research)'] },
  { n: 4, name: 'Botanical Research Centre', blurb: 'Multiple departments, specialist employees and advanced scientific equipment.', cost: 60000, needMatured: 60, needDisc: 18, needTech: 'gen_mendel', baseRooms: 5, baseSlots: 12, perks: ['Premium species expeditions', 'Hybridisation, sequencing and automation', 'Legacy system unlocked'] },
  { n: 5, name: 'Commercial Greenhouse', blurb: 'Large-scale cultivation, automated production and commercial distribution.', cost: 600000, needMatured: 150, needDisc: 40, needTech: 'com_collectors', baseRooms: 7, baseSlots: 14, perks: ['Robotic harvesting and automated sales', 'Legendary species', 'Intergeneric crosses'] },
  { n: 6, name: 'Advanced Research Institution', blurb: 'A vast, highly automated botanical research organisation with virtually unlimited expansion.', cost: 6000000, needMatured: 400, needDisc: 80, needTech: 'gen_seq', baseRooms: 10, baseSlots: 16, perks: ['Gene editing and machine-learned genomics', 'Unlimited facility expansion', 'Maximum legacy rewards'] },
];

// ---------------------------------------------------------------------------------------------
// Room equipment
// ---------------------------------------------------------------------------------------------

export interface EquipDef {
  id: keyof RoomEquipment;
  name: string;
  desc: string;
  max: number;
  base: number;
  growth: number;
}
export const EQUIP: EquipDef[] = [
  { id: 'lighting', name: 'Grow Lighting', desc: 'Raises the maximum light intensity the room can supply.', max: 5, base: 100, growth: 2.3 },
  { id: 'climate', name: 'Climate Control', desc: 'Holds temperature at the setpoint against the ambient swing.', max: 5, base: 140, growth: 2.3 },
  { id: 'humidity', name: 'Humidity Control', desc: 'Humidifiers and dehumidifiers that hold relative humidity.', max: 5, base: 90, growth: 2.3 },
  { id: 'irrigation', name: 'Irrigation Lines', desc: 'Capacity for automatic watering (requires the Watering Lines technology).', max: 5, base: 180, growth: 2.3 },
  { id: 'nutrients', name: 'Nutrient Dosing', desc: 'Dosing pumps that feed plants efficiently (requires Fertigation).', max: 5, base: 160, growth: 2.3 },
  { id: 'airflow', name: 'Air Circulation', desc: 'Fans raise the maximum airflow and reduce disease.', max: 5, base: 70, growth: 2.3 },
];
export const equipCost = (e: EquipDef, level: number): number => Math.round(e.base * e.growth ** level);

export const maxLight = (lvl: number): number => Math.min(100, 45 + 11 * lvl);
export const climateStrength = (lvl: number): number => 0.12 + 0.17 * lvl;
export const maxAirflow = (lvl: number): number => 30 + 14 * lvl;
export const irrigationRate = (lvl: number): number => 0.25 * lvl;

export const roomBuildCost = (n: number): number => Math.round(300 * 2.4 ** Math.max(0, n - 1));
export const roomSlotCost = (slots: number): number => Math.round(55 * 1.3 ** slots);

// ---------------------------------------------------------------------------------------------
// Media and pots
// ---------------------------------------------------------------------------------------------

export interface MediumDef {
  id: MediumId;
  name: string;
  desc: string;
  evap: number; // evaporation multiplier
  drain: number; // 0..1, drainage (waterlogging protection)
  cost: number;
  needs?: string; // flag
}
export const MEDIA_DEFS: Record<MediumId, MediumDef> = {
  peatMix: { id: 'peatMix', name: 'Peat & Perlite', desc: 'Moisture-retentive general mix.', evap: 0.85, drain: 0.5, cost: 1.5 },
  aroidMix: { id: 'aroidMix', name: 'Aroid Mix', desc: 'Chunky bark, perlite and coir: airy and fast-draining.', evap: 1, drain: 0.75, cost: 2 },
  cocoPerlite: { id: 'cocoPerlite', name: 'Coco & Perlite', desc: 'Balanced and forgiving.', evap: 0.95, drain: 0.7, cost: 2 },
  sphagnum: { id: 'sphagnum', name: 'Sphagnum Moss', desc: 'Holds a great deal of water; great for humid lovers.', evap: 0.75, drain: 0.35, cost: 3 },
  barkMix: { id: 'barkMix', name: 'Orchid Bark', desc: 'Very airy, ideal for epiphytes.', evap: 1.2, drain: 0.95, cost: 3 },
  gritMix: { id: 'gritMix', name: 'Gritty Mineral Mix', desc: 'Sharp drainage for succulents.', evap: 1.35, drain: 0.95, cost: 2 },
  leca: { id: 'leca', name: 'LECA Clay Pebbles', desc: 'Inert clay balls; the classic hydroponic medium.', evap: 1.25, drain: 0.95, cost: 3, needs: 'passiveHydro' },
};

export interface PotDef {
  id: PotId;
  name: string;
  desc: string;
  evap: number;
  cost: number;
  needs?: string;
}
export const POT_DEFS: Record<PotId, PotDef> = {
  standard: { id: 'standard', name: 'Standard Pot', desc: 'A plain terracotta or plastic pot.', evap: 1, cost: 0 },
  selfWatering: { id: 'selfWatering', name: 'Self-Watering Pot', desc: 'A wicking reservoir slows moisture loss.', evap: 0.55, cost: 4, needs: 'selfWatering' },
  passiveHydro: { id: 'passiveHydro', name: 'Passive Hydro Pot', desc: 'A sealed reservoir that holds moisture almost constant.', evap: 0.18, cost: 9, needs: 'passiveHydro' },
};

// ---------------------------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------------------------

export interface RoleDef {
  id: StaffRole;
  name: string;
  desc: string;
  hire: number;
  wage: number;
}
export const ROLES: Record<StaffRole, RoleDef> = {
  grower: { id: 'grower', name: 'Grower', desc: 'Waters, feeds and treats plants in your rooms (0.18 actions/s per level).', hire: 250, wage: 0.12 },
  technician: { id: 'technician', name: 'Lab Technician', desc: 'Speeds up tissue culture and lowers contamination.', hire: 600, wage: 0.2 },
  geneticist: { id: 'geneticist', name: 'Geneticist', desc: 'Speeds up analysis and improves discovery rewards.', hire: 1500, wage: 0.35 },
  researcher: { id: 'researcher', name: 'Researcher', desc: 'Generates research points around the clock.', hire: 900, wage: 0.3 },
  manager: { id: 'manager', name: 'Sales Manager', desc: 'Negotiates higher prices and speeds up automation.', hire: 2500, wage: 0.5 },
};
export const STAFF_NAMES = ['Ava', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farid', 'Grace', 'Hiro', 'Imani', 'Jonas', 'Kira', 'Liam', 'Mina', 'Noah', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Vik', 'Wen', 'Xavier', 'Yara', 'Zane'];
export const staffCap = (stage: number): number => [0, 0, 0, 3, 8, 20, 50][stage] ?? 50;
export const hireCost = (role: StaffRole, count: number): number => Math.round(ROLES[role].hire * 1.45 ** count);
export const trainCost = (role: StaffRole, level: number): number => Math.round(ROLES[role].hire * 1.8 ** level);
export const wageOf = (role: StaffRole, level: number): number => ROLES[role].wage * level ** 1.2;
export const MAX_STAFF_LEVEL = 10;

// ---------------------------------------------------------------------------------------------
// Facility upgrades
// ---------------------------------------------------------------------------------------------

export interface UpgradeDef {
  id: string;
  dept: DeptId | 'facility';
  name: string;
  desc: string;
  max: number;
  cost: number;
  growth: number;
  stage: number;
  needFlag?: string;
  needUpgrade?: [string, number];
  effects: Effect[];
}
const mul = (k: NumMod, m: number): Effect => ({ k, mul: m });
const add = (k: NumMod, a: number): Effect => ({ k, add: a });

export const UPGRADES: UpgradeDef[] = [
  // Cultivation
  { id: 'lvl_cultivation', dept: 'cultivation', name: 'Cultivation Department', desc: 'Each level allows another grow room and speeds up growth by 2%.', max: 20, cost: 350, growth: 2.6, stage: 1, effects: [add('maxRooms', 1), mul('growth', 1.02)] },
  { id: 'cult_media', dept: 'cultivation', name: 'Substrate Mixing Bench', desc: 'Better germination and slightly slower evaporation.', max: 5, cost: 200, growth: 2.2, stage: 1, effects: [add('germination', 0.03), mul('waterUse', 0.97)] },
  { id: 'cult_storage', dept: 'cultivation', name: 'Propagule Storage', desc: '+10 propagule slots and +5 sale stock slots.', max: 12, cost: 150, growth: 1.7, stage: 1, effects: [add('storage', 10)] },
  // Tissue culture
  { id: 'lvl_tissue', dept: 'tissue', name: 'Tissue Culture Laboratory', desc: 'Each level adds a sterile workstation.', max: 10, cost: 1500, growth: 2.8, stage: 2, needFlag: 'tissueCulture', effects: [add('tcSlots', 1)] },
  { id: 'tc_media', dept: 'tissue', name: 'Media Kitchen', desc: '+12% plantlet yield per level.', max: 6, cost: 900, growth: 2.3, stage: 2, needUpgrade: ['lvl_tissue', 1], effects: [mul('tcYield', 1.12)] },
  { id: 'tc_flow', dept: 'tissue', name: 'Laminar Flow Cabinets', desc: '-15% contamination risk per level.', max: 6, cost: 1100, growth: 2.3, stage: 2, needUpgrade: ['lvl_tissue', 1], effects: [mul('tcContam', 0.85)] },
  { id: 'tc_shelves', dept: 'tissue', name: 'Culture Growth Shelves', desc: '+12% culture speed per level.', max: 6, cost: 1000, growth: 2.3, stage: 2, needUpgrade: ['lvl_tissue', 1], effects: [mul('tcSpeed', 1.12)] },
  // Genetics
  { id: 'lvl_genetics', dept: 'genetics', name: 'Genetics Laboratory', desc: 'Opens the genetics department. Each level adds an analysis bench.', max: 10, cost: 7000, growth: 2.8, stage: 3, effects: [add('analysisSlots', 1)] },
  { id: 'gen_bench', dept: 'genetics', name: 'Analysis Benches', desc: 'Run more specimen analyses in parallel.', max: 8, cost: 3500, growth: 2.2, stage: 3, needUpgrade: ['lvl_genetics', 1], effects: [add('analysisSlots', 1)] },
  { id: 'gen_breeding', dept: 'genetics', name: 'Breeding Stations', desc: 'Run more crosses in parallel.', max: 8, cost: 4500, growth: 2.2, stage: 3, needUpgrade: ['lvl_genetics', 1], effects: [add('breedSlots', 1)] },
  { id: 'gen_cloners', dept: 'genetics', name: 'Cloning Chambers', desc: 'More parallel clone jobs, and +0.5 clones per job per level.', max: 6, cost: 4000, growth: 2.3, stage: 3, needFlag: 'cloning', needUpgrade: ['lvl_genetics', 1], effects: [add('cloneSlots', 1), add('cloneYield', 0.5)] },
  { id: 'gen_database', dept: 'genetics', name: 'Genetic Database Cluster', desc: '+8% discovery rewards per level.', max: 8, cost: 6000, growth: 2.4, stage: 3, needUpgrade: ['lvl_genetics', 1], effects: [mul('discovery', 1.08)] },
  { id: 'gen_sequencer', dept: 'genetics', name: 'Sequencing Hardware', desc: '+15% analysis speed per level.', max: 6, cost: 8000, growth: 2.4, stage: 3, needUpgrade: ['lvl_genetics', 1], effects: [mul('analysisSpeed', 1.15)] },
  // Research
  { id: 'lvl_research', dept: 'research', name: 'Research Department', desc: 'Each level adds a little baseline research and a bit of speed.', max: 20, cost: 250, growth: 2.6, stage: 1, effects: [add('rpFlat', 0.04), mul('research', 1.03)] },
  { id: 'res_bench', dept: 'research', name: 'Research Benches', desc: '+0.08 research points per second per level.', max: 12, cost: 300, growth: 2.2, stage: 1, effects: [add('rpFlat', 0.08)] },
  { id: 'res_slots', dept: 'research', name: 'Project Offices', desc: 'Run another research project in parallel.', max: 6, cost: 1200, growth: 3.2, stage: 1, effects: [add('researchSlots', 1)] },
  { id: 'res_library', dept: 'research', name: 'Botanical Library', desc: '+10% research output per level.', max: 8, cost: 800, growth: 2.3, stage: 1, effects: [mul('research', 1.1)] },
  { id: 'res_instruments', dept: 'research', name: 'Analytical Instruments', desc: '+6% discovery rewards and cheaper analyses per level.', max: 6, cost: 2500, growth: 2.6, stage: 3, effects: [mul('discovery', 1.06), mul('analysisCost', 0.95)] },
  { id: 'res_cluster', dept: 'research', name: 'Computing Cluster', desc: '+12% research output per level.', max: 8, cost: 15000, growth: 2.5, stage: 4, effects: [mul('research', 1.12)] },
  // Facility
  { id: 'fac_solar', dept: 'facility', name: 'Solar Array', desc: '-12% running costs per level.', max: 6, cost: 2000, growth: 2.4, stage: 2, effects: [mul('energy', 0.88)] },
  { id: 'fac_monitor', dept: 'facility', name: 'Overnight Monitoring', desc: '+2 hours offline progress and +5% offline efficiency per level.', max: 8, cost: 1500, growth: 2, stage: 1, effects: [add('offlineCap', 2), add('offlineEff', 0.05)] },
  { id: 'fac_sales', dept: 'facility', name: 'Sales Office', desc: '+3% sale prices per level.', max: 8, cost: 900, growth: 2.3, stage: 2, effects: [mul('sellPrice', 1.03)] },
  { id: 'fac_control', dept: 'facility', name: 'Environmental Controllers', desc: '+4% environmental stability per level.', max: 5, cost: 1800, growth: 2.5, stage: 2, effects: [add('stability', 0.04)] },
];
export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const upgradeCost = (u: UpgradeDef, level: number): number => Math.round(u.cost * u.growth ** level);

// ---------------------------------------------------------------------------------------------
// Legacy (prestige)
// ---------------------------------------------------------------------------------------------

export interface LegacyDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  cost: number;
  growth: number;
  effects: Effect[];
}
export const LEGACY: LegacyDef[] = [
  { id: 'research', name: 'Endowed Chairs', desc: '+10% research output per level.', max: 20, cost: 1, growth: 1.35, effects: [mul('research', 1.1)] },
  { id: 'discovery', name: 'Taxonomic Instinct', desc: '+8% discovery rewards per level.', max: 15, cost: 1, growth: 1.4, effects: [mul('discovery', 1.08)] },
  { id: 'growth', name: 'Heirloom Seedstock', desc: '+6% growth speed per level.', max: 15, cost: 1, growth: 1.4, effects: [mul('growth', 1.06)] },
  { id: 'mutation', name: 'Genetic Drift', desc: '+8% mutation rate per level.', max: 12, cost: 2, growth: 1.45, effects: [mul('mutation', 1.08)] },
  { id: 'price', name: 'Prestige Brand', desc: '+5% sale prices per level.', max: 15, cost: 1, growth: 1.4, effects: [mul('sellPrice', 1.05)] },
  { id: 'offline', name: 'Night Shift', desc: '+3 hours offline progress and +4% offline efficiency per level.', max: 10, cost: 1, growth: 1.35, effects: [add('offlineCap', 3), add('offlineEff', 0.04)] },
  { id: 'tc', name: 'Quantum Incubators', desc: '+15% tissue culture speed per level.', max: 8, cost: 2, growth: 1.5, effects: [mul('tcSpeed', 1.15)] },
  { id: 'cash', name: "Founders' Grant", desc: 'Start each run with 4x more cash per level (base $200).', max: 8, cost: 1, growth: 1.5, effects: [] },
  { id: 'head', name: 'Head Start', desc: 'Start each run one stage higher per level (max stage 4).', max: 3, cost: 3, growth: 2.2, effects: [] },
  { id: 'auto', name: 'Standing Automation', desc: 'Automation technologies survive a reset.', max: 1, cost: 8, growth: 1, effects: [] },
  { id: 'memory', name: 'Institutional Memory', desc: 'Stage 1-2 technologies survive a reset.', max: 1, cost: 5, growth: 1, effects: [] },
  { id: 'species', name: 'Legacy Species Pack', desc: 'Unlocks three legendary legacy species.', max: 1, cost: 6, growth: 1, effects: [] },
  { id: 'branch', name: 'Synthetic Botany Branch', desc: 'Unlocks a seventh research branch with powerful late-game technologies.', max: 1, cost: 15, growth: 1, effects: [] },
];
export const LEGACY_BY_ID: Record<string, LegacyDef> = Object.fromEntries(LEGACY.map((l) => [l.id, l]));
export const legacyCost = (l: LegacyDef, level: number): number => Math.ceil(l.cost * l.growth ** level);

// ---------------------------------------------------------------------------------------------
// Misc economy constants
// ---------------------------------------------------------------------------------------------

export const START_MONEY = 200;
export const SEED_PACK = 3;
export const TC_FLASK = 6;
export const PRICE_SEED = 0.55; // per pack, x baseValue
export const PRICE_YOUNG = 1.15;
export const PRICE_CUTTING = 0.4;
export const PRICE_FLASK = 1.0;
