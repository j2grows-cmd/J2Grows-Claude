// Research & technology tree: eight categories, laid out in columns by facility stage.

import {
  SPECIES, SPECIES_LIST, TECHS, TECH_BY_ID, TECH_CATS, rpRate, startProject, techState, type Effect, type GameState, type TechDef,
} from '../../engine';
import { act, setTab, useGame, useUi } from '../../store';
import { Bar, Btn, Chip, Icon, PageHead, Panel, Stat, Tabs } from '../kit';
import { dur, money, num } from '../format';

/** Species an expedition unlocks beyond the specimens it brings back. */
const extraUnlocks = (techId: string, shown: string[]): number =>
  SPECIES_LIST.filter((sp) => sp.unlock.expedition === techId && !shown.includes(sp.id)).length;

const LABEL: Record<string, string> = {
  growth: 'Growth speed', research: 'Research output', rpFlat: 'Base research', analysisSpeed: 'Analysis speed', analysisSlots: 'Analysis slots', breedSlots: 'Breeding stations',
  breedSpeed: 'Breeding speed', cloneSlots: 'Cloning chambers', cloneYield: 'Clones per batch', tcSlots: 'Culture benches', tcYield: 'Tissue culture yield', tcSpeed: 'Culture speed',
  tcContam: 'Contamination', tcMutation: 'Somaclonal variation', propSuccess: 'Propagation success', propSpeed: 'Propagation recovery time', mutation: 'Mutation rate', novel: 'Novel alleles',
  discovery: 'Discovery rewards', sellPrice: 'Sale prices', seedPrice: 'Seed value', offlineCap: 'Offline hours', offlineEff: 'Offline efficiency', stability: 'Climate stability',
  diseaseResist: 'Disease resistance', researchSlots: 'Research slots', maxRooms: 'Maximum rooms', roomSlots: 'Slots per room', germination: 'Germination', contractSlots: 'Contract slots',
  royalty: 'Cultivar royalties', wage: 'Wages', energy: 'Energy use', staffCap: 'Staff capacity', autoRate: 'Automation speed', storage: 'Storage', rareBonus: 'Rare plant prices',
  waterUse: 'Water use', nutrientUse: 'Fertiliser use', analysisCost: 'Analysis cost',
};
const pretty = (flag: string): string => flag.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function effectText(e: Effect): string {
  if (e.flag) return `Unlocks ${pretty(e.flag)}`;
  const label = LABEL[e.k ?? ''] ?? e.k ?? '';
  if (e.mul != null) {
    const p = Math.round((e.mul - 1) * 100);
    return `${label} ${p >= 0 ? '+' : '−'}${Math.abs(p)}%`;
  }
  if (e.add != null) return `${label} ${e.add >= 0 ? '+' : '−'}${Math.abs(e.add * (Math.abs(e.add) < 1 ? 100 : 1)).toFixed(Math.abs(e.add) < 1 ? 0 : 1).replace(/\.0$/, '')}${Math.abs(e.add) < 1 ? '%' : ''}`;
  return label;
}

