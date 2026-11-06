// Reusable plant widgets: thumbnails, cards, the genome viewer and the condition breakdown.

import {
  GENES, GENE_IDS, bandIndex, colourLabel, effAnalysis, INFECTION_NAME, MEDIA_DEFS, effectiveSpecies, express, getRoom, hiddenIndex, phenoOf, plantValue, shapeLabel,
  sizeLabel, suitability, variegationTier, VAR_TIER_NAMES, BAND_NAMES, type GeneId, type GameState, type Plant, type Propagule, type Pheno, type Genome,
} from '../engine';
import { PlantArt } from './PlantArt';
import { Bar, Chip, Icon } from './kit';
import { band5, cls, money } from './format';

export function PlantThumb({ p, height = 112, glow, bare }: { p: Plant; height?: number | string; glow?: boolean; bare?: boolean }) {
  return (
    <PlantArt
      sp={p.sp} hy={p.hy} genome={p.genome} pheno={phenoOf(p)} growth={p.growth} health={p.health} hydration={p.hydration}
      infected={!!p.inf} seed={p.id} pot={p.pot} height={height} glow={glow} sparkle={p.tags.length > 0 || !!p.cultivar} bare={bare}
    />
  );
}

export function PropThumb({ pr, height = 56 }: { pr: Propagule; height?: number }) {
  const g = { seed: 0.1, stem: 0.22, leaf: 0.12, division: 0.4, clone: 0.3, tissue: 0.14, young: 0.5 }[pr.kind];
  return <PlantArt sp={pr.sp} hy={pr.hy} genome={pr.genome} growth={g} seed={pr.id} height={height} />;
}

export function plantWarnings(p: Plant): { text: string; tone: 'red' | 'gold' }[] {
  const out: { text: string; tone: 'red' | 'gold' }[] = [];
  const sp = effectiveSpecies(p.sp, p.hy);
  if (p.inf) out.push({ text: INFECTION_NAME[p.inf.kind], tone: 'red' });
  if (p.hydration < sp.env.dryBack) out.push({ text: 'thirsty', tone: 'gold' });
  if (p.hydration > sp.env.wetCap) out.push({ text: 'waterlogged', tone: 'gold' });
  if (p.nutrients < sp.env.nutrient[0] - 5) out.push({ text: 'hungry', tone: 'gold' });
  if (p.health < 35) out.push({ text: 'failing', tone: 'red' });
  return out;
}

