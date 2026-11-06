// Goals: what to do next, achievements and plant shows.

import {
  ACHIEVEMENTS, SHOW_OPEN_SECONDS, plantValue, SHOW_THEMES, THEMES, achievementCount, advisor, enterShow, guideProgress, showCandidates, title as lab_title, withdrawEntry,
  type Achievement, type GameState,
} from '../../engine';
import { act, setTab, setUi, useGame, useUi } from '../../store';
import { Bar, Btn, Chip, Empty, Hint, Icon, PageHead, Panel, Tabs } from '../kit';
import { PlantThumb } from '../plantbits';
import { setPrefs, usePrefs } from '../prefs';
import { dur, money, num } from '../format';

export function Goals() {
  const s = useGame();
  const ui = useUi();
  const tab = ui.tab.goals ?? 'next';
  const open = s.shows.open;
  return (
    <div className="page">
      <PageHead title="Goals" blurb="What to do next, what you have achieved, and the plant show circuit." right={lab_title(s) ? <Chip tone="gold">{lab_title(s)}</Chip> : undefined} />
      <Tabs
        value={tab}
        onChange={(t) => setTab('goals', t)}
        tabs={[
          { id: 'next', label: 'Next steps' },
          { id: 'ach', label: 'Achievements', badge: `${achievementCount(s)}/${ACHIEVEMENTS.length}` },
          { id: 'shows', label: 'Shows', badge: open ? 'open' : undefined },
        ]}
      />
      {tab === 'next' && <Next s={s} />}
      {tab === 'ach' && <Achievements s={s} />}
      {tab === 'shows' && <Shows s={s} />}
    </div>
  );
}

export function AdviceList({ s, max = 5 }: { s: GameState; max?: number }) {
  const list = advisor(s, max);
  return (
    <div className="list">
      {list.map((a) => (
        <div className={`item advice advice-${a.tone}`} key={a.id}>
          <Icon name={a.tone === 'urgent' ? 'warn' : a.tone === 'good' ? 'star' : a.tone === 'do' ? 'arrow' : 'info'} />
          <div className="grow-1">
            <div className="item-title">{a.title}</div>
            <div className="item-sub">{a.body}</div>
          </div>
          {a.view && (
            <Btn small onClick={() => setUi({ view: a.view! })}>
              Go
            </Btn>
          )}
        </div>
      ))}
    </div>
  );
}

function Next({ s }: { s: GameState }) {
  const g = guideProgress(s);
  const prefs = usePrefs();
  return (
    <div className="grid g2">
      <Panel title="What to do now" icon="arrow" sub="updates as you play">
        <AdviceList s={s} max={8} />
      </Panel>
      <div className="stack">
        <Panel title="The opening guide" icon="star" sub={`${g.doneCount}/${g.steps.length}`}>
          <ul className="reqs">
            {g.steps.map((st, i) => (
              <li key={st.id} className={`req${st.done ? ' met' : ''}`}>
                <Icon name={st.done ? 'check' : 'x'} size={13} />
                <span>
                  <b style={{ color: st.done ? 'var(--muted)' : 'var(--text)' }}>{st.title}</b>
                  {i === g.current && <span className="item-sub" style={{ display: 'block' }}>{st.body}</span>}
                </span>
                {i === g.current && (
                  <Btn small kind="primary" onClick={() => setUi({ view: st.view })}>
                    Go
                  </Btn>
                )}
              </li>
            ))}
          </ul>
          <label className="check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={prefs.guide} onChange={(e) => setPrefs({ guide: e.target.checked })} /> Show the guide on the Overview
          </label>
        </Panel>
      </div>
    </div>
  );
}

