import { newGame, buy, placePropagule, run, step, plantValue, sellPlant, waterPlant, feedPlant, refreshMods, availableSpecies } from '../src/engine';

const s = newGame(42);
refreshMods(s);
console.log('species available', availableSpecies(s).map((x) => x.id).join(','));
console.log(buy(s, 'tradescantia_zebrina', 'seed'));
console.log(buy(s, 'epipremnum_aureum', 'young'));
for (let i = 0; i < s.props.length; i++) {
  const r = placePropagule(s, s.props[0].id, s.rooms[0].id, i);
  console.log('place', r.msg);
}
console.log('plants', s.plants.length, 'money', s.money.toFixed(2));
for (let t = 0; t < 600; t += 5) {
  run(s, 5);
  for (const p of s.plants) { if (p.hydration < 40) waterPlant(s, p); if (p.nutrients < 30) feedPlant(s, p); }
  if (t % 60 === 0) {
    console.log(`t=${t} money=${s.money.toFixed(1)} rp=${s.rp.toFixed(1)}`, s.plants.map((p) => `${p.name.slice(0,10)} g=${p.growth.toFixed(2)} h=${p.health.toFixed(0)} w=${p.hydration.toFixed(0)} n=${p.nutrients.toFixed(0)} r=${p.roots.toFixed(0)}`).join(' | '));
    console.log('  room', JSON.stringify(Object.fromEntries(Object.entries(s.rooms[0].act).map(([k,v])=>[k, +(v as number).toFixed(1)]))));
  }
}
for (const p of [...s.plants]) if (p.stage==='mature') console.log('value', p.name, plantValue(s,p).toFixed(2), sellPlant(s,p).msg);
console.log('log', s.log.slice(-6).map(l=>l.msg));
void step;