export function Research() {
  const s = useGame();
  const ui = useUi();
  const cats = TECH_CATS.filter((c) => c.id !== 'synthetic' || s.legacy.ups.branch > 0);
  const cat = ui.tab.research && cats.some((c) => c.id === ui.tab.research) ? ui.tab.research : cats[0].id;
  const list = TECHS.filter((t) => t.cat === cat);
  const stages = [...new Set(list.map((t) => t.stage))].sort((a, b) => a - b);
  const def = TECH_CATS.find((c) => c.id === cat)!;
  const doneN = (c: string) => TECHS.filter((t) => t.cat === c && s.done[t.id] !== undefined).length;
  return (
    <div className="page">
      <PageHead title="Research" blurb="Spend research points and funding to unlock new methods, machines and markets. Points come from your researchers, from growing plants and from discoveries." />
      <div className="stats-row" style={{ marginBottom: 16 }}>
        <Stat label="Research points" value={num(s.rp)} tone="blue" sub={`+${rpRate(s).toFixed(2)}/s base`} />
        <Stat label="Project slots" value={`${s.active.length}/${s.mods.researchSlots}`} />
        <Stat label="Techs researched" value={Object.keys(s.done).length} sub={`of ${TECHS.length}`} />
        <Stat label="Research speed" value={`${(1 + 0.2 * Math.max(0, Math.min(20, s.mods.research - 1))).toFixed(2)}×`} />
      </div>

      {s.active.length > 0 && (
        <Panel title="Active projects" icon="rp" sub={`${s.active.length}/${s.mods.researchSlots}`}>
          <div className="grid g3">
            {s.active.map((a) => (
              <div key={a.id} className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="row between">
                  <span className="item-title">{TECH_BY_ID[a.id]?.name}</span>
                  <span className="muted num">{Math.round((a.progress / a.total) * 100)}%</span>
                </div>
                <Bar value={a.progress} max={a.total} tone="blue" />
                <span className="item-sub">{dur((a.total - a.progress) / (1 + 0.2 * Math.max(0, Math.min(20, s.mods.research - 1))))} remaining</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="mt">
        <Tabs
          value={cat}
          onChange={(t) => setTab('research', t)}
          tabs={cats.map((c) => ({ id: c.id, label: c.name, badge: `${doneN(c.id)}/${TECHS.filter((t) => t.cat === c.id).length}` }))}
        />
      </div>
      <p className="muted" style={{ marginTop: -6 }}>{def.blurb}</p>

      <div className="tree">
        {stages.map((st) => (
          <div className="tree-col" key={st}>
            <h4>Stage {st}</h4>
            {list.filter((t) => t.stage === st).map((t) => (
              <TechCard key={t.id} s={s} t={t} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TechCard({ s, t }: { s: GameState; t: TechDef }) {
  const st = techState(s, t);
  const afford = s.rp >= t.rp && s.money >= t.money;
  const slots = s.active.length < s.mods.researchSlots;
  const cls = st.status === 'done' ? 'done' : st.status === 'active' ? 'active' : st.status === 'locked' ? 'locked' : 'avail';
  const speed = 1 + 0.2 * Math.max(0, Math.min(20, s.mods.research - 1));
  return (
    <div className={`tech ${cls}`}>
      <div className="row between top">
        <span className="tech-name">{t.name}</span>
        {st.status === 'done' && <Icon name="check" className="green" />}
        {st.status === 'locked' && <Icon name="lock" size={14} />}
      </div>
      <div className="tech-desc">{t.desc}</div>
      {t.effects.length > 0 && (
        <div className="row wrap gap-s">
          {t.effects.slice(0, 3).map((e, i) => (
            <Chip key={i} tone={e.flag ? 'purple' : 'green'}>
              {effectText(e)}
            </Chip>
          ))}
        </div>
      )}
      {t.species && (
        <div className="row wrap gap-s">
          {t.species.map((id) => (
            <Chip key={id} tone="olive">
              {SPECIES[id]?.common[0] ?? id}
            </Chip>
          ))}
          {extraUnlocks(t.id, t.species) > 0 && <Chip tone="purple">+{extraUnlocks(t.id, t.species)} more species</Chip>}
        </div>
      )}
      {t.req.length > 0 && st.status !== 'done' && (
        <div className="faint" style={{ fontSize: 11.5 }}>
          Needs:{' '}
          {t.req.map((r, i) => (
            <span key={r} className={s.done[r] !== undefined ? 'green' : 'red'}>
              {i > 0 && ', '}
              {TECH_BY_ID[r]?.name ?? r}
            </span>
          ))}
        </div>
      )}
      {st.status === 'locked' && st.why && <div className="faint" style={{ fontSize: 11.5 }}>{st.why}</div>}
      {st.status !== 'done' && (
        <>
          <div className="tech-cost">
            <span className={s.rp >= t.rp ? 'glass' : 'red'}>{t.rp} RP</span>
            <span className={s.money >= t.money ? 'gold' : 'red'}>{money(t.money)}</span>
            <span className="muted">{dur(t.time / speed)}</span>
          </div>
          {st.status === 'available' && (
            <Btn small kind="primary" disabled={!afford || !slots} onClick={() => act((g) => startProject(g, t.id))} title={!slots ? 'All project slots are busy' : undefined}>
              Research
            </Btn>
          )}
        </>
      )}
    </div>
  );
}
