import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS, CHALLENGES, GUIDE, SAVE_KEY, advisor, checkAchievements, clamp, deserializeWithReport, diagnose, enterShow, guideProgress, listBackups,
  loadBackup, loadGameReport, makePlant, makePropagule, newGame, openShow, placePropagule, prestige, run, saveGameResult, serialize, setRoom, showCandidates,
  showScore, step, sanitize, deleteSave, PRESTIGE_MIN_EARNED, TECHS, movePlant, type GameState,
} from '../src/engine';

function withPlant(seed = 3, sp = 'philodendron-brasil'): GameState {
  const s = newGame(seed);
  const pl = makePlant(s, makePropagule(s, sp, 'young'));
  s.rooms[0].slots[0] = pl.id;
  pl.room = s.rooms[0].id;
  pl.slot = 0;
  s.plants.push(pl);
  return s;
}

// ---------- hardening ----------

test('clamp turns NaN into the lower bound instead of passing it on', () => {
  assert.equal(clamp(NaN, 0, 100), 0);
  assert.equal(clamp(NaN, 5, 9), 5);
  assert.equal(clamp(7, 0, 5), 5);
  assert.equal(clamp(Infinity, 0, 5), 5);
});

test('room settings ignore non-finite values', () => {
  const s = newGame(1);
  const before = JSON.stringify(s.rooms[0].set);
  setRoom(s, s.rooms[0].id, { light: NaN, temp: Infinity - Infinity });
  assert.equal(JSON.stringify(s.rooms[0].set), before);
  setRoom(s, s.rooms[0].id, { light: 40 });
  assert.equal(s.rooms[0].set.light, 40);
});

test('fractional or NaN slots are rejected when planting and moving', () => {
  const s = newGame(2);
  s.money = 1000;
  s.props.push(makePropagule(s, 'philodendron-brasil', 'young'));
  const room = s.rooms[0];
  assert.equal(placePropagule(s, s.props[0].id, room.id, 1.5).ok, false);
  assert.equal(placePropagule(s, s.props[0].id, room.id, NaN).ok, false);
  assert.equal(placePropagule(s, s.props[0].id, room.id, 1).ok, true);
  const p = s.plants[0];
  assert.equal(movePlant(s, p.id, room.id, 2.5).ok, false);
  assert.equal(room.slots.length, 6);
});

test('a damaged save is repaired, not trusted', () => {
  const s = withPlant(4);
  const good = makePlant(s, makePropagule(s, 'monstera-adansonii', 'young'));
  s.rooms[0].slots[1] = good.id;
  good.room = s.rooms[0].id;
  good.slot = 1;
  s.plants.push(good);
  const j = JSON.parse(serialize(s));
  j.plants[0].health = null; // NaN in JSON becomes null
  j.plants[0].hydration = 'wet';
  j.plants.push({ ...j.plants[1], id: 999, sp: 'no-such-plant' });
  j.plants.push({ ...j.plants[1], id: j.plants[1].id }); // duplicate id and slot
  j.money = null;
  j.settings.speed = 1e9;
  j.rooms[0].slots = [j.plants[0].id, j.plants[0].id, 12345, 'x', null, null];
  j.stats.sold = 'lots';
  const rep = deserializeWithReport(JSON.stringify(j));
  assert.ok(rep);
  const r = rep.state;
  assert.ok(rep.repairs.length > 0);
  assert.equal(r.plants.some((p) => p.sp === 'no-such-plant'), false);
  for (const p of r.plants) {
    assert.ok(Number.isFinite(p.health) && Number.isFinite(p.hydration), 'finite vitals');
    assert.equal(r.rooms.find((x) => x.id === p.room)?.slots[p.slot], p.id, 'every plant sits in its slot');
  }
  assert.equal(new Set(r.plants.map((p) => p.id)).size, r.plants.length, 'unique ids');
  assert.ok(Number.isFinite(r.money));
  assert.equal(r.settings.speed, 1);
  assert.equal(r.stats.sold, 0);
  run(r, 60); // must not throw or produce NaN
  for (const p of r.plants) assert.ok(Number.isFinite(p.health) && Number.isFinite(p.growth));
});

test('garbage and truncated saves are refused', () => {
  assert.equal(deserializeWithReport('not json'), null);
  assert.equal(deserializeWithReport('{"rooms":1,"plants":2}'), null);
  assert.equal(deserializeWithReport(serialize(newGame(1)).slice(0, 200)), null);
});

test('sanitise leaves a healthy save untouched', () => {
  const s = withPlant(8);
  run(s, 100);
  assert.deepEqual(sanitize(s), []);
});

function fakeStorage(): Map<string, string> {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
  return m;
}

