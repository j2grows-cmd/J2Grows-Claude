// Research & technology tree: six categories from the design doc, plus species expeditions and
// a seventh "Synthetic Botany" branch that opens through the prestige system.

import type { NumMod } from './types';

export type TechCat = 'genetics' | 'cultivation' | 'propagation' | 'mutation' | 'automation' | 'commercial' | 'synthetic' | 'expedition';

export interface Effect {
  k?: NumMod;
  add?: number;
  mul?: number;
  flag?: string;
}

export interface TechDef {
  id: string;
  name: string;
  cat: TechCat;
  desc: string;
  stage: number;
  rp: number;
  money: number;
  time: number;
  req: string[];
  effects: Effect[];
  discoveries?: number; // minimum unique discoveries needed
  species?: string[]; // species unlocked (expeditions)
}

export const TECH_CATS: { id: TechCat; name: string; blurb: string }[] = [
  { id: 'genetics', name: 'Genetics & Heredity', blurb: 'Read genomes, predict inheritance and cross species.' },
  { id: 'cultivation', name: 'Cultivation & Environmental Science', blurb: 'Control light, climate, water and substrate.' },
  { id: 'propagation', name: 'Propagation & Tissue Culture', blurb: 'Cuttings, cloning and sterile mass propagation.' },
  { id: 'mutation', name: 'Mutation & Evolution', blurb: 'Steer sports, novel alleles and directed evolution.' },
  { id: 'automation', name: 'Laboratory Automation', blurb: 'Hand the repetitive work to machines.' },
  { id: 'commercial', name: 'Commercial Production', blurb: 'Markets, collectors, registries and licensing.' },
  { id: 'expedition', name: 'Species Discovery', blurb: 'Field expeditions that unlock rare species.' },
  { id: 'synthetic', name: 'Synthetic Botany', blurb: 'An advanced branch unlocked through the legacy system.' },
];

const t = (
  id: string, cat: TechCat, name: string, stage: number, rp: number, money: number, time: number,
  req: string[], desc: string, effects: Effect[], extra: Partial<TechDef> = {},
): TechDef => ({ id, cat, name, stage, rp, money, time, req, desc, effects, ...extra });

const mul = (k: NumMod, m: number): Effect => ({ k, mul: m });
const add = (k: NumMod, a: number): Effect => ({ k, add: a });
const flag = (f: string): Effect => ({ flag: f });

