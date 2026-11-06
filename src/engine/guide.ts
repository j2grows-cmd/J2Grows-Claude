// Guidance: the opening guide (a short run of goals for a new player) and the advisor, which looks at the
// whole game state and says what is worth doing next. Both are pure functions of the state, so they can
// never get out of step with the save.

import type { GameState } from './types';
import { STAGES, UPGRADES } from './config';
import { TECHS } from './techs';
import { techState } from './research';
import { stageRequirements, upgradeStatus } from './lab';
import { matchesContract } from './economy';
import { analysisSlots } from './propagation';
import { canPrestige, legacyGain } from './prestige';
import { discoveryCount } from './core';
import { isOn } from './automation';

export interface GuideStep {
  id: string;
  title: string;
  body: string;
  view: string;
  done: (s: GameState) => boolean;
}

export const GUIDE: GuideStep[] = [
  { id: 'buy', title: 'Buy your first plant', view: 'market', body: 'Open the Market and buy a young Philodendron Brasil: cheap, forgiving and a good first plant. You start with $200.', done: (s) => s.plants.length > 0 || s.props.length > 0 || s.stats.spent > 0 },
  { id: 'pot', title: 'Pot it in your grow room', view: 'cultivation', body: 'In Cultivation, pick an empty slot and plant it. Each slot is a pot; a room holds a handful of them.', done: (s) => s.plants.length > 0 },
  { id: 'care', title: 'Water and feed it', view: 'cultivation', body: 'Click the plant and water and feed it when the bars drop. Hydration falls steadily, nutrients more slowly. Watering is cheap; neglect is not.', done: (s) => (s.stats.cares ?? 0) >= 2 },
  { id: 'research', title: 'Start a research project', view: 'research', body: 'Research runs on a timer and keeps running while you are away. Early projects are cheap and unlock better tools.', done: (s) => s.stats.techs >= 1 || s.active.length > 0 },
  { id: 'mature', title: 'Grow a plant to maturity', view: 'cultivation', body: 'Plants go from seedling to juvenile to mature. Keep the room inside the species’ comfortable range (open the plant card to see it) and growth is faster.', done: (s) => s.stats.matured >= 1 },
  { id: 'sell', title: 'Sell a mature plant', view: 'cultivation', body: 'Mature, healthy plants sell for the most. Sell one from its card, then spend the money on the next plant.', done: (s) => s.stats.sold >= 1 },
  { id: 'grow', title: 'Grow a small collection', view: 'market', body: 'More plants means more income and more discoveries. Fill your slots; the Market refreshes prices as demand moves.', done: (s) => s.stats.maxPlants >= 3 },
  { id: 'cuttings', title: 'Research Cuttings', view: 'research', body: 'Cuttings let you make new plants from the ones you already own: the start of propagation, and of everything that follows.', done: (s) => !!s.done.prop_cuttings },
  { id: 'stage2', title: 'Reach Stage 2', view: 'lab', body: 'Open the Laboratory and read the upgrade requirements. Stage 2 opens propagation, tissue culture and more species.', done: (s) => s.stage >= 2 },
];

export interface GuideProgress {
  steps: (Pick<GuideStep, 'id' | 'title' | 'body' | 'view'> & { done: boolean })[];
  current: number;
  doneCount: number;
  complete: boolean;
}

export function guideProgress(s: GameState): GuideProgress {
  const steps = GUIDE.map((g) => ({ id: g.id, title: g.title, body: g.body, view: g.view, done: g.done(s) }));
  const doneCount = steps.filter((x) => x.done).length;
  const first = steps.findIndex((x) => !x.done);
  return { steps, current: first < 0 ? steps.length : first, doneCount, complete: first < 0 };
}

// ---------------------------------------------------------------------------------------------
// Advisor
// ---------------------------------------------------------------------------------------------

export interface Advice {
  id: string;
  tone: 'urgent' | 'do' | 'good' | 'info';
  title: string;
  body: string;
  view?: string;
}

const money = (n: number): string => '$' + Math.round(n).toLocaleString();

