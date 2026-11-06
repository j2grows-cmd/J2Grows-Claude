// Brand colour direction, taken from the artwork itself.
//
// The accent used for ambient glows and highlights (--brand) is measured from the logo and banner pictures,
// so the interface follows whatever palette the artwork has. The measured hue is remembered between visits
// (so there is no flash), and the saturation and lightness are fixed so text always stays readable.

const KEY = 'j2grows.brand.v1';
let rank = 0; // 2 = measured from the banner, 1 = from the logo, 0 = nothing yet

function apply(h: number): void {
  const root = document.documentElement.style;
  root.setProperty('--brand', `hsl(${h.toFixed(0)} 52% 64%)`);
  root.setProperty('--brand-2', `hsl(${h.toFixed(0)} 42% 40%)`);
  root.setProperty('--brand-glow', `hsla(${h.toFixed(0)} 60% 56% / 0.34)`);
}

/** Re-apply the last measured accent immediately on start. */
export function restoreBrandColour(): void {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { h: number; rank: number } | null;
    if (v && typeof v.h === 'number') {
      rank = v.rank || 1;
      apply(v.h);
    }
  } catch {
    /* no stored accent */
  }
}

/** The dominant saturated hue of a picture, or null when it has none (greyscale artwork, a transparent logo, a tainted canvas). */
export function dominantHue(img: HTMLImageElement): number | null {
  try {
    const w = 48;
    const h = Math.max(8, Math.round((w * (img.naturalHeight || 1)) / (img.naturalWidth || 1)));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const buckets = new Float64Array(24);
    const sinSum = new Float64Array(24);
    const cosSum = new Float64Array(24);
    let total = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      const v = mx, s = mx === 0 ? 0 : (mx - mn) / mx;
      total += a;
      if (a < 0.5 || s < 0.22 || v < 0.28 || v > 0.98) continue;
      let hue: number;
      const dl = mx - mn;
      if (mx === r) hue = ((gg - b) / dl) % 6;
      else if (mx === gg) hue = (b - r) / dl + 2;
      else hue = (r - gg) / dl + 4;
      hue = (hue * 60 + 360) % 360;
      const k = Math.floor(hue / 15) % 24;
      const wgt = s * v * a;
      buckets[k] += wgt;
      sinSum[k] += Math.sin((hue * Math.PI) / 180) * wgt;
      cosSum[k] += Math.cos((hue * Math.PI) / 180) * wgt;
    }
    let best = 0;
    for (let k = 1; k < 24; k++) if (buckets[k] > buckets[best]) best = k;
    if (total === 0 || buckets[best] / total < 0.015) return null;
    return ((Math.atan2(sinSum[best], cosSum[best]) * 180) / Math.PI + 360) % 360;
  } catch {
    return null;
  }
}

/** Measure a loaded picture and, if it beats what is already in use, make its hue the accent. */
export function brandColourFrom(img: HTMLImageElement, source: 1 | 2): void {
  if (source < rank) return;
  const h = dominantHue(img);
  if (h == null) return;
  rank = source;
  apply(h);
  try {
    localStorage.setItem(KEY, JSON.stringify({ h: Math.round(h), rank: source }));
  } catch {
    /* private mode */
  }
}

/** Use the logo as the browser tab icon. */
export function setFavicon(url: string): void {
  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link || !url) return;
    link.type = 'image/png';
    link.href = url;
  } catch {
    /* keep the built-in icon */
  }
}
