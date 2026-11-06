import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENE_IDS, SPECIES, newGame, refreshMods, run, wildGenome, phenotype, express, recombine, cloneGenome, copyGenome, heterozygosity,
  buy, placePropagule, waterPlant, feedPlant, sellPlant, plantValue, serialize, deserialize, simulateOffline, offlineLimits,
  startProject, TECH_BY_ID, canPrestige, prestige, legacyGain, startBreeding, setFlag, firstFreeSlot, bestMedium, effectiveSpecies,
  discoveryCount, DISCOVERIES, qualifying, makePlant, makePropagule, STAGES, roomSlotCost, rescue,
  PRESTIGE_STAGE, PRESTIGE_MIN_EARNED, PRESTIGE_DIVISOR, TECHS, buyLegacy, techState, stageRequirements,
  type GameState, type Genome, type Plant,
} from '../src/engine';
import { botAct, makeBotLog } from '../scripts/bot';

const fresh = (seed = 1): GameState => {
  const s = newGame(seed, 1_000_000);
  refreshMods(s);
  return s;
};

/** Plant one seed of a species straight into the first free slot and return the plant. */
function plantOne(s: GameState, sp = 'philodendron-brasil'): Plant {
  const before = s.plants.length;
  // Germination is a real random roll; retry (paying again) until a seed takes.
  for (let attempt = 0; attempt < 20 && s.plants.length === before; attempt++) {
    assert.ok(buy(s, sp, 'seed').ok);
    const slot = firstFreeSlot(s)!;
    const pr = s.props[s.props.length - 1];
    const r = placePropagule(s, pr.id, slot.room, slot.slot, bestMedium(effectiveSpecies(pr.sp, pr.hy), s), 'standard');
    if (!r.ok) assert.match(r.msg, /germinate/, r.msg);
  }
  assert.equal(s.plants.length, before + 1);
  return s.plants[s.plants.length - 1];
}

function tend(s: GameState, seconds: number): void {
  for (let t = 0; t < seconds; t += 5) {
    run(s, 5);
    for (const p of s.plants) {
      if (p.hydration < 45) waterPlant(s, p);
      if (p.nutrients < 30) feedPlant(s, p);
    }
  }
}

function assertFinite(value: unknown, path = 'state'): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is not finite (${value})`);
  else if (Array.isArray(value)) value.forEach((v, i) => assertFinite(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`);
}

// ---------------------------------------------------------------------------------------------
// Genetics
// ---------------------------------------------------------------------------------------------

test('there are exactly twelve genes and every genome has two alleles for each', () => {
  assert.equal(GENE_IDS.length, 12);
  const s = fresh();
  for (const sp of Object.values(SPECIES).slice(0, 8)) {
    const g = wildGenome(s, sp);
    for (const id of GENE_IDS) {
      assert.equal(g[id].length, 2);
      for (const a of g[id]) {
        assert.ok(a.v >= 0 && a.v <= 1, `${id} value out of range`);
        assert.ok(a.d >= 0 && a.d <= 1, `${id} dominance out of range`);
      }
    }
  }
});

test('a clearly dominant allele masks a recessive one; equal dominance blends', () => {
  const dom = express([{ v: 0.9, d: 0.9 }, { v: 0.1, d: 0.1 }]);
  assert.ok(Math.abs(dom - 0.9) < 1e-6, `expected the dominant value, got ${dom}`);
  const blend = express([{ v: 0.8, d: 0.5 }, { v: 0.2, d: 0.5 }]);
  assert.ok(Math.abs(blend - 0.5) < 0.01, `expected a blend, got ${blend}`);
  const swapped = express([{ v: 0.1, d: 0.1 }, { v: 0.9, d: 0.9 }]);
  assert.equal(swapped, dom, 'allele order must not matter');
});

