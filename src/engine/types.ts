// Core data model. Everything in GameState is plain JSON so saves are trivial.

export const GENE_IDS = [
  'growthRate',
  'leafSize',
  'leafShape',
  'leafColour',
  'variegation',
  'rootDevelopment',
  'envTolerance',
  'waterReq',
  'nutrientReq',
  'diseaseResistance',
  'propagationEfficiency',
  'mutationPotential',
] as const;
export type GeneId = (typeof GENE_IDS)[number];

/** One allele: value (0..1) and dominance (0..1). */
export interface Allele {
  v: number;
  d: number;
}
export type Gene = [Allele, Allele];
export type Genome = Record<GeneId, Gene>;

export type Stage = 'seedling' | 'juvenile' | 'mature';
export type PropKind = 'seed' | 'stem' | 'leaf' | 'division' | 'clone' | 'tissue' | 'young';
export type MediumId = 'peatMix' | 'aroidMix' | 'cocoPerlite' | 'leca' | 'sphagnum' | 'barkMix' | 'gritMix';
export type PotId = 'standard' | 'selfWatering' | 'passiveHydro';
export type DeptId = 'cultivation' | 'tissue' | 'genetics' | 'research';
export type StaffRole = 'grower' | 'technician' | 'geneticist' | 'researcher' | 'manager';
export type LogKind = 'info' | 'good' | 'warn' | 'bad' | 'discovery';
export type InfectionKind = 'fungal' | 'pests' | 'rot';

export interface HistoryEntry {
  t: number;
  msg: string;
}
export interface Infection {
  kind: InfectionKind;
  sev: number;
}

export interface Plant {
  id: number;
  sp: string;
  hy?: string;
  name: string;
  genome: Genome;
  gen: number;
  parents: [number | null, number | null];
  origin: string;
  sport: boolean;
  born: number;
  growth: number;
  stage: Stage;
  health: number;
  hydration: number;
  nutrients: number;
  roots: number;
  inf: Infection | null;
  room: number | null;
  slot: number;
  medium: MediumId;
  pot: PotId;
  analysis: 0 | 1 | 2 | 3;
  tags: string[];
  cultivar?: string;
  keeper: boolean;
  mother: boolean;
  cool: number;
  vigor: number;
  hist: HistoryEntry[];
}

export interface Propagule {
  id: number;
  kind: PropKind;
  sp: string;
  hy?: string;
  genome: Genome;
  gen: number;
  parents: [number | null, number | null];
  origin: string;
  sport: boolean;
  q: number;
  vigor: number;
  cultivar?: string;
}

export interface RoomEquipment {
  lighting: number;
  climate: number;
  humidity: number;
  irrigation: number;
  nutrients: number;
  airflow: number;
}
export interface RoomSettings {
  light: number;
  photoperiod: number;
  temp: number;
  humidity: number;
  airflow: number;
  feed: number;
}
export interface RoomActual {
  light: number;
  temp: number;
  humidity: number;
  airflow: number;
  stability: number;
}
export interface Room {
  id: number;
  name: string;
  slots: (number | null)[];
  equip: RoomEquipment;
  set: RoomSettings;
  act: RoomActual;
}

export interface Staff {
  id: number;
  role: StaffRole;
  name: string;
  level: number;
}

export interface AnalysisJob {
  id: number;
  plant: number;
  level: 1 | 2 | 3;
  progress: number;
  total: number;
}
export interface BreedJob {
  id: number;
  a: number;
  b: number;
  sp: string;
  hy?: string;
  kind: 'self' | 'same' | 'hybrid';
  progress: number;
  total: number;
  seeds: number;
  viability: number;
  ga: Genome;
  gb: Genome;
  genA: number;
  genB: number;
  nameA: string;
  nameB: string;
}
export interface CloneJob {
  id: number;
  plant: number;
  name: string;
  sp: string;
  hy?: string;
  genome: Genome;
  gen: number;
  cultivar?: string;
  parents: [number | null, number | null];
  progress: number;
  total: number;
  n: number;
}
export interface TissueBatch {
  id: number;
  sp: string;
  hy?: string;
  genome: Genome;
  gen: number;
  cultivar?: string;
  srcName: string;
  cycles: number;
  phase: 0 | 1 | 2 | 3;
  progress: number;
  total: number;
  units: number;
  lost: number;
  parents: [number | null, number | null];
}

