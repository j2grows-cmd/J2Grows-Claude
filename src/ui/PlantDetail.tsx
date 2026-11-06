// The detail panel for a single plant: condition, genome, propagation actions and history.

import { useState } from 'react';
import {
  ANALYSIS_BASE, CUT_RULES, DISC_BY_ID, MEDIA_DEFS, POT_DEFS, analysisCost, canCut, cloneCost, cutChance, cultivarCost, discKey, discardPlant, editCost,
  editGene, effAnalysis, INFECTION_NAME, effectiveSpecies, feedById, GENES, GENE_IDS, hasFlag, harvestToStock, movePlant, plantValue, registerCultivar, renamePlant,
  repot, sellPlant, setFlag, startAnalysis, startClone, startTissue, takeCutting, tcCost, tcMaxCycles, tcUnits, treatById, waterById, cloneCap, tcCap,
  analysisSlots, type CutKind, type GameState, type GeneId, type MediumId, type PotId, type Plant,
} from '../engine';
import { act, askConfirm, askText, setUi, useGame, useUi } from '../store';
import { Bar, Btn, Chip, Icon, Modal, Tabs } from './kit';
import { GenomeView, PlantThumb, SuitView } from './plantbits';
import { age, dur, money, pct, cap } from './format';

export function PlantDetailHost() {
  const s = useGame();
  const ui = useUi();
  if (ui.plant == null) return null;
  const p = s.plants.find((x) => x.id === ui.plant) ?? s.stock.find((x) => x.id === ui.plant);
  if (!p) return null;
  return <PlantDetail s={s} p={p} onClose={() => setUi({ plant: null })} />;
}