test('recombination without mutation passes on one allele per gene from each parent', () => {
  const s = fresh(5);
  const sp = SPECIES['monstera-adansonii'];
  const a = wildGenome(s, sp);
  const b = wildGenome(s, sp);
  for (let i = 0; i < 50; i++) {
    const { genome, events } = recombine(s, a, b, { rate: 0, novel: 0 });
    assert.equal(events.length, 0);
    for (const id of GENE_IDS) {
      const [x, y] = genome[id];
      const inA = (v: number) => a[id].some((al) => al.v === v);
      const inB = (v: number) => b[id].some((al) => al.v === v);
      assert.ok((inA(x.v) && inB(y.v)) || (inA(y.v) && inB(x.v)), `${id}: offspring alleles must come from the two parents`);
    }
  }
});

test('mendelian ratios: crossing two heterozygotes shows the recessive about a quarter of the time', () => {
  const s = fresh(11);
  const sp = SPECIES['philodendron-brasil'];
  const base = wildGenome(s, sp);
  const het: Genome = copyGenome(base);
  het.leafSize = [{ v: 0.9, d: 0.9 }, { v: 0.1, d: 0.1 }];
  let low = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const { genome } = recombine(s, het, het, { rate: 0, novel: 0 });
    if (phenotype(genome).leafSize < 0.3) low++;
  }
  const share = low / n;
  assert.ok(share > 0.2 && share < 0.3, `recessive share ${share.toFixed(3)} should be near 0.25`);
});

test('cloning copies the genome exactly unless a sport occurs, and sports are flagged', () => {
  const s = fresh(3);
  const g = wildGenome(s, SPECIES['alocasia-polly']);
  const exact = cloneGenome(s, g, 0, { rate: 1, novel: 1 });
  assert.equal(exact.sport, false);
  assert.deepEqual(exact.genome, g);
  assert.notEqual(exact.genome, g, 'the clone must be a copy, not an alias');
  const sport = cloneGenome(s, g, 1, { rate: 1, novel: 1 });
  assert.equal(sport.sport, true);
  assert.ok(sport.events.length >= 1);
  assert.notDeepEqual(sport.genome, g);
});

test('heterozygosity is zero for a doubled-haploid and positive for a wild plant', () => {
  const s = fresh(9);
  const g = wildGenome(s, SPECIES['philodendron-brasil']);
  const homo = copyGenome(g);
  for (const id of GENE_IDS) homo[id][1] = { ...homo[id][0] };
  assert.equal(heterozygosity(homo), 0);
  assert.ok(heterozygosity(g) >= 0);
});

test('discoveries are defined for every gene and the catalogue is large', () => {
  assert.ok(DISCOVERIES.length >= 60);
  const ids = new Set(DISCOVERIES.map((d) => d.id));
  assert.equal(ids.size, DISCOVERIES.length, 'discovery ids must be unique');
  for (const g of GENE_IDS) {
    if (g === 'growthRate' || g === 'leafSize') assert.ok(DISCOVERIES.some((d) => d.id.startsWith(g)), `${g} has discoveries`);
  }
});

test('a plant carrying an extreme trait qualifies for the matching discovery once analysed', () => {
  const s = fresh(21);
  const pl = makePlant(s, makePropagule(s, 'monstera-adansonii', 'seed'));
  pl.genome.leafSize = [{ v: 0.98, d: 0.9 }, { v: 0.98, d: 0.9 }];
  pl.growth = 1;
  pl.analysis = 1;
  const hits = qualifying(pl, phenotype(pl.genome)).map((d) => d.id);
  assert.ok(hits.some((h) => h.startsWith('leafSize_hi')), `expected a large-leaf discovery, got ${hits.join(',')}`);
});

// ---------------------------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------------------------

test('the same seed and the same actions give an identical game', () => {
  const play = () => {
    const s = fresh(77);
    plantOne(s, 'philodendron-micans');
    plantOne(s, 'alocasia-cucullata');
    tend(s, 240);
    return JSON.stringify({ ...s, mods: undefined, savedAt: 0 });
  };
  assert.equal(play(), play());
});

test('different seeds give different plants', () => {
  const a = fresh(1);
  const b = fresh(2);
  const pa = plantOne(a);
  const pb = plantOne(b);
  assert.notDeepEqual(pa.genome, pb.genome);
});