export function PlantCard({ p, s, onClick, selected }: { p: Plant; s: GameState; onClick: () => void; selected?: boolean }) {
  const sp = effectiveSpecies(p.sp, p.hy);
  const warns = plantWarnings(p);
  return (
    <button type="button" className={cls('plant-card', selected && 'sel', warns.some((w) => w.tone === 'red') && 'warn')} onClick={onClick}>
      <div className="pc-badges">
        {p.mother && <Chip tone="olive" title="Mother plant: kept for cuttings">Mother</Chip>}
        {p.keeper && <Chip tone="purple" title="Protected from selling">Keeper</Chip>}
        {p.cultivar && <Chip tone="gold">{p.cultivar}</Chip>}
      </div>
      <div className="art">
        <PlantThumb p={p} />
      </div>
      <div className="pc-name">{p.name}</div>
      <div className="pc-sub">
        {sp.common[0]} · {p.stage}
        {p.tags.length > 0 && ` · ${p.tags.length} trait${p.tags.length > 1 ? 's' : ''}`}
      </div>
      <div className="pc-stats">
        <Bar value={p.growth} max={1} tone="olive" thin />
        <Bar value={p.hydration} tone="blue" thin />
        <Bar value={p.health} tone={p.health < 40 ? 'red' : 'green'} thin />
      </div>
      <div className="row between" style={{ fontSize: 11.5 }}>
        <span className="gold num">{p.growth >= 0.3 ? money(plantValue(s, p)) : 'seedling'}</span>
        <span className="row gap-s">
          {warns.slice(0, 2).map((w) => (
            <span key={w.text} className={w.tone}>
              <Icon name="warn" size={11} /> {w.text}
            </span>
          ))}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Genome viewer. What you can see depends on the analysis level:
//   0 visible morphology only · 1 all expressed values · 2 both alleles + dominance · 3 + origin marks
// ---------------------------------------------------------------------------------------------

const GROUP_COL: Record<string, string> = { Morphology: '#bdd062', Physiology: '#5fd08e', Resilience: '#7fd4e0', Lineage: '#bba8f2' };
const VISIBLE0: GeneId[] = ['leafSize', 'leafShape', 'leafColour', 'variegation'];

function expressionText(p: Plant, g: GeneId, v: number): string {
  const sp = effectiveSpecies(p.sp, p.hy);
  if (g === 'leafSize') return sizeLabel(v);
  if (g === 'leafShape') return shapeLabel(sp, v);
  if (g === 'leafColour') return colourLabel(sp, v);
  if (g === 'variegation') return VAR_TIER_NAMES[variegationTier(v)];
  return BAND_NAMES[bandIndex(v)];
}

export function GenomeView({ p }: { p: Plant | { genome: Genome; analysis: number; growth: number; sp: string; hy?: string } }) {
  const level = effAnalysis(p as Plant);
  const pheno: Pheno = {} as Pheno;
  for (const g of GENE_IDS) pheno[g] = express(p.genome[g]);
  return (
    <div>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Analysis level {level} · {['Visual only', 'Phenotype', 'Genotype', 'Sequenced'][level]}
        </span>
        <span className="row gap-s">
          {(['Morphology', 'Physiology', 'Resilience', 'Lineage'] as const).map((k) => (
            <span key={k} style={{ fontSize: 10.5, color: GROUP_COL[k] }}>
              ● {k}
            </span>
          ))}
        </span>
      </div>
      {GENE_IDS.map((gid) => {
        const meta = GENES[gid];
        const col = GROUP_COL[meta.group];
        const known = level >= 1 || VISIBLE0.includes(gid);
        const alleles = p.genome[gid];
        const hid = hiddenIndex(alleles);
        const dom0 = alleles[0].d >= alleles[1].d;
        return (
          <div className="gene-row" key={gid} title={meta.desc}>
            <div className="gene-name">
              {meta.name}
              <small>{meta.group}</small>
            </div>
            <div>
              {known ? (
                <>
                  <Bar value={pheno[gid]} max={1} thin tone={meta.group === 'Morphology' ? 'olive' : meta.group === 'Physiology' ? 'green' : meta.group === 'Resilience' ? 'blue' : 'purple'} />
                  {level >= 2 && (
                    <div className="allele-pair" style={{ marginTop: 5 }}>
                      {alleles.map((a, i) => {
                        const dominant = i === 0 ? dom0 : !dom0;
                        return (
                          <div className="allele" key={i} title={`value ${a.v.toFixed(2)} · dominance ${a.d.toFixed(2)}${dominant ? ' (dominant)' : ' (recessive)'}`}>
                            <i className={dominant ? 'dom' : undefined} style={{ width: `${a.v * 100}%`, background: col }} />
                            <span>
                              {a.v.toFixed(2)} · d{a.d.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                      {hid >= 0 && (
                        <span className="purple" style={{ fontSize: 11 }}>
                          <Icon name="dna" size={11} /> hidden recessive carrier: {alleles[hid].v.toFixed(2)} (masked)
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <span className="hidden-gene">▒▒▒▒▒▒▒▒▒▒</span>
              )}
            </div>
            <div className="r" style={{ fontSize: 12 }}>
              {known ? <span title={`${meta.low} → ${meta.high}`}>{expressionText(p as Plant, gid, pheno[gid])}</span> : <span className="faint">unknown</span>}
            </div>
          </div>
        );
      })}
      {level < 2 && <p className="hint">Alleles, dominance and hidden carriers need a genotype scan (Marker Genotyping research and a Genetics Laboratory).</p>}
    </div>
  );
}

export function SuitView({ p, s }: { p: Plant; s: GameState }) {
  const room = getRoom(s, p.room);
  if (!room) return <p className="hint">This plant is not in a room.</p>;
  const sp = effectiveSpecies(p.sp, p.hy);
  const su = suitability(p, sp, room);
  const rows: [string, number, string][] = [
    ['Light', su.light, `${room.act.light.toFixed(0)} (wants ${sp.env.light[0]}–${sp.env.light[1]})`],
    ['Temperature', su.temp, `${room.act.temp.toFixed(1)}°C (wants ${sp.env.temp[0]}–${sp.env.temp[1]})`],
    ['Humidity', su.rh, `${room.act.humidity.toFixed(0)}% (wants ${sp.env.rh[0]}–${sp.env.rh[1]})`],
    ['Airflow', su.air, `${room.act.airflow.toFixed(0)} (wants ${sp.env.air[0]}–${sp.env.air[1]})`],
    ['Water', su.water, `${p.hydration.toFixed(0)}% (keep ${sp.env.dryBack}–${sp.env.wetCap})`],
    ['Nutrients', su.nut, `${p.nutrients.toFixed(0)} (wants ${sp.env.nutrient[0]}–${sp.env.nutrient[1]})`],
    ['Medium', su.medium, MEDIA_DEFS[p.medium]?.name ?? p.medium],
  ];
  return (
    <div className="cmp">
      {rows.map(([name, v, note]) => (
        <div className="cmp-row suit-row" key={name}>
          <span className="muted">{name}</span>
          <Bar value={v} max={1} thin tone={v > 0.8 ? 'green' : v > 0.5 ? 'gold' : 'red'} />
          <span className="faint" style={{ fontSize: 11 }}>
            {note}
          </span>
        </div>
      ))}
      <div className="row between mt-s">
        <span className="muted">Overall suitability</span>
        <b className={su.total > 0.7 ? 'green' : su.total > 0.4 ? 'gold' : 'red'}>{(su.total * 100).toFixed(0)}%</b>
      </div>
      {su.lethal && <p className="red">The room temperature is outside what this species can survive.</p>}
    </div>
  );
}

export { band5 };
