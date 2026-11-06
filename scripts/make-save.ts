// Plays the scripted bot for N game-minutes and prints the serialized save (for UI testing).
//   tsx scripts/make-save.ts [minutes=360] [seed=3] > save.json
import { newGame, run, refreshMods, serialize } from '../src/engine';
import { botAct, makeBotLog } from './bot';

const minutes = Number(process.argv[2] ?? 360);
const seed = Number(process.argv[3] ?? 3);
const s = newGame(seed);
refreshMods(s);
const blog = makeBotLog();
for (let t = 0; t < minutes * 60; t += 5) {
  run(s, 5);
  botAct(s, blog);
}
s.savedAt = Date.now();
process.stdout.write(serialize(s));
