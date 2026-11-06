// Procedural plant illustrations. Every plant is drawn from its species (leaf form + habit),
// its expressed genes (size, shape, colour, variegation) and its current condition.

import { useMemo } from 'react';
import {
  effectiveSpecies, leafColourHex, mixHex, patternOf, phenotype, variegationHue, variegationTier,
  type Genome, type Pheno, type Species,
} from '../engine';

// ---------------------------------------------------------------------------------------------
// small deterministic RNG for stable artwork
// ---------------------------------------------------------------------------------------------
function mulberry(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const f = (n: number): string => (Math.round(n * 1000) / 1000).toString();

// ---------------------------------------------------------------------------------------------
// leaf outlines in unit space: base at (0,0), tip at (0,-1)
// ---------------------------------------------------------------------------------------------
interface Profile {
  w: number; // max half width
  a: number; // where the widest point sits (small = near the base)
  b: number; // fullness
  base?: number; // base indent (heart)
  notch?: boolean;
  lobes?: number;
}
const PROFILES: Record<string, Profile> = {
  heart: { w: 0.62, a: 0.62, b: 0.8, base: 0.13 },
  split: { w: 0.66, a: 0.7, b: 0.75, base: 0.1, notch: true, lobes: 4 },
  oval: { w: 0.5, a: 0.8, b: 0.7 },
  lance: { w: 0.27, a: 0.85, b: 0.8 },
  paddle: { w: 0.56, a: 1.2, b: 0.6 },
  peltate: { w: 0.5, a: 1, b: 0.5 },
  round: { w: 0.5, a: 1, b: 0.5 },
  fleshy: { w: 0.4, a: 0.9, b: 0.5 },
  strap: { w: 0.11, a: 0.45, b: 0.14 },
  spike: { w: 0.15, a: 0.7, b: 0.45 },
  pitcher: { w: 0.22, a: 0.85, b: 0.8 },
};

function profileOutline(form: string, shape: number): string {
  const pr = PROFILES[form] ?? PROFILES.oval;
  const N = 34;
  const depth = pr.notch ? 0.22 + 0.55 * shape : ['heart', 'oval', 'paddle'].includes(form) ? Math.max(0, shape - 0.55) * 0.9 : 0;
  const k = pr.lobes ?? 3;
  const width = (t: number): number => {
    const tt = Math.pow(t, pr.a);
    let w = pr.w * Math.pow(Math.max(0, Math.sin(Math.PI * tt)), pr.b);
    if (depth > 0 && t > 0.14 && t < 0.9) {
      const n = Math.pow(Math.max(0, Math.cos(2 * Math.PI * (t * k - 0.25))), 4);
      w *= 1 - depth * n;
    }
    return w;
  };
  const left: string[] = [];
  const right: string[] = [];
  const y0 = pr.base ?? 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = -(y0 + (1 - y0) * t);
    const w = width(t);
    left.push(`${f(-w)},${f(y)}`);
    right.push(`${f(w)},${f(y)}`);
  }
  return `M0,${f(-y0 * 0.2)} L${left.join(' L')} L0,-1 L${right.reverse().join(' L')} Z`;
}

