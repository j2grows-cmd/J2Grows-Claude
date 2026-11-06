// Hero artwork: the species picture from Supabase, adjusted for the individual plant, plus the brand images.

import { useMemo, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { effectiveSpecies, mixHex, phenotype, variegationHue, variegationTier } from '../engine';
import {
  BRAND_BUCKET, SPECIES_BUCKET, heroPath, markHeroFailed, noteImageFail, noteImageOk, objectUrl, renderUrl,
  setTransformState, transformState, widthFor,
} from './artwork';
import type { PlantArtProps } from './PlantArt';
import { mulberry } from './rng';

const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------------------------------------
// Loading: resized copy -> original with CORS (lets us sample the edge colour) -> original without CORS
// ---------------------------------------------------------------------------------------------

interface Loader {
  src: string;
  crossOrigin: 'anonymous' | undefined;
  /** Attach to the <img>. */
  onLoad: (e: SyntheticEvent<HTMLImageElement>) => void;
  onError: () => void;
  failed: boolean;
  /** CORS-clean: the pixels may be read (for edge colour sampling). */
  readable: boolean;
}

/** Edge colours already measured, by URL, so a picture is only sampled once. */
const edgeCache = new Map<string, string | null>();

function sampleEdges(img: HTMLImageElement): string | null {
  try {
    const n = 24;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    let r = 0, gr = 0, b = 0, a = 0, cnt = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (x > 1 && x < n - 2 && y > 1 && y < n - 2) continue;
        const i = (y * n + x) * 4;
        const al = d[i + 3] / 255;
        r += d[i] * al; gr += d[i + 1] * al; b += d[i + 2] * al; a += al; cnt++;
      }
    }
    if (cnt === 0 || a / cnt < 0.6) return null; // transparent border: keep the themed backdrop
    return `rgb(${Math.round(r / a)},${Math.round(gr / a)},${Math.round(b / a)})`;
  } catch {
    return null; // tainted canvas
  }
}

