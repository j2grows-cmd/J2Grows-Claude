// Legacy: the prestige system. Reset the operation for permanent bonuses and extra research.

import { CHALLENGES, CHALLENGE_BY_ID, LEGACY, buyLegacy, canPrestige, discoveryCount, legacyCost, legacyGain, prestige } from '../../engine';
import { useState } from 'react';
import { act, askConfirm, setUi, useGame } from '../../store';
import { Bar, Btn, Chip, Empty, Hint, Icon, PageHead, Panel, Stat } from '../kit';
import { money, num } from '../format';

export function Legacy() {
  const s = useGame();
  const can = canPrestige(s);
  const base = legacyGain(s);
  const [pick, setPick] = useState('');
  const active = CHALLENGE_BY_ID[s.challenge];
  const gain = active ? Math.floor(base * (1 + active.bonus)) : base;
  const cleared = s.legacy.cleared ?? [];
  return (
    <div className="page">
      <PageHead
        title="Legacy"
        blurb="When your institution has done all it can, hand it on. A legacy reset returns you to a small growing room but keeps your discoveries, collection and permanent bonuses — and each run goes further than the last."
        right={<Chip tone="purple">{s.legacy.runs} completed run{s.legacy.runs === 1 ? '' : 's'}</Chip>}
      />
      <div className="stats-row" style={{ marginBottom: 16 }}>
        <Stat label="Legacy points" value={s.legacy.points} tone="purple" sub={`${s.legacy.spent} spent in total`} />
        <Stat label="Earned this run" value={money(s.stats.earnedRun)} tone="gold" />
        <Stat label="Points on reset" value={can.ok ? `+${gain}` : '—'} tone="purple" sub={active ? `includes +${Math.round(active.bonus * 100)}% challenge bonus` : `${Math.max(0, discoveryCount(s) - (s.legacy.discPaid ?? 0))} new discoveries count too`} />
      </div>
      {active && (
        <div className="notice info" role="status" style={{ marginBottom: 16 }}>
          <b>Challenge run: {active.name}.</b> {active.blurb} Reach the next reset to clear it for +{Math.round(active.bonus * 100)}% legacy points.
        </div>
      )}
      <div className="grid g-main">
        <Panel title="Permanent upgrades" icon="legacy">
          <div className="list">
            {LEGACY.map((l) => {
              const lvl = s.legacy.ups[l.id] ?? 0;
              const maxed = lvl >= l.max;
              const cost = legacyCost(l, lvl);
              return (
                <div className="item" key={l.id}>
                  <div className="grow-1">
                    <div className="row between">
                      <span className="item-title">{l.name}</span>
                      <span className="muted num" style={{ fontSize: 12 }}>{lvl}/{l.max}</span>
                    </div>
                    <div className="item-sub">{l.desc}</div>
                    <Bar value={lvl} max={l.max} thin tone="purple" />
                  </div>
                  <Btn small kind="primary" disabled={maxed || s.legacy.points < cost} onClick={() => act((g) => buyLegacy(g, l.id))}>
                    {maxed ? 'Max' : `${cost} pt${cost === 1 ? '' : 's'}`}
                  </Btn>
                </div>
              );
            })}
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Begin a new run" icon="arrow">
            {!can.ok ? (
              <Empty icon="lock">{can.why}</Empty>
            ) : (
              <>
                <h2 style={{ marginBottom: 6 }}>+{gain} legacy points</h2>
                <p className="muted">You will start again from a small growing room with a fresh stock of cash.</p>
                <div className="grid g2" style={{ gap: 10 }}>
                  <div>
                    <h3 style={{ marginBottom: 6 }}>Resets</h3>
                    <ul className="reqs">
                      {['Money and research points', 'Plants, rooms and staff', 'Facility stage and upgrades', 'Most technologies'].map((x) => <li key={x} className="req"><Icon name="x" size={12} /> {x}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ marginBottom: 6 }}>Kept</h3>
                    <ul className="reqs">
                      {['Discoveries and collection', 'Cultivars and royalties', 'Legacy upgrades', 'Statistics'].map((x) => <li key={x} className="req met"><Icon name="check" size={12} /> {x}</li>)}
                    </ul>
                  </div>
                </div>
                <h3 style={{ margin: '14px 0 6px' }}>Next run</h3>
                <div className="challenges" role="radiogroup" aria-label="Choose how the next run starts">
                  <button type="button" role="radio" aria-checked={pick === ''} className={`challenge${pick === '' ? ' on' : ''}`} onClick={() => setPick('')}>
                    <b>Standard</b>
                    <span>A normal run with all your legacy upgrades.</span>
                  </button>
                  {CHALLENGES.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={pick === c.id} className={`challenge${pick === c.id ? ' on' : ''}`} onClick={() => setPick(c.id)}>
                      <b>{c.name} {cleared.includes(c.id) && <Chip tone="gold">cleared</Chip>}</b>
                      <span>{c.blurb}</span>
                      <em>Clear it for +{Math.round(c.bonus * 100)}% legacy points</em>
                    </button>
                  ))}
                </div>
                <div className="mt">
                  <Btn kind="gold" icon="legacy" onClick={() => askConfirm('Your facility, plants, staff and most research reset. Discoveries, the collection, cultivars and legacy upgrades stay.' + (pick ? ` The next run is the ${CHALLENGE_BY_ID[pick].name} challenge.` : ''), () => act((g) => prestige(g, pick)), { title: `Reset for +${gain} legacy points?`, confirm: 'Hand on the legacy' })}>
                    Hand on the legacy
                  </Btn>
                </div>
              </>
            )}
          </Panel>
          <Panel title="How points are earned" icon="info">
            <Hint>Legacy points grow with the square root of the money you earn in a run, plus a bonus for every eight discoveries made since your last reset. Resets pay off best once you can earn far more than the last time.</Hint>
            <Hint>Synthetic Botany opens a seventh research branch; the Legacy Species Pack unlocks three legendary plants.</Hint>
            <Btn small onClick={() => setUi({ view: 'research' })}>Open research ({num(s.rp)} RP)</Btn>
          </Panel>
        </div>
      </div>
    </div>
  );
}
