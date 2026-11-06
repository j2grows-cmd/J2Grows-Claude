// Research projects: techs and expeditions. Costs are paid up front, projects run on a timer
// (and keep running offline), and passive research points trickle in from the lab.

import type { GameState } from './types';
import { Ctx, addRp, discoveryCount, fail, log, ok, spend, type Result } from './core';
import { TECHS, TECH_BY_ID, type TechDef } from './techs';
import { SPECIES } from './species';
import { makePropagule } from './economy';
import { clamp } from './util';

export function rpRate(s: GameState): number {
  return s.mods.rpFlat * s.mods.research;
}

export function techState(s: GameState, t: TechDef): { status: 'done' | 'active' | 'available' | 'locked'; why?: string } {
  if (s.done[t.id]) return { status: 'done' };
  if (s.active.some((a) => a.id === t.id)) return { status: 'active' };
  if (t.cat === 'synthetic' && !(s.legacy.ups.branch > 0)) return { status: 'locked', why: 'Unlock the Synthetic Botany Branch in the Legacy shop.' };
  if (s.stage < t.stage) return { status: 'locked', why: `Requires Stage ${t.stage}.` };
  const missing = t.req.filter((r) => !s.done[r]);
  if (missing.length) return { status: 'locked', why: `Requires ${missing.map((m) => TECH_BY_ID[m]?.name ?? m).join(', ')}.` };
  if (t.discoveries && discoveryCount(s) < t.discoveries) return { status: 'locked', why: `Requires ${t.discoveries} discoveries (you have ${discoveryCount(s)}).` };
  return { status: 'available' };
}

export function startProject(s: GameState, id: string): Result {
  const t = TECH_BY_ID[id];
  if (!t) return fail('Unknown project.');
  const st = techState(s, t);
  if (st.status === 'done') return fail('Already researched.');
  if (st.status === 'active') return fail('Already in progress.');
  if (st.status === 'locked') return fail(st.why ?? 'Locked.');
  if (s.active.length >= s.mods.researchSlots) return fail('All project slots are busy. Build Project Offices for more.');
  if (s.rp < t.rp) return fail(`You need ${t.rp} research points.`);
  if (s.money < t.money) return fail(`You need $${t.money.toLocaleString()}.`);
  spend(s, t.money);
  s.rp -= t.rp;
  s.active.push({ id, progress: 0, total: t.time });
  return ok(`Started: ${t.name}.`);
}

function complete(s: GameState, t: TechDef): void {
  s.done[t.id] = s.time;
  s.stats.techs++;
  s.modsDirty = true;
  if (Ctx.rep) Ctx.rep.techs++;
  log(s, 'good', `Research complete: ${t.name}.`);
  if (t.species) {
    for (const spId of t.species) {
      if (!SPECIES[spId]) continue;
      for (let i = 0; i < 2; i++) if (s.props.length < 200) s.props.push(makePropagule(s, spId, 'seed', undefined, { origin: 'expedition' }));
      log(s, 'good', `Expedition brought back specimens of ${SPECIES[spId].common[0]}.`);
    }
  }
}

export function tickResearch(s: GameState, dt: number): void {
  const rp = rpRate(s) * dt;
  addRp(s, rp);
  const speed = 1 + 0.2 * clamp(s.mods.research - 1, 0, 20);
  for (const a of [...s.active]) {
    a.progress += dt * speed;
    if (a.progress >= a.total) {
      s.active.splice(s.active.indexOf(a), 1);
      const t = TECH_BY_ID[a.id];
      if (t) complete(s, t);
    }
  }
}

export const techsByCat = (cat: string): TechDef[] => TECHS.filter((t) => t.cat === cat);
