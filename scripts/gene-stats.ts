import { wildGenome, phenotype, SPECIES, GENE_IDS, recombine, newGame, qualifying, DISCOVERIES, mutParams, refreshMods, makePropagule, makePlant } from '../src/engine';

const s = newGame(7); refreshMods(s);
const sp = SPECIES['monstera_deliciosa'];
const N = 4000;
const acc: Record<string, number[]> = {};
for (let i = 0; i < N; i++) { const p = phenotype(wildGenome(s, sp)); for (const g of GENE_IDS) (acc[g] ??= []).push(p[g]); }
for (const g of GENE_IDS) { const a = acc[g].sort((x,y)=>x-y); const m = a.reduce((x,y)=>x+y,0)/N; console.log(g.padEnd(24), 'mean', m.toFixed(2), 'p5', a[Math.floor(N*.05)].toFixed(2), 'p95', a[Math.floor(N*.95)].toFixed(2), 'max', a[N-1].toFixed(2)); }

// How often does a fresh plant earn any discovery, by tier
const counts: Record<string, number> = {};
let any = 0;
for (let i = 0; i < 2000; i++) {
  const pr = makePropagule(s, sp.id, 'seed'); const pl = makePlant(s, pr); pl.analysis = 2; pl.growth = 1;
  const hits = qualifying(pl, phenotype(pl.genome));
  if (hits.length) any++;
  for (const h of hits) counts[h.id] = (counts[h.id] ?? 0) + 1;
}
console.log('plants with >=1 discovery (analysis 2):', (any/20).toFixed(1) + '%');
console.log(Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>`${k}:${(v/20).toFixed(1)}%`).join('  '));
console.log('total discoveries defined:', DISCOVERIES.length);

// Selection response: 6 generations of breeding the top variegation/size plants
let pool = Array.from({length: 12}, () => wildGenome(s, sp));
for (let gen = 1; gen <= 8; gen++) {
  const scored = pool.map((g) => ({ g, v: phenotype(g).leafSize + phenotype(g).variegation })).sort((a,b)=>b.v-a.v);
  const top = scored.slice(0, 4).map(x=>x.g);
  const next = [];
  for (let i = 0; i < 12; i++) { const a = top[i%4], b = top[(i+1)%4]; next.push(recombine(s, a, b, mutParams(s)).genome); }
  pool = next;
  const best = Math.max(...pool.map(g => phenotype(g).leafSize + phenotype(g).variegation));
  console.log('gen', gen, 'best size+var', best.toFixed(2));
}