test('saves rotate into backups, and a broken save falls back to the newest backup', () => {
  const store = fakeStorage();
  const s = withPlant(5);
  assert.deepEqual(saveGameResult(s), { ok: true });
  assert.equal(listBackups().length, 0, 'the first save has nothing to back up');
  for (let i = 1; i <= 4; i++) {
    store.set(SAVE_KEY + '.baktime', '0'); // pretend ten minutes passed
    s.money += 100 * i;
    run(s, 5);
    assert.equal(saveGameResult(s).ok, true);
  }
  const b = listBackups();
  assert.equal(b.length, 3, 'three backups are kept');
  assert.ok(loadBackup(1) && loadBackup(3));
  store.set(SAVE_KEY, '{ broken');
  const back = loadGameReport();
  assert.ok(back);
  assert.equal(back.fromBackup, 1, 'fell back to the newest backup');
  deleteSave();
  assert.equal(loadGameReport(), null);
});

test('a full or refusing browser store is reported, and the old save survives', () => {
  const store = fakeStorage();
  const s = withPlant(6);
  assert.equal(saveGameResult(s).ok, true);
  const old = store.get(SAVE_KEY);
  (globalThis as unknown as { localStorage: { setItem: () => void } }).localStorage.setItem = () => {
    const e = new Error('The quota has been exceeded');
    e.name = 'QuotaExceededError';
    throw e;
  };
  const r = saveGameResult(s);
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.why, /full/i);
  assert.equal(store.get(SAVE_KEY), old);
});

// ---------- guide, advisor, achievements ----------

test('the opening guide follows what the player does', () => {
  const s = newGame(7);
  let g = guideProgress(s);
  assert.equal(g.doneCount, 0);
  assert.equal(g.current, 0);
  s.money = 500;
  const pl = makePlant(s, makePropagule(s, 'philodendron-brasil', 'young'));
  s.plants.push(pl);
  s.stats.spent = 5;
  g = guideProgress(s);
  assert.ok(g.steps[0].done && g.steps[1].done && !g.steps[2].done);
  assert.equal(g.current, 2);
  for (const step of GUIDE) assert.ok(step.title && step.body && step.view);
  s.stats.cares = 3; s.stats.techs = 1; s.stats.matured = 2; s.stats.sold = 1; s.stats.maxPlants = 4; s.done.prop_cuttings = 1; s.stage = 2;
  assert.equal(guideProgress(s).complete, true);
});

test('the advisor flags real problems first and never returns nothing', () => {
  const s = withPlant(9);
  assert.ok(advisor(s).length >= 1);
  s.plants[0].inf = { kind: 'fungal', sev: 0.4 };
  assert.equal(advisor(s)[0].id, 'sick');
  s.plants[0].inf = null;
  s.plants[0].hydration = 5;
  assert.equal(advisor(s)[0].id, 'thirsty');
  s.plants[0].hydration = 70;
  s.money = 1e9;
  s.rp = 1e6;
  const ids = advisor(s, 10).map((a) => a.id);
  assert.ok(ids.includes('research') || ids.includes('upgrade') || ids.includes('stage'));
});

test('achievements are awarded once and kept across a reset', () => {
  const s = withPlant(10);
  s.stats.matured = 30;
  s.stats.sold = 1;
  const got = checkAchievements(s).map((a) => a.id);
  assert.ok(got.includes('first_bloom') && got.includes('green_thumb') && got.includes('first_sale'));
  assert.equal(checkAchievements(s).length, 0, 'not awarded twice');
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length, 'ids are unique');
  for (const a of ACHIEVEMENTS) {
    const [have, need] = a.goal(newGame(1));
    assert.ok(need > 0 && have < need, `${a.id} must not be earned by a brand-new game`);
  }
});

// ---------- shows ----------

function showReady(): GameState {
  const s = withPlant(11);
  s.stage = 2;
  const p = s.plants[0];
  p.growth = 1;
  p.stage = 'mature';
  s.shows.next = 0;
  return s;
}

test('a show opens, takes an entry, and pays out when it closes', () => {
  const s = showReady();
  step(s, 1);
  const show = s.shows.open;
  assert.ok(show, 'a show opened');
  const p = s.plants[0];
  if (show.theme === 'hybrid') p.hy = 'monstera-adansonii';
  assert.equal(enterShow(s, p.id).ok, true);
  assert.ok(showCandidates(s).length >= 1);
  const money0 = s.money;
  s.time = show.closes;
  step(s, 1);
  assert.equal(s.shows.open, null);
  assert.equal(s.shows.hist.length, 1);
  assert.equal(s.stats.shows, 1);
  assert.ok(s.shows.hist[0].prize >= 0 && s.money >= money0 + s.shows.hist[0].prize - 5, 'a show never costs money');
  assert.ok(s.shows.next > s.time);
});

test('a show with no entry is simply missed, and shows never open offline', () => {
  const s = showReady();
  step(s, 1);
  s.time = s.shows.open!.closes;
  step(s, 1);
  assert.equal(s.shows.hist[0].place, 0);
  const t = showReady();
  const before = t.shows.seq;
  // offline catch-up must not open a show
  run(t, 0); // no-op
  t.shows.next = 0;
  assert.equal(t.shows.seq, before);
});

