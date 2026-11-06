// Runs the scripted bot through the game and prints a pacing report.
//   npx tsx scripts/balance-sim.ts [minutes=120] [seed=1]

import { newGame, run, discoveryCount, refreshMods, coreTechsLeft, legacyGain, royaltyRate, type GameState } from '../src/engine';
import { botAct, makeBotLog } from './bot';

const minutes = Number(process.argv[2] ?? 120);
const seed = Number(process.argv[3] ?? 1);
const maxStep = Number(process.argv[4] ?? 1); // sub-step size; the browser uses 0.5, 1 is the default, 5 is for quick tuning runs

const s: GameState = newGame(seed);
refreshMods(s);
const blog = makeBotLog();
const fmt = (n: number) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));

const t0 = Date.now();
const total = minutes * 60;
for (let t = 0; t < total; t += 5) {
  run(s, 5, maxStep);
  botAct(s, blog);
  if (t % 300 === 0) {
    blog.snaps.push({ t, stage: s.stage, money: s.money, rp: s.rp, plants: s.plants.length, disc: discoveryCount(s), techs: Object.keys(s.done).length, income: s.income });
  }
}
console.log(`Simulated ${minutes} game-minutes in ${((Date.now() - t0) / 1000).toFixed(1)}s (seed ${seed})`);
console.log('Stage reached at (h):', Object.entries(blog.stageAt).map(([k, v]) => `S${k}@${(v / 3600).toFixed(1)}`).join('  '));
console.log(`First legacy reset possible at: ${blog.prestigeAt === undefined ? 'not reached' : (blog.prestigeAt / 3600).toFixed(1) + ' h'}   (main tree left: ${coreTechsLeft(s)}, earned this run: ${fmt(s.stats.earnedRun)}, points on reset: ${legacyGain(s)}, royalties: ${royaltyRate(s).toFixed(1)}/s of income ${s.income.toFixed(1)}/s)`);
console.log('min   stage  money    RP    plants disc techs income/s');
for (const x of blog.snaps.filter((_, i) => i % 2 === 0)) {
  console.log(`${String(Math.round(x.t / 60)).padStart(3)}   S${x.stage}   ${fmt(x.money).padStart(7)} ${fmt(x.rp).padStart(6)} ${String(x.plants).padStart(6)} ${String(x.disc).padStart(4)} ${String(x.techs).padStart(5)}  ${x.income.toFixed(2)}`);
}
console.log('stats', JSON.stringify(s.stats));
console.log('plants', s.plants.length, 'died', s.stats.died, 'props', s.props.length, 'stock', s.stock.length, 'cultivars', s.cultivars.length, 'staff', s.staff.length);
console.log('last log:', s.log.slice(-5).map((l) => l.msg).join(' | '));
