import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGACY_SPECIES, SPECIES, SPECIES_LIST, TECHS, TECH_BY_ID, compat, deserialize, makePlant, makePropagule, migrateLegacySpecies, newGame, run, serialize } from '../src/engine';

// tests/species-slugs.txt is the list of folders in the Supabase `plant-images` bucket (species/<slug>/hero.png).
const slugs = readFileSync(fileURLToPath(new URL('./species-slugs.txt', import.meta.url)), 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);

test('the game has exactly the 99 species that have hero artwork, once each', () => {
  assert.equal(slugs.length, 99);
  assert.equal(SPECIES_LIST.length, 99);
  assert.deepEqual(SPECIES_LIST.map((s) => s.id).sort(), [...slugs].sort());
  assert.equal(new Set(SPECIES_LIST.map((s) => s.id)).size, 99);
});

test('every species is a complete, sane record', () => {
  for (const sp of SPECIES_LIST) {
    assert.ok(sp.common.length > 0 && sp.sci && sp.genus && sp.region && sp.notes && sp.exotic, sp.id + ' is missing text');
    assert.ok(['Alocasia', 'Anthurium', 'Monstera', 'Philodendron'].includes(sp.genus), sp.id + ' has genus ' + sp.genus);
    assert.ok(sp.id.startsWith(sp.genus.toLowerCase() + '-'), sp.id + ' does not start with its genus');
    assert.ok(sp.baseValue > 0 && sp.growSec > 0, sp.id + ' price/growth');
    assert.ok(sp.env.light[0] < sp.env.light[1] && sp.env.temp[0] < sp.env.temp[1] && sp.env.rh[0] < sp.env.rh[1], sp.id + ' bands');
    assert.ok(sp.env.lethal[0] < sp.env.temp[0] && sp.env.lethal[1] > sp.env.temp[1], sp.id + ' lethal range must enclose the ideal');
    for (const k of Object.values(sp.prop)) assert.ok(k >= 0 && k <= 1);
    assert.equal(sp.palette.length, 4);
  }
});

test('rarity, price and unlock stage rise together', () => {
  const byStage = (n: number) => SPECIES_LIST.filter((s) => s.unlock.stage === n);
  assert.ok(byStage(1).length >= 6, 'stage 1 needs a handful of starters');
  assert.ok(byStage(1).every((s) => s.rarity === 1 && s.baseValue <= 60));
  assert.ok(SPECIES_LIST.filter((s) => s.rarity === 5).every((s) => s.baseValue >= 2000));
  assert.ok(SPECIES_LIST.filter((s) => s.rarity <= 2).every((s) => s.baseValue < 250));
});

test('expeditions unlock real species and bring back real specimens', () => {
  const exps = TECHS.filter((t) => t.cat === 'expedition');
  assert.equal(exps.length, 4);
  for (const sp of SPECIES_LIST) {
    if (sp.unlock.expedition) assert.ok(TECH_BY_ID[sp.unlock.expedition]?.cat === 'expedition', sp.id + ' -> unknown expedition');
  }
  for (const t of exps) {
    const unlocked = SPECIES_LIST.filter((s) => s.unlock.expedition === t.id);
    assert.ok(unlocked.length >= 2, t.id + ' unlocks too little');
    for (const id of t.species ?? []) {
      assert.ok(SPECIES[id], t.id + ' brings back unknown ' + id);
      assert.equal(SPECIES[id].unlock.expedition, t.id, id + ' is in the haul of ' + t.id + ' but unlocked elsewhere');
    }
  }
});

test('all species are aroids, so cross-genus breeding is the only compatibility hurdle', () => {
  assert.equal(compat('alocasia-polly', 'alocasia-cucullata'), 'congeneric');
  assert.equal(compat('alocasia-polly', 'monstera-adansonii'), 'intergeneric');
  assert.equal(compat('alocasia-polly', 'alocasia-polly'), 'same');
});

test('every old species id maps to a species that exists', () => {
  assert.equal(Object.keys(LEGACY_SPECIES).length, 35);
  for (const [old, now] of Object.entries(LEGACY_SPECIES)) assert.ok(SPECIES[now], `${old} -> ${now} does not exist`);
});

test('a save from the 35-species version loads and keeps playing', () => {
  const s = newGame(4);
  const pr = makePropagule(s, 'philodendron-brasil', 'young');
  const pl = makePlant(s, pr);
  s.rooms[0].slots[0] = pl.id;
  s.plants.push(pl);
  s.seen['philodendron-brasil'] = 3;
  const hyb = makePlant(s, { ...makePropagule(s, 'philodendron-micans', 'young'), hy: 'philodendron-brasil' });
  s.rooms[0].slots[1] = hyb.id;
  s.plants.push(hyb);
  const old = serialize(s).replaceAll('philodendron-brasil', 'epipremnum_aureum').replaceAll('philodendron-micans', 'philodendron_hederaceum');
  assert.ok(old.includes('epipremnum_aureum'));
  const back = deserialize(old);
  assert.ok(back, 'old save did not load');
  assert.equal(back.plants[0].sp, 'philodendron-brasil');
  assert.equal(back.plants[1].sp, 'philodendron-micans');
  assert.equal(back.plants[1].hy, 'philodendron-brasil');
  assert.equal(back.seen['philodendron-brasil'], 3);
  assert.ok(!JSON.stringify(back).includes('epipremnum_aureum'));
  run(back, 120); // must not throw on any plant
  assert.equal(migrateLegacySpecies('no old ids here'), 'no old ids here');
});
