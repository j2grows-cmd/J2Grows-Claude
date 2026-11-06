// Where the game's artwork lives and how it is loaded.
//
// All plant pictures (species/<id>/hero.png) and brand art (logo, banners) are served from the project's
// public Supabase Storage buckets. Nothing here is required to play: every image has a fallback (the
// procedural drawing for plants, plain text for the brand), so the game still works offline.

import { useSyncExternalStore } from 'react';

export const STORAGE = 'https://lwaxzivcjzpmmantryor.supabase.co/storage/v1';
export const SPECIES_BUCKET = 'plant-images';
export const BRAND_BUCKET = 'Artwork';

/** Species whose hero image sits at a non-standard path in the bucket. */
const HERO_PATH: Record<string, string> = {
  'philodendron-pink-princess': 'Species/philodendron-pink-princess/hero.png',
};
export const heroPath = (id: string): string => HERO_PATH[id] ?? `species/${id}/hero.png`;

export const BRAND = { logo: 'logo.png', banner: 'banner.png', bannerLogo: 'banner with logo.png' } as const;

const enc = (path: string): string => path.split('/').map(encodeURIComponent).join('/');
/** The original, full-size file. */
export const objectUrl = (bucket: string, path: string): string => `${STORAGE}/object/public/${bucket}/${enc(path)}`;
/** A resized copy from Supabase's image transformer (not available on every plan: callers fall back). */
export const renderUrl = (bucket: string, path: string, width: number, quality = 78): string =>
  `${STORAGE}/render/image/public/${bucket}/${enc(path)}?width=${width}&quality=${quality}&resize=contain`;

/** Pick a transform width that is crisp on retina screens without being wasteful. */
export const widthFor = (px: number | undefined): number => {
  const want = (px ?? 360) * 2;
  return [160, 320, 480, 720, 1080, 1600].find((w) => w >= want) ?? 1600;
};

// ---------------------------------------------------------------------------------------------
// Session-wide art state: which mode the player chose, and what has proven unreachable.
// ---------------------------------------------------------------------------------------------

export type ArtMode = 'hero' | 'drawn';
const KEY = 'j2grows.art.v1';

function readMode(): ArtMode {
  try {
    return localStorage.getItem(KEY) === 'drawn' ? 'drawn' : 'hero';
  } catch {
    return 'hero';
  }
}

let mode: ArtMode = readMode();
let version = 0;
let consecutiveFails = 0;
let unreachable = false; // too many images failed in a row: stop trying until the player asks
let transform: 'unknown' | 'yes' | 'no' = 'unknown';
const failedHeroes = new Set<string>();
const listeners = new Set<() => void>();
const bump = (): void => {
  version++;
  listeners.forEach((l) => l());
};

export function setArtMode(m: ArtMode): void {
  mode = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* private mode: the choice just lasts for this visit */
  }
  bump();
}

/** Forget every failure and try the pictures again. */
export function retryArtwork(): void {
  unreachable = false;
  consecutiveFails = 0;
  transform = 'unknown';
  failedHeroes.clear();
  bump();
}

export const transformState = (): 'unknown' | 'yes' | 'no' => transform;
export function setTransformState(t: 'yes' | 'no'): void {
  transform = t;
}
export function noteImageOk(): void {
  consecutiveFails = 0;
}
export function noteImageFail(): void {
  consecutiveFails++;
  if (consecutiveFails >= 8 && !unreachable) {
    unreachable = true;
    bump();
  }
}
export function markHeroFailed(id: string): void {
  if (failedHeroes.has(id)) return;
  failedHeroes.add(id);
  bump();
}

export interface ArtState {
  mode: ArtMode;
  unreachable: boolean;
  failed: number;
  /** True when this species should be drawn instead of shown as a picture. */
  drawn: (id: string) => boolean;
}

export function useArt(): ArtState {
  useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, () => version);
  return { mode, unreachable, failed: failedHeroes.size, drawn: (id) => mode === 'drawn' || unreachable || failedHeroes.has(id) };
}
