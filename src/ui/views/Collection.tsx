// The collection: species database, discovery codex, hall of fame and lifetime statistics.

import { useState } from 'react';
import {
  DISCOVERIES, SPECIES_LIST, TECH_BY_ID, availableSpecies, discKey, discoveryCount, effectiveSpecies, speciesAvailable, type DiscCat, type GameState, type Species,
} from '../../engine';
import { setTab, useGame, useUi } from '../../store';
import { Chip, Empty, Hint, Icon, Modal, PageHead, Panel, Stat, Tabs } from '../kit';
import { PlantArt } from '../PlantArt';
import { dur, money, pct } from '../format';

const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);

function unlockHint(s: GameState, sp: Species): string {
  if (s.stage < sp.unlock.stage) return `Reach Stage ${sp.unlock.stage}`;
  if (sp.unlock.expedition) return `Research: ${TECH_BY_ID[sp.unlock.expedition]?.name ?? sp.unlock.expedition}`;
  if (sp.unlock.legacy) return 'Legacy Species Pack';
  return 'Locked';
}

const discFor = (s: GameState, spId: string): number => Object.keys(s.discoveries).filter((k) => k.endsWith(`|${spId}`)).length;

export function Collection() {
  const s = useGame();
  const ui = useUi();
  const tab = ui.tab.coll ?? 'species';
  const seen = SPECIES_LIST.filter((sp) => (s.seen[sp.id] ?? 0) > 0).length;
  return (
    <div className="page">
      <PageHead
        title="Collection"
        blurb="Every real species you can grow, every discovery you have credited, and the finest specimens that ever passed through your laboratory."
        right={
          <>
            <Chip tone="green">{seen}/{SPECIES_LIST.length} species grown</Chip>
            <Chip tone="purple">{discoveryCount(s)} discoveries</Chip>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setTab('coll', t)}
        tabs={[
          { id: 'species', label: 'Species database' },
          { id: 'codex', label: 'Discovery codex' },
          { id: 'fame', label: 'Hall of fame', badge: s.records.length || undefined },
          { id: 'stats', label: 'Statistics' },
        ]}
      />
      {tab === 'species' && <SpeciesTab s={s} />}
      {tab === 'codex' && <Codex s={s} />}
      {tab === 'fame' && <Fame s={s} />}
      {tab === 'stats' && <StatsTab s={s} />}
    </div>
  );
}

