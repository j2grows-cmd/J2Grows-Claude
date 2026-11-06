// Playtest instrumentation. Two layers:
//  * a local log of milestones, always kept in this browser and exportable from Settings, so a playtester can
//    hand it over even if nothing is ever uploaded;
//  * an anonymous upload of the same events, only if the player has said yes. No names, no email, no save data:
//    a random device id, the stage, time played and a few counters.

import { CLOUD_KEY, CLOUD_URL } from './cloud';
import { getPrefs } from './ui/prefs';

export const BUILD = '0.2.0';
const LOG_KEY = 'j2grows.playlog.v1';
const MAX_LOCAL = 400;

export interface PlayEvent {
  at: number;
  kind: string;
  data: Record<string, number | string | boolean>;
}

const session = Math.random().toString(36).slice(2, 10);
let log: PlayEvent[] = [];
let pending: PlayEvent[] = [];
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    log = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as PlayEvent[];
    if (!Array.isArray(log)) log = [];
  } catch {
    log = [];
  }
}
function persist(): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_LOCAL)));
  } catch {
    /* ignore */
  }
}

export function track(kind: string, data: PlayEvent['data'] = {}): void {
  ensureLoaded();
  const ev: PlayEvent = { at: Date.now(), kind, data };
  log.push(ev);
  if (log.length > MAX_LOCAL) log.splice(0, log.length - MAX_LOCAL);
  persist();
  if (getPrefs().telemetry === 'on') {
    pending.push(ev);
    if (pending.length >= 8 || kind === 'stage' || kind === 'reset') void flush();
  }
}

export async function flush(): Promise<void> {
  if (getPrefs().telemetry !== 'on' || !pending.length) return;
  const batch = pending.splice(0, 50);
  const device = getPrefs().deviceId;
  try {
    const r = await fetch(`${CLOUD_URL}/rest/v1/telemetry_events`, {
      method: 'POST',
      headers: { apikey: CLOUD_KEY, Authorization: `Bearer ${CLOUD_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(batch.map((e) => ({ device, session, kind: e.kind, data: e.data, build: BUILD, at: new Date(e.at).toISOString() }))),
      keepalive: true,
    });
    if (!r.ok) pending = []; // table missing or refused: drop rather than retry forever
  } catch {
    pending.unshift(...batch.slice(0, 20));
  }
}

export function playLog(): PlayEvent[] {
  ensureLoaded();
  return [...log];
}
export function clearPlayLog(): void {
  log = [];
  pending = [];
  persist();
}

/** A plain-text report a playtester can send back: build, device-free facts and the milestone log. */
export function playReport(summary: Record<string, string | number>, notes: string): string {
  ensureLoaded();
  const head = [`J2Grows playtest report`, `build ${BUILD}`, `generated ${new Date().toISOString()}`, `browser ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`, ''];
  const sum = Object.entries(summary).map(([k, v]) => `${k}: ${v}`);
  const events = log.map((e) => `${new Date(e.at).toISOString()}  ${e.kind}  ${JSON.stringify(e.data)}`);
  return [...head, 'Summary', ...sum, '', 'Notes from the player', notes.trim() || '(none)', '', 'Milestones', ...events].join('\n');
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush());
}
