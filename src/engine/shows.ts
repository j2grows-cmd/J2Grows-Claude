// Plant shows: every half hour or so a show opens for ten minutes. Enter your best plant for the theme,
// and it is judged against three rivals. Prizes are modest (a share of the plant's value, reputation and a
// place in the history), so shows are a reason to breed and groom for a purpose, not an income stream.

import type { GameState, Plant, Show, ShowResult, ShowTheme } from './types';
import { Ctx, fail, log, ok, type Result } from './core';
import { effectiveSpecies } from './species';
import { phenoOf } from './plants';
import { plantValue } from './economy';
import { clamp, pick, range } from './util';

export const SHOW_OPEN_SECONDS = 600;
export const SHOW_GAP: [number, number] = [1500, 2400];

export const SHOW_THEMES: Record<ShowTheme, { name: string; blurb: string }> = {
  best: { name: 'Open Show', blurb: 'The best all-round plant: rarity, form and condition.' },
  rarity: { name: 'Rare Aroid Show', blurb: 'Rare species and notable discoveries count for most.' },
  hybrid: { name: 'Hybrid Cup', blurb: 'Hybrids only. Straight species are not eligible.' },
  variegation: { name: 'Variegation Gala', blurb: 'The boldest variegation wins.' },
  foliage: { name: 'Foliage Classic', blurb: 'Big, well-shaped, richly coloured leaves.' },
  health: { name: 'Perfect Specimen', blurb: 'Condition is everything: health, roots and a clean bill of health.' },
};
const THEME_IDS = Object.keys(SHOW_THEMES) as ShowTheme[];

export const PRIZE_SHARE = [1, 0.4, 0.15, 0];
export const PRIZE_REP = [4, 2, 1, 0];

/** Entry condition 0..1: health, roots and freedom from infection. */
const condition = (p: Plant): number => 0.55 * (p.health / 100) + 0.25 * (p.roots / 100) + 0.2 * (p.inf ? 0 : 1);

export function eligible(p: Plant, theme: ShowTheme): string | null {
  if (p.growth < 1) return 'Only mature plants can be entered.';
  if (p.room == null) return 'The plant must be growing in a room.';
  if (theme === 'hybrid' && !p.hy) return 'This show is for hybrids only.';
  return null;
}

/** How the judges see a plant for a theme, 0..100. */
export function showScore(p: Plant, theme: ShowTheme): number {
  if (eligible(p, theme)) return 0;
  const sp = effectiveSpecies(p.sp, p.hy);
  const ph = phenoOf(p);
  const rarityN = (sp.rarity - 1) / 4;
  const tagN = Math.min(1, p.tags.length * 0.12);
  const traits = (ph.leafSize + ph.leafShape + ph.leafColour + ph.variegation) / 4;
  const cond = condition(p);
  let quality: number;
  switch (theme) {
    case 'rarity': quality = 0.7 * rarityN + 0.3 * tagN; break;
    case 'hybrid': quality = 0.45 + 0.55 * traits; break;
    case 'variegation': quality = ph.variegation; break;
    case 'foliage': quality = (ph.leafSize + ph.leafShape + ph.leafColour) / 3; break;
    case 'health': quality = cond * cond; break;
    default: quality = 0.4 * rarityN + 0.4 * traits + 0.2 * tagN;
  }
  return Math.round(100 * (0.45 * quality + 0.55 * cond) * 10) / 10;
}

/** How strong the rivals are at this stage of the facility. */
export const rivalBase = (stage: number): number => 30 + stage * 8;

export function openShow(s: GameState): Show {
  s.shows.seq++;
  const theme = pick(s, THEME_IDS);
  const base = rivalBase(s.stage);
  const show: Show = {
    id: s.shows.seq,
    name: `${SHOW_THEMES[theme].name} No. ${s.shows.seq}`,
    theme,
    opens: s.time,
    closes: s.time + SHOW_OPEN_SECONDS,
    entry: null,
    entryName: '',
    rivals: [0, 1, 2].map(() => Math.round((base + range(s, 0, 16)) * 10) / 10),
  };
  s.shows.open = show;
  log(s, 'good', `${show.name} is open for entries for ${Math.round(SHOW_OPEN_SECONDS / 60)} minutes (Goals).`);
  return show;
}

export function enterShow(s: GameState, plantId: number): Result {
  const show = s.shows.open;
  if (!show) return fail('No show is open right now.');
  const p = s.plants.find((x) => x.id === plantId);
  if (!p) return fail('Plant not found.');
  const why = eligible(p, show.theme);
  if (why) return fail(why);
  show.entry = p.id;
  show.entryName = p.name;
  return ok(`${p.name} is entered in the ${show.name}.`);
}
export function withdrawEntry(s: GameState): void {
  if (s.shows.open) {
    s.shows.open.entry = null;
    s.shows.open.entryName = '';
  }
}

function resolve(s: GameState, show: Show): void {
  const p = show.entry != null ? s.plants.find((x) => x.id === show.entry) : undefined;
  let result: ShowResult;
  if (!p || eligible(p, show.theme)) {
    result = { id: show.id, name: show.name, t: s.time, place: 0, prize: 0, plantName: show.entryName, score: 0 };
    if (show.entry != null && !Ctx.quiet) log(s, 'info', `${show.name}: your entry could not be judged.`);
  } else {
    const score = showScore(p, show.theme);
    const beaten = show.rivals.filter((r) => r > score).length;
    const place = beaten + 1;
    const prize = Math.round(plantValue(s, p) * PRIZE_SHARE[beaten]);
    if (prize > 0) {
      s.money += prize;
      s.stats.earned += prize;
      s.stats.earnedRun += prize;
      if (Ctx.rep) Ctx.rep.money += prize;
    }
    s.market.rep += PRIZE_REP[beaten];
    s.stats.shows = (s.stats.shows ?? 0) + 1;
    if (place === 1) s.stats.showWins = (s.stats.showWins ?? 0) + 1;
    result = { id: show.id, name: show.name, t: s.time, place, prize, plantName: p.name, score };
    p.hist.push({ t: s.time, msg: place === 1 ? `Best in show: ${show.name}` : `Placed ${place} in ${show.name}` });
    const ordinal = ['', '1st', '2nd', '3rd', '4th'][place];
    log(s, place === 1 ? 'discovery' : 'good', `${show.name}: ${p.name} placed ${ordinal} (score ${score.toFixed(0)}).${prize ? ` Prize $${prize.toLocaleString()}.` : ''}`);
  }
  s.shows.hist.unshift(result);
  if (s.shows.hist.length > 40) s.shows.hist.length = 40;
  s.shows.open = null;
  s.shows.next = s.time + range(s, SHOW_GAP[0], SHOW_GAP[1]);
}

export function tickShows(s: GameState): void {
  const sh = s.shows;
  if (sh.open) {
    if (s.time >= sh.open.closes) resolve(s, sh.open);
    return;
  }
  if (s.time < sh.next) return;
  // Stage 1 has too little to show; shows begin once there is a real collection. They never open while you are away.
  if (s.stage < 2 || Ctx.offline || !s.plants.length) {
    sh.next = s.time + 120;
    return;
  }
  openShow(s);
}

/** Mature plants ranked for the open show, best first. */
export function showCandidates(s: GameState, limit = 8): { plant: Plant; score: number }[] {
  const show = s.shows.open;
  if (!show) return [];
  return s.plants
    .filter((p) => !eligible(p, show.theme))
    .map((plant) => ({ plant, score: showScore(plant, show.theme) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const clampScore = (x: number): number => clamp(x, 0, 100);