function PlantDetail({ s, p, onClose }: { s: GameState; p: Plant; onClose: () => void }) {
  const [tab, setTab] = useState('status');
  const sp = effectiveSpecies(p.sp, p.hy);
  const inStock = s.stock.includes(p);
  const value = plantValue(s, p);
  const level = effAnalysis(p);
  const queued = s.jobs.analysis.find((j) => j.plant === p.id);

  const footer = (
    <>
      {!inStock && (
        <Btn
          onClick={() => {
            askConfirm('The plant is removed for good. It earns nothing.', () => {
              act((g) => discardPlant(g, p.id));
              onClose();
            }, { title: `Discard ${p.name}?`, confirm: 'Discard', danger: true });
          }}
          kind="ghost"
          icon="trash"
        >
          Discard
        </Btn>
      )}
      {!inStock && s.mods.flags.cultivars && p.tags.length > 0 && !p.cultivar && (
        <Btn
          kind="default"
          icon="star"
          title="Name this line and earn royalties each time it is sold"
          onClick={() => {
            askText('Name this cultivar', `${sp.common[0]} '${p.name.split('#')[0].trim()}'`, (name) => act((g) => registerCultivar(g, p.id, name)), `Register · ${money(cultivarCost(s, p))}`, 'Registering costs money and earns royalties every time the line is sold.');
          }}
        >
          Register cultivar · {money(cultivarCost(s, p))}
        </Btn>
      )}
      {!inStock && p.stage === 'mature' && (
        <Btn onClick={() => act((g) => harvestToStock(g, p))} icon="arrow" title="Free the growing slot and hold the plant in sales stock until the market is right">
          To stock
        </Btn>
      )}
      <Btn
        kind="gold"
        disabled={p.growth < 0.3}
        onClick={() => {
          const r = act((g) => sellPlant(g, p));
          if (r?.ok) onClose();
        }}
        icon="coin"
      >
        Sell · {money(value)}
      </Btn>
    </>
  );

  return (
    <Modal
      wide
      onClose={onClose}
      footer={footer}
      title={
        <div className="row wrap">
          <input
            type="text"
            defaultValue={p.name}
            maxLength={40}
            aria-label="Plant name"
            onBlur={(e) => act((g) => renamePlant(g, p.id, e.target.value), true)}
            style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, background: 'transparent', border: '1px solid transparent', width: 280 }}
          />
          <span className="sci" style={{ fontSize: 15 }}>
            {sp.sci}
          </span>
        </div>
      }
    >
      <div className="grid split-pd">
        <div>
          <div style={{ height: 250, display: 'grid', alignItems: 'end' }}>
            <PlantThumb p={p} height={250} glow />
          </div>
          <div className="row wrap gap-s mt-s">
            <Chip tone={p.stage === 'mature' ? 'green' : 'olive'}>{p.stage}</Chip>
            <Chip tone="muted">Gen {p.gen}</Chip>
            <Chip tone="muted">{cap(p.origin)}</Chip>
            {p.sport && <Chip tone="purple">Bud sport</Chip>}
            {p.hy && <Chip tone="blue">Hybrid</Chip>}
            {p.cultivar && <Chip tone="gold">{p.cultivar}</Chip>}
            <Chip tone={level >= 2 ? 'purple' : 'muted'}>Analysis {level}</Chip>
          </div>
          <div className="stack mt" style={{ gap: 8 }}>
            {(
              [
                ['Growth', p.growth * 100, 'olive', `${(p.growth * 100).toFixed(0)}%`],
                ['Health', p.health, p.health < 40 ? 'red' : 'green', `${p.health.toFixed(0)}`],
                ['Hydration', p.hydration, 'blue', `${p.hydration.toFixed(0)}%`],
                ['Nutrients', p.nutrients, 'gold', `${p.nutrients.toFixed(0)}`],
                ['Roots', p.roots, 'olive', `${p.roots.toFixed(0)}`],
              ] as const
            ).map(([l, v, tone, txt]) => (
              <div key={l}>
                <div className="row between" style={{ fontSize: 12 }}>
                  <span className="muted">{l}</span>
                  <span className="num">{txt}</span>
                </div>
                <Bar value={v} tone={tone} thin />
              </div>
            ))}
          </div>
          {p.inf && (
            <p className="red mt-s">
              <Icon name="warn" size={14} /> {cap(INFECTION_NAME[p.inf.kind])} · severity {pct(p.inf.sev)}
            </p>
          )}
          <dl className="kv mt">
            <dt>Age</dt>
            <dd>{age(s.time, p.born)}</dd>
            <dt>Market value</dt>
            <dd className="gold">{money(value)}</dd>
            <dt>Vigour</dt>
            <dd>{p.vigor.toFixed(2)}×</dd>
            <dt>Location</dt>
            <dd>{inStock ? 'Sales stock' : (s.rooms.find((r) => r.id === p.room)?.name ?? '—') + ` · slot ${p.slot + 1}`}</dd>
          </dl>
        </div>

        <div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'status', label: 'Care' },
              { id: 'genome', label: 'Genome', badge: p.tags.length || undefined },
              { id: 'propagate', label: 'Propagate' },
              { id: 'history', label: 'History' },
            ]}
          />
          {tab === 'status' && <CareTab s={s} p={p} inStock={inStock} />}
          {tab === 'genome' && <GenomeTab s={s} p={p} />}
          {tab === 'propagate' && <PropagateTab s={s} p={p} inStock={inStock} queued={!!queued} />}
          {tab === 'history' && (
            <div className="stack" style={{ gap: 10 }}>
              <div className="log" style={{ maxHeight: 360 }}>
                {[...p.hist].reverse().map((h, i) => (
                  <div key={i}>
                    <time>{dur(s.time - h.t)}</time>
                    <span>{h.msg}</span>
                  </div>
                ))}
              </div>
              {(p.parents[0] != null || p.parents[1] != null) && (
                <p className="hint">
                  Bred from {p.parents.map((id) => (id == null ? 'unknown' : s.plants.find((x) => x.id === id)?.name ?? s.records.find((r) => r.id === id)?.name ?? `plant #${id}`)).join(' × ')}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CareTab({ s, p, inStock }: { s: GameState; p: Plant; inStock: boolean }) {
  const [medium, setMedium] = useState<MediumId>(p.medium);
  const [pot, setPot] = useState<PotId>(p.pot);
  const [dest, setDest] = useState('');
  const sp = effectiveSpecies(p.sp, p.hy);
  if (inStock) return <p className="hint">This plant is waiting in your sales stock. Sell it from here or on the Market page.</p>;
  const free: { room: number; slot: number; label: string }[] = [];
  for (const r of s.rooms) r.slots.forEach((id, i) => id == null && free.push({ room: r.id, slot: i, label: `${r.name} · slot ${i + 1}` }));
  return (
    <div className="stack">
      <SuitView p={p} s={s} />
      <div className="divider" style={{ margin: 0 }} />
      <div className="row wrap">
        <Btn icon="drop" onClick={() => act((g) => waterById(g, p.id), true)}>
          Water
        </Btn>
        <Btn icon="plant" onClick={() => act((g) => feedById(g, p.id), true)}>
          Feed
        </Btn>
        <Btn icon="heart" disabled={!p.inf} onClick={() => act((g) => treatById(g, p.id))}>
          Treat infection
        </Btn>
        <span className="hint" style={{ margin: 0 }}>
          Keep hydration between {sp.env.dryBack}% and {sp.env.wetCap}%.
        </span>
      </div>
      <div className="divider" style={{ margin: 0 }} />
      <div className="row wrap">
        <label className="muted">Medium</label>
        <select value={medium} onChange={(e) => setMedium(e.target.value as MediumId)}>
          {Object.values(MEDIA_DEFS).map((m) => (
            <option key={m.id} value={m.id} disabled={!!m.needs && !s.mods.flags[m.needs]}>
              {m.name}
              {m.needs && !s.mods.flags[m.needs] ? ' (locked)' : ''} {(sp.env.media[m.id] ?? 0.45) >= 0.8 ? '★' : ''}
            </option>
          ))}
        </select>
        <label className="muted">Pot</label>
        <select value={pot} onChange={(e) => setPot(e.target.value as PotId)}>
          {Object.values(POT_DEFS).map((m) => (
            <option key={m.id} value={m.id} disabled={!!m.needs && !s.mods.flags[m.needs]}>
              {m.name}
              {m.needs && !s.mods.flags[m.needs] ? ' (locked)' : ''}
            </option>
          ))}
        </select>
        <Btn small disabled={medium === p.medium && pot === p.pot} onClick={() => act((g) => repot(g, p.id, medium, pot))}>
          Repot
        </Btn>
        <span className="hint" style={{ margin: 0 }}>
          ★ = this species&apos; preferred medium.
        </span>
      </div>
      {free.length > 0 && (
        <div className="row wrap">
          <label className="muted">Move to</label>
          <select value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value="">Choose a free slot…</option>
            {free.map((f) => (
              <option key={`${f.room}:${f.slot}`} value={`${f.room}:${f.slot}`}>
                {f.label}
              </option>
            ))}
          </select>
          <Btn
            small
            disabled={!dest}
            onClick={() => {
              const [r, sl] = dest.split(':').map(Number);
              act((g) => movePlant(g, p.id, r, sl));
              setDest('');
            }}
          >
            Move
          </Btn>
        </div>
      )}
      <div className="row wrap">
        <Btn small kind={p.mother ? 'primary' : 'default'} onClick={() => act((g) => setFlag(g, p.id, 'mother'), true)} title="Mother plants are protected from auto-selling and used for cuttings">
          {p.mother ? '✓ Mother plant' : 'Mark as mother'}
        </Btn>
        <Btn small kind={p.keeper ? 'primary' : 'default'} onClick={() => act((g) => setFlag(g, p.id, 'keeper'), true)} title="Keepers are never sold automatically">
          {p.keeper ? '✓ Keeper' : 'Mark as keeper'}
        </Btn>
      </div>
    </div>
  );
}

function GenomeTab({ s, p }: { s: GameState; p: Plant }) {
  const [gene, setGene] = useState<GeneId>('leafSize');
  const [allele, setAllele] = useState<0 | 1>(0);
  const known = effAnalysis(p) >= 1;
  return (
    <div className="stack">
      <GenomeView p={p} />
      {p.tags.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Traits & discoveries</h3>
          <div className="row wrap gap-s">
            {p.tags.map((t) => {
              const d = DISC_BY_ID[t];
              const credited = !!s.discoveries[discKey(t, p.sp)];
              return (
                <Chip key={t} tone={credited ? 'purple' : 'muted'} title={d?.desc}>
                  <Icon name="star" size={11} /> {d?.name ?? t}
                </Chip>
              );
            })}
          </div>
        </div>
      )}
      {s.mods.flags.geneEdit && known && (
        <div className="panel" style={{ background: 'rgba(8,18,13,.5)' }}>
          <div className="panel-b">
            <h3 style={{ marginBottom: 8 }}>Gene editing</h3>
            <div className="row wrap">
              <select value={gene} onChange={(e) => setGene(e.target.value as GeneId)}>
                {GENE_IDS.map((g) => (
                  <option key={g} value={g}>
                    {GENES[g].name}
                  </option>
                ))}
              </select>
              <select value={allele} onChange={(e) => setAllele(Number(e.target.value) as 0 | 1)}>
                <option value={0}>Allele A</option>
                <option value={1}>Allele B</option>
              </select>
              <Btn small onClick={() => act((g) => editGene(g, p.id, gene, allele, -0.1))}>
                −0.10
              </Btn>
              <Btn small onClick={() => act((g) => editGene(g, p.id, gene, allele, 0.1))}>
                +0.10
              </Btn>
              <span className="hint" style={{ margin: 0 }}>
                Each edit costs {money(editCost(p).money)} and {editCost(p).rp} RP.
              </span>
            </div>
          </div>
        </div>
      )}
      {!known && <p className="hint">Mature plants are measured informally; use the Genetics Laboratory to analyse younger plants or reveal alleles.</p>}
      <p className="hint">Phenotype is what you see ({GENE_IDS.length} genes, two alleles each). Alleles with high dominance mask low-dominance partners; hidden recessives can return in offspring.</p>
    </div>
  );
}

function PropagateTab({ s, p, inStock, queued }: { s: GameState; p: Plant; inStock: boolean; queued: boolean }) {
  const [cycles, setCycles] = useState(1);
  const sp = effectiveSpecies(p.sp, p.hy);
  const level = p.analysis + 1;
  if (inStock) return <p className="hint">Plants in stock can only be sold. Plant a seed or take cuttings from a living plant instead.</p>;
  const maxC = tcMaxCycles(s);
  const kinds: CutKind[] = ['stem', 'leaf', 'division'];
  return (
    <div className="stack">
      <div>
        <h3 style={{ marginBottom: 8 }}>Cuttings & division</h3>
        <div className="list">
          {kinds.map((k) => {
            const why = canCut(s, p, k);
            const rule = CUT_RULES[k];
            return (
              <div className="item" key={k}>
                <Icon name="scissors" />
                <div className="grow-1">
                  <div className="item-title">{rule.label}</div>
                  <div className="item-sub">{why ?? `${pct(cutChance(s, p, k))} chance · ${money(rule.cost)} · rests ${dur(rule.cool)}`}</div>
                </div>
                <Btn small disabled={!!why} onClick={() => act((g) => takeCutting(g, p.id, k))}>
                  Take
                </Btn>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h3 style={{ marginBottom: 8 }}>Cloning & tissue culture</h3>
        <div className="list">
          <div className="item">
            <Icon name="flask" />
            <div className="grow-1">
              <div className="item-title">Cloning chamber</div>
              <div className="item-sub">
                {hasFlag(s, 'cloning') ? `Exact copies · ${money(cloneCost(p))} · ${s.jobs.cloning.length}/${cloneCap(s)} chambers busy` : 'Research Clonal Propagation to unlock.'}
              </div>
            </div>
            <Btn small disabled={!hasFlag(s, 'cloning') || p.growth < 0.5} onClick={() => act((g) => startClone(g, p.id))}>
              Clone
            </Btn>
          </div>
          <div className="item">
            <Icon name="flask" />
            <div className="grow-1">
              <div className="item-title">Tissue culture</div>
              <div className="item-sub">
                {tcCap(s) > 0
                  ? `${tcUnits(s, sp, cycles)} plantlets · ${money(tcCost(sp, cycles))} · ${s.jobs.tissue.length}/${tcCap(s)} batches`
                  : 'Needs the Tissue Culture department and Aseptic Technique research.'}
              </div>
            </div>
            <select value={cycles} onChange={(e) => setCycles(Number(e.target.value))} disabled={tcCap(s) === 0}>
              {Array.from({ length: maxC }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>
                  {c} cycle{c > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <Btn small disabled={tcCap(s) === 0 || p.growth < 0.5} onClick={() => act((g) => startTissue(g, p.id, cycles))}>
              Start
            </Btn>
          </div>
          <div className="item">
            <Icon name="dna" />
            <div className="grow-1">
              <div className="item-title">{level <= 3 ? ANALYSIS_BASE[level - 1].name : 'Fully sequenced'}</div>
              <div className="item-sub">
                {p.analysis >= 3
                  ? 'Every layer of this genome is known.'
                  : (s.upgrades.lvl_genetics ?? 0) < 1
                    ? 'Build the Genetics Laboratory first.'
                    : `${ANALYSIS_BASE[level - 1].desc} ${money(analysisCost(s, p, level))} · ${dur(ANALYSIS_BASE[level - 1].time)} · ${s.jobs.analysis.length}/${analysisSlots(s)} slots`}
              </div>
            </div>
            <Btn small disabled={queued || p.analysis >= 3 || (s.upgrades.lvl_genetics ?? 0) < 1} onClick={() => act((g) => startAnalysis(g, p.id))}>
              {queued ? 'Queued' : 'Analyse'}
            </Btn>
          </div>
        </div>
      </div>
      <p className="hint">
        Cuttings, clones and tissue culture copy the genome exactly — apart from rare bud sports. Only seeds from a cross recombine genes.
      </p>
    </div>
  );
}
