// "Why is this plant struggling?" Compares a plant with the conditions it is actually getting and says,
// in order of importance, what to change. It uses the same suitability model the simulation uses.

import type { GameState, Plant } from './types';
import { MEDIA_DEFS } from './config';
import { effectiveSpecies } from './species';
import { bestMedium, getRoom, suitability } from './plants';

export interface Issue {
  key: string;
  /** 0 (trivial) to 1 (critical). */
  severity: number;
  title: string;
  fix: string;
}

export interface Diagnosis {
  /** Overall suitability 0..1 (the number that drives growth and health). */
  fit: number;
  trend: 'thriving' | 'steady' | 'declining';
  issues: Issue[];
}

const r0 = (x: number): number => Math.round(x);

export function diagnose(s: GameState, p: Plant): Diagnosis | null {
  const room = getRoom(s, p.room);
  if (!room) return null;
  const sp = effectiveSpecies(p.sp, p.hy);
  const e = sp.env;
  const a = room.act;
  const su = suitability(p, sp, room);
  const issues: Issue[] = [];
  const add = (key: string, factor: number, title: string, fix: string, floor = 0.8) => {
    if (factor < floor) issues.push({ key, severity: Math.min(1, 1 - factor), title, fix });
  };

  if (su.lethal) {
    issues.push({
      key: 'lethal', severity: 1,
      title: `The room is lethal: ${r0(a.temp)}°C`,
      fix: a.temp < e.lethal[0] ? `This species dies below ${e.lethal[0]}°C. Raise the room temperature at once (and add Climate Control if it cannot hold).` : `This species dies above ${e.lethal[1]}°C. Lower the room temperature at once (and add Climate Control if it cannot hold).`,
    });
  }
  add('temp', su.temp, a.temp < e.temp[0] ? `Too cold (${r0(a.temp)}°C, wants ${e.temp[0]}–${e.temp[1]}°C)` : `Too hot (${r0(a.temp)}°C, wants ${e.temp[0]}–${e.temp[1]}°C)`,
    `Set the room temperature between ${e.temp[0]} and ${e.temp[1]}°C. If the actual value does not follow the setting, the room needs Climate Control.`);
  add('light', su.light, a.light < e.light[0] ? `Too little light (${r0(a.light)}, wants ${e.light[0]}–${e.light[1]})` : `Too much light (${r0(a.light)}, wants ${e.light[0]}–${e.light[1]})`,
    a.light < e.light[0] ? 'Raise the room’s light. If it is already at the limit, upgrade Grow Lighting in the Laboratory.' : 'Lower the room’s light, or move this plant to a dimmer room.');
  add('rh', su.rh, a.humidity < e.rh[0] ? `Air is too dry (${r0(a.humidity)}%, wants ${e.rh[0]}–${e.rh[1]}%)` : `Air is too humid (${r0(a.humidity)}%, wants ${e.rh[0]}–${e.rh[1]}%)`,
    a.humidity < e.rh[0] ? 'Raise humidity in the room settings; Humidity Control helps it hold.' : 'Lower humidity or raise airflow: stagnant, wet air invites fungus.');
  add('air', su.air, a.airflow < e.air[0] ? `Too little airflow (${r0(a.airflow)}, wants ${e.air[0]}–${e.air[1]})` : `Too much airflow (${r0(a.airflow)}, wants ${e.air[0]}–${e.air[1]})`,
    a.airflow < e.air[0] ? 'Raise airflow in the room settings.' : 'Lower airflow in the room settings.', 0.75);
  if (p.hydration < e.dryBack) add('water', su.water, `Thirsty (${r0(p.hydration)}%, wants above ${r0(e.dryBack)}%)`, 'Water it. Automation or an Irrigation Line will keep it watered for you.');
  else if (p.hydration > e.wetCap) add('wet', su.water, `Waterlogged (${r0(p.hydration)}%, roots suffer above ${r0(e.wetCap)}%)`, 'Stop watering and let it dry back. A faster-draining medium or a passive hydro pot helps.');
  if (p.nutrients < e.nutrient[0]) add('feed', su.nut, `Underfed (${r0(p.nutrients)}%, wants ${r0(e.nutrient[0])}–${r0(e.nutrient[1])}%)`, 'Feed it. Raise the room’s feed strength or use auto-feed.');
  else if (p.nutrients > e.nutrient[1]) {
    const burning = p.nutrients > e.nutrient[1] + 15;
    add('overfeed', su.nut, `${burning ? 'Fertiliser burn' : 'Overfed'} (${r0(p.nutrients)}%, wants ${r0(e.nutrient[0])}–${r0(e.nutrient[1])}%)`, 'Stop feeding until it falls back into range, and lower the room’s feed strength.', burning ? 1 : 0.85);
  }
  if ((e.media[p.medium] ?? 0.45) < 0.6) {
    const best = bestMedium(sp, s);
    add('medium', su.medium, `${MEDIA_DEFS[p.medium].name} is a poor medium for this species`, `Repot it into ${MEDIA_DEFS[best].name}.`, 0.9);
  }
  if (p.roots < 45) {
    issues.push({ key: 'roots', severity: Math.min(1, (45 - p.roots) / 45 * 0.8 + 0.2), title: `Roots are damaged (${r0(p.roots)}%)`, fix: 'Roots recover slowly in good conditions. Fix any waterlogging or drought first, then be patient.' });
  }
  if (p.inf) {
    const fix = {
      fungal: 'Treat it ($3), then lower humidity and raise airflow so it does not return.',
      pests: 'Treat it ($3), then keep the room cooler and a little more humid.',
      rot: 'Treat it ($3), then water less and use a faster-draining medium.',
    }[p.inf.kind];
    issues.push({ key: 'inf', severity: Math.min(1, 0.45 + p.inf.sev * 0.55), title: `${p.inf.kind === 'rot' ? 'Root rot' : p.inf.kind === 'fungal' ? 'Fungal infection' : 'Pest infestation'} (${r0(p.inf.sev * 100)}% severe)`, fix });
  }
  issues.sort((x, y) => y.severity - x.severity);
  const trend = su.total < 0.45 || su.lethal ? 'declining' : su.total >= 0.7 && !p.inf ? 'thriving' : 'steady';
  return { fit: su.total, trend, issues };
}
