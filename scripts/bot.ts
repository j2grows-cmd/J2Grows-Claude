// A simple scripted player used for balance testing and integration tests.
// It plays roughly like a competent human: waters, sells, buys, researches and expands.

import {
  EQUIP, STAGES, equipCost, roomSlotCost, SPECIES_LIST, discoveryCount, TECHS, UPGRADES, advanceStage, autoTuneRoom, availableSpecies, buildRoom, buy, buyEquip, buyUpgrade,
  canCut, careRoom, expandRoom, firstFreeSlot, hire, matchesContract, nextRoomCost, placePropagule, plantValue, propCap,
  roomSlotCap, sellPlant, setFlag, startAnalysis, startBreeding, startClone, startProject, startTissue, takeCutting,
  fulfillContract, canPrestige, techState, feedPlant, treatPlant, waterPlant, tcMaxCycles, upgradeStatus, bestMedium, effectiveSpecies, registerCultivar,
  type CutKind, type GameState, type Plant,
} from '../src/engine';

const TECH_ORDER = [
  'com_market', 'env_reservoir', 'prop_cuttings', 'auto_water', 'prop_rooting', 'prop_leaf', 'prop_seeds', 'prop_tc', 'prop_cloning',
  'env_nutrients', 'env_monitor', 'env_climate', 'env_airflow', 'gen_mendel', 'exp_neotropics', 'exp_sea', 'gen_geno', 'com_collectors',
  'com_registry', 'auto_feed', 'auto_treat', 'auto_env', 'mut_sports', 'prop_media', 'gen_hybrid', 'prop_sterile', 'mut_soma', 'env_hydro',
  'com_liners', 'gen_db', 'gen_seq', 'auto_plant', 'auto_analyse', 'auto_propagate', 'prop_bioreactor', 'mut_induced', 'com_brand',
  'exp_andes', 'exp_atlantic', 'auto_harvest', 'auto_sales', 'auto_tissue', 'com_seeds', 'auto_gantry', 'com_export', 'com_licensing',
  'mut_novel', 'env_spectrum', 'env_predict',
];
const UP_ORDER = [
  'res_bench', 'lvl_cultivation', 'res_library', 'res_slots', 'cult_storage', 'lvl_tissue', 'lvl_genetics', 'gen_bench', 'gen_breeding',
  'tc_media', 'fac_sales', 'gen_cloners', 'res_instruments', 'gen_database', 'lvl_research', 'fac_monitor', 'tc_shelves', 'tc_flow',
  'res_cluster', 'fac_control', 'gen_sequencer', 'fac_solar',
];

export interface BotLog {
  stageAt: Record<number, number>;
  /** Game time at which the first legacy reset became possible. */
  prestigeAt?: number;
  techAt: Record<string, number>;
  snaps: { t: number; stage: number; money: number; rp: number; plants: number; disc: number; techs: number; income: number }[];
}

export function makeBotLog(): BotLog {
  return { stageAt: { 1: 0 }, techAt: {}, snaps: [] };
}

const freeSlots = (s: GameState): number => s.rooms.reduce((a, r) => a + r.slots.filter((x) => x == null).length, 0);


const LEVEL_CAP: Record<string, number> = { lvl_cultivation: 6, lvl_tissue: 4, lvl_genetics: 5, lvl_research: 5 };
const levelOf = (s: GameState, id: string): number => s.upgrades[id] ?? 0;

function chase(s: GameState, blog: BotLog, saving: boolean): void {
  type Goal = { kind: 'tech' | 'up'; id: string; cost: number; rank: number };
  const next = STAGES[s.stage];
  const cheap = saving && next ? next.cost * 0.12 : Infinity; // while saving for a stage only small purchases are made
  const techs: Goal[] = TECHS.filter((t) => techState(s, t).status === 'available' && s.rp >= t.rp && t.money <= cheap)
    .map((t) => ({ kind: 'tech' as const, id: t.id, cost: t.money, rank: TECH_ORDER.indexOf(t.id) < 0 ? 999 : TECH_ORDER.indexOf(t.id) }))
    .sort((a, b) => a.rank - b.rank || a.cost - b.cost);
  // With no further stage to save for, a finishing player buys every upgrade level.
  const finishing = !STAGES[s.stage];
  const ups: Goal[] = saving ? [] : UPGRADES.filter((u) => upgradeStatus(s, u.id).ok && levelOf(s, u.id) < (finishing ? 99 : LEVEL_CAP[u.id] ?? 2))
    .map((u) => ({ kind: 'up' as const, id: u.id, cost: upgradeStatus(s, u.id).cost, rank: UP_ORDER.indexOf(u.id) < 0 ? 999 : UP_ORDER.indexOf(u.id) }))
    .sort((a, b) => a.rank - b.rank || a.cost - b.cost);
  const free = s.active.length < s.mods.researchSlots;
  // Once the last stage is reached the research tree is the goal: finish it before spending on upgrades.
  const cands = finishing && free && techs.length ? techs.slice(0, 2).sort((a, b) => a.cost - b.cost) : [...(free ? techs.slice(0, 2) : []), ...ups.slice(0, 2)].sort((a, b) => a.cost - b.cost);
  const goal = cands[0];
  if (!goal || s.money < goal.cost * 1.02 + 40) return;
  if (goal.kind === 'tech') { if (startProject(s, goal.id).ok) blog.techAt[goal.id] = s.time; }
  else buyUpgrade(s, goal.id);
}