test('show scoring rewards condition and ignores ineligible plants', () => {
  const s = showReady();
  const p = s.plants[0];
  p.health = 100; p.roots = 100; p.inf = null;
  const healthy = showScore(p, 'best');
  p.health = 30; p.inf = { kind: 'rot', sev: 0.6 };
  assert.ok(showScore(p, 'best') < healthy);
  p.growth = 0.5;
  assert.equal(showScore(p, 'best'), 0, 'immature plants are not eligible');
  p.growth = 1;
  assert.equal(showScore(p, 'hybrid'), 0, 'a straight species cannot enter the hybrid cup');
  const open = openShow(s);
  assert.equal(open.rivals.length, 3);
  assert.equal(enterShow(newGame(1), 1).ok, false, 'no show open');
});

// ---------- challenges ----------

test('a challenge run applies its handicap, and clearing it pays a bonus and is remembered', () => {
  const s = newGame(12);
  s.stage = 6;
  for (const t of TECHS) if (t.cat !== 'synthetic') s.done[t.id] = 1;
  s.stats.earnedRun = PRESTIGE_MIN_EARNED * 2;
  s.legacy.ups.cash = 3;
  s.legacy.ups.head = 2;
  const plain = prestige(JSON.parse(JSON.stringify(s)) as GameState, 'nope');
  assert.equal(plain.ok, false, 'unknown challenge is refused');
  const first = prestige(s, 'bootstrap');
  assert.equal(first.ok, true);
  assert.equal(s.challenge, 'bootstrap');
  assert.equal(s.stage, 1, 'bootstrap ignores Head Start');
  assert.equal(s.money, 200, 'and Founders’ Grant');
  assert.equal(s.mods.sellPrice < 1, true);
  // finish the challenge run
  s.stage = 6;
  for (const t of TECHS) if (t.cat !== 'synthetic') s.done[t.id] = 1;
  s.stats.earnedRun = PRESTIGE_MIN_EARNED * 2;
  const before = s.legacy.points;
  const plainGain = Math.floor(Math.sqrt(s.stats.earnedRun / 15000));
  assert.equal(prestige(s).ok, true);
  assert.ok(s.legacy.points - before > plainGain, 'the bonus pays');
  assert.deepEqual(s.legacy.cleared, ['bootstrap']);
  assert.equal(s.challenge, '');
  assert.equal(CHALLENGES.length, 4);
});

test('blight, drought and austerity change the right modifiers', () => {
  const s = newGame(13);
  const base = s.mods;
  for (const [id, key, dir] of [['blight', 'diseaseResist', -1], ['drought', 'waterUse', 1], ['austerity', 'wage', 1]] as const) {
    const t = newGame(13);
    t.challenge = id;
    t.modsDirty = true;
    step(t, 0.1);
    assert.ok(Math.sign(t.mods[key] - base[key]) === dir, id);
  }
});

// ---------- diagnosis ----------

test('the diagnosis names the real problem with the real numbers', () => {
  const s = withPlant(14);
  const p = s.plants[0];
  s.rooms[0].act.temp = 6;
  const d = diagnose(s, p)!;
  assert.equal(d.issues[0].key, 'lethal');
  assert.equal(d.trend, 'declining');
  s.rooms[0].act.temp = 24;
  p.hydration = 3;
  const d2 = diagnose(s, p)!;
  assert.ok(d2.issues.some((i) => i.key === 'water'));
  p.hydration = 60;
  p.nutrients = 100;
  assert.ok(diagnose(s, p)!.issues.some((i) => i.key === 'overfeed'));
  p.inf = { kind: 'rot', sev: 0.5 };
  assert.ok(diagnose(s, p)!.issues.some((i) => i.key === 'inf' && /Root rot/.test(i.title)));
  assert.equal(diagnose(s, { ...p, room: null }), null, 'stock has no room to diagnose');
});

// ---------- charts and determinism ----------

test('the run history is sampled and thins out instead of growing without limit', () => {
  const s = withPlant(15);
  run(s, 600, 5);
  assert.ok(s.series.t.length >= 9 && s.series.t.length <= 11);
  for (let i = 0; i < 40000; i++) step(s, 5);
  assert.ok(s.series.t.length <= 241, 'bounded: ' + s.series.t.length);
  assert.ok(s.series.every > 60, 'the interval widened');
  assert.equal(new Set([s.series.t.length, s.series.money.length, s.series.rp.length, s.series.net.length, s.series.plants.length]).size, 1);
});

test('the same seed still gives the same game with the new systems', () => {
  const a = withPlant(21);
  const b = withPlant(21);
  a.stage = b.stage = 2;
  run(a, 3000, 5);
  run(b, 3000, 5);
  a.savedAt = b.savedAt = 0;
  assert.ok(JSON.stringify({ ...a, mods: 0 }) === JSON.stringify({ ...b, mods: 0 }), 'identical state after the same run');
});