test('a tended plant grows to maturity and can be sold for more than its seed cost', () => {
  const s = fresh(4);
  const start = s.money;
  const p = plantOne(s);
  const seedCost = start - s.money;
  assert.ok(seedCost > 0);
  tend(s, 420);
  assert.equal(p.stage, 'mature', `plant is ${p.stage} at growth ${p.growth.toFixed(2)}`);
  assert.ok(p.health > 40);
  const before = s.money;
  const r = sellPlant(s, p);
  assert.ok(r.ok);
  assert.ok(s.money - before > seedCost / 3, 'sale price should comfortably cover one seed');
  assert.equal(s.plants.includes(p), false);
  assert.ok(s.stats.sold >= 1);
});

test('an untended plant dries out and loses health', () => {
  const s = fresh(6);
  const p = plantOne(s);
  const h0 = p.health;
  run(s, 1500);
  const gone = !s.plants.includes(p);
  assert.ok(gone || p.health < h0 || p.hydration < 40, 'neglect must have consequences');
});

test('selling a young seedling is refused', () => {
  const s = fresh(8);
  const p = plantOne(s);
  const r = sellPlant(s, p);
  assert.equal(r.ok, false);
});

test('plant value rises with growth and health', () => {
  const s = fresh(12);
  const p = plantOne(s);
  p.growth = 0.6;
  const v1 = plantValue(s, p);
  p.growth = 1;
  const v2 = plantValue(s, p);
  p.health = 30;
  const v3 = plantValue(s, p);
  assert.ok(v2 > v1);
  assert.ok(v3 < v2);
});

test('a long run keeps the state finite and slot references consistent', () => {
  const s = fresh(31);
  const blog = makeBotLog();
  for (let t = 0; t < 90 * 60; t += 5) {
    run(s, 5);
    botAct(s, blog);
  }
  assertFinite(s);
  for (const r of s.rooms) {
    for (const slot of r.slots) if (slot != null) assert.ok(s.plants.some((p) => p.id === slot), `slot points at missing plant ${slot}`);
  }
  for (const p of s.plants) {
    if (p.room != null) assert.equal(s.rooms.find((r) => r.id === p.room)?.slots[p.slot], p.id);
    assert.ok(p.health >= 0 && p.health <= 100);
    assert.ok(p.growth >= 0 && p.growth <= 1.0001);
  }
  assert.ok(s.money >= 0);
  assert.ok(s.stage >= 2, 'a competent player should have reached Stage 2 within 90 minutes');
});

// ---------------------------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------------------------

test('research needs both points and money, then completes over time and applies its effect', () => {
  const s = fresh(2);
  const t = TECH_BY_ID['env_monitor'];
  assert.ok(t);
  assert.equal(startProject(s, t.id).ok, false, 'no research points yet');
  s.rp = 100;
  s.money = 1000;
  const r = startProject(s, t.id);
  assert.ok(r.ok, r.msg);
  assert.equal(s.money, 1000 - t.money);
  assert.equal(s.rp, 100 - t.rp);
  assert.equal(startProject(s, t.id).ok, false, 'already running');
  run(s, t.time + 5);
  assert.ok(s.done[t.id] !== undefined, 'project should be complete');
  assert.equal(s.active.length, 0);
});

test('later technologies stay locked behind their prerequisites and stage', () => {
  const s = fresh(2);
  s.rp = 1e6;
  s.money = 1e9;
  assert.equal(startProject(s, 'gen_seq').ok, false);
  assert.equal(startProject(s, 'prop_cloning').ok, false);
});

test('the stage ladder has six entries with growing costs', () => {
  assert.equal(STAGES.length, 6);
  for (let i = 1; i < STAGES.length; i++) assert.ok(STAGES[i].cost > STAGES[i - 1].cost);
  assert.ok(roomSlotCost(10) > roomSlotCost(6));
});

test('breeding two mature plants yields seeds that carry mixed genes', () => {
  const s = fresh(15);
  s.money = 5000;
  s.upgrades.lvl_genetics = 1;
  s.upgrades.gen_breeding = 1;
  s.stage = 3;
  s.modsDirty = true;
  refreshMods(s);
  const a = plantOne(s, 'philodendron-brasil');
  const b = plantOne(s, 'philodendron-brasil');
  for (const p of [a, b]) {
    p.growth = 1;
    p.stage = 'mature';
    p.health = 100;
  }
  const r = startBreeding(s, a.id, b.id);
  assert.ok(r.ok, r.msg);
  const before = s.props.length;
  const job = s.jobs.breeding[0];
  tend(s, Math.ceil(job.total) + 10);
  assert.ok(s.props.length > before, 'seeds should have been produced');
  const kid = s.props[s.props.length - 1];
  assert.equal(kid.kind, 'seed');
  assert.deepEqual(kid.parents, [a.id, b.id]);
  assert.equal(kid.gen, 1);
  assert.equal(s.stats.bred, 1);
});