const totalSlots = (s: GameState): number => s.rooms.reduce((a, r) => a + r.slots.length, 0);

export function botAct(s: GameState, blog: BotLog): void {
  const f = s.mods.flags;
  const autoCare = f.autoWater && f.autoFeed;

  // Save up for the next facility stage once its non-money requirements are met.
  const next = STAGES[s.stage];
  const saving = !!next && s.stats.matured >= next.needMatured && discoveryCount(s) >= next.needDisc && (!next.needTech || !!s.done[next.needTech]) && s.money < next.cost * 1.05;

  // --- environment ---
  for (const r of s.rooms) {
    if (r.slots.some((x) => x != null)) autoTuneRoom(s, r.id);
    const want: Record<string, number> = s.stage <= 1
      ? { lighting: 1, climate: 0, humidity: 1, airflow: 0, irrigation: 0, nutrients: 0 }
      : { lighting: 3, climate: 2, humidity: 2, airflow: 1, irrigation: f.autoWater ? 2 : 0, nutrients: f.autoFeed ? 1 : 0 };
    if (!saving) for (const e of EQUIP) if (r.equip[e.id] < want[e.id] && s.money > equipCost(e, r.equip[e.id]) * 1.5 + 40) buyEquip(s, r.id, e.id);
  }

  // --- care (manual until automation) ---
  for (const p of s.plants) {
    const e = effectiveSpecies(p.sp, p.hy).env;
    if (!f.autoWater && p.hydration < e.dryBack + 6) waterPlant(s, p);
    if (!f.autoFeed && p.nutrients < e.nutrient[0] + 4) feedPlant(s, p);
    if (!f.autoTreat && p.inf) treatPlant(s, p);
  }
  void careRoom;

  // --- contracts ---
  for (const c of [...s.market.contracts]) {
    const p = [...s.plants, ...s.stock].find((x) => matchesContract(c, x));
    if (p) fulfillContract(s, c.id, p.id);
  }

  // --- mothers, analysis, cultivars ---
  if (s.stage >= 2) {
    const have = new Set(s.plants.filter((p) => p.mother).map((p) => p.sp));
    for (const p of s.plants) {
      if (p.stage === 'mature' && !have.has(p.sp) && !p.hy && s.plants.filter((x) => x.mother).length < Math.min(6, Math.max(1, Math.floor(s.plants.length / 4)))) {
        setFlag(s, p.id, 'mother');
        have.add(p.sp);
      }
    }
  }
  if (s.stage >= 3) {
    for (const p of s.plants) {
      if (p.stage === 'mature' && p.analysis === 0 && s.jobs.analysis.length < 3) startAnalysis(s, p.id);
      if (p.tags.length && p.analysis >= 1 && p.stage === 'mature' && !p.cultivar && f.cultivars && s.money > 3000) registerCultivar(s, p.id, '');
      if (p.tags.length && !p.keeper && s.plants.filter((x) => x.keeper).length < Math.min(6, Math.max(1, Math.floor(totalSlots(s) / 4)))) setFlag(s, p.id, 'keeper');
    }
  }

  // --- selling ---
  for (const p of [...s.plants]) {
    if (p.stage !== 'mature' || p.mother || p.keeper) continue;
    if (s.stage >= 3 && p.analysis === 0 && s.jobs.analysis.length < 3 && s.upgrades.lvl_genetics && s.money > 600) continue; // wait to analyse only when it can be afforded
    sellPlant(s, p);
  }

  // --- broke and nothing to sell: cash in the least valuable stock plant ---
  if (s.money < 30 && s.props.length === 0 && !s.plants.some((p) => p.stage === 'mature' && !p.mother && !p.keeper)) {
    const spare = s.plants.filter((p) => p.growth >= 0.3).sort((a, b) => plantValue(s, a) - plantValue(s, b))[0];
    if (spare) { spare.mother = false; spare.keeper = false; sellPlant(s, spare); }
  }

  // --- propagation from mothers ---
  if (s.stage >= 2 && freeSlots(s) > s.props.length) {
    for (const p of s.plants) {
      if (!p.mother) continue;
      for (const k of ['stem', 'division', 'leaf'] as CutKind[]) if (canCut(s, p, k) === null) { takeCutting(s, p.id, k); break; }
    }
    if (f.cloning) for (const p of s.plants) if (p.mother && s.jobs.cloning.length < 2 && freeSlots(s) > s.props.length + 2) startClone(s, p.id);
    if (f.tissueCulture && s.upgrades.lvl_tissue && s.jobs.tissue.length < 1 && s.props.length < 20) {
      const m = s.plants.find((p) => p.mother && p.growth >= 0.4);
      if (m) startTissue(s, m.id, tcMaxCycles(s));
    }
  }

  // --- breeding (same-species pairs of tagged / best plants) ---
  if (s.stage >= 3 && s.upgrades.lvl_genetics && s.jobs.breeding.length < 2) {
    const mature = s.plants.filter((p) => p.stage === 'mature' && !p.hy && p.health > 50);
    const bySp = new Map<string, Plant[]>();
    for (const p of mature) (bySp.get(p.sp) ?? bySp.set(p.sp, []).get(p.sp)!).push(p);
    for (const arr of bySp.values()) {
      if (arr.length >= 2 && s.props.length < propCap(s) - 6) {
        arr.sort((a, b) => plantValue(s, b) - plantValue(s, a));
        startBreeding(s, arr[0].id, arr[1].id);
        break;
      }
    }
  }

  // --- purchasing & planting ---
  let guard = 0;
  while (s.props.length && freeSlots(s) > 0 && guard++ < 40) {
    const slot = firstFreeSlot(s)!;
    const pr = s.props[0];
    const sp = effectiveSpecies(pr.sp, pr.hy);
    const r = placePropagule(s, pr.id, slot.room, slot.slot, bestMedium(sp, s), f.selfWatering && sp.env.wetCap >= 70 ? 'selfWatering' : 'standard');
    if (!r.ok && r.msg.includes('Potting')) break;
  }
  if (freeSlots(s) > s.props.length && s.money > 30) {
    const options = availableSpecies(s)
      .filter((sp) => sp.prop.seed > 0.2)
      .map((sp) => ({ sp, score: (sp.baseValue * (1 + sp.rarity * 0.05)) / (sp.growSec * (1 + 0.1 * sp.rarity)) }))
      .sort((a, b) => b.score - a.score);
    const choose = options.find((o) => s.money > o.sp.baseValue * 1.6);
    if (choose) buy(s, choose.sp.id, 'seed');
  }

  // --- rooms ---
  if (!saving && freeSlots(s) < 2 && s.money > nextRoomCost(s) * 1.25) buildRoom(s);
  if (!saving) for (const r of s.rooms) if (r.slots.length < roomSlotCap(s) && s.money > roomSlotCost(r.slots.length) * 1.5) expandRoom(s, r.id);

  // --- research & upgrades: pick the cheapest of the top-priority goals and save for it ---
  chase(s, blog, saving);

  // --- stage ---
  const adv = advanceStage(s);
  if (adv.ok) blog.stageAt[s.stage] = s.time;
  if (blog.prestigeAt === undefined && canPrestige(s).ok) blog.prestigeAt = s.time;

  // --- staff ---
  if (s.stage >= 3 && s.money > 5000) {
    const have = (role: string) => s.staff.filter((x) => x.role === role).length;
    if (have('researcher') < 2) hire(s, 'researcher');
    else if (have('grower') < 2 && !f.autoWater) hire(s, 'grower');
    else if (s.stage >= 4 && have('geneticist') < 1) hire(s, 'geneticist');
    else if (s.stage >= 4 && have('technician') < 1) hire(s, 'technician');
    else if (s.stage >= 5 && have('manager') < 1) hire(s, 'manager');
  }
  void SPECIES_LIST;
}
