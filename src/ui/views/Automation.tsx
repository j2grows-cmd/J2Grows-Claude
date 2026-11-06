// Automation: what the machines and staff do on their own, and the rules for auto-selling.

import { ROLES, growerRate, tendRate, totalWages, type GameState } from '../../engine';
import { act, setUi, useGame } from '../../store';
import { Btn, Chip, Hint, Icon, PageHead, Panel, Stat } from '../kit';
import { money } from '../format';

const AUTOS: { key: string; flag: string; name: string; desc: string; tech: string }[] = [
  { key: 'water', flag: 'autoWater', name: 'Watering', desc: 'Waters every plant when it gets thirsty.', tech: 'Automated Watering Lines' },
  { key: 'feed', flag: 'autoFeed', name: 'Fertigation', desc: 'Feeds plants that are running low on nutrients.', tech: 'Automated Fertigation' },
  { key: 'treat', flag: 'autoTreat', name: 'Pest & disease treatment', desc: 'Treats infections before they spread.', tech: 'Integrated Pest Management' },
  { key: 'env', flag: 'autoEnv', name: 'Environment management', desc: 'Retunes every room to its plants every 20 seconds and tightens climate stability.', tech: 'Automated Environmental Management' },
  { key: 'analyse', flag: 'autoAnalyse', name: 'Phenotyping & analysis', desc: 'Queues genetic scans for promising plants.', tech: 'Automated Phenotyping' },
  { key: 'plant', flag: 'autoPlant', name: 'Potting', desc: 'Plants anything on the bench into free slots.', tech: 'Robotic Potting' },
  { key: 'propagate', flag: 'autoPropagate', name: 'Propagation', desc: 'Takes cuttings from mother plants.', tech: 'Automated Propagation Cells' },
  { key: 'harvest', flag: 'autoHarvest', name: 'Harvesting', desc: 'Moves mature plants into sale stock to free up slots.', tech: 'Robotic Harvesting' },
  { key: 'sell', flag: 'autoSell', name: 'Sales', desc: 'Sells stock according to the rules below.', tech: 'Automated Sales Platform' },
  { key: 'tissue', flag: 'autoTissue', name: 'Tissue culture', desc: 'Starts new culture batches from mother plants.', tech: 'Tissue-Culture Robotics' },
];

export function Automation() {
  const s = useGame();
  const f = s.mods.flags;
  const rules = s.auto.sell;
  const set = (fn: (g: GameState) => void) => act((g) => void fn(g), true);
  const hasStaffTending = growerRate(s) > 0;
  const unlocked = AUTOS.filter((a) => f[a.flag] || (['water', 'feed', 'treat'].includes(a.key) && hasStaffTending)).length;
  return (
    <div className="page">
      <PageHead title="Automation" blurb="Machines and staff keep the lab running while you are away. Everything here also runs during offline progress." />
      <div className="stats-row" style={{ marginBottom: 16 }}>
        <Stat label="Actions per second" value={tendRate(s).toFixed(2)} sub="shared across all automations" tone="blue" />
        <Stat label="Systems online" value={`${unlocked}/${AUTOS.length}`} />
        <Stat label="Wage bill" value={`${money(totalWages(s))}/s`} sub={`${s.staff.length} staff`} />
        <Stat label="Action budget" value={s.auto.budget.toFixed(1)} />
      </div>
      <div className="grid g-main">
        <Panel title="Systems" icon="bolt">
          <div className="list">
            {AUTOS.map((a) => {
              const has = !!f[a.flag] || (['water', 'feed', 'treat'].includes(a.key) && hasStaffTending);
              const on = s.auto.on[a.key] !== false;
              return (
                <div className={`item${has ? '' : ' dim'}`} key={a.key}>
                  <Icon name={has ? 'bolt' : 'lock'} className={has && on ? 'green' : ''} />
                  <div className="grow-1">
                    <div className="item-title">{a.name}</div>
                    <div className="item-sub">{has ? a.desc : `Research: ${a.tech}${['water', 'feed', 'treat'].includes(a.key) ? ' — or hire a Grower' : ''}`}</div>
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={has && on} disabled={!has} onChange={(e) => set((g) => { g.auto.on[a.key] = e.target.checked; })} aria-label={`Toggle ${a.name}`} />
                    <span className="muted">{has ? (on ? 'On' : 'Off') : 'Locked'}</span>
                  </label>
                </div>
              );
            })}
          </div>
          {unlocked < AUTOS.length && (
            <div className="mt-s"><Btn small onClick={() => setUi({ view: 'research' })}>Open research</Btn></div>
          )}
        </Panel>
        <div className="stack">
          <Panel title="Auto-sell rules" icon="coin" right={!f.autoSell && <Chip tone="muted">needs Automated Sales</Chip>}>
            <div className="stack" style={{ gap: 12 }}>
              <div className="row between">
                <label htmlFor="minv">Minimum value to sell</label>
                <input id="minv" type="number" min={0} step={5} value={rules.minValue} onChange={(e) => set((g) => { g.auto.sell.minValue = Math.max(0, Number(e.target.value) || 0); })} style={{ width: 110 }} />
              </div>
              <div className="row between">
                <label htmlFor="hold">Hold when demand is below</label>
                <span className="row gap-s">
                  <input id="hold" type="range" min={0.5} max={1.2} step={0.05} value={rules.holdForIndex} onChange={(e) => set((g) => { g.auto.sell.holdForIndex = Number(e.target.value); })} style={{ width: 140 }} />
                  <span className="num" style={{ width: 40 }}>{Math.round(rules.holdForIndex * 100)}%</span>
                </span>
              </div>
              <div className="row between">
                <label htmlFor="maxsp">Keep at most N mature per species (0 = no limit)</label>
                <input id="maxsp" type="number" min={0} max={20} value={rules.maxPerSpecies} onChange={(e) => set((g) => { g.auto.sell.maxPerSpecies = Math.max(0, Number(e.target.value) || 0); })} style={{ width: 80 }} />
              </div>
              <div className="row between">
                <label htmlFor="keeprare">Never sell species of rarity ≥</label>
                <select id="keeprare" value={rules.keepRarity} onChange={(e) => set((g) => { g.auto.sell.keepRarity = Number(e.target.value); })}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n === 6 ? 'Sell everything' : `${'★'.repeat(n)}`}</option>)}
                </select>
              </div>
              <label className="check"><input type="checkbox" checked={rules.keepAnalysed} onChange={(e) => set((g) => { g.auto.sell.keepAnalysed = e.target.checked; })} /> Keep plants that have been analysed</label>
              <label className="check"><input type="checkbox" checked={rules.keepDiscoveries} onChange={(e) => set((g) => { g.auto.sell.keepDiscoveries = e.target.checked; })} /> Keep plants carrying discoveries</label>
              <Hint>Mother plants and keepers are never sold automatically.</Hint>
            </div>
          </Panel>
          <Panel title="Human tending" icon="users">
            <Hint>
              Growers add {ROLES.grower.desc.match(/\(([^)]+)\)/)?.[1] ?? 'tending actions'}. Without automation research they water, feed and treat plants by hand; with it they share the same action budget.
            </Hint>
            <Btn small onClick={() => setUi({ view: 'lab' })}>Manage staff</Btn>
          </Panel>
        </div>
      </div>
    </div>
  );
}
