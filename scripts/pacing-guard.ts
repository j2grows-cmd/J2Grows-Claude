// Pacing guard for CI: plays the bot for the first ~12 hours (a few seconds of real time at coarse steps)
// and fails if the early milestones drift outside the intended window. The full 80-100 h check is
// `npm run balance -- 6000 1 5`, which takes a few minutes and is run on a schedule instead.
//   npx tsx scripts/pacing-guard.ts [seed=1]

import { newGame, refreshMods, run } from '../src/engine';
import { botAct, makeBotLog } from './bot';

const seed = Number(process.argv[2] ?? 1);
const s = newGame(seed);
refreshMods(s);
const blog = makeBotLog();
const HOURS = 14;
for (let t = 0; t < HOURS * 3600; t += 5) {
  run(s, 5, 5);
  botAct(s, blog);
}
const at = (n: number): number | undefined => (blog.stageAt[n] === undefined ? undefined : blog.stageAt[n] / 3600);
// [stage, earliest, latest] in hours, from the measured pacing table (attentive bot) with generous margins
const WINDOWS: [number, number, number][] = [[2, 0.1, 1.2], [3, 1.2, 6], [4, 6, 14]];
let bad = 0;
for (const [stage, lo, hi] of WINDOWS) {
  const h = at(stage);
  const ok = h !== undefined && h >= lo && h <= hi;
  console.log(`Stage ${stage}: ${h === undefined ? 'not reached' : h.toFixed(1) + ' h'} (allowed ${lo}–${hi} h) ${ok ? 'ok' : 'OUT OF RANGE'}`);
  if (!ok) bad++;
}
if (bad) {
  console.error(`${bad} pacing milestone(s) out of range`);
  process.exit(1);
}
console.log('Early pacing is inside the intended window.');