export function advisor(s: GameState, max = 5): Advice[] {
  const out: Advice[] = [];
  const add = (a: Advice) => out.push(a);
  const auto = (k: string): boolean => isOn(s, k, 'auto' + k[0].toUpperCase() + k.slice(1));

  // 1. things that are going wrong
  const sick = s.plants.filter((p) => p.inf).length;
  if (sick) add({ id: 'sick', tone: 'urgent', title: `${sick} plant${sick > 1 ? 's are' : ' is'} infected`, body: 'Treat them before it spreads to the rest of the room. Wet, still air breeds fungus; dry, hot air breeds pests; waterlogged pots rot.', view: 'cultivation' });
  const thirsty = s.plants.filter((p) => p.hydration < 15 && p.growth < 1.01).length;
  if (thirsty && !auto('water')) add({ id: 'thirsty', tone: 'urgent', title: `${thirsty} plant${thirsty > 1 ? 's are' : ' is'} very dry`, body: 'Water them now. Automation (in Research) will take this chore off your hands.', view: 'cultivation' });
  const weak = s.plants.filter((p) => p.health < 35 && !p.inf).length;
  if (weak) add({ id: 'weak', tone: 'urgent', title: `${weak} plant${weak > 1 ? 's are' : ' is'} struggling`, body: 'Open a plant card: it says exactly which condition is hurting it and what to change.', view: 'cultivation' });

  // 2. money to be made
  const ready = s.plants.filter((p) => p.stage === 'mature' && !p.keeper && !p.mother && p.health > 50).length;
  if (ready >= 2 && !auto('sell')) add({ id: 'sell', tone: 'do', title: `${ready} mature plants are ready to sell`, body: 'Sell them and reinvest, or keep your best for breeding. Automation can sell for you by rule.', view: 'cultivation' });
  const match = s.market.contracts.find((c) => c.expires > s.time && s.plants.some((p) => p.stage === 'mature' && matchesContract(c, p)));
  if (match) add({ id: 'contract', tone: 'good', title: `You can fill a commission for ${match.buyer}`, body: `It pays ${money(match.reward)}, ${match.rp} RP and reputation. One of your plants already qualifies.`, view: 'market' });
  const show = s.shows.open;
  if (show && show.entry == null && s.plants.some((p) => p.stage === 'mature')) add({ id: 'show', tone: 'good', title: `${show.name} is open for entries`, body: 'Enter your best plant. Prizes, reputation and a place in the hall of fame are at stake.', view: 'goals' });

  // 3. progress
  const reqs = stageRequirements(s);
  if (reqs && reqs.every((r) => r.met)) add({ id: 'stage', tone: 'good', title: `Upgrade to Stage ${s.stage + 1}`, body: `${STAGES[s.stage].name}: ${STAGES[s.stage].blurb}`, view: 'lab' });
  else if (reqs) {
    const gap = reqs.find((r) => !r.met);
    if (gap) add({ id: 'stage-gap', tone: 'info', title: `Next stage: ${gap.label}`, body: `You have ${gap.have}. Everything the next facility needs is listed in the Laboratory.`, view: 'lab' });
  }
  if (s.active.length < s.mods.researchSlots) {
    const options = TECHS.filter((t) => techState(s, t).status === 'available' && s.rp >= t.rp && s.money >= t.money).sort((a, b) => a.rp + a.money / 50 - (b.rp + b.money / 50));
    if (options[0]) add({ id: 'research', tone: 'do', title: `A research slot is idle: ${options[0].name}`, body: 'Projects run in the background, so an idle slot is wasted progress. This is the cheapest useful project you can afford.', view: 'research' });
  }
  const analysisIdle = analysisSlots(s) > s.jobs.analysis.length && s.plants.some((p) => p.stage === 'mature' && p.analysis < 1);
  if (analysisIdle && !auto('analyse')) add({ id: 'analyse', tone: 'do', title: 'A genetics bench is free', body: 'Analyse a mature plant to reveal its alleles. Hidden traits are where the discoveries are.', view: 'genetics' });
  const free = s.rooms.reduce((n, r) => n + r.slots.filter((x) => x == null).length, 0);
  if (free > 0 && s.props.length === 0 && s.money > 60 && s.stage >= 1 && s.plants.length > 0) add({ id: 'fill', tone: 'do', title: `${free} empty slot${free > 1 ? 's' : ''} in your rooms`, body: 'Idle slots earn nothing. Buy stock in the Market or take cuttings from a mature plant.', view: 'market' });
  if (s.props.length > 0 && free > 0) add({ id: 'plant-props', tone: 'do', title: `${s.props.length} cutting${s.props.length > 1 ? 's/seeds are' : '/seed is'} waiting to be potted`, body: 'Pot them in an empty slot so they start to grow.', view: 'cultivation' });
  const ups = UPGRADES.map((u) => ({ u, st: upgradeStatus(s, u.id) })).filter((x) => x.st.ok && x.st.cost <= s.money * 0.4).sort((a, b) => a.st.cost - b.st.cost);
  if (ups[0]) add({ id: 'upgrade', tone: 'do', title: `You can afford: ${ups[0].u.name}`, body: `${ups[0].u.desc} It costs ${money(ups[0].st.cost)}.`, view: 'lab' });

  // 4. the end of the run
  if (canPrestige(s).ok) add({ id: 'prestige', tone: 'good', title: 'A legacy reset is available', body: `You would earn ${legacyGain(s)} legacy points. Spend them on permanent upgrades, or keep playing to earn more.`, view: 'legacy' });
  else if (s.stage >= 6 && s.legacy.runs === 0) add({ id: 'prestige-gap', tone: 'info', title: 'The legacy reset is in reach', body: canPrestige(s).why ?? '', view: 'legacy' });

  if (!out.length) add({ id: 'idle', tone: 'info', title: 'Everything is running', body: `You have ${discoveryCount(s)} discoveries. Cross-breeding two analysed plants is the fastest way to find a new one.`, view: s.stage >= 3 ? 'genetics' : 'cultivation' });
  const order = { urgent: 0, do: 1, good: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, max);
}