function SpeciesTab({ s }: { s: GameState }) {
  const [open, setOpen] = useState<Species | null>(null);
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {SPECIES_LIST.map((sp) => {
          const avail = speciesAvailable(s, sp);
          const n = s.seen[sp.id] ?? 0;
          return (
            <button key={sp.id} type="button" className={`species-card${avail ? '' : ' lockedsp'}`} onClick={() => setOpen(sp)}>
              <div style={{ height: 96, display: 'grid', alignItems: 'end', filter: n > 0 || avail ? 'none' : 'grayscale(1) brightness(.4)' }}>
                <PlantArt sp={sp.id} growth={0.9} seed={sp.id.length * 11} height={96} />
              </div>
              <div className="item-title" style={{ fontSize: 13.5 }}>{n > 0 || avail ? sp.common[0] : '???'}</div>
              <div className="sci" style={{ fontSize: 11.5 }}>{n > 0 || avail ? sp.sci : 'Undiscovered'}</div>
              <div className="row between" style={{ fontSize: 11.5 }}>
                <span className="gold">{stars(sp.rarity)}</span>
                {avail ? <Chip tone={n > 0 ? 'green' : 'muted'}>{n > 0 ? `grown ${n}` : 'new'}</Chip> : <Chip tone="muted"><Icon name="lock" size={10} /> {unlockHint(s, sp)}</Chip>}
              </div>
            </button>
          );
        })}
      </div>
      {open && <SpeciesModal s={s} sp={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function SpeciesModal({ s, sp, onClose }: { s: GameState; sp: Species; onClose: () => void }) {
  const avail = speciesAvailable(s, sp);
  const rows: [string, number][] = [['Seed', sp.prop.seed], ['Stem cutting', sp.prop.stem], ['Leaf cutting', sp.prop.leaf], ['Division', sp.prop.division], ['Cloning', sp.prop.clone], ['Tissue culture', sp.prop.tissue]];
  return (
    <Modal wide onClose={onClose} title={<span>{sp.common[0]} <span className="sci" style={{ fontSize: 16 }}>{sp.sci}</span></span>}>
      <div className="grid split-sp">
        <div>
          <div style={{ height: 220, display: 'grid', alignItems: 'end' }}><PlantArt sp={sp.id} growth={1} seed={sp.id.length * 11} height={220} glow /></div>
          <div className="row wrap gap-s mt-s">
            <Chip tone="gold">{stars(sp.rarity)}</Chip>
            <Chip tone="muted">{sp.family}</Chip>
            <Chip tone="olive">{sp.habit}</Chip>
            {!avail && <Chip tone="red"><Icon name="lock" size={10} /> {unlockHint(s, sp)}</Chip>}
          </div>
          <dl className="kv mt">
            <dt>Grown by you</dt><dd>{s.seen[sp.id] ?? 0}</dd>
            <dt>Discoveries</dt><dd>{discFor(s, sp.id)}</dd>
            <dt>Base value</dt><dd className="gold">{money(sp.baseValue)}</dd>
            <dt>Time to mature</dt><dd>{dur(sp.growSec)}</dd>
          </dl>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <p className="muted">{sp.notes}</p>
          <dl className="kv">
            <dt>Native region</dt><dd>{sp.region}</dd>
            <dt>Habitat</dt><dd>{sp.habitat}</dd>
            <dt>Signature trait</dt><dd>{sp.exotic}</dd>
          </dl>
          <div>
            <h3 style={{ marginBottom: 6 }}>Growing conditions</h3>
            <dl className="kv">
              <dt>Light (effective)</dt><dd>{sp.env.light[0]}–{sp.env.light[1]}</dd>
              <dt>Temperature</dt><dd>{sp.env.temp[0]}–{sp.env.temp[1]}°C (lethal beyond {sp.env.lethal[0]}–{sp.env.lethal[1]})</dd>
              <dt>Humidity</dt><dd>{sp.env.rh[0]}–{sp.env.rh[1]}%</dd>
              <dt>Airflow</dt><dd>{sp.env.air[0]}–{sp.env.air[1]}</dd>
              <dt>Water</dt><dd>keep {sp.env.dryBack}–{sp.env.wetCap}%</dd>
            </dl>
          </div>
          <div>
            <h3 style={{ marginBottom: 6 }}>Propagation suitability</h3>
            <div className="cmp">
              {rows.map(([l, v]) => (
                <div className="cmp-row" key={l}>
                  <span className="muted">{l}</span>
                  <div className="bar bar-thin"><div className="bar-fill tone-olive" style={{ width: `${v * 100}%` }} /></div>
                  <span className="num r">{v > 0 ? pct(v) : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const CATS: DiscCat[] = ['Morphology', 'Physiology', 'Resilience', 'Lineage', 'Composite', 'Origin', 'Hidden alleles'];

function Codex({ s }: { s: GameState }) {
  const grown = availableSpecies(s).filter((sp) => (s.seen[sp.id] ?? 0) > 0);
  const [sp, setSp] = useState<string>(grown[0]?.id ?? '');
  const spId = sp || grown[0]?.id || '';
  return (
    <>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <label className="muted">Species</label>
        <select value={spId} onChange={(e) => setSp(e.target.value)}>
          {grown.map((x) => <option key={x.id} value={x.id}>{x.common[0]} ({discFor(s, x.id)})</option>)}
          {grown.length === 0 && <option value="">Grow a species first</option>}
        </select>
        <span className="muted">Each species has its own codex: the same trait is a fresh discovery in every species.</span>
      </div>
      {CATS.map((cat) => {
        const list = DISCOVERIES.filter((d) => d.cat === cat);
        if (!list.length) return null;
        const got = list.filter((d) => s.discoveries[discKey(d.id, spId)]).length;
        return (
          <Panel key={cat} title={cat} sub={`${got}/${list.length}`} className="mt">
            <div className="codex-grid">
              {list.map((d) => {
                const rec = s.discoveries[discKey(d.id, spId)];
                const any = Object.keys(s.discoveries).some((k) => k.startsWith(`${d.id}|`));
                return (
                  <div key={d.id} className={`codex ${rec ? 'got' : any ? '' : 'unknown'}`} title={d.desc}>
                    <div className="row between">
                      <span className="item-title" style={{ fontSize: 13 }}>{rec || any ? d.name : '???'}</span>
                      {rec ? <Icon name="check" size={14} className="purple" /> : <Chip tone="muted">L{d.needs}</Chip>}
                    </div>
                    <div className="item-sub">{rec || any ? d.desc : 'Not yet seen in any species.'}</div>
                    {rec && <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>found in {rec.plantName}</div>}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </>
  );
}

function Fame({ s }: { s: GameState }) {
  const list = [...s.records].sort((a, b) => b.tags.length - a.tags.length || b.value - a.value).slice(0, 48);
  if (!list.length) return <Panel><Empty icon="star">Analyse or sell a plant that carries a discovery and it will be recorded here.</Empty></Panel>;
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
      {list.map((r) => (
        <Panel key={r.id} pad={false}>
          <div className="panel-b">
            <div style={{ height: 110, display: 'grid', alignItems: 'end' }}>
              <PlantArt sp={r.sp} hy={r.hy} genome={r.genome} growth={1} seed={r.id} height={110} sparkle={r.tags.length > 0} />
            </div>
            <div className="item-title mt-s">{r.name}</div>
            <div className="item-sub">{effectiveSpecies(r.sp, r.hy).common[0]} · gen {r.gen} · {r.origin}</div>
            <div className="row wrap gap-s mt-s">
              <Chip tone="purple">{r.tags.length} trait{r.tags.length === 1 ? '' : 's'}</Chip>
              {r.value > 0 && <Chip tone="gold">sold {money(r.value)}</Chip>}
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function StatsTab({ s }: { s: GameState }) {
  const st = s.stats;
  const tiles: [string, string | number][] = [
    ['Money earned', money(st.earned)], ['Money spent', money(st.spent)], ['Plants sold', st.sold], ['Plants matured', st.matured], ['Plants lost', st.died],
    ['Crosses made', st.bred], ['Seeds produced', st.seedsMade], ['Clones made', st.cloned], ['Plantlets cultured', st.tissueMade], ['Scans completed', st.analysed],
    ['Contracts filled', st.contracts], ['Technologies', st.techs], ['Research earned', Math.round(st.rpEarned)], ['Largest collection', st.maxPlants], ['Time played', dur(s.totalTime)],
  ];
  return (
    <div className="stats-row">
      {tiles.map(([l, v]) => <Stat key={l} label={l} value={v} />)}
      <Hint>Statistics carry through legacy resets.</Hint>
    </div>
  );
}

