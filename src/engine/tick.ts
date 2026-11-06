// The simulation clock: single steps, bulk runs and offline catch-up.

import type { GameState, OfflineReport } from './types';
import { Ctx, drain, log } from './core';
import { BASE_OFFLINE_EFF, BASE_OFFLINE_HOURS } from './config';
import { refreshMods, totalWages } from './mods';
import { stepRooms } from './plants';
import { tickJobs } from './propagation';
import { tickResearch } from './research';
import { rescue, tickMarket, tickRoyalties } from './economy';
import { runAutomation } from './automation';
import { clamp } from './util';
import { tickShows } from './shows';
import { sampleSeries } from './series';
import { checkAchievements } from './achievements';

/** Advance the simulation by dt seconds (callers keep dt modest: <= ~1s online). */
export function step(s: GameState, dt: number): void {
  if (dt <= 0) return;
  if (s.modsDirty) refreshMods(s);
  s.time += dt;
  s.totalTime += dt;
  stepRooms(s, dt);
  tickJobs(s, dt);
  tickResearch(s, dt);
  tickMarket(s, dt);
  tickRoyalties(s, dt);
  drain(s, totalWages(s) * dt);
  runAutomation(s, dt);
  rescue(s);
  tickShows(s);
  sampleSeries(s);
  if (Math.floor(s.time / 5) !== Math.floor((s.time - dt) / 5)) checkAchievements(s);
  if (s.modsDirty) refreshMods(s);
  const k = 1 - Math.exp(-dt / 20);
  s.income += (Ctx.inc / dt - s.income) * k;
  s.expense += (Ctx.exp / dt - s.expense) * k;
  Ctx.inc = 0;
  Ctx.exp = 0;
}

/** Run `seconds` of simulation in fixed sub-steps. */
export function run(s: GameState, seconds: number, maxStep = 1): void {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(maxStep, left);
    step(s, dt);
    left -= dt;
  }
}

export function offlineLimits(s: GameState): { capSeconds: number; efficiency: number } {
  return {
    capSeconds: (BASE_OFFLINE_HOURS + s.mods.offlineCap) * 3600,
    efficiency: clamp(BASE_OFFLINE_EFF + s.mods.offlineEff, 0, 1),
  };
}

export function simulateOffline(s: GameState, awaySeconds: number): OfflineReport | null {
  if (awaySeconds < 30) return null;
  if (s.modsDirty) refreshMods(s);
  const { capSeconds, efficiency } = offlineLimits(s);
  const credited = Math.min(awaySeconds, capSeconds) * efficiency;
  const report: OfflineReport = { seconds: awaySeconds, credited, money: 0, rp: 0, matured: 0, died: 0, discoveries: 0, techs: 0, jobs: 0, neglected: 0 };
  const n = Math.min(4500, Math.max(1, Math.ceil(credited / 60)));
  const dt = credited / n;
  Ctx.offline = true;
  Ctx.quiet = true;
  Ctx.rep = report;
  try {
    for (let i = 0; i < n; i++) step(s, dt);
  } finally {
    Ctx.offline = false;
    Ctx.quiet = false;
    Ctx.rep = null;
  }
  report.neglected = s.plants.filter((p) => p.health < 25 || p.hydration < 5).length;
  log(s, 'info', `Welcome back. ${Math.round(credited / 60)} minutes of progress were simulated while you were away.`);
  return report;
}
