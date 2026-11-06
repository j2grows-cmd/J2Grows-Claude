// Tissue culture department: sterile mass propagation in four phases.

import { useState } from 'react';
import {
  TC_PHASES, deptStatus, effectiveSpecies, startTissue, tcCap, tcCost, tcMaxCycles, tcPhaseTime, tcUnits, type GameState,
} from '../../engine';
import { act, setUi, useGame } from '../../store';
import { Bar, Btn, Chip, Empty, Hint, PageHead, Panel, Stat } from '../kit';
import { PlantThumb } from '../plantbits';
import { UpgradeList } from '../upgrades';
import { dur, money, pct } from '../format';

export function TissueCulture() {
  const s = useGame();
  const dept = deptStatus(s, 'tissue');
  const built = (s.upgrades.lvl_tissue ?? 0) >= 1;
  const cap = tcCap(s);
  return (
    <div className="page">
      <PageHead
        title="Tissue Culture"
        blurb="Grow whole plants from a few cells in sterile flasks. Slow to start, but a single healthy mother can become dozens of identical plantlets."
        right={<Chip tone={built ? 'green' : 'muted'}>Department level {s.upgrades.lvl_tissue ?? 0}</Chip>}
      />
      {!dept.unlocked && (
        <Panel title="Locked" icon="lock">
          <Empty icon="lock">{dept.why}</Empty>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Btn onClick={() => setUi({ view: 'research' })}>Open research</Btn>
          </div>
        </Panel>
      )}
      {dept.unlocked && !built && (
        <Panel title="Build the laboratory" icon="flask">
          <p className="muted">You have the technique. Build the Tissue Culture Laboratory to get your first culture bench.</p>
          <UpgradeList s={s} dept="tissue" />
        </Panel>
      )}
      {dept.unlocked && built && (
        <div className="grid g-main">
          <div className="stack">
            <div className="stats-row">
              <Stat label="Culture benches" value={`${s.jobs.tissue.length}/${cap}`} />
              <Stat label="Yield" value={`${s.mods.tcYield.toFixed(2)}×`} tone="green" />
              <Stat label="Speed" value={`${s.mods.tcSpeed.toFixed(2)}×`} tone="blue" />
              <Stat label="Contamination" value={pct(Math.min(1, 0.12 * s.mods.tcContam))} sub="of plantlets lost per cycle" />
              <Stat label="Max cycles" value={tcMaxCycles(s)} />
            </div>
            <NewCulture s={s} />
            <Panel title="Cultures in progress" icon="flask" sub={`${s.jobs.tissue.length}`}>
              {s.jobs.tissue.length === 0 ? (
                <Empty icon="flask">No cultures running. Choose a healthy mother plant above.</Empty>
              ) : (
                <div className="list">
                  {s.jobs.tissue.map((b) => (
                    <div className="item" key={b.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                      <div className="row between">
                        <div>
                          <div className="item-title">{b.srcName}</div>
                          <div className="item-sub">
                            {b.cycles} cycle{b.cycles > 1 ? 's' : ''} · expecting {b.units - b.lost} plantlets{b.lost > 0 && ` (${b.lost} lost to contamination)`}
                          </div>
                        </div>
                        <Chip tone="blue">{TC_PHASES[b.phase]}</Chip>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {TC_PHASES.map((ph, i) => (
                          <div key={ph}>
                            <div className="faint" style={{ fontSize: 10.5, marginBottom: 2, color: i === b.phase ? 'var(--glass)' : undefined }}>
                              {ph}
                            </div>
                            <Bar value={i < b.phase ? 1 : i === b.phase ? b.progress / b.total : 0} max={1} thin tone={i < b.phase ? 'green' : 'blue'} />
                          </div>
                        ))}
                      </div>
                      <div className="item-sub">{dur(b.total - b.progress)} left in this phase</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          <div className="stack">
            <Panel title="Department upgrades" icon="gear">
              <UpgradeList s={s} dept="tissue" />
            </Panel>
            <Panel title="How it works" icon="info">
              <Hint>
                Each batch passes through Initiation, Multiplication, Rooting and Acclimatisation. More multiplication cycles give exponentially more plantlets, but each phase risks contamination, and prolonged culture can introduce somaclonal variants — occasionally valuable, occasionally not.
              </Hint>
              <Hint>Finished plantlets arrive on the propagation bench, ready to plant.</Hint>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function NewCulture({ s }: { s: GameState }) {
  const eligible = s.plants.filter((p) => p.growth >= 0.4 && effectiveSpecies(p.sp, p.hy).prop.tissue > 0);
  const [id, setId] = useState<number | ''>('');
  const [cycles, setCycles] = useState(1);
  const p = eligible.find((x) => x.id === id) ?? null;
  const sp = p ? effectiveSpecies(p.sp, p.hy) : null;
  const time = [0, 1, 2, 3].reduce((a, ph) => a + tcPhaseTime(s, ph, cycles), 0);
  return (
    <Panel title="Start a culture" icon="plant">
      {eligible.length === 0 ? (
        <Empty>You need a plant that is at least 40% grown, from a species that tolerates tissue culture.</Empty>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'center' }}>
          <div style={{ height: 120 }}>{p ? <PlantThumb p={p} height={120} /> : <Empty>Choose a plant</Empty>}</div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="row wrap">
              <select value={id} onChange={(e) => setId(e.target.value ? Number(e.target.value) : '')} style={{ minWidth: 220 }}>
                <option value="">Select a mother plant…</option>
                {eligible.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({effectiveSpecies(x.sp, x.hy).common[0]}, {Math.round(x.growth * 100)}%)
                  </option>
                ))}
              </select>
              <select value={cycles} onChange={(e) => setCycles(Number(e.target.value))}>
                {Array.from({ length: tcMaxCycles(s) }, (_, i) => i + 1).map((c) => (
                  <option key={c} value={c}>
                    {c} multiplication cycle{c > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            {sp && (
              <div className="row wrap gap-s">
                <Chip tone="green">≈ {tcUnits(s, sp, cycles)} plantlets</Chip>
                <Chip tone="gold">{money(tcCost(sp, cycles))}</Chip>
                <Chip tone="blue">{dur(time)}</Chip>
              </div>
            )}
            <div>
              <Btn kind="primary" disabled={!p || s.jobs.tissue.length >= tcCap(s) + 4} onClick={() => p && act((g) => startTissue(g, p.id, cycles))}>
                Start culture
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
