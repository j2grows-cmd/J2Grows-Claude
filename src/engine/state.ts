// Creating a fresh game (also used by prestige resets).

import type { GameState, Legacy, Room } from './types';
import { SAVE_VERSION, START_MONEY } from './config';
import { baseMods } from './mods';

export function newLegacy(): Legacy {
  return { points: 0, spent: 0, ups: {}, runs: 0, discPaid: 0 };
}

export function makeRoom(id: number, name: string, slots = 6): Room {
  return {
    id,
    name,
    slots: new Array(slots).fill(null),
    equip: { lighting: 0, climate: 0, humidity: 0, irrigation: 0, nutrients: 0, airflow: 0 },
    set: { light: 60, photoperiod: 12, temp: 24, humidity: 60, airflow: 40, feed: 50 },
    act: { light: 60, temp: 21, humidity: 50, airflow: 40, stability: 0.1 },
  };
}

export function newGame(seed = (Date.now() ^ 0x5bd1e995) >>> 0, now = Date.now()): GameState {
  const s: GameState = {
    v: SAVE_VERSION,
    rng: seed >>> 0,
    time: 0,
    totalTime: 0,
    savedAt: now,
    money: START_MONEY,
    rp: 0,
    stage: 1,
    nextId: 1,
    plants: [],
    stock: [],
    props: [],
    rooms: [],
    depts: { cultivation: 1, tissue: 0, genetics: 0, research: 1 },
    upgrades: { lvl_cultivation: 1, lvl_research: 1 },
    staff: [],
    done: {},
    active: [],
    jobs: { analysis: [], breeding: [], cloning: [], tissue: [] },
    discoveries: {},
    seen: {},
    unlocked: [],
    records: [],
    cultivars: [],
    market: { index: {}, events: [], contracts: [], rep: 0, nextContract: 60, nextEvent: 180, hist: {} },
    auto: {
      on: { water: true, feed: true, treat: true, env: true, analyse: true, plant: true, propagate: true, harvest: true, sell: true, tissue: true },
      sell: { minValue: 0, keepAnalysed: false, keepDiscoveries: true, keepRarity: 6, maxPerSpecies: 0, holdForIndex: 0.9 },
      budget: 0,
    },
    legacy: newLegacy(),
    stats: {
      earned: 0, earnedRun: 0, spent: 0, sold: 0, matured: 0, died: 0, bred: 0, seedsMade: 0, cloned: 0,
      tissueMade: 0, analysed: 0, contracts: 0, techs: 0, rpEarned: 0, maxPlants: 0,
    },
    log: [],
    settings: { speed: 1, autosave: true, compact: false },
    income: 0,
    expense: 0,
    mods: baseMods(),
    modsDirty: true,
  };
  s.rooms.push(makeRoom(s.nextId++, 'Growing Room', 6));
  return s;
}