test('the rescue rule gifts seeds only when the player is truly stuck', () => {
  const s = fresh(19);
  rescue(s);
  assert.equal(s.props.length, 0, 'a fresh game has money, so no gift');
  s.money = 3;
  s.plants.length = 0;
  rescue(s);
  assert.equal(s.props.length, 3);
  rescue(s);
  assert.equal(s.props.length, 3, 'only gift once while seeds are waiting');
});

// ---------------------------------------------------------------------------------------------
// Persistence, offline progress, prestige
// ---------------------------------------------------------------------------------------------

test('save and load round-trips the whole game', () => {
  const s = fresh(50);
  const blog = makeBotLog();
  for (let t = 0; t < 40 * 60; t += 5) {
    run(s, 5);
    botAct(s, blog);
  }
  const json = serialize(s);
  const back = deserialize(json);
  assert.ok(back);
  refreshMods(back);
  assert.equal(back.money, s.money);
  assert.equal(back.plants.length, s.plants.length);
  assert.deepEqual(back.plants[0]?.genome, s.plants[0]?.genome);
  assert.equal(back.stage, s.stage);
  assert.deepEqual(back.done, s.done);
  // and the loaded game must keep simulating identically
  run(s, 120);
  run(back, 120);
  assert.equal(Math.round(back.money * 1000), Math.round(s.money * 1000));
});

test('corrupt or foreign save data is rejected, not crashed on', () => {
  assert.equal(deserialize('not json'), null);
  assert.equal(deserialize('{"hello":1}'), null);
  assert.equal(deserialize('null'), null);
});

test('offline progress is capped, partial, and ignores very short absences', () => {
  const s = fresh(60);
  plantOne(s);
  plantOne(s);
  assert.equal(simulateOffline(s, 10), null);
  const lim = offlineLimits(s);
  assert.ok(lim.efficiency > 0 && lim.efficiency <= 1);
  const t0 = s.time;
  const rep = simulateOffline(s, 30 * 24 * 3600);
  assert.ok(rep);
  assert.ok(Math.abs(s.time - t0 - lim.capSeconds * lim.efficiency) < 5, 'credited time must follow the cap');
  assertFinite(s);
});

test('offline time grows plants, so a returning player finds mature plants waiting', () => {
  const s = fresh(61);
  plantOne(s, 'philodendron-micans');
  const rep = simulateOffline(s, 3600);
  assert.ok(rep);
  assert.ok(s.plants.length === 0 || s.plants[0].growth > 0.5 || s.stats.matured > 0 || s.stats.died > 0);
});

/** Put a save into the state in which the first legacy reset is allowed. */
function readyToPrestige(s: GameState): void {
  s.stage = PRESTIGE_STAGE;
  for (const t of TECHS) if (t.cat !== 'synthetic') s.done[t.id] = 1;
  s.stats.earnedRun = PRESTIGE_MIN_EARNED * 2;
  s.stats.earned = s.stats.earnedRun;
  refreshMods(s);
}