function ellipsePoly(cx: number, cy: number, rx: number, ry: number, rot: number, n = 10): string {
  const pts: string[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const x = Math.cos(th) * rx;
    const y = Math.sin(th) * ry;
    pts.push(`${f(cx + x * c - y * s)},${f(cy + x * s + y * c)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Compound leaves: a rachis with leaflets (ZZ plant, ferns). */
function compoundOutline(kind: 'pinnate' | 'frond', shape: number): string {
  const n = kind === 'pinnate' ? 7 : 11;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = 0.18 + (0.8 * i) / (n - 1);
    const size = kind === 'pinnate' ? 0.2 - 0.06 * t : 0.17 * (1 - 0.65 * t) + 0.02;
    const spread = 0.16 + 0.16 * (1 - t) + 0.08 * shape;
    for (const side of [-1, 1]) {
      out.push(ellipsePoly(side * spread, -t, size * 0.75, size * (kind === 'pinnate' ? 0.55 : 0.32), side * (0.7 + 0.2 * t), 9));
    }
  }
  out.push(ellipsePoly(0, -1, 0.07, 0.07, 0, 8));
  out.push('M-0.012,0 L-0.012,-0.98 L0.012,-0.98 L0.012,0 Z');
  return out.join(' ');
}

const cache = new Map<string, string>();
export function leafOutline(form: string, shape: number): string {
  const key = `${form}:${Math.round(shape * 6)}`;
  let d = cache.get(key);
  if (!d) {
    d = form === 'pinnate' || form === 'frond' ? compoundOutline(form, shape) : profileOutline(form, shape);
    cache.set(key, d);
  }
  return d;
}

// ---------------------------------------------------------------------------------------------
// layouts
// ---------------------------------------------------------------------------------------------
interface LeafPlace {
  x: number;
  y: number;
  angle: number; // degrees from vertical
  len: number; // px
  petiole?: [number, number, number, number, number, number]; // quad curve from stem to leaf base
  flip?: boolean;
  back?: boolean; // draw behind
}

const AX = 100;
const AY = 170;

function layout(sp: Species, g: number, size: number, rnd: () => number): { leaves: LeafPlace[]; stems: string[]; pole: boolean; roots: string[] } {
  const habit = sp.habit;
  const form = sp.leaf;
  const leaves: LeafPlace[] = [];
  const stems: string[] = [];
  const roots: string[] = [];
  const growth = Math.pow(g, 0.75);
  const maxN = { rosette: 9, clump: 10, upright: 9, climber: 10, trailing: 12, epiphyte: 9 }[habit];
  const n = Math.max(2, Math.round(lerp(2, maxN, growth)));
  const baseLen = ({ heart: 56, split: 62, oval: 52, lance: 58, paddle: 52, peltate: 30, strap: 100, round: 26, fleshy: 34, pinnate: 56, frond: 60, spike: 92, pitcher: 52 } as Record<string, number>)[form] ?? 50;
  const sizeF = (0.62 + 0.75 * size) * lerp(0.32, 1, growth);
  const leafLen = (): number => baseLen * sizeF * (0.8 + 0.3 * rnd());

  if (habit === 'rosette' || habit === 'epiphyte') {
    for (let i = 0; i < n; i++) {
      const spread = habit === 'epiphyte' ? 70 : 62;
      const th = n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1) + (rnd() - 0.5) * 12;
      const pet = (18 + 22 * growth) * (0.7 + 0.5 * rnd()) * (form === 'peltate' || form === 'round' ? 1.2 : 1);
      const r = (th * Math.PI) / 180;
      const bx = AX + Math.sin(r) * pet;
      const by = AY - Math.cos(r) * pet;
      const mid = pet * 0.5;
      leaves.push({
        x: bx, y: by, angle: th * 1.08, len: leafLen(),
        petiole: [AX, AY, AX + Math.sin(r * 0.5) * mid * 0.6, AY - Math.cos(r * 0.4) * mid, bx, by],
        back: Math.abs(th) > 50,
      });
    }
    if (habit === 'epiphyte') {
      for (let i = 0; i < 5; i++) {
        const dx = (rnd() - 0.5) * 50;
        roots.push(`M${AX + dx * 0.3},${AY} Q${AX + dx},${AY + 18} ${AX + dx * 1.4},${AY + 30 + rnd() * 10}`);
      }
    }
  } else if (habit === 'clump') {
    for (let i = 0; i < n; i++) {
      const th = (-26 + (52 * i) / Math.max(1, n - 1)) + (rnd() - 0.5) * 12;
      const off = (rnd() - 0.5) * 38;
      leaves.push({ x: AX + off * 0.9, y: AY - 2, angle: th * 0.55 + off * 0.2, len: leafLen() * (0.8 + 0.4 * rnd()), back: i % 2 === 0 });
    }
  } else if (habit === 'upright') {
    const H = 18 + 80 * growth;
    stems.push(`M${AX},${AY} Q${AX + 3},${AY - H / 2} ${AX},${AY - H}`);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const side = i % 2 === 0 ? -1 : 1;
      const y = AY - H * t;
      const pet = 10 + 8 * rnd();
      const th = side * (46 + 24 * rnd()) * (1 - 0.35 * t) - (t > 0.85 ? side * 20 : 0);
      const r = (th * Math.PI) / 180;
      const bx = AX + Math.sin(r) * pet;
      const by = y - Math.cos(r) * pet * 0.6;
      leaves.push({ x: bx, y: by, angle: th, len: leafLen() * (1 - 0.25 * t), petiole: [AX, y, AX + (bx - AX) * 0.4, y - 4, bx, by] });
    }
    leaves.push({ x: AX, y: AY - H - 4, angle: 0, len: leafLen() * 0.8 });
  } else if (habit === 'climber') {
    const H = 24 + 84 * growth;
    stems.push(`M${AX},${AY} C${AX + 14},${AY - H * 0.3} ${AX - 12},${AY - H * 0.65} ${AX + 4},${AY - H}`);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.6) / (n + 0.3);
      const side = i % 2 === 0 ? -1 : 1;
      const sx = AX + 14 * Math.sin(t * 5) * (1 - t) + 4 * t;
      const y = AY - H * t;
      const pet = 12 + 10 * rnd();
      const th = side * (50 + 30 * rnd());
      const r = (th * Math.PI) / 180;
      const bx = sx + Math.sin(r) * pet;
      const by = y - Math.cos(r) * pet * 0.5 + 6;
      leaves.push({ x: bx, y: by, angle: th * 1.15, len: leafLen(), petiole: [sx, y, sx + (bx - sx) * 0.6, y - 6, bx, by] });
    }
    leaves.push({ x: AX + 4, y: AY - H - 2, angle: 6, len: leafLen() * 0.7 });
  } else {
    // trailing: arching stems spilling over the rim
    const stemsN = clamp(Math.round(2 + growth * 3), 2, 5);
    const per = Math.max(2, Math.round(n / stemsN));
    for (let s = 0; s < stemsN; s++) {
      const dir = stemsN === 1 ? 0 : -1 + (2 * s) / (stemsN - 1);
      const reach = (30 + 70 * growth) * (0.7 + 0.5 * rnd());
      const lift = 20 + 26 * (1 - Math.abs(dir)) * growth;
      const ex = AX + dir * reach;
      const ey = AY + 6 + 24 * Math.abs(dir) * growth;
      const cx = AX + dir * reach * 0.45;
      const cy = AY - lift;
      stems.push(`M${AX + dir * 6},${AY} Q${cx},${cy} ${ex},${ey}`);
      for (let k = 1; k <= per; k++) {
        const t = k / (per + 0.2);
        const x = (1 - t) * (1 - t) * (AX + dir * 6) + 2 * (1 - t) * t * cx + t * t * ex;
        const y = (1 - t) * (1 - t) * AY + 2 * (1 - t) * t * cy + t * t * ey;
        const dx = 2 * (1 - t) * (cx - (AX + dir * 6)) + 2 * t * (ex - cx);
        const dy = 2 * (1 - t) * (cy - AY) + 2 * t * (ey - cy);
        const tang = (Math.atan2(dx, -dy) * 180) / Math.PI;
        const side = k % 2 === 0 ? -1 : 1;
        const th = tang + side * 62 + (rnd() - 0.5) * 20;
        const r = (th * Math.PI) / 180;
        const pet = 5 + 4 * rnd();
        leaves.push({ x: x + Math.sin(r) * pet, y: y - Math.cos(r) * pet, angle: th, len: leafLen() * 0.85, petiole: [x, y, x + Math.sin(r) * pet * 0.5, y - Math.cos(r) * pet * 0.5, x + Math.sin(r) * pet, y - Math.cos(r) * pet] });
      }
    }
  }
  return { leaves, stems, pole: habit === 'climber', roots };
}

// ---------------------------------------------------------------------------------------------
// variegation patches (unit space, clipped to the leaf)
// ---------------------------------------------------------------------------------------------
function patches(pattern: string, tier: number, rnd: () => number): { d: string; o: number }[] {
  const out: { d: string; o: number }[] = [];
  const strength = 0.45 + 0.14 * tier;
  if (pattern === 'Speckled') {
    const n = 6 + tier * 5;
    for (let i = 0; i < n; i++) out.push({ d: ellipsePoly((rnd() - 0.5) * 0.8, -0.1 - rnd() * 0.85, 0.035 + 0.03 * rnd(), 0.035 + 0.03 * rnd(), 0, 7), o: strength });
  } else if (pattern === 'Marbled') {
    const n = 3 + tier * 2;
    for (let i = 0; i < n; i++) out.push({ d: ellipsePoly((rnd() - 0.5) * 0.7, -0.15 - rnd() * 0.75, 0.07 + 0.1 * rnd(), 0.05 + 0.12 * rnd(), rnd() * 3, 9), o: strength });
  } else if (pattern === 'Splash') {
    out.push({ d: ellipsePoly((rnd() > 0.5 ? 1 : -1) * 0.18, -0.5, 0.26, 0.45, (rnd() - 0.5) * 0.6, 14), o: 0.9 });
    out.push({ d: ellipsePoly((rnd() - 0.5) * 0.4, -0.8, 0.1, 0.1, 0, 8), o: 0.7 });
  } else if (pattern === 'Sectoral') {
    out.push({ d: rnd() > 0.5 ? 'M0,0.1 L0.9,0.1 L0.9,-1.1 L0.02,-1.1 Z' : 'M0,0.1 L-0.9,0.1 L-0.9,-1.1 L-0.02,-1.1 Z', o: 0.95 });
  } else {
    out.push({ d: ellipsePoly(0, -0.2, 0.75, 0.42, (rnd() - 0.5) * 0.3, 16), o: 0.95 });
    out.push({ d: ellipsePoly(0.1, -0.78, 0.22, 0.12, 0, 8), o: 0.7 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------------------------
export interface PlantArtProps {
  sp: string;
  hy?: string;
  genome?: Genome;
  pheno?: Pheno;
  growth?: number;
  health?: number;
  hydration?: number;
  infected?: boolean;
  seed?: number;
  pot?: 'standard' | 'selfWatering' | 'passiveHydro';
  height?: number | string;
  glow?: boolean;
  sparkle?: boolean;
  bare?: boolean; // no pot
  className?: string;
}

export function PlantArt({ sp, hy, genome, pheno, growth = 1, health = 100, hydration = 70, infected, seed = 1, pot = 'standard', height, glow, sparkle, bare, className }: PlantArtProps) {
  const species = effectiveSpecies(sp, hy);
  const ph = useMemo(() => pheno ?? (genome ? phenotype(genome) : null), [pheno, genome]);
  const leafSize = ph?.leafSize ?? 0.5;
  const shape = ph?.leafShape ?? 0.5;
  const colour = ph?.leafColour ?? 0.5;
  const varVal = ph?.variegation ?? 0;
  const g = clamp(growth);
  const uid = `pa${seed}_${species.id.slice(0, 4)}`;

  const art = useMemo(() => {
    const rnd = mulberry(seed * 7919 + species.id.length * 31);
    const lay = layout(species, g, leafSize, rnd);
    const tier = variegationTier(varVal);
    const pattern = genome ? patternOf(genome, tier) : 'Marbled';
    return { lay, tier, pattern, seedBase: seed };
  }, [species, g, leafSize, varVal, genome, seed]);

  const base = leafColourHex(species, colour);
  const sick = clamp((60 - health) / 60);
  const parched = clamp((28 - hydration) / 28);
  const body = mixHex(base, '#b09a45', sick * 0.65);
  const dark = mixHex(body, '#03120a', 0.5);
  const light = mixHex(body, '#e9f7b8', 0.3);
  const vcol = genome ? variegationHue(colour).hex : '#f4f0dd';
  const form = species.leaf;
  const outline = leafOutline(form, shape);
  const compound = form === 'pinnate' || form === 'frond';

  const potCol = pot === 'selfWatering' ? ['#e8e4d8', '#c9c3b2'] : pot === 'passiveHydro' ? ['#cfe8ee', '#9cc3cf'] : ['#b9673f', '#8f4a2a'];

  return (
    <svg className={className} viewBox="0 0 200 224" preserveAspectRatio="xMidYMax meet" style={{ height, width: height ? 'auto' : '100%', display: 'block' }} role="img" aria-label={species.common[0]}>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <path d={outline} />
        </clipPath>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="62%" r="55%">
          <stop offset="0%" stopColor={body} stopOpacity="0.35" />
          <stop offset="100%" stopColor={body} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-pot`} x1="0" x2="1">
          <stop offset="0%" stopColor={potCol[1]} />
          <stop offset="45%" stopColor={potCol[0]} />
          <stop offset="100%" stopColor={potCol[1]} />
        </linearGradient>
      </defs>
      {glow && <ellipse cx="100" cy="130" rx="95" ry="95" fill={`url(#${uid}-glow)`} />}
      {art.lay.pole && <rect x="94" y="64" width="10" height="112" rx="5" fill="#5b4a33" opacity="0.8" />}
      {art.lay.roots.map((d, i) => (
        <path key={`r${i}`} d={d} stroke="#9fb08a" strokeWidth="1.6" fill="none" opacity="0.8" />
      ))}
      {art.lay.stems.map((d, i) => (
        <path key={`s${i}`} d={d} stroke={dark} strokeWidth={2.2 + 1.6 * g} fill="none" strokeLinecap="round" />
      ))}
      {[true, false].map((back) =>
        art.lay.leaves
          .filter((l) => !!l.back === back)
          .map((l, i) => {
            const droop = parched * 34;
            const ang = l.angle + Math.sign(l.angle || 1) * droop;
            const L = l.len * (1 - 0.18 * parched);
            const w = form === 'strap' || form === 'spike' ? L : L;
            const rnd = mulberry(seed * 131 + i * 17 + (back ? 3 : 0));
            const ptl = l.petiole;
            return (
              <g key={`${back ? 'b' : 'f'}${i}`}>
                {ptl && <path d={`M${f(ptl[0])},${f(ptl[1])} Q${f(ptl[2])},${f(ptl[3])} ${f(ptl[4])},${f(ptl[5])}`} stroke={dark} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
                <g transform={`translate(${f(l.x)},${f(l.y)}) rotate(${f(ang)}) scale(${f(w)},${f(L)})`}>
                  <path d={outline} fill={back ? dark : body} stroke={dark} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                  {!back && !compound && (
                    <>
                      <path d={`M0,0 L0,-0.95`} stroke={light} strokeWidth="0.9" opacity="0.55" vectorEffect="non-scaling-stroke" />
                      {form !== 'strap' && form !== 'spike' && [0.3, 0.5, 0.7].map((y) => (
                        <path key={y} d={`M0,${-y} L${0.3 - y * 0.12},${-y - 0.12} M0,${-y} L${-0.3 + y * 0.12},${-y - 0.12}`} stroke={light} strokeWidth="0.6" opacity="0.35" vectorEffect="non-scaling-stroke" />
                      ))}
                      <path d="M0,0 L0.7,0 L0.7,-1 L0,-1 Z" fill="#fff" opacity="0.07" clipPath={`url(#${uid}-clip)`} />
                    </>
                  )}
                  {!back && art.tier > 0 && !compound && (
                    <g clipPath={`url(#${uid}-clip)`}>
                      {patches(art.pattern, art.tier, rnd).map((p, k) => (
                        <path key={k} d={p.d} fill={vcol} opacity={p.o} />
                      ))}
                    </g>
                  )}
                  {!back && infected && !compound && (
                    <g clipPath={`url(#${uid}-clip)`}>
                      {[0, 1, 2].map((k) => (
                        <circle key={k} cx={(rnd() - 0.5) * 0.5} cy={-0.25 - rnd() * 0.55} r={0.07 + 0.05 * rnd()} fill="#5a3418" opacity="0.8" />
                      ))}
                    </g>
                  )}
                </g>
                {form === 'pitcher' && !back && (
                  <g transform={`translate(${f(l.x + Math.sin((ang * Math.PI) / 180) * L)},${f(l.y - Math.cos((ang * Math.PI) / 180) * L)})`}>
                    <path d="M0,0 Q4,12 0,18" stroke={dark} strokeWidth="1.4" fill="none" />
                    <path d="M-7,18 Q-9,34 0,40 Q9,34 7,18 Z" fill={mixHex(body, '#9a3a3a', 0.5)} stroke={dark} strokeWidth="1" />
                    <ellipse cx="0" cy="18" rx="7" ry="2.4" fill={dark} />
                  </g>
                )}
              </g>
            );
          }),
      )}
      {!bare && (
        <g>
          <ellipse cx="100" cy="176" rx="36" ry="6.5" fill="#2a1d12" />
          <path d="M62,174 L66,210 Q66,218 76,218 L124,218 Q134,218 134,210 L138,174 Z" fill={`url(#${uid}-pot)`} />
          <rect x="58" y="168" width="84" height="10" rx="4" fill={potCol[0]} stroke={potCol[1]} strokeWidth="1" />
          {pot === 'selfWatering' && <rect x="86" y="196" width="28" height="9" rx="3" fill="#7fb7d6" opacity="0.8" />}
          {pot === 'passiveHydro' && <path d="M68,196 L132,196 L130,210 Q130,216 122,216 L78,216 Q70,216 70,210 Z" fill="#6fb4d8" opacity="0.55" />}
          <ellipse cx="100" cy="171" rx="34" ry="4" fill="#3b2a1a" />
        </g>
      )}
      {sparkle && (
        <g fill="#e9f7b8">
          <path d="M168,36 l3,9 9,3 -9,3 -3,9 -3,-9 -9,-3 9,-3z" opacity="0.95" />
          <path d="M30,60 l2,6 6,2 -6,2 -2,6 -2,-6 -6,-2 6,-2z" opacity="0.7" />
        </g>
      )}
    </svg>
  );
}

/** Small leaf silhouette used as a species swatch in lists. */
export function LeafIcon({ sp, size = 22 }: { sp: string; size?: number }) {
  const s = effectiveSpecies(sp);
  const form = s.leaf;
  const compound = form === 'pinnate' || form === 'frond';
  const d = leafOutline(form, 0.3);
  const col = s.palette[1];
  return (
    <svg width={size} height={size} viewBox="-0.7 -1.1 1.4 1.3" aria-hidden>
      <path d={d} fill={col} stroke={s.palette[0]} strokeWidth={compound ? 0 : 0.04} />
    </svg>
  );
}
