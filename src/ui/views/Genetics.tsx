// Genetics department: analysis scans and the breeding station.

import { useMemo, useState } from 'react';
import {
  ANALYSIS_BASE, BASE_MUT, GENES, GENE_IDS, MUT_WEIGHT, analysisCost, analysisSlots, breedCap, breedEstimate, compat, deptStatus, effAnalysis, effectiveSpecies, express,
  hasFlag, hybridSuccess, mutParams, phenoOf, startAnalysis, startBreeding, type GameState, type GeneId, type Plant,
} from '../../engine';
import { act, setTab, setUi, useGame, useUi } from '../../store';
import { Bar, Btn, Chip, Empty, Hint, Icon, PageHead, Panel, Stat, Tabs } from '../kit';
import { PlantThumb } from '../plantbits';
import { UpgradeList } from '../upgrades';
import { dur, money, pct } from '../format';

export function Genetics() {
  const s = useGame();
  const ui = useUi();
  const tab = ui.tab.gen ?? 'breeding';
  const built = (s.upgrades.lvl_genetics ?? 0) >= 1;
  const dept = deptStatus(s, 'genetics');
  return (
    <div className="page">
      <PageHead
        title="Genetics"
        blurb="Read the genomes of your plants, then cross the best of them. Every gene has two alleles; dominant ones hide recessive ones, and recessives can reappear a generation later."
        right={<Chip tone={built ? 'purple' : 'muted'}>Department level {s.upgrades.lvl_genetics ?? 0}</Chip>}
      />
      {!built ? (
        <Panel title="Build the Genetics Laboratory" icon="dna">
          <p className="muted">{dept.unlocked ? 'Your facility is ready for a Genetics Laboratory.' : dept.why}</p>
          {dept.unlocked && <UpgradeList s={s} dept="genetics" />}
        </Panel>
      ) : (
        <>
          <div className="stats-row" style={{ marginBottom: 16 }}>
            <Stat label="Breeding stations" value={`${s.jobs.breeding.length}/${breedCap(s)}`} tone="purple" />
            <Stat label="Analysis slots" value={`${s.jobs.analysis.length}/${analysisSlots(s)}`} />
            <Stat label="Pollinations done" value={s.stats.bred} />
            <Stat label="Scans completed" value={s.stats.analysed} />
            <Stat label="Mutation rate" value={`${s.mods.mutation.toFixed(2)}×`} sub={`novel ${s.mods.novel.toFixed(2)}×`} />
          </div>
          <Tabs
            value={tab}
            onChange={(t) => setTab('gen', t)}
            tabs={[
              { id: 'breeding', label: 'Breeding station' },
              { id: 'analysis', label: 'Analysis', badge: s.jobs.analysis.length || undefined },
              { id: 'upgrades', label: 'Department upgrades' },
            ]}
          />
          {tab === 'breeding' && <Breeding s={s} />}
          {tab === 'analysis' && <Analysis s={s} />}
          {tab === 'upgrades' && (
            <Panel title="Genetics department" icon="gear">
              <UpgradeList s={s} dept="genetics" />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Analysis({ s }: { s: GameState }) {
  const rows = s.plants.filter((p) => p.growth >= 0.3);
  return (
    <div className="grid g-main">
      <Panel title="Plants" icon="plant">
        {rows.length === 0 ? (
          <Empty>No plants are old enough to analyse yet.</Empty>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th>Plant</th>
                <th>Level</th>
                <th>Next scan</th>
                <th className="r">Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const next = p.analysis + 1;
                const queued = s.jobs.analysis.find((j) => j.plant === p.id);
                const done = p.analysis >= 3;
                return (
                  <tr key={p.id}>
                    <td>
                      <button type="button" className="icon-btn" style={{ color: 'var(--text)', gap: 8, display: 'flex' }} onClick={() => setUi({ plant: p.id })}>
                        {p.name}
                      </button>
                    </td>
                    <td>
                      <Chip tone={effAnalysis(p) >= 2 ? 'purple' : 'muted'}>{effAnalysis(p)}</Chip>
                    </td>
                    <td className="muted">{done ? 'Fully sequenced' : ANALYSIS_BASE[next - 1].name}</td>
                    <td className="r gold">{done ? '—' : money(analysisCost(s, p, next))}</td>
                    <td className="r">
                      <Btn small disabled={done || !!queued} onClick={() => act((g) => startAnalysis(g, p.id))}>
                        {queued ? 'Queued' : 'Scan'}
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      <div className="stack">
        <Panel title="Queue" icon="flask">
          {s.jobs.analysis.length === 0 ? (
            <Empty icon="dna">Nothing is being scanned.</Empty>
          ) : (
            <div className="list">
              {s.jobs.analysis.map((j) => (
                <div className="item" key={j.id}>
                  <div className="grow-1">
                    <div className="item-title">{s.plants.find((p) => p.id === j.plant)?.name ?? 'Plant'}</div>
                    <div className="item-sub">
                      {ANALYSIS_BASE[j.level - 1].name} · {dur(j.total - j.progress)} left
                    </div>
                    <Bar value={j.progress} max={j.total} tone="purple" thin />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Scan levels" icon="info">
          <div className="list">
            {ANALYSIS_BASE.map((a, i) => (
              <div key={a.name} className="item dim" style={{ opacity: 1 }}>
                <Chip tone={i === 0 ? 'green' : i === 1 ? (hasFlag(s, 'analysis2') ? 'green' : 'muted') : hasFlag(s, 'analysis3') ? 'green' : 'muted'}>L{i + 1}</Chip>
                <div>
                  <div className="item-title">{a.name}</div>
                  <div className="item-sub">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <Hint>Marker Genotyping and Genome Sequencing (Research → Genetics) unlock levels 2 and 3. Mature plants are always measured informally at level 1.</Hint>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function outcomes(a: Plant, b: Plant, g: GeneId): number[] {
  const out: number[] = [];
  for (const x of a.genome[g]) for (const y of b.genome[g]) out.push(express([x, y]));
  return out;
}

function Breeding({ s }: { s: GameState }) {
  const mature = useMemo(() => s.plants.filter((p) => p.stage === 'mature' && p.health >= 40), [s.plants, s.time > 0 ? Math.floor(s.time / 10) : 0]);
  const [aId, setA] = useState<number | ''>('');
  const [bId, setB] = useState<number | ''>('');
  const a = mature.find((p) => p.id === aId) ?? null;
  const b = mature.find((p) => p.id === bId) ?? null;
  const est = a && b ? breedEstimate(s, a, b) : null;
  const preview = hasFlag(s, 'breedPreview');
  const predict = hasFlag(s, 'breedPredict');
  const both = a && b && effAnalysis(a) >= 2 && effAnalysis(b) >= 2;

  const mutPct = useMemo(() => {
    if (!a || !b) return 0;
    const mp = mutParams(s, { mutationPotential: (phenoOf(a).mutationPotential + phenoOf(b).mutationPotential) / 2 });
    let keep = 1;
    for (const g of GENE_IDS) keep *= (1 - Math.min(0.5, BASE_MUT * mp.rate * MUT_WEIGHT[g])) ** 2;
    return 1 - keep;
  }, [a, b, s]);

  const opts = (cur: number | '', other: number | '') => (
    <>
      <option value="">Choose a plant…</option>
      {mature.map((p) => (
        <option key={p.id} value={p.id} disabled={p.id === other && !hasFlag(s, 'selfing')}>
          {p.name} — {effectiveSpecies(p.sp, p.hy).common[0]}
          {p.id === cur ? ' ✓' : ''}
        </option>
      ))}
    </>
  );

  return (
    <div className="grid g-main">
      <div className="stack">
        <Panel title="Cross two plants" icon="dna">
          {mature.length === 0 ? (
            <Empty>You need mature, healthy plants to breed. Grow a few and come back.</Empty>
          ) : (
            <>
              <div className="grid g2" style={{ alignItems: 'start' }}>
                {([['Pollen parent A', a, aId, setA, bId], ['Pollen parent B', b, bId, setB, aId]] as const).map(([label, pl, val, setter, other]) => (
                  <div key={label} className="stack" style={{ gap: 8 }}>
                    <div className="muted" style={{ fontSize: 12 }}>{label}</div>
                    <select value={val} onChange={(e) => setter(e.target.value ? Number(e.target.value) : '')}>
                      {opts(val, other)}
                    </select>
                    <div style={{ height: 130 }}>{pl ? <PlantThumb p={pl} height={130} /> : <Empty icon="dna">Select</Empty>}</div>
                    {pl && (
                      <div className="row wrap gap-s">
                        <Chip tone="muted">Gen {pl.gen}</Chip>
                        <Chip tone={effAnalysis(pl) >= 2 ? 'purple' : 'muted'}>Analysis {effAnalysis(pl)}</Chip>
                        {pl.tags.length > 0 && <Chip tone="purple">{pl.tags.length} traits</Chip>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {est && a && b && (
                <div className="mt">
                  <div className="row wrap gap-s">
                    <Chip tone={est.kind === 'hybrid' ? 'blue' : est.kind === 'self' ? 'olive' : 'green'}>{est.kind === 'self' ? 'Self-pollination' : est.kind === 'same' ? 'Same-species cross' : `Hybrid (${compat(a.sp, b.sp)})`}</Chip>
                    <Chip tone="gold">{money(est.cost)}</Chip>
                    <Chip tone="blue">{dur(est.total)}</Chip>
                    <Chip tone="green">≈ {est.seeds} seeds</Chip>
                    <Chip tone="muted">viability {pct(est.viability)}</Chip>
                    {est.kind === 'hybrid' && !est.err && <Chip tone="blue">{pct(hybridSuccess(s, a, b))} chance to set seed</Chip>}
                    <Chip tone="purple" title="Chance that a seed carries at least one new mutation">{pct(mutPct, 1)} mutate</Chip>
                  </div>
                  {est.err && <p className="red mt-s">{est.err}</p>}
                  <div className="mt">
                    <Btn kind="primary" icon="dna" disabled={!!est.err || s.jobs.breeding.length >= breedCap(s) + 4} onClick={() => act((g) => startBreeding(g, a.id, b.id))}>
                      Start pollination
                    </Btn>
                    <span className="hint" style={{ marginLeft: 10 }}>
                      Offspring seeds recombine one allele from each parent per gene and arrive on the propagation bench.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>

        {a && b && (
          <Panel title="Offspring preview" icon="star" sub={predict ? 'inheritance model' : preview ? 'Mendelian preview' : 'locked'}>
            {!preview ? (
              <Empty icon="lock">Research Mendelian Principles to preview how the parents combine.</Empty>
            ) : !both ? (
              <>
                <Hint>Analyse both parents to level 2 (genotype scan) to see exact allele combinations. For now, offspring will fall roughly between the parents&apos; visible traits.</Hint>
                <Preview a={a} b={b} loose />
              </>
            ) : (
              <Preview a={a} b={b} predict={predict} />
            )}
          </Panel>
        )}
      </div>

      <div className="stack">
        <Panel title="Pollination in progress" icon="flask" sub={`${s.jobs.breeding.length}`}>
          {s.jobs.breeding.length === 0 ? (
            <Empty icon="dna">No crosses running.</Empty>
          ) : (
            <div className="list">
              {s.jobs.breeding.map((j) => (
                <div className="item" key={j.id}>
                  <div className="grow-1">
                    <div className="item-title">
                      {j.nameA} × {j.nameB}
                    </div>
                    <div className="item-sub">
                      {j.kind === 'hybrid' ? 'Hybrid' : j.kind === 'self' ? 'Selfed' : 'Cross'} · {j.seeds} seeds · {dur(j.total - j.progress)} left
                    </div>
                    <Bar value={j.progress} max={j.total} tone="olive" thin />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-s">
            <Btn small onClick={() => { setTab('cult', 'bench'); setUi({ view: 'cultivation' }); }}>
              <Icon name="arrow" size={13} /> Open the bench ({s.props.filter((p) => p.origin !== 'purchase').length} home-grown)
            </Btn>
          </div>
        </Panel>
        <Panel title="Breeding tips" icon="info">
          <Hint>Cross plants that differ in what you want to combine. Self-pollination (once researched) concentrates recessive alleles but lowers vigour.</Hint>
          <Hint>Hidden recessive carriers look normal, but crossing two carriers reveals the trait in about a quarter of the offspring.</Hint>
          <Hint>Mutation potential is a gene too: unstable plants make more novel alleles — and more duds.</Hint>
        </Panel>
      </div>
    </div>
  );
}

function Preview({ a, b, predict, loose }: { a: Plant; b: Plant; predict?: boolean; loose?: boolean }) {
  const pa = phenoOf(a);
  const pb = phenoOf(b);
  const rows = GENE_IDS.filter((g) => loose ? ['leafSize', 'leafShape', 'leafColour', 'variegation'].includes(g) : true);
  return (
    <div className="cmp" style={{ gap: 10 }}>
      {rows.map((g) => {
        const o = loose ? [pa[g], pb[g]] : outcomes(a, b, g);
        const lo = Math.min(...o);
        const hi = Math.max(...o);
        const best = Math.max(pa[g], pb[g]);
        const worst = Math.min(pa[g], pb[g]);
        const up = o.filter((v) => v > best + 0.02).length / o.length;
        const down = o.filter((v) => v < worst - 0.02).length / o.length;
        return (
          <div key={g} className="pred-row" style={{ fontSize: 12.5 }}>
            <span>{GENES[g].name}</span>
            <div style={{ position: 'relative', height: 14, background: 'rgba(255,255,255,.07)', borderRadius: 7 }}>
              <div style={{ position: 'absolute', left: `${lo * 100}%`, width: `${Math.max(1.5, (hi - lo) * 100)}%`, top: 0, bottom: 0, background: 'linear-gradient(90deg,#7a62c4,#bba8f2)', borderRadius: 7, opacity: 0.85 }} />
              {!loose && o.map((v, i) => <div key={i} style={{ position: 'absolute', left: `${v * 100}%`, top: 3, width: 3, height: 8, background: '#fff', opacity: 0.8, transform: 'translateX(-1px)' }} />)}
              <div title={`A: ${pa[g].toFixed(2)}`} style={{ position: 'absolute', left: `${pa[g] * 100}%`, top: -3, width: 2, height: 20, background: '#5fd08e' }} />
              <div title={`B: ${pb[g].toFixed(2)}`} style={{ position: 'absolute', left: `${pb[g] * 100}%`, top: -3, width: 2, height: 20, background: '#dfb85c' }} />
            </div>
            <span className="muted" style={{ fontSize: 11.5 }}>
              {predict && !loose ? (
                <>
                  {up > 0 && <span className="green">↑ {pct(up)} </span>}
                  {down > 0 && <span className="red">↓ {pct(down)}</span>}
                  {up === 0 && down === 0 && <span>≈ parents</span>}
                </>
              ) : (
                `${lo.toFixed(2)}–${hi.toFixed(2)}`
              )}
            </span>
          </div>
        );
      })}
      <div className="row gap-s faint" style={{ fontSize: 11 }}>
        <span style={{ color: '#5fd08e' }}>▌ parent A</span>
        <span style={{ color: '#dfb85c' }}>▌ parent B</span>
        <span>purple = range of possible offspring (before mutation){!loose && ', ticks = the four allele combinations'}</span>
      </div>
    </div>
  );
}
