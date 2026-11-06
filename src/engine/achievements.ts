// Achievements: lasting marks of progress. They never change the economy; they unlock titles and the
// laboratory colour themes. They are kept across legacy resets.

import type { GameState } from './types';
import { discoveryCount, log } from './core';
import { SPECIES_LIST } from './species';
import { TECHS } from './techs';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  group: 'Cultivation' | 'Propagation' | 'Genetics' | 'Business' | 'Research' | 'Mastery';
  /** Progress towards the goal, as [have, need]. */
  goal: (s: GameState) => [number, number];
}

const n = (have: number, need: number): [number, number] => [Math.min(have, need), need];
const speciesSeen = (s: GameState): number => Object.keys(s.seen).length;
const hybrids = (s: GameState): number => s.records.filter((r) => r.hy).length + s.plants.filter((p) => p.hy).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_bloom', group: 'Cultivation', name: 'First Leaf', desc: 'Grow a plant to maturity.', goal: (s) => n(s.stats.matured, 1) },
  { id: 'green_thumb', group: 'Cultivation', name: 'Green Thumb', desc: 'Grow 25 plants to maturity.', goal: (s) => n(s.stats.matured, 25) },
  { id: 'nursery', group: 'Cultivation', name: 'Nursery', desc: 'Grow 150 plants to maturity.', goal: (s) => n(s.stats.matured, 150) },
  { id: 'forest', group: 'Cultivation', name: 'Indoor Forest', desc: 'Grow 600 plants to maturity.', goal: (s) => n(s.stats.matured, 600) },
  { id: 'full_house', group: 'Cultivation', name: 'Full House', desc: 'Have 30 plants growing at once.', goal: (s) => n(s.stats.maxPlants, 30) },
  { id: 'jungle', group: 'Cultivation', name: 'Jungle', desc: 'Have 120 plants growing at once.', goal: (s) => n(s.stats.maxPlants, 120) },
  { id: 'collector', group: 'Cultivation', name: 'Collector', desc: 'Grow 15 different species.', goal: (s) => n(speciesSeen(s), 15) },
  { id: 'curator', group: 'Cultivation', name: 'Curator', desc: 'Grow 50 different species.', goal: (s) => n(speciesSeen(s), 50) },
  { id: 'completist', group: 'Cultivation', name: 'Completist', desc: `Grow all ${SPECIES_LIST.length} species.`, goal: (s) => n(speciesSeen(s), SPECIES_LIST.length) },

  { id: 'cutter', group: 'Propagation', name: 'Steady Hands', desc: 'Make 20 clones.', goal: (s) => n(s.stats.cloned, 20) },
  { id: 'seed_saver', group: 'Propagation', name: 'Seed Saver', desc: 'Produce 50 seeds from your own crosses.', goal: (s) => n(s.stats.seedsMade, 50) },
  { id: 'sterile', group: 'Propagation', name: 'Sterile Technique', desc: 'Produce 100 tissue culture plantlets.', goal: (s) => n(s.stats.tissueMade, 100) },
  { id: 'factory', group: 'Propagation', name: 'Plantlet Factory', desc: 'Produce 1,000 tissue culture plantlets.', goal: (s) => n(s.stats.tissueMade, 1000) },

  { id: 'analyst', group: 'Genetics', name: 'Under the Microscope', desc: 'Analyse 10 plants.', goal: (s) => n(s.stats.analysed, 10) },
  { id: 'breeder', group: 'Genetics', name: 'Cross Pollinator', desc: 'Complete 10 breeding projects.', goal: (s) => n(s.stats.bred, 10) },
  { id: 'hybridiser', group: 'Genetics', name: 'Hybridiser', desc: 'Grow a hybrid between two species.', goal: (s) => n(hybrids(s), 1) },
  { id: 'hybrid_house', group: 'Genetics', name: 'Hybrid House', desc: 'Keep 10 hybrids in your records and rooms.', goal: (s) => n(hybrids(s), 10) },
  { id: 'novel', group: 'Genetics', name: 'Something New', desc: 'Make 10 discoveries.', goal: (s) => n(discoveryCount(s), 10) },
  { id: 'naturalist', group: 'Genetics', name: 'Naturalist', desc: 'Make 40 discoveries.', goal: (s) => n(discoveryCount(s), 40) },
  { id: 'taxonomist', group: 'Genetics', name: 'Taxonomist', desc: 'Make 100 discoveries.', goal: (s) => n(discoveryCount(s), 100) },
  { id: 'archivist', group: 'Genetics', name: 'Hall of Fame', desc: 'Have 25 specimens in the hall of fame.', goal: (s) => n(s.records.length, 25) },

  { id: 'first_sale', group: 'Business', name: 'Open for Business', desc: 'Sell your first plant.', goal: (s) => n(s.stats.sold, 1) },
  { id: 'thousand', group: 'Business', name: 'Four Figures', desc: 'Earn $1,000 in total.', goal: (s) => n(s.stats.earned, 1e3) },
  { id: 'hundred_k', group: 'Business', name: 'Six Figures', desc: 'Earn $100,000 in total.', goal: (s) => n(s.stats.earned, 1e5) },
  { id: 'million', group: 'Business', name: 'Millionaire', desc: 'Earn $1,000,000 in total.', goal: (s) => n(s.stats.earned, 1e6) },
  { id: 'hundred_m', group: 'Business', name: 'Magnate', desc: 'Earn $100,000,000 in total.', goal: (s) => n(s.stats.earned, 1e8) },
  { id: 'contractor', group: 'Business', name: 'Reliable Supplier', desc: 'Complete 10 commissions.', goal: (s) => n(s.stats.contracts, 10) },
  { id: 'reputation', group: 'Business', name: 'Trusted Name', desc: 'Reach 50 reputation.', goal: (s) => n(s.market.rep, 50) },
  { id: 'brand', group: 'Business', name: 'Cultivar Registered', desc: 'Register a named cultivar.', goal: (s) => n(s.cultivars.length, 1) },
  { id: 'rosette', group: 'Business', name: 'Rosette', desc: 'Win a plant show.', goal: (s) => n(s.stats.showWins ?? 0, 1) },
  { id: 'best_in_show', group: 'Business', name: 'Show Circuit', desc: 'Win 5 plant shows.', goal: (s) => n(s.stats.showWins ?? 0, 5) },

  { id: 'rs_first', group: 'Research', name: 'Lab Notes', desc: 'Complete your first research project.', goal: (s) => n(s.stats.techs, 1) },
  { id: 'rs_20', group: 'Research', name: 'Department', desc: 'Complete 20 research projects.', goal: (s) => n(s.stats.techs, 20) },
  { id: 'rs_all', group: 'Research', name: 'Whole Tree', desc: 'Complete the entire main research tree.', goal: (s) => n(TECHS.filter((t) => t.cat !== 'synthetic' && s.done[t.id]).length, TECHS.filter((t) => t.cat !== 'synthetic').length) },
  { id: 'stage3', group: 'Research', name: 'Genetics Laboratory', desc: 'Reach Stage 3.', goal: (s) => n(s.stage, 3) },
  { id: 'stage5', group: 'Research', name: 'Commercial Scale', desc: 'Reach Stage 5.', goal: (s) => n(s.stage, 5) },
  { id: 'stage6', group: 'Research', name: 'Institution', desc: 'Reach Stage 6.', goal: (s) => n(s.stage, 6) },

  { id: 'legacy1', group: 'Mastery', name: 'Passing It On', desc: 'Complete your first legacy reset.', goal: (s) => n(s.legacy.runs, 1) },
  { id: 'legacy3', group: 'Mastery', name: 'Dynasty', desc: 'Complete three legacy resets.', goal: (s) => n(s.legacy.runs, 3) },
  { id: 'challenge1', group: 'Mastery', name: 'Against the Odds', desc: 'Clear a challenge run.', goal: (s) => n(s.legacy.cleared?.length ?? 0, 1) },
  { id: 'challenge4', group: 'Mastery', name: 'Unbowed', desc: 'Clear all four challenge runs.', goal: (s) => n(s.legacy.cleared?.length ?? 0, 4) },
  { id: 'veteran', group: 'Mastery', name: 'Veteran', desc: 'Play for 50 hours.', goal: (s) => n(s.totalTime, 50 * 3600) },
];
export const ACH_BY_ID: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Laboratory colour themes, unlocked by how many achievements are earned. The first is always available. */
export const THEMES: { id: string; name: string; need: number }[] = [
  { id: 'forest', name: 'Forest', need: 0 },
  { id: 'orchid', name: 'Orchid', need: 6 },
  { id: 'aurum', name: 'Aurum', need: 14 },
  { id: 'tide', name: 'Tidepool', need: 22 },
  { id: 'ember', name: 'Ember', need: 30 },
];

export const achievementCount = (s: GameState): number => Object.keys(s.ach).filter((id) => ACH_BY_ID[id]).length;

/** The title shown next to the lab name: the hardest achievement earned so far. */
export function title(s: GameState): string {
  const c = achievementCount(s);
  return c >= 36 ? 'Grand Botanist' : c >= 28 ? 'Master Breeder' : c >= 20 ? 'Senior Horticulturist' : c >= 12 ? 'Propagator' : c >= 6 ? 'Hobbyist Grower' : c >= 1 ? 'Seedling' : '';
}

/** Awards anything newly reached. Returns the achievements earned by this call. */
export function checkAchievements(s: GameState): Achievement[] {
  const got: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.ach[a.id] != null) continue;
    const [have, need] = a.goal(s);
    if (have >= need) {
      s.ach[a.id] = s.totalTime || 1;
      got.push(a);
      log(s, 'discovery', `Achievement: ${a.name}. ${a.desc}`);
    }
  }
  return got;
}