function useLoader(bucket: string, path: string, px: number | undefined, onGiveUp: () => void, onEdge?: (c: string | null) => void): Loader {
  const [step, setStep] = useState<0 | 1 | 2>(transformState() === 'no' ? 1 : 0);
  const [failed, setFailed] = useState(false);
  const transformMissed = useRef(false);
  const src = step === 0 ? renderUrl(bucket, path, widthFor(px)) : objectUrl(bucket, path);
  return {
    src,
    crossOrigin: step < 2 ? 'anonymous' : undefined,
    readable: step < 2,
    failed,
    onLoad: (e) => {
      noteImageOk();
      if (step === 0) setTransformState('yes');
      else if (step === 1 && transformMissed.current) setTransformState('no');
      if (step < 2 && onEdge) {
        if (!edgeCache.has(src)) edgeCache.set(src, sampleEdges(e.currentTarget));
        onEdge(edgeCache.get(src) ?? null);
      }
    },
    onError: () => {
      if (step === 0) {
        transformMissed.current = true;
        setStep(1);
      } else if (step === 1) setStep(2);
      else {
        setFailed(true);
        noteImageFail();
        onGiveUp();
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A plant
// ---------------------------------------------------------------------------------------------

const POT_TITLE = { standard: '', selfWatering: 'Self-watering pot', passiveHydro: 'Passive hydroponic pot' } as const;

function Droplet({ wave }: { wave?: boolean }) {
  return wave ? (
    <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden><path d="M2 6c2-2 4 2 6 0s4-2 6 0M2 10c2-2 4 2 6 0s4-2 6 0" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
  ) : (
    <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden><path d="M8 2c2.6 3.2 4 5.2 4 7.2A4 4 0 0 1 4 9.2C4 7.2 5.4 5.2 8 2z" fill="currentColor" /></svg>
  );
}

export function HeroPlant({ sp, hy, genome, pheno, growth = 1, health = 100, hydration = 70, infected, seed = 1, pot = 'standard', height, glow, sparkle, className }: PlantArtProps) {
  const species = effectiveSpecies(sp, hy);
  const px = typeof height === 'number' ? height : undefined;
  const [edge, setEdge] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const loader = useLoader(SPECIES_BUCKET, heroPath(sp), px, () => markHeroFailed(sp), (c) => setEdge(c));

  const ph = useMemo(() => pheno ?? (genome ? phenotype(genome) : null), [pheno, genome]);
  const g = clamp(growth);
  const colour = ph?.leafColour ?? 0.5;
  const tier = variegationTier(ph?.variegation ?? 0);
  const sick = clamp((60 - health) / 60);
  const parched = clamp((28 - hydration) / 28);

  const filter = useMemo(() => {
    if (!ph && sick === 0 && parched === 0) return undefined;
    const hue = ((ph ? colour : 0.5) - 0.5) * 34;
    const sat = (1 + Math.abs(colour - 0.5) * 0.25) * (1 - 0.4 * sick - 0.22 * parched);
    const bri = 1 - 0.1 * parched - 0.1 * sick;
    return `hue-rotate(${hue.toFixed(1)}deg) saturate(${sat.toFixed(3)}) brightness(${bri.toFixed(3)}) sepia(${(0.55 * sick).toFixed(3)})`;
  }, [ph, colour, sick, parched]);

  const overlays = useMemo(() => {
    const rnd = mulberry(seed * 977 + species.id.length * 13);
    const blobs: string[] = [];
    if (tier > 0) {
      const vc = genome ? variegationHue(colour).hex : '#f4f0dd';
      for (let i = 0; i < 3 + tier; i++) blobs.push(`radial-gradient(ellipse at ${(28 + rnd() * 44).toFixed(0)}% ${(26 + rnd() * 42).toFixed(0)}%, ${vc} 0, transparent ${(7 + rnd() * 9).toFixed(0)}%)`);
    }
    const spots: string[] = [];
    if (infected) for (let i = 0; i < 5; i++) spots.push(`radial-gradient(circle at ${(32 + rnd() * 36).toFixed(0)}% ${(30 + rnd() * 38).toFixed(0)}%, #4a2610 0, #4a2610 1.6%, transparent 3.2%)`);
    return { blobs: blobs.join(','), spots: spots.join(',') };
  }, [seed, species.id, tier, infected, genome, colour]);

  const scale = (0.55 + 0.45 * g) * (ph ? 0.95 + 0.1 * (ph.leafSize ?? 0.5) : 1);
  const back = edge ?? mixHex(species.palette[2], '#07100c', 0.62);
  const frame: CSSProperties = {
    width: px ?? '100%', height: px, aspectRatio: '1 / 1', borderRadius: Math.max(8, Math.min(16, (px ?? 120) / 9)),
    background: edge ? back : `radial-gradient(circle at 50% 38%, ${mixHex(species.palette[2], '#0e1a14', 0.35)}, ${mixHex(species.palette[2], '#050a07', 0.78)})`,
    boxShadow: glow ? `0 0 38px -8px ${species.palette[0]}88` : undefined,
  };
  const small = (px ?? 120) < 80;

  return (
    <div className={`pic ${className ?? ''}`} style={frame} role="img" aria-label={species.common[0]}>
      {!loader.failed && (
        <img
          className="pic-img" src={loader.src} crossOrigin={loader.crossOrigin} alt="" loading="lazy" decoding="async" draggable={false}
          onLoad={(e) => { loader.onLoad(e); setShown(true); }} onError={loader.onError}
          style={{ transform: `scale(${scale.toFixed(3)})`, filter, opacity: shown ? 1 : 0 }}
        />
      )}
      {overlays.blobs && <div className="pic-fx pic-var" style={{ backgroundImage: overlays.blobs, opacity: [0, 0.2, 0.3, 0.4, 0.5][tier] }} />}
      {overlays.spots && <div className="pic-fx pic-spots" style={{ backgroundImage: overlays.spots }} />}
      {sparkle && (
        <svg className="pic-spark" viewBox="0 0 40 40" aria-hidden>
          <g fill="#e9f7b8"><path d="M28,4 l3,9 9,3 -9,3 -3,9 -3,-9 -9,-3 9,-3z" opacity="0.95" /><path d="M8,22 l2,6 6,2 -6,2 -2,6 -2,-6 -6,-2 6,-2z" opacity="0.7" /></g>
        </svg>
      )}
      {pot !== 'standard' && !small && (
        <span className="pic-pot" title={POT_TITLE[pot]}><Droplet wave={pot === 'passiveHydro'} /></span>
      )}
      {hy && !small && <HybridParent id={hy} px={px} />}
    </div>
  );
}

/** The pollen parent of a hybrid, shown as a small round picture in the corner. */
function HybridParent({ id, px }: { id: string; px: number | undefined }) {
  const size = px ? Math.round(px * 0.3) : undefined;
  const loader = useLoader(SPECIES_BUCKET, heroPath(id), size, () => undefined);
  if (loader.failed) return null;
  return (
    <span className="pic-parent" style={size ? { width: size, height: size } : undefined} title={effectiveSpecies(id).common[0]}>
      <img src={loader.src} crossOrigin={loader.crossOrigin} alt="" loading="lazy" decoding="async" draggable={false} onLoad={loader.onLoad} onError={loader.onError} />
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Brand images
// ---------------------------------------------------------------------------------------------

/**
 * An image from the Artwork bucket. Shows `fallback` until the image arrives and for good if it cannot be
 * loaded, so the interface never has a broken-image icon in it.
 */
export function BrandImage({ file, width, className, style, alt = '', fallback = null, onReady }: {
  file: string; width?: number; className?: string; style?: CSSProperties; alt?: string; fallback?: ReactNode;
  /** Called once the picture is loaded and its pixels may be read (for colour sampling). */
  onReady?: (img: HTMLImageElement) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const loader = useLoader(BRAND_BUCKET, file, width, () => undefined);
  if (loader.failed) return <>{fallback}</>;
  return (
    <>
      {!loaded && fallback}
      <img
        className={`${className ?? ''}${loaded ? ' ready' : ''}`} style={{ ...style, display: loaded ? undefined : 'none' }} src={loader.src} crossOrigin={loader.crossOrigin} alt={alt}
        loading="eager" decoding="async" draggable={false}
        onLoad={(e) => { loader.onLoad(e); setLoaded(true); if (loader.readable) onReady?.(e.currentTarget); }} onError={loader.onError}
      />
    </>
  );
}

/**
 * A wide brand picture shown at its natural proportions (never cropped), on a backdrop matched to its edges.
 * Renders nothing if the picture cannot be loaded.
 */
export function Banner({ file, width = 1600, className = '', onReady, children }: {
  file: string; width?: number; className?: string; onReady?: (img: HTMLImageElement) => void; children?: ReactNode;
}) {
  const [edge, setEdge] = useState<string | null>(null);
  const [ratio, setRatio] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const loader = useLoader(BRAND_BUCKET, file, width, () => undefined, (c) => setEdge(c));
  if (loader.failed) return null;
  return (
    <div className={`banner ${loaded ? 'on' : ''} ${className}`} style={{ aspectRatio: String(ratio), background: edge ?? undefined }}>
      <img
        src={loader.src} crossOrigin={loader.crossOrigin} alt="J2Grows. Grow. Discover. Experiment. Evolve." loading="eager" decoding="async" draggable={false}
        onLoad={(e) => {
          const im = e.currentTarget;
          if (im.naturalWidth && im.naturalHeight) setRatio(im.naturalWidth / im.naturalHeight);
          loader.onLoad(e);
          setLoaded(true);
          if (loader.readable) onReady?.(im);
        }}
        onError={loader.onError}
      />
      {children}
    </div>
  );
}
