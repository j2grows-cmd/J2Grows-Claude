// Economy guards: loopholes that would let late-game bonuses run away with the pacing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CULTIVARS_PER_SPECIES, RESALE_LIMIT, TECHS, availableSpecies, buy, newGame, refreshMods, registerCultivar, royaltyRate, sellProp, shopOffer,
  makePlant, makePropagule, propValue, type GameState, type Plant,
} from '../src/engine';

function lateGame(seed: number): GameState {
  const s = newGame(seed, 1_000_000);
  s.stage = 6;
  for (const t of TECHS) s.done[t.id] = 1;
  s.upgrades.fac_sales = 8;
  s.legacy.ups.price = 15; // the strongest sale-price bonuses the game offers
  s.legacy.ups.species = 1;
  s.money = 1e9;
  refreshMods(s);
  return s;
}

test('anything bought from the shop resells for well under what it cost, whatever the price bonuses', () => {
  const s = lateGame(1);
  assert.ok(s.mods.sellPrice > 3, 'the late-game price bonus is large');
  const species = availableSpecies(s).filter((x) => x.rarity >= 3).slice(0, 6);
  assert.ok(species.length >= 4);
  for (const sp of species) {
    for (const kind of ['seed', 'young', 'cutting', 'flask'] as const) {
      if (!shopOffer(s, sp.id, kind).available) continue;
      s.props.length = 0;
      const before = s.money;
      assert.ok(buy(s, sp.id, kind).ok, `${sp.id} ${kind}`);
      const spent = before - s.money;
      const mid = s.money;
      for (const pr of [...s.props]) assert.ok(sellProp(s, pr).ok, `${sp.id} ${kind} sells`);
      const got = s.money - mid;
      assert.ok(got <= spent * RESALE_LIMIT + 1e-6, `${sp.id} ${kind}: spent ${spent.toFixed(2)}, resold for ${got.toFixed(2)}`);
    }
  }
});

test('propagules you breed or clone are still worth their full value', () => {
  const s = lateGame(2);
  const sp = availableSpecies(s).find((x) => x.rarity === 4)!;
  const bought = makePropagule(s, sp.id, 'young', undefined, { origin: 'purchase' });
  const raised = makePropagule(s, sp.id, 'young', undefined, { origin: 'clone' });
  assert.ok(propValue(s, raised) > propValue(s, bought) * 2);
});

function taggedPlant(s: GameState, spId: string, tag: string): Plant {
  const pr = makePropagule(s, spId, 'young');
  const p = makePlant(s, pr);
  p.growth = 1;
  p.stage = 'mature';
  p.analysis = 1;
  p.tags = [tag];
  p.health = 100;
  s.stock.push(p);
  return p;
}

test('a trait line registers once and a species holds only a few lines, so royalties cannot snowball', () => {
  const s = lateGame(3);
  const sp = availableSpecies(s).find((x) => x.rarity === 4)!;
  const tags = ['leafSize_hi1', 'growthRate_hi1', 'leafShape_hi1', 'variegation_t1', 'envTolerance_hi1', 'leafColour_hi1'];
  assert.ok(registerCultivar(s, taggedPlant(s, sp.id, tags[0]).id, 'A').ok);
  const dupe = registerCultivar(s, taggedPlant(s, sp.id, tags[0]).id, 'A again');
  assert.equal(dupe.ok, false);
  assert.match(dupe.msg, /already registered/);
  let ok = 1;
  for (const tag of tags.slice(1)) if (registerCultivar(s, taggedPlant(s, sp.id, tag).id, tag).ok) ok++;
  assert.equal(ok, CULTIVARS_PER_SPECIES);
  assert.equal(s.cultivars.length, CULTIVARS_PER_SPECIES);
  // A different species has its own allowance.
  const other = availableSpecies(s).find((x) => x.id !== sp.id && x.rarity === 4)!;
  assert.ok(registerCultivar(s, taggedPlant(s, other.id, tags[0]).id, 'B').ok);
  // Royalties stay a small part of income: a hundred-odd lines would be needed to match one good plant's sale per minute.
  assert.ok(royaltyRate(s) * 60 < sp.baseValue, `royalties ${royaltyRate(s)}/s are small next to a plant worth ${sp.baseValue}`);
});
