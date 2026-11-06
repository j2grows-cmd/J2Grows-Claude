// The dashboard: stage progress, things that need attention, running work and the lab log.

import {
  STAGES, TECH_BY_ID, advanceStage, careRoom, discoveryCount, effectiveSpecies, plantValue, rpRate, sellPlant, stageRequirements, totalWages, tendRate,
  type GameState,
} from '../../engine';
import { act, setUi, toast, useGame } from '../../store';
import { Bar, Btn, Chip, Empty, Icon, PageHead, Panel, Req, Stat } from '../kit';
import { PlantArt } from '../PlantArt';
import { Banner, BrandImage } from '../HeroArt';
import { BRAND } from '../artwork';
import { brandColourFrom } from '../brand';
import { SPECIES, SPECIES_LIST } from '../../engine';
import { dur, money, num } from '../format';

export function Overview() {
  const s = useGame();
  const stage = STAGES[s.stage - 1];
  const reqs = stageRequirements(s);
  const allMet = !!reqs && reqs.every((r) => r.met);

  const mature = s.plants.filter((p) => p.stage === 'mature' && !p.mother && !p.keeper);
  const matureValue = mature.reduce((a, p) => a + plantValue(s, p), 0);
  const thirsty = s.plants.filter((p) => p.hydration < effectiveSpecies(p.sp, p.hy).env.dryBack).length;
  const sick = s.plants.filter((p) => p.inf).length;
  const failing = s.plants.filter((p) => p.health < 35).length;
  const free = s.rooms.reduce((a, r) => a + r.slots.filter((x) => x == null).length, 0);
  const net = s.income - s.expense;
  const wages = totalWages(s);
  const seenSp = Object.keys(s.seen).filter((k) => SPECIES[k]).length;

  const sellMature = (): void => {
    let total = 0;
    let n = 0;
    act((g) => {
      for (const p of [...g.plants]) {
        if (p.stage !== 'mature' || p.mother || p.keeper) continue;
        const v = plantValue(g, p);
        if (sellPlant(g, p).ok) {
          total += v;
          n++;
        }
      }
    }, true);
    if (n) toast(`Sold ${n} plant${n > 1 ? 's' : ''} for ${money(total)}.`, 'good');
  };

  const attention: { icon: string; tone: string; text: string; action?: () => void; label?: string }[] = [];
  if (mature.length) attention.push({ icon: 'coin', tone: 'gold', text: `${mature.length} mature plant${mature.length > 1 ? 's' : ''} ready to sell (${money(matureValue)})`, action: sellMature, label: 'Sell all' });
  if (sick) attention.push({ icon: 'warn', tone: 'red', text: `${sick} infected plant${sick > 1 ? 's' : ''}`, action: () => s.rooms.forEach((r) => act((g) => careRoom(g, r.id, 'treat'), true)), label: 'Treat all' });
  if (thirsty) attention.push({ icon: 'drop', tone: 'glass', text: `${thirsty} plant${thirsty > 1 ? 's are' : ' is'} thirsty`, action: () => s.rooms.forEach((r) => act((g) => careRoom(g, r.id, 'water'), true)), label: 'Water all' });
  if (failing) attention.push({ icon: 'heart', tone: 'red', text: `${failing} plant${failing > 1 ? 's' : ''} failing (health under 35)`, action: () => setUi({ view: 'cultivation' }), label: 'Inspect' });
  if (free) attention.push({ icon: 'plant', tone: 'green', text: `${free} empty slot${free > 1 ? 's' : ''}${s.props.length ? ` · ${s.props.length} item${s.props.length > 1 ? 's' : ''} on the bench` : ''}`, action: () => setUi({ view: s.props.length ? 'cultivation' : 'market' }), label: s.props.length ? 'Plant' : 'Shop' });
  const expiring = s.market.contracts.filter((c) => c.expires - s.time < 180);
  if (expiring.length) attention.push({ icon: 'star', tone: 'purple', text: `${expiring.length} collector contract${expiring.length > 1 ? 's' : ''} expiring soon`, action: () => setUi({ view: 'market' }), label: 'View' });

  return (
    <div className="page">
      <Banner file={BRAND.bannerLogo} className="banner-top" onReady={(im) => brandColourFrom(im, 2)} />
      <PageHead title="Overview" blurb="Grow. Discover. Experiment. Evolve." right={<Chip tone="muted">Day {Math.floor(s.totalTime / 60) + 1}</Chip>} />

      <div className="hero" style={{ marginBottom: 16 }}>
        <BrandImage file={BRAND.banner} width={1200} className="hero-bg" onReady={(im) => brandColourFrom(im, 2)} />
        <div>
          <div className="row gap-s" style={{ marginBottom: 6 }}>
            <Chip tone="green">Stage {s.stage} of {STAGES.length}</Chip>
            {s.legacy.runs > 0 && <Chip tone="purple">Legacy run {s.legacy.runs + 1}</Chip>}
          </div>
          <h2>{stage.name}</h2>
          <p className="muted" style={{ maxWidth: 560 }}>{stage.blurb}</p>
          {reqs ? (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                To reach <b style={{ color: 'var(--text)' }}>{STAGES[s.stage].name}</b>:
              </div>
              <ul className="reqs">
                {reqs.map((r) => (
                  <Req key={r.label} ok={r.met} have={r.have}>
                    {r.label}
                  </Req>
                ))}
              </ul>
              <div style={{ marginTop: 14 }}>
                <Btn kind="primary" icon="arrow" disabled={!allMet} onClick={() => act((g) => advanceStage(g))}>
                  Expand to {STAGES[s.stage].name}
                </Btn>
              </div>
            </div>
          ) : (
            <p className="olive" style={{ marginTop: 12 }}>You run the most advanced botanical institution in the world. Consider a Legacy reset to reach even further.</p>
          )}
        </div>
        <div className="hero-art">
          <PlantArt sp="monstera-adansonii" growth={1} seed={7} height={150} glow />
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <Stat label="Net income" value={<span className={Math.abs(net) < 0.005 ? '' : net > 0 ? 'green' : 'red'}>{net < -0.005 ? '−' : net > 0.005 ? '+' : ''}{money(Math.abs(net))}/s</span>} sub={`${money(s.income)} in · ${money(s.expense)} out`} />
        <Stat label="Research rate" value={`${rpRate(s).toFixed(2)}/s`} sub={`${num(s.rp)} RP banked`} tone="blue" />
        <Stat label="Plants growing" value={s.plants.length} sub={`${s.stats.matured} matured · ${s.stats.sold} sold`} />
        <Stat label="Discoveries" value={discoveryCount(s)} sub={`${seenSp}/${SPECIES_LIST.length} species seen`} tone="purple" />
        <Stat label="Tending" value={`${tendRate(s).toFixed(1)}/s`} sub={wages > 0 ? `Wages ${money(wages)}/s` : 'Manual care'} />
      </div>

      <div className="grid g-main">
        <div className="stack">
          <Guide s={s} />
          <Panel title="Needs attention" icon="warn">
            {attention.length === 0 ? (
              <Empty icon="check">All quiet. Your plants are comfortable — plan your next experiment.</Empty>
            ) : (
              <div className="list">
                {attention.map((a, i) => (
                  <div className="item" key={i}>
                    <Icon name={a.icon} className={a.tone} />
                    <span className="grow-1">{a.text}</span>
                    {a.action && (
                      <Btn small onClick={a.action}>
                        {a.label}
                      </Btn>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Laboratory work in progress" icon="flask">
            <Work s={s} />
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Lab log" icon="info">
            <div className="log">
              {[...s.log].reverse().slice(0, 40).map((l) => (
                <div key={l.id} className={l.kind}>
                  <time>{dur(s.time - l.t)}</time>
                  <span>{l.msg}</span>
                </div>
              ))}
              {s.log.length === 0 && <span className="faint">Nothing has happened yet.</span>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Work({ s }: { s: GameState }) {
  const rows: { key: string; label: string; sub: string; value: number; max: number; tone: 'blue' | 'green' | 'purple' | 'gold' | 'olive' }[] = [];
  for (const a of s.active) rows.push({ key: `r${a.id}`, label: TECH_BY_ID[a.id]?.name ?? a.id, sub: `Research · ${dur(a.total - a.progress)} left`, value: a.progress, max: a.total, tone: 'blue' });
  for (const j of s.jobs.breeding) rows.push({ key: `b${j.id}`, label: `${j.nameA} × ${j.nameB}`, sub: `Pollination · ${j.seeds} seeds expected`, value: j.progress, max: j.total, tone: 'olive' });
  for (const j of s.jobs.analysis) rows.push({ key: `a${j.id}`, label: s.plants.find((p) => p.id === j.plant)?.name ?? 'Plant', sub: `Genetic analysis (level ${j.level})`, value: j.progress, max: j.total, tone: 'purple' });
  for (const j of s.jobs.cloning) rows.push({ key: `c${j.id}`, label: j.name, sub: `Cloning · ${j.n} copies`, value: j.progress, max: j.total, tone: 'green' });
  for (const j of s.jobs.tissue) rows.push({ key: `t${j.id}`, label: j.srcName, sub: `Tissue culture · phase ${j.phase + 1}/4`, value: j.progress, max: j.total, tone: 'gold' });
  if (!rows.length) return <Empty icon="flask">No research, breeding or lab jobs are running. Start a research project to unlock new techniques.</Empty>;
  return (
    <div className="list">
      {rows.map((r) => (
        <div className="item" key={r.key}>
          <div className="grow-1">
            <div className="row between">
              <span className="item-title">{r.label}</span>
              <span className="muted num" style={{ fontSize: 12 }}>{Math.round((r.value / r.max) * 100)}%</span>
            </div>
            <div className="item-sub">{r.sub}</div>
            <Bar value={r.value} max={r.max} tone={r.tone} thin />
          </div>
        </div>
      ))}
    </div>
  );
}

function Guide({ s }: { s: GameState }) {
  const steps: { text: string; done: boolean; view?: string; label?: string }[] = [
    { text: 'Buy seeds or a young plant at the Market.', done: s.plants.length + s.props.length + s.stats.sold > 0, view: 'market', label: 'Market' },
    { text: 'Plant them in a grow-room slot (Cultivation → empty slot).', done: s.plants.length + s.stats.sold > 0, view: 'cultivation', label: 'Cultivation' },
    { text: 'Keep them watered and fed. Click a plant to see exactly what it wants.', done: s.stats.matured > 0, view: 'cultivation', label: 'Care' },
    { text: 'Sell your first mature plant.', done: s.stats.sold > 0, view: 'cultivation', label: 'Sell' },
    { text: 'Start a research project — new techniques unlock everything else.', done: Object.keys(s.done).length > 0 || s.active.length > 0, view: 'research', label: 'Research' },
    { text: 'Meet the requirements to expand to the Propagation Facility.', done: s.stage >= 2 },
  ];
  if (steps.every((x) => x.done) || s.stage >= 3) return null;
  const nextIdx = steps.findIndex((x) => !x.done);
  return (
    <Panel title="Getting started" icon="star" sub={`${steps.filter((x) => x.done).length}/${steps.length}`}>
      <ul className="reqs">
        {steps.map((st, i) => (
          <Req key={st.text} ok={st.done}>
            <span style={{ color: st.done ? 'var(--muted)' : 'var(--text)', textDecoration: st.done ? 'line-through' : 'none' }}>{st.text}</span>
            {i === nextIdx && st.view && (
              <span style={{ marginLeft: 10 }}>
                <Btn small kind="primary" onClick={() => setUi({ view: st.view! })}>
                  {st.label}
                </Btn>
              </span>
            )}
          </Req>
        ))}
      </ul>
    </Panel>
  );
}