function Achievements({ s }: { s: GameState }) {
  const groups = [...new Set(ACHIEVEMENTS.map((a) => a.group))];
  const prefs = usePrefs();
  const count = achievementCount(s);
  return (
    <div className="stack">
      <Panel title="Laboratory themes" icon="star" sub="unlocked by achievements">
        <div className="row wrap" style={{ gap: 8 }}>
          {THEMES.map((t) => {
            const locked = count < t.need;
            return (
              <button key={t.id} type="button" disabled={locked} className={`theme-chip${prefs.theme === t.id ? ' on' : ''}`} data-swatch={t.id} onClick={() => setPrefs({ theme: t.id })}>
                <i className="swatch" />
                {t.name}
                {locked && <small>{t.need} achievements</small>}
              </button>
            );
          })}
        </div>
        <Hint>Achievements never change prices, growth or research: they are marks of progress and they unlock these colour themes. They are kept across legacy resets.</Hint>
      </Panel>
      {groups.map((grp) => (
        <Panel key={grp} title={grp} icon="star" sub={`${ACHIEVEMENTS.filter((a) => a.group === grp && s.ach[a.id] != null).length}/${ACHIEVEMENTS.filter((a) => a.group === grp).length}`}>
          <div className="ach-grid">
            {ACHIEVEMENTS.filter((a) => a.group === grp).map((a) => (
              <Ach key={a.id} a={a} s={s} />
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Ach({ a, s }: { a: Achievement; s: GameState }) {
  const done = s.ach[a.id] != null;
  const [have, need] = a.goal(s);
  return (
    <div className={`ach${done ? ' done' : ''}`}>
      <Icon name={done ? 'check' : 'star'} size={16} />
      <div className="grow-1">
        <div className="item-title">{a.name}</div>
        <div className="item-sub">{a.desc}</div>
        {!done && need > 1 && <Bar value={have} max={need} thin tone="olive" label={`${num(have, 0)} / ${num(need, 0)}`} />}
      </div>
    </div>
  );
}

function Shows({ s }: { s: GameState }) {
  const show = s.shows.open;
  const cands = show ? showCandidates(s, 8) : [];
  const left = show ? Math.max(0, show.closes - s.time) : 0;
  const entry = show?.entry != null ? s.plants.find((p) => p.id === show.entry) : undefined;
  return (
    <div className="grid g2">
      <Panel title={show ? show.name : 'Plant shows'} icon="star" sub={show ? `closes in ${dur(left)}` : s.stage < 2 ? 'from Stage 2' : `next in about ${dur(Math.max(0, s.shows.next - s.time))}`}>
        {!show ? (
          <Empty icon="star">
            {s.stage < 2 ? 'Shows begin once you reach Stage 2.' : 'No show is open. A show opens every half hour or so for ten minutes, but never while you are away. Keep a few mature, healthy plants ready.'}
          </Empty>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <p className="muted">{SHOW_THEMES[show.theme].blurb}</p>
            <Bar value={SHOW_OPEN_SECONDS - left} max={SHOW_OPEN_SECONDS} thin tone="gold" />
            {entry ? (
              <div className="item">
                <div style={{ width: 52 }}>
                  <PlantThumb p={entry} height={52} bare />
                </div>
                <div className="grow-1">
                  <div className="item-title">Entered: {entry.name}</div>
                  <div className="item-sub">Judged when the show closes, so keep it healthy.</div>
                </div>
                <Btn small kind="ghost" onClick={() => act((g) => withdrawEntry(g), true)}>
                  Withdraw
                </Btn>
              </div>
            ) : (
              <p className="gold">You have not entered yet.</p>
            )}
            <div className="muted" style={{ fontSize: 12 }}>Your best candidates (score out of 100). Rivals at this stage score roughly {Math.round(show.rivals[0])}–{Math.round(Math.max(...show.rivals))}.</div>
            {cands.length === 0 && <Empty icon="plant">No eligible plants. {show.theme === 'hybrid' ? 'This show is for hybrids only.' : 'Only mature plants growing in a room can be entered.'}</Empty>}
            <div className="list">
              {cands.map((c) => (
                <div className="item" key={c.plant.id}>
                  <div style={{ width: 44 }}>
                    <PlantThumb p={c.plant} height={44} bare />
                  </div>
                  <div className="grow-1">
                    <div className="item-title">{c.plant.name}</div>
                    <div className="item-sub">Score {c.score.toFixed(0)} · worth {money(plantValue(s, c.plant))}</div>
                  </div>
                  <Btn small kind={show.entry === c.plant.id ? 'ghost' : 'primary'} disabled={show.entry === c.plant.id} onClick={() => act((g) => enterShow(g, c.plant.id))}>
                    {show.entry === c.plant.id ? 'Entered' : 'Enter'}
                  </Btn>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Results" icon="book" sub={`${s.stats.showWins ?? 0} won · ${s.stats.shows ?? 0} entered`}>
        {s.shows.hist.length === 0 ? (
          <Empty icon="book">No shows yet. Prizes are modest (a share of the plant’s value plus reputation); the real reward is the rosette.</Empty>
        ) : (
          <div className="list">
            {s.shows.hist.slice(0, 12).map((h) => (
              <div className="item" key={h.id + ':' + h.t}>
                <Chip tone={h.place === 1 ? 'gold' : h.place === 0 ? 'muted' : h.place <= 3 ? 'green' : 'default'}>{h.place === 0 ? 'missed' : ['', '1st', '2nd', '3rd', '4th'][h.place]}</Chip>
                <div className="grow-1">
                  <div className="item-title">{h.name}</div>
                  <div className="item-sub">{h.place === 0 ? 'No entry' : `${h.plantName} · score ${h.score.toFixed(0)}${h.prize ? ` · prize ${money(h.prize)}` : ''}`}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