export const TECHS: TechDef[] = [
  // ---- Cultivation & Environmental Science ----------------------------------------------
  t('env_monitor', 'cultivation', 'Environmental Monitoring', 1, 6, 40, 15, [], 'Sensor probes tighten environmental stability.', [add('stability', 0.05)]),
  t('env_reservoir', 'cultivation', 'Self-Watering Reservoirs', 1, 12, 120, 30, ['env_monitor'], 'Unlocks self-watering pots that evaporate far more slowly.', [flag('selfWatering')]),
  t('env_nutrients', 'cultivation', 'Balanced Nutrient Schedules', 1, 18, 180, 40, [], 'Plants use less fertiliser and grow a little faster.', [mul('nutrientUse', 0.85), mul('growth', 1.04)]),
  t('env_airflow', 'cultivation', 'Pathogen-Control Airflow', 2, 40, 500, 60, ['env_monitor'], 'Better circulation cuts infection risk.', [add('diseaseResist', 0.1)]),
  t('env_climate', 'cultivation', 'Climate Control Systems', 2, 45, 650, 80, ['env_monitor'], 'Heating and humidity systems hold setpoints more tightly.', [add('stability', 0.1)]),
  t('env_hydro', 'cultivation', 'Passive Hydro Culture', 2, 70, 1000, 100, ['env_reservoir'], 'Unlocks passive hydro pots with a wicking reservoir: near-constant moisture.', [flag('passiveHydro')]),
  t('env_spectrum', 'cultivation', 'Full-Spectrum LED Lighting', 3, 160, 4000, 150, ['env_climate'], 'Efficient grow lights: faster growth and lower power draw.', [mul('growth', 1.08), mul('energy', 0.8)]),
  t('env_substrate', 'cultivation', 'Engineered Substrates', 3, 220, 5500, 170, ['env_hydro'], 'Improved germination and moisture retention.', [add('germination', 0.1), mul('waterUse', 0.9)]),
  t('env_predict', 'cultivation', 'Predictive Microclimate AI', 4, 650, 32000, 300, ['env_spectrum'], 'Anticipates drift and corrects before plants notice.', [add('stability', 0.2), mul('growth', 1.08)]),
  t('env_vertical', 'cultivation', 'Vertical Rack Systems', 5, 2600, 300000, 600, ['env_predict'], 'Every grow room gains four extra slots.', [add('roomSlots', 4)]),
  t('env_closed', 'cultivation', 'Closed-Loop Biospheres', 6, 9000, 2500000, 900, ['env_vertical'], 'Recycled water and heat: faster growth, a fraction of the running costs.', [mul('growth', 1.2), mul('energy', 0.6), mul('waterUse', 0.6)]),
  // ---- Propagation & Tissue Culture ---------------------------------------------------------
  t('prop_cuttings', 'propagation', 'Cutting Technique', 2, 18, 220, 40, [], 'Unlocks stem cuttings from mature plants.', [flag('stemCuttings'), add('propSuccess', 0.05)]),
  t('prop_leaf', 'propagation', 'Leaf & Division Techniques', 2, 30, 350, 60, ['prop_cuttings'], 'Unlocks leaf cuttings and clump division.', [flag('leafCuttings')]),
  t('prop_rooting', 'propagation', 'Rooting Hormones', 2, 45, 550, 70, ['prop_cuttings'], 'Higher cutting success and shorter recovery between cuts.', [add('propSuccess', 0.08), mul('propSpeed', 0.9)]),
  t('prop_seeds', 'propagation', 'Seed Saving & Selfing', 2, 55, 650, 90, [], 'Unlocks self-pollination and improves germination.', [flag('selfing'), add('germination', 0.05)]),
  t('prop_cloning', 'propagation', 'Clonal Propagation', 2, 110, 1800, 120, ['prop_rooting'], 'Unlocks cloning chambers that copy any plant exactly.', [flag('cloning')]),
  t('prop_tc', 'propagation', 'Aseptic Technique', 2, 95, 1400, 120, ['prop_rooting'], 'Unlocks the tissue culture laboratory.', [flag('tissueCulture')]),
  t('prop_media', 'propagation', 'Optimised Culture Media', 3, 240, 5000, 160, ['prop_tc'], 'Tissue culture yields 30% more plantlets.', [mul('tcYield', 1.3)]),
  t('prop_sterile', 'propagation', 'Laminar-Flow Sterility', 3, 290, 7500, 180, ['prop_tc'], 'Contamination risk is halved.', [mul('tcContam', 0.5)]),
  t('prop_acclimate', 'propagation', 'Acclimatisation Protocols', 3, 200, 4500, 140, ['prop_tc'], 'Plantlets harden off faster and establish better.', [add('germination', 0.1), mul('tcSpeed', 1.15)]),
  t('prop_bioreactor', 'propagation', 'Bioreactor Mass Cloning', 4, 900, 60000, 320, ['prop_media'], 'Industrial yields and two extra workstations.', [mul('tcYield', 1.5), add('tcSlots', 2)]),
  t('prop_seedbank', 'propagation', 'Seed Bank & Cryo-storage', 4, 600, 40000, 260, ['prop_seeds'], 'Larger storage and better long-term seed viability.', [add('storage', 40), add('germination', 0.1)]),
  t('prop_meristem', 'propagation', 'Meristem Mass Production', 5, 2400, 280000, 500, ['prop_bioreactor'], 'Faster, higher-yield tissue culture cycles.', [mul('tcSpeed', 1.4), mul('tcYield', 1.3)]),
  // ---- Mutation & Evolution -------------------------------------------------------------------
  t('mut_sports', 'mutation', 'Observing Bud Sports', 3, 140, 2800, 120, ['prop_cuttings'], 'Systematic attention to mutants raises the mutation rate.', [mul('mutation', 1.25)]),
  t('mut_soma', 'mutation', 'Somaclonal Variation', 3, 250, 6000, 180, ['prop_tc', 'mut_sports'], 'Tissue culture generates variants twice as often.', [mul('tcMutation', 2)]),
  t('mut_induced', 'mutation', 'Induced Mutagenesis', 4, 800, 52000, 300, ['mut_sports'], 'Controlled mutagens boost mutation substantially.', [mul('mutation', 1.5)]),
  t('mut_novel', 'mutation', 'Novel Allele Surveys', 4, 1200, 90000, 360, ['mut_induced'], 'Mutations are twice as likely to produce brand-new alleles.', [mul('novel', 2)]),
  t('mut_directed', 'mutation', 'Directed Evolution', 5, 3200, 420000, 600, ['mut_novel'], 'Selection pressure at scale: more mutation and better discovery yields.', [mul('mutation', 1.4), mul('discovery', 1.25)]),
  t('mut_unstable', 'mutation', 'Controlled Instability', 5, 4200, 600000, 700, ['mut_directed'], 'Deliberately destabilised lines produce striking novelties.', [mul('novel', 1.8), mul('tcMutation', 1.6)]),
  t('mut_evolve', 'mutation', 'Accelerated Evolution', 6, 12000, 4000000, 1000, ['mut_unstable'], 'Evolution on a leash.', [mul('mutation', 1.6), mul('discovery', 1.4)]),
  // ---- Genetics & Heredity --------------------------------------------------------------------
  t('gen_mendel', 'genetics', 'Mendelian Principles', 3, 180, 3000, 120, [], 'Faster analysis and a preview of how parents combine.', [mul('analysisSpeed', 1.2), flag('breedPreview')]),
  t('gen_geno', 'genetics', 'Marker Genotyping', 3, 340, 8500, 180, ['gen_mendel'], 'Unlocks level-2 genotype scans: see both alleles of every gene.', [flag('analysis2')]),
  t('gen_hybrid', 'genetics', 'Interspecific Hybridisation', 3, 420, 14000, 220, ['gen_mendel'], 'Cross different species within the same genus.', [flag('hybridisation')]),
  t('gen_db', 'genetics', 'Genetic Databases', 4, 520, 30000, 240, ['gen_geno'], 'A genomic database multiplies discovery rewards.', [mul('discovery', 1.25)]),
  t('gen_predict', 'genetics', 'Inheritance Modelling', 4, 720, 42000, 280, ['gen_geno'], 'Predicted offspring distributions in the breeding station.', [flag('breedPredict')]),
  t('gen_seq', 'genetics', 'Genome Sequencing', 4, 1100, 75000, 330, ['gen_geno'], 'Unlocks level-3 full sequencing and faster analysis.', [flag('analysis3'), mul('analysisSpeed', 1.3)]),
  t('gen_inter', 'genetics', 'Intergeneric Crosses', 5, 3400, 480000, 600, ['gen_hybrid', 'mut_novel'], 'Cross plants from different genera within one family.', [flag('intergeneric')]),
  t('gen_edit', 'genetics', 'Targeted Gene Editing', 6, 10000, 3500000, 900, ['gen_seq'], 'Directly edit alleles in sequenced plants.', [flag('geneEdit')]),
  t('gen_ai', 'genetics', 'Machine-Learned Genomics', 6, 14000, 6000000, 1100, ['gen_edit'], 'Analysis is twice as fast and half the price.', [mul('analysisSpeed', 2), mul('analysisCost', 0.5)]),
  // ---- Laboratory Automation ------------------------------------------------------------------
  t('auto_water', 'automation', 'Automated Watering Lines', 2, 60, 900, 100, ['env_reservoir'], 'Irrigation lines water every plant when it is thirsty.', [flag('autoWater')]),
  t('auto_feed', 'automation', 'Automated Fertigation', 3, 170, 4200, 140, ['auto_water', 'env_nutrients'], 'Feeds plants automatically.', [flag('autoFeed')]),
  t('auto_treat', 'automation', 'Integrated Pest Management', 3, 190, 4800, 150, ['env_airflow'], 'Detects and treats infections automatically.', [flag('autoTreat')]),
  t('auto_env', 'automation', 'Automated Environmental Management', 3, 260, 7000, 170, ['env_climate'], 'Rooms retune themselves to suit their occupants.', [flag('autoEnv'), add('stability', 0.1)]),
  t('auto_analyse', 'automation', 'Automated Phenotyping', 4, 560, 34000, 240, ['gen_mendel'], 'Queues analysis for new plants automatically.', [flag('autoAnalyse')]),
  t('auto_plant', 'automation', 'Robotic Potting', 4, 620, 38000, 260, ['auto_water'], 'Plants propagules into empty slots automatically.', [flag('autoPlant')]),
  t('auto_propagate', 'automation', 'Automated Propagation Cells', 4, 780, 48000, 300, ['prop_cuttings', 'auto_plant'], 'Mother plants are cut automatically on a schedule.', [flag('autoPropagate')]),
  t('auto_harvest', 'automation', 'Robotic Harvesting', 5, 2000, 240000, 420, ['auto_plant'], 'Mature plants are moved into sale stock automatically.', [flag('autoHarvest')]),
  t('auto_sales', 'automation', 'Automated Sales Platform', 5, 2200, 260000, 440, ['auto_harvest', 'com_market'], 'Sale stock is sold automatically by your rules.', [flag('autoSell')]),
  t('auto_tissue', 'automation', 'Tissue-Culture Robotics', 5, 2600, 320000, 480, ['prop_tc', 'auto_plant'], 'Keeps your tissue culture stations running on their own.', [flag('autoTissue')]),
  t('auto_gantry', 'automation', 'Gantry Robotics', 5, 3000, 420000, 520, ['auto_harvest'], 'Doubles the work automation can do per second.', [mul('autoRate', 2)]),
  t('auto_optimise', 'automation', 'Production Optimisation', 6, 9500, 3000000, 900, ['auto_gantry'], 'Lean operations: faster growth, lower wages, quicker automation.', [mul('growth', 1.15), mul('wage', 0.8), mul('autoRate', 1.5)]),
  // ---- Commercial Production ----------------------------------------------------------------------
  t('com_market', 'commercial', 'Wholesale Contacts', 2, 28, 300, 45, [], 'Better trade prices on everything you sell.', [mul('sellPrice', 1.08)]),
  t('com_collectors', 'commercial', 'Collector Network', 3, 170, 3800, 130, ['com_market'], 'Collectors post commissions for specific plants.', [flag('contracts'), add('contractSlots', 2)]),
  t('com_registry', 'commercial', 'Cultivar Registration', 3, 240, 6000, 170, ['com_market'], 'Register named cultivars that earn passive royalties.', [flag('cultivars')]),
  t('com_liners', 'commercial', 'Wholesale Liners Programme', 3, 210, 5200, 150, ['prop_tc', 'com_market'], 'Sell tissue-cultured plantlets in bulk.', [flag('sellTissue')]),
  t('com_seeds', 'commercial', 'Commercial Seed Lines', 4, 480, 24000, 240, ['com_registry'], 'Sell seed lots to the trade.', [flag('seedSales'), mul('seedPrice', 1.5)]),
  t('com_brand', 'commercial', 'J2Grows Premium Brand', 4, 780, 58000, 300, ['com_collectors'], 'Your name carries a price premium, especially on rarities.', [mul('sellPrice', 1.15), mul('rareBonus', 1.15)]),
  t('com_export', 'commercial', 'International Export', 5, 2400, 290000, 480, ['com_brand'], 'New markets: higher prices and an extra commission slot.', [mul('sellPrice', 1.2), add('contractSlots', 1)]),
  t('com_licensing', 'commercial', 'Licensing Agreements', 5, 2300, 270000, 460, ['com_registry'], 'Cultivar royalties rise 80%.', [mul('royalty', 1.8)]),
  t('com_auction', 'commercial', 'Rare Plant Auctions', 5, 3000, 400000, 540, ['com_export'], 'Rarities fetch auction premiums.', [mul('rareBonus', 1.3)]),
  t('com_empire', 'commercial', 'Global Botanical Empire', 6, 12000, 5000000, 1000, ['com_auction'], 'A household name in horticulture.', [mul('sellPrice', 1.3)]),
  // ---- Species expeditions -----------------------------------------------------------------------
  t('exp_neotropics', 'expedition', 'Neotropical Aroid Expedition', 4, 400, 20000, 300, [], 'Unlock the velvet Anthuriums and prized climbing Philodendrons of the Neotropics, and bring back a first haul of seed.', [], { species: ['anthurium-magnificum', 'anthurium-forgetii', 'philodendron-gloriosum', 'philodendron-melanochrysum'], discoveries: 8 }),
  t('exp_sea', 'expedition', 'South-East Asian Highlands Expedition', 4, 450, 24000, 320, [], 'Unlock the jewel Alocasias of Borneo, the Philippines and the Malay highlands, and bring back a first haul of corms.', [], { species: ['alocasia-cuprea-red-secret', 'alocasia-dragon-scale', 'alocasia-melo'], discoveries: 8 }),
  t('exp_andes', 'expedition', 'Andean Cloud Forest Expedition', 5, 2000, 220000, 480, ['exp_neotropics'], 'Secure legendary cloud-forest aroids: the Queen and Royal Anthuriums and the lace-leaved Monstera obliqua.', [], { species: ['anthurium-warocqueanum', 'anthurium-regale', 'monstera-obliqua'], discoveries: 25 }),
  t('exp_atlantic', 'expedition', 'Atlantic Forest Conservation Expedition', 5, 2600, 300000, 520, ['exp_neotropics'], 'Work with conservation partners in the Atlantic Forest to secure the divided-leaf climbers Tortum and Mayoi.', [], { species: ['philodendron-tortum', 'philodendron-mayoi'], discoveries: 25 }),
  // ---- Synthetic Botany (legacy branch) ----------------------------------------------------------
  t('syn_chloro', 'synthetic', 'Synthetic Chloroplasts', 4, 3000, 400000, 600, [], 'Engineered photosynthesis for faster growth.', [mul('growth', 1.2)]),
  t('syn_roots', 'synthetic', 'Programmable Root Systems', 4, 3600, 500000, 650, ['syn_chloro'], 'Hardier roots with lower water needs.', [add('diseaseResist', 0.15), mul('waterUse', 0.7)]),
  t('syn_morph', 'synthetic', 'Morphogen Control', 5, 6000, 900000, 800, ['syn_roots'], 'Controlled developmental chaos.', [mul('mutation', 1.5), mul('novel', 1.5)]),
  t('syn_biolab', 'synthetic', 'Bio-Fabricated Laboratories', 5, 8000, 1500000, 900, ['syn_morph'], 'Grown, not built: more slots and storage.', [add('roomSlots', 4), add('storage', 60)]),
  t('syn_ultimate', 'synthetic', 'Chimeric Genome Architecture', 6, 20000, 8000000, 1200, ['syn_biolab'], 'The final frontier of botanical research.', [mul('discovery', 1.5), mul('sellPrice', 1.25)]),
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((x) => [x.id, x]));
