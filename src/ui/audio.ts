// Sound, synthesised with the Web Audio API so the game ships no audio files. Nothing plays until the
// player has interacted with the page (browsers require that), and everything respects the volume prefs.

import { getPrefs } from './prefs';

type Sfx = 'click' | 'coin' | 'good' | 'bad' | 'discovery' | 'stage' | 'water' | 'achievement';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientNodes: { stop: () => void } | null = null;
let ambientGain: GainNode | null = null;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine', slideTo?: number): void {
  const c = ctx;
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g);
  g.connect(master);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

function noise(start: number, dur: number, vol: number, freq: number): void {
  const c = ctx;
  if (!c || !master) return;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 0.9;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(c.currentTime + start);
}

export function play(kind: Sfx): void {
  const v = getPrefs().sfx;
  if (v <= 0.001 || !ensure()) return;
  const k = v * v; // perceptual curve
  switch (kind) {
    case 'click': tone(520, 0, 0.05, 0.05 * k, 'triangle'); break;
    case 'coin': tone(988, 0, 0.09, 0.09 * k, 'square'); tone(1319, 0.07, 0.18, 0.08 * k, 'square'); break;
    case 'good': tone(440, 0, 0.1, 0.08 * k, 'triangle'); tone(660, 0.08, 0.16, 0.08 * k, 'triangle'); break;
    case 'bad': tone(220, 0, 0.16, 0.1 * k, 'sawtooth', 150); break;
    case 'water': noise(0, 0.28, 0.16 * k, 1800); tone(700, 0.02, 0.2, 0.03 * k, 'sine', 420); break;
    case 'discovery':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.45, 0.07 * k, 'sine'));
      tone(1568, 0.38, 0.7, 0.04 * k, 'sine');
      break;
    case 'achievement':
      tone(392, 0, 0.14, 0.08 * k, 'triangle'); tone(523, 0.12, 0.14, 0.08 * k, 'triangle'); tone(784, 0.24, 0.5, 0.09 * k, 'triangle');
      break;
    case 'stage':
      [262, 330, 392, 523].forEach((f, i) => tone(f, i * 0.14, 0.6, 0.08 * k, 'triangle'));
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6 + i * 0.1, 0.9, 0.07 * k, 'sine'));
      break;
  }
}

/** A soft, slowly moving laboratory hum: filtered noise plus two detuned drones. Started and stopped by the preference. */
export function setAmbient(level: number): void {
  if (level <= 0.001) {
    if (ambientGain && ctx) ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    const n = ambientNodes;
    ambientNodes = null;
    if (n) setTimeout(n.stop, 1500);
    ambientGain = null;
    return;
  }
  const c = ensure();
  if (!c || !master) return;
  if (!ambientNodes) {
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(master);
    const nodes: AudioScheduledSourceNode[] = [];
    // two drones, a fifth apart
    for (const f of [110, 164.8]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = 0.5;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.07 + f / 4000;
      const lg = c.createGain();
      lg.gain.value = 0.25;
      lfo.connect(lg);
      lg.connect(og.gain);
      o.connect(og);
      og.connect(g);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    }
    // air: very quiet band-passed noise
    const buf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const ng = c.createGain();
    ng.gain.value = 0.18;
    src.connect(f);
    f.connect(ng);
    ng.connect(g);
    src.start();
    nodes.push(src);
    ambientGain = g;
    ambientNodes = {
      stop: () => {
        for (const n of nodes) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
        g.disconnect();
      },
    };
  }
  ambientGain?.gain.setTargetAtTime(0.06 * level * level, c.currentTime, 0.6);
}

/** Browsers only allow audio after a gesture: the first click or key press unlocks it. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  const go = () => {
    ensure();
    setAmbient(getPrefs().ambient);
    window.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}
