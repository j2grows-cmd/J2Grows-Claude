// Sampled history of the run for the charts. Samples start 60 s apart; when the buffer fills, every second
// sample is dropped and the interval doubles, so a whole run always fits in a few hundred points.

import type { GameState } from './types';
import { newSeries } from './state';

export const SERIES_MAX = 240;

export function sampleSeries(s: GameState): void {
  const r = s.series;
  if (s.time < r.next) return;
  r.t.push(Math.round(s.time));
  r.money.push(Math.round(s.money));
  r.rp.push(Math.round(s.rp));
  r.net.push(Math.round((s.income - s.expense) * 100) / 100);
  r.plants.push(s.plants.length);
  r.next = s.time + r.every;
  if (r.t.length > SERIES_MAX) {
    for (const k of ['t', 'money', 'rp', 'net', 'plants'] as const) r[k] = r[k].filter((_, i) => i % 2 === 0);
    r.every *= 2;
    r.next = s.time + r.every;
  }
}

export const resetSeries = (s: GameState): void => {
  s.series = newSeries();
};
