// Challenge runs: after the first legacy reset a run can be started under a handicap. Clearing it (reaching
// the next reset) pays a bonus on that run's legacy points and marks the challenge as cleared for good.

import type { Mods } from './types';

export interface Challenge {
  id: string;
  name: string;
  blurb: string;
  /** Extra legacy points, as a share of the normal gain. */
  bonus: number;
  /** Starts with only the base cash and stage, ignoring Founders' Grant and Head Start. */
  bare: boolean;
  apply: (m: Mods) => void;
}

export const CHALLENGES: Challenge[] = [
  { id: 'bootstrap', name: 'Bootstrap', blurb: 'No grant, no head start, and buyers pay 10% less. Everything is earned from the first $200.', bonus: 0.25, bare: true, apply: (m) => { m.sellPrice *= 0.9; } },
  { id: 'blight', name: 'Blight Year', blurb: 'Disease strikes far more often and spreads faster. Airflow, humidity and clean pots matter.', bonus: 0.3, bare: false, apply: (m) => { m.diseaseResist -= 0.8; } },
  { id: 'drought', name: 'Drought and Famine', blurb: 'Plants dry out 70% faster and eat 50% more. Irrigation and dosing become urgent.', bonus: 0.3, bare: false, apply: (m) => { m.waterUse *= 1.7; m.nutrientUse *= 1.5; } },
  { id: 'austerity', name: 'Austerity', blurb: 'Wages double, running costs rise by half and research is 20% slower.', bonus: 0.4, bare: false, apply: (m) => { m.wage *= 2; m.energy *= 1.5; m.research *= 0.8; } },
];
export const CHALLENGE_BY_ID: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
