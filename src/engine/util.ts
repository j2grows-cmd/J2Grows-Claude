// Small shared helpers: math + a seeded PRNG whose state lives inside the game state.

/** Clamp to [a,b]. A NaN input gives `a`, so one bad number can never poison the simulation. */
export const clamp = (x: number, a = 0, b = 1): number => (x !== x || x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const round = (x: number, d = 3): number => {
  const m = 10 ** d;
  return Math.round(x * m) / m;
};

export interface Rng {
  rng: number;
}

/** mulberry32 over a uint32 stored on the holder, so the whole simulation is reproducible. */
export function rand(h: Rng): number {
  let t = (h.rng = (h.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const range = (h: Rng, a: number, b: number): number => a + (b - a) * rand(h);
export const int = (h: Rng, a: number, b: number): number => Math.floor(range(h, a, b + 1));
export const chance = (h: Rng, p: number): boolean => rand(h) < p;

export function gauss(h: Rng): number {
  let u = 0;
  while (u === 0) u = rand(h);
  const v = rand(h);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function pick<T>(h: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rand(h) * arr.length)];
}

export function weighted<T>(h: Rng, items: readonly T[], w: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += Math.max(0, w(it));
  let r = rand(h) * total;
  for (const it of items) {
    r -= Math.max(0, w(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

/** Smooth band score: 1 inside [lo,hi], falling to 0 at `soft` beyond either edge. */
export function band(x: number, lo: number, hi: number, soft: number): number {
  if (x >= lo && x <= hi) return 1;
  const d = x < lo ? lo - x : x - hi;
  const s = Math.max(1e-6, soft);
  const t = clamp(1 - d / s);
  return t * t * (3 - 2 * t);
}

export const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
export const mean = (a: readonly number[]): number => (a.length ? sum(a) / a.length : 0);

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