export interface ActiveProject {
  id: string;
  progress: number;
  total: number;
}
export interface DiscoveryRecord {
  t: number;
  plant: number;
  plantName: string;
}
export interface SpecimenRecord {
  id: number;
  sp: string;
  hy?: string;
  name: string;
  t: number;
  genome: Genome;
  tags: string[];
  origin: string;
  gen: number;
  value: number;
}
export interface Cultivar {
  id: string;
  name: string;
  sp: string;
  hy?: string;
  tags: string[];
  t: number;
  royalty: number;
  rarity: number;
}

export type ContractReq =
  | { kind: 'gene'; gene: GeneId; min: number }
  | { kind: 'tag'; tag: string }
  | { kind: 'hybrid' };
export interface Contract {
  id: number;
  sp: string;
  buyer: string;
  reqs: ContractReq[];
  reward: number;
  rp: number;
  rep: number;
  expires: number;
}
export interface MarketEvent {
  id: number;
  t: number;
  until: number;
  sp: string; // species id or 'all'
  mag: number;
  msg: string;
}

export interface LogEntry {
  id: number;
  t: number;
  kind: LogKind;
  msg: string;
}

export interface SellRules {
  minValue: number;
  keepAnalysed: boolean;
  keepDiscoveries: boolean;
  keepRarity: number; // keep plants of species with rarity >= this (6 = never)
  maxPerSpecies: number; // keep at most N unsold mature plants per species (0 = unlimited)
  holdForIndex: number; // only sell when species market index >= this
}

export interface Stats {
  earned: number;
  earnedRun: number;
  spent: number;
  sold: number;
  matured: number;
  died: number;
  bred: number;
  seedsMade: number;
  cloned: number;
  tissueMade: number;
  analysed: number;
  contracts: number;
  techs: number;
  rpEarned: number;
  maxPlants: number;
}

export interface Legacy {
  points: number;
  spent: number;
  ups: Record<string, number>;
  runs: number;
  /** Discoveries that have already earned legacy points, so a reset only pays for new ones. */
  discPaid?: number;
}

export interface Settings {
  speed: number;
  autosave: boolean;
  compact: boolean;
}

export interface Market {
  index: Record<string, number>;
  events: MarketEvent[];
  contracts: Contract[];
  rep: number;
  nextContract: number;
  nextEvent: number;
  hist: Record<string, number[]>;
}

export interface Automation {
  on: Record<string, boolean>;
  sell: SellRules;
  budget: number;
}

export type Jobs = {
  analysis: AnalysisJob[];
  breeding: BreedJob[];
  cloning: CloneJob[];
  tissue: TissueBatch[];
};

export interface Mods {
  growth: number;
  research: number;
  rpFlat: number;
  analysisSpeed: number;
  analysisSlots: number;
  breedSlots: number;
  breedSpeed: number;
  cloneSlots: number;
  cloneYield: number;
  tcSlots: number;
  tcYield: number;
  tcSpeed: number;
  tcContam: number;
  tcMutation: number;
  propSuccess: number;
  propSpeed: number;
  mutation: number;
  novel: number;
  discovery: number;
  sellPrice: number;
  seedPrice: number;
  offlineCap: number;
  offlineEff: number;
  stability: number;
  diseaseResist: number;
  researchSlots: number;
  maxRooms: number;
  roomSlots: number;
  germination: number;
  contractSlots: number;
  royalty: number;
  wage: number;
  energy: number;
  staffCap: number;
  autoRate: number;
  storage: number;
  rareBonus: number;
  waterUse: number;
  nutrientUse: number;
  analysisCost: number;
  flags: Record<string, boolean>;
}
export type NumMod = Exclude<keyof Mods, 'flags'>;

export interface GameState {
  v: number;
  rng: number;
  time: number;
  totalTime: number;
  savedAt: number;
  money: number;
  rp: number;
  stage: number;
  nextId: number;
  plants: Plant[];
  stock: Plant[];
  props: Propagule[];
  rooms: Room[];
  depts: Record<DeptId, number>;
  upgrades: Record<string, number>;
  staff: Staff[];
  done: Record<string, number>;
  active: ActiveProject[];
  jobs: Jobs;
  discoveries: Record<string, DiscoveryRecord>;
  seen: Record<string, number>;
  unlocked: string[];
  records: SpecimenRecord[];
  cultivars: Cultivar[];
  market: Market;
  auto: Automation;
  legacy: Legacy;
  stats: Stats;
  log: LogEntry[];
  settings: Settings;
  income: number;
  expense: number;
  mods: Mods;
  modsDirty: boolean;
}

export interface OfflineReport {
  seconds: number;
  credited: number;
  money: number;
  rp: number;
  matured: number;
  died: number;
  discoveries: number;
  techs: number;
  jobs: number;
  neglected: number;
}
