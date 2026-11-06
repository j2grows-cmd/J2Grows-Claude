// Prestige ("Legacy"): reset the operation in exchange for permanent bonuses.

import type { GameState } from './types';
import { discoveryCount, fail, log, ok, type Result } from './core';
import { LEGACY_BY_ID, PRESTIGE_DIVISOR, PRESTIGE_MIN_EARNED, PRESTIGE_STAGE, STAGES, START_MONEY, legacyCost } from './config';
import { TECHS, TECH_BY_ID } from './techs';
import { newGame } from './state';
import { refreshMods } from './mods';

/** Technologies of the main tree still to research (the Synthetic Botany branch is optional endgame). */
export const coreTechsLeft = (s: GameState): number => TECHS.filter((t) => t.cat !== 'synthetic' && !s.done[t.id]).length;

export function legacyGain(s: GameState): number {
  const run = s.stats.earnedRun;
  if (run < PRESTIGE_MIN_EARNED) return 0;
  // Discoveries survive resets, so only the ones made since the last reset earn points.
  const fresh = Math.max(0, discoveryCount(s) - (s.legacy.discPaid ?? 0));
  return Math.floor(Math.sqrt(run / PRESTIGE_DIVISOR) + fresh / 8);
}

export function canPrestige(s: GameState): { ok: boolean; why?: string } {
  if (s.stage < PRESTIGE_STAGE) return { ok: false, why: `Reach Stage ${PRESTIGE_STAGE} (${STAGES[PRESTIGE_STAGE - 1].name}) to unlock the Legacy system.` };
  const left = coreTechsLeft(s);
  if (left > 0) return { ok: false, why: `Finish the main research tree (${left} technolog${left === 1 ? 'y' : 'ies'} still to research).` };
  if (s.stats.earnedRun < PRESTIGE_MIN_EARNED) return { ok: false, why: `Earn $${PRESTIGE_MIN_EARNED.toLocaleString()} in this run (you have earned $${Math.floor(s.stats.earnedRun).toLocaleString()}).` };
  return { ok: true };
}

export function prestige(s: GameState): Result {
  const c = canPrestige(s);
  if (!c.ok) return fail(c.why ?? 'Not available.');
  const gain = legacyGain(s);
  const fresh = newGame(((s.rng ^ 0x9e3779b9) >>> 0) || 1, Date.now());
  const ups = s.legacy.ups;
  fresh.legacy = { points: s.legacy.points + gain, spent: s.legacy.spent, ups: { ...ups }, runs: s.legacy.runs + 1, discPaid: discoveryCount(s) };
  // what survives
  fresh.discoveries = s.discoveries;
  fresh.seen = s.seen;
  fresh.records = s.records;
  fresh.cultivars = s.cultivars;
  fresh.stats = { ...s.stats, earnedRun: 0 };
  fresh.settings = s.settings;
  fresh.auto.sell = s.auto.sell;
  fresh.log = [];
  // retained technologies
  for (const id of Object.keys(s.done)) {
    const t = TECH_BY_ID[id];
    if (!t) continue;
    const keepAuto = (ups.auto ?? 0) > 0 && t.cat === 'automation';
    const keepMemory = (ups.memory ?? 0) > 0 && t.stage <= 2 && t.cat !== 'expedition';
    if (keepAuto || keepMemory) fresh.done[id] = 1; // any truthy value: 0 would read as "not researched"
  }
  fresh.money = START_MONEY + (ups.cash ? 200 * 4 ** ups.cash : 0);
  fresh.stage = Math.min(4, 1 + (ups.head ?? 0));
  Object.assign(s, fresh);
  refreshMods(s);
  log(s, 'good', `Legacy reset complete. +${gain} legacy points. A new operation begins.`);
  return ok(`Gained ${gain} legacy points.`);
}

export function buyLegacy(s: GameState, id: string): Result {
  const def = LEGACY_BY_ID[id];
  if (!def) return fail('Unknown upgrade.');
  const lvl = s.legacy.ups[id] ?? 0;
  if (lvl >= def.max) return fail('Maximum level.');
  const cost = legacyCost(def, lvl);
  if (s.legacy.points < cost) return fail(`Needs ${cost} legacy points.`);
  s.legacy.points -= cost;
  s.legacy.spent += cost;
  s.legacy.ups[id] = lvl + 1;
  s.modsDirty = true;
  return ok(`${def.name} is now level ${lvl + 1}.`);
}