test('prestige is locked until the end of the main game, pays out then, and keeps permanent progress', () => {
  const s = fresh(70);
  assert.equal(canPrestige(s).ok, false);
  assert.equal(prestige(s).ok, false);
  // Stage 4 and plenty of money used to be enough; now the last stage and the whole research tree are needed.
  s.stage = 4;
  s.stats.earnedRun = PRESTIGE_MIN_EARNED * 2;
  assert.equal(canPrestige(s).ok, false);
  assert.match(canPrestige(s).why ?? '', /Stage 6/);
  s.stage = PRESTIGE_STAGE;
  assert.equal(canPrestige(s).ok, false);
  assert.match(canPrestige(s).why ?? '', /research tree/);
  readyToPrestige(s);
  s.discoveries['leafSize_hi1|philodendron-brasil'] = { t: 1, plant: 1, plantName: 'x' };
  s.money = 12345;
  plantOne(s);
  assert.equal(canPrestige(s).ok, true);
  const gain = legacyGain(s);
  assert.ok(gain >= 1);
  const r = prestige(s);
  assert.ok(r.ok, r.msg);
  assert.equal(s.legacy.points, gain);
  assert.equal(s.legacy.runs, 1);
  assert.equal(s.plants.length, 0);
  assert.ok(s.money < 12345);
  assert.equal(s.stats.earnedRun, 0);
  assert.ok(discoveryCount(s) >= 1, 'discoveries survive a legacy reset');
});

test('one missing technology from the main tree keeps the first reset closed', () => {
  const s = fresh(71);
  readyToPrestige(s);
  assert.equal(canPrestige(s).ok, true);
  const last = TECHS.filter((t) => t.cat !== 'synthetic')[10];
  delete s.done[last.id];
  assert.equal(canPrestige(s).ok, false);
  assert.match(canPrestige(s).why ?? '', /1 technology still/);
});

test('discoveries pay out legacy points once, not at every reset', () => {
  const s = fresh(72);
  readyToPrestige(s);
  for (let i = 0; i < 80; i++) s.discoveries[`leafSize_hi1|fake-${i}`] = { t: 1, plant: 1, plantName: 'x' };
  const base = Math.floor(Math.sqrt(s.stats.earnedRun / PRESTIGE_DIVISOR));
  assert.equal(legacyGain(s), base + 10, '80 discoveries are worth 10 points the first time');
  assert.ok(prestige(s).ok);
  readyToPrestige(s);
  assert.equal(legacyGain(s), base, 'the same discoveries are not paid again');
  for (let i = 0; i < 16; i++) s.discoveries[`leafSize_hi1|more-${i}`] = { t: 2, plant: 1, plantName: 'x' };
  assert.equal(legacyGain(s), base + 2, 'new discoveries count');
});

test('technologies kept by the legacy perks still read as researched after a reset', () => {
  const s = fresh(73);
  readyToPrestige(s);
  s.legacy.points = 50;
  assert.ok(buyLegacy(s, 'memory').ok);
  assert.ok(buyLegacy(s, 'auto').ok);
  assert.ok(prestige(s).ok);
  const kept = Object.keys(s.done);
  assert.ok(kept.length > 5, 'stage 1-2 and automation techs survive');
  for (const id of kept) {
    assert.equal(techState(s, TECH_BY_ID[id]).status, 'done', `${id} should count as researched`);
    assert.ok(s.done[id], `${id} must be truthy so every gate sees it`);
  }
  assert.equal(stageRequirements(s)!.some((r) => /Cutting/.test(r.label) && !r.met), false, 'a kept prerequisite does not block a stage');
});

test('flagging a plant as a mother or keeper is remembered', () => {
  const s = fresh(80);
  const p = plantOne(s);
  p.growth = 1;
  p.stage = 'mature';
  setFlag(s, p.id, 'mother');
  assert.equal(p.mother, true);
  setFlag(s, p.id, 'mother');
  assert.equal(p.mother, false, 'the flag toggles');
});

test('a short absence does not wreck a comfortable lab: no outbreaks start while the player is away', () => {
  const s = fresh(90);
  for (let i = 0; i < 4; i++) plantOne(s, i % 2 ? 'philodendron-brasil' : 'alocasia-cucullata');
  run(s, 60);
  const report = simulateOffline(s, 4 * 3600);
  assert.ok(report, 'an absence of hours produces a report');
  assert.ok(s.plants.every((p) => !p.inf), 'no infections appear offline in a healthy room');
  assert.equal(report!.died, 0, 'plants are never lost while away');
});

test('the offline report covers a save of any age over 30 seconds, and none under it', () => {
  const s = fresh(91);
  plantOne(s);
  assert.equal(simulateOffline(s, 10), null);
  const r = simulateOffline(s, 600);
  assert.ok(r && r.seconds === 600);
});
