// Application shell: navigation, resource bar, toasts and the welcome-back report.

import { useEffect, useState, type ReactNode } from 'react';
import { title as labTitle } from './engine';
import { PRESTIGE_STAGE, STAGES, discoveryCount, legacyGain, canPrestige, type GameState } from './engine';
import { closeAsk, dismissBeat, dismissBootNotice, dismissOffline, getAsk, getBeat, getBootNotice, getOffline, getSaveProblem, getToasts, isPrimary, save, setUi, takeOverTab, useGame, useUi } from './store';
import { setPrefs, usePrefs } from './ui/prefs';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { FeedbackModal, HelpModal } from './ui/Help';
import { Goals } from './ui/views/Goals';
import { Icon, Modal, Btn, Stat } from './ui/kit';
import { dur, money, num } from './ui/format';
import { PlantDetailHost } from './ui/PlantDetail';
import { Banner, BrandImage } from './ui/HeroArt';
import { BRAND } from './ui/artwork';
import { setFavicon } from './ui/brand';
import { Overview } from './ui/views/Overview';
import { Cultivation } from './ui/views/Cultivation';
import { TissueCulture } from './ui/views/TissueCulture';
import { Genetics } from './ui/views/Genetics';
import { Research } from './ui/views/Research';
import { Laboratory } from './ui/views/Laboratory';
import { Market } from './ui/views/Market';
import { Collection } from './ui/views/Collection';
import { Automation } from './ui/views/Automation';
import { Legacy } from './ui/views/Legacy';
import { Settings } from './ui/views/Settings';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  locked?: (s: GameState) => string | null;
  pip?: (s: GameState) => { n: number; red?: boolean } | null;
  view: () => ReactNode;
}

const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'overview', view: () => <Overview />, pip: (s) => {
    const n = s.plants.filter((p) => p.inf || p.health < 35).length;
    return n ? { n, red: true } : null;
  } },
  { id: 'cultivation', label: 'Cultivation', icon: 'grow', view: () => <Cultivation />, pip: (s) => {
    const n = s.plants.filter((p) => p.stage === 'mature' && !p.mother && !p.keeper).length;
    return n ? { n } : null;
  } },
  { id: 'tissue', label: 'Tissue Culture', icon: 'flask', view: () => <TissueCulture />, locked: (s) => (s.stage < 2 ? 'Stage 2' : null) },
  { id: 'genetics', label: 'Genetics', icon: 'dna', view: () => <Genetics />, locked: (s) => (s.stage < 3 ? 'Stage 3' : null) },
  { id: 'goals', label: 'Goals', icon: 'star', view: () => <Goals />, pip: (s) => (s.shows.open && s.shows.open.entry == null ? { n: 1 } : null) },
  { id: 'research', label: 'Research', icon: 'research', view: () => <Research />, pip: (s) => (s.active.length ? { n: s.active.length } : null) },
  { id: 'lab', label: 'Laboratory', icon: 'lab', view: () => <Laboratory /> },
  { id: 'market', label: 'Market', icon: 'market', view: () => <Market />, pip: (s) => (s.market.contracts.length ? { n: s.market.contracts.length } : null) },
  { id: 'collection', label: 'Collection', icon: 'book', view: () => <Collection /> },
  { id: 'automation', label: 'Automation', icon: 'bolt', view: () => <Automation /> },
  { id: 'legacy', label: 'Legacy', icon: 'legacy', view: () => <Legacy />, locked: (s) => (s.stage < PRESTIGE_STAGE && s.legacy.runs === 0 ? `Stage ${PRESTIGE_STAGE}` : null), pip: (s) => (canPrestige(s).ok && legacyGain(s) > 0 ? { n: legacyGain(s) } : null) },
  { id: 'settings', label: 'Settings', icon: 'gear', view: () => <Settings /> },
];

export function App() {
  const s = useGame();
  const ui = useUi();
  const toasts = getToasts();
  const offline = getOffline();
  const cur = NAV.find((n) => n.id === ui.view) ?? NAV[0];
  const stage = STAGES[s.stage - 1];
  const locked = cur.locked?.(s);
  const prefs = usePrefs();
  const [help, setHelp] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const bootNotice = getBootNotice();
  const saveProblem = getSaveProblem();
  const beat = getBeat();
  const primary = isPrimary();
  const t = labTitle(s);

  return (
    <div className="app">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to the game</a>
      <nav className="side" aria-label="Main">
        <div className="brand">
          <div className="brand-mark">
            <BrandImage
              file={BRAND.logo} width={84} className="brand-logo" alt="J2Grows"
              onReady={(im) => setFavicon(im.currentSrc)}
              fallback={<Icon name="plant" size={20} />}
            />
          </div>
          <div>
            <div className="brand-name">J2Grows</div>
            <div className="brand-tag">{t || 'Botanical genetics'}</div>
          </div>
        </div>
        {NAV.map((n) => {
          const lock = n.locked?.(s);
          const pip = n.pip?.(s);
          return (
            <button key={n.id} type="button" className={`nav${ui.view === n.id ? ' on' : ''}${lock ? ' locked' : ''}`} aria-current={ui.view === n.id ? 'page' : undefined} onClick={() => setUi({ view: n.id })} title={lock ? `Unlocks at ${lock}` : undefined}>
              <Icon name={lock ? 'lock' : n.icon} />
              <span>{n.label}</span>
              {pip && <span className={`pip${pip.red ? ' red' : ''}`}>{pip.n > 99 ? '99+' : pip.n}</span>}
            </button>
          );
        })}
        <button type="button" className="side-feedback" onClick={() => setFeedback(true)}>Send feedback</button>
        <div className="side-foot">One-time purchase · no microtransactions</div>
      </nav>

      <header className="top">
        <div className="stage-pill">
          <b>{stage.name}</b>
          <span>
            Stage {s.stage} · {dur(s.totalTime)} played
          </span>
        </div>
        <div className="top-gap" />
        <button type="button" className="icon-btn help-btn" onClick={() => setHelp(true)} aria-label="How to play" title="How to play">
          <b>?</b>
        </button>
        <div className="res money" title="Money">
          <Icon name="coin" size={16} />
          <b>{money(s.money)}</b>
          <small>{Math.abs(s.income - s.expense) < 0.005 ? '' : s.income - s.expense > 0 ? '+' : '−'}{num(Math.abs(s.income - s.expense), 2)}/s</small>
        </div>
        <div className="res rp" title="Research points">
          <Icon name="rp" size={16} />
          <b>{num(s.rp)}</b>
          <small>RP</small>
        </div>
        <div className="res" title="Unique discoveries">
          <Icon name="star" size={16} />
          <b>{discoveryCount(s)}</b>
          <small>discoveries</small>
        </div>
        {s.legacy.points > 0 && (
          <div className="res legacy" title="Unspent legacy points">
            <Icon name="legacy" size={16} />
            <b>{s.legacy.points}</b>
            <small>legacy</small>
          </div>
        )}
      </header>

      <main className="main" id="main" tabIndex={-1}>
        {!primary && (
          <div className="notice warn" role="alert">
            <b>The game is open in another tab.</b> This tab is paused so the two cannot overwrite each other’s save.
            <button type="button" className="btn btn-primary btn-s" onClick={takeOverTab}>Use this tab instead</button>
          </div>
        )}
        {saveProblem && (
          <div className="notice bad" role="alert">
            <b>Your progress is not being saved.</b> {saveProblem.why}
            <button type="button" className="btn btn-s" onClick={() => { save(); }}>Try again</button>
            <button type="button" className="btn btn-s" onClick={() => setUi({ view: 'settings' })}>Export a copy</button>
          </div>
        )}
        {bootNotice && (
          <div className="notice info" role="status">
            {bootNotice.fromBackup > 0 ? <><b>Your latest save could not be read, so an earlier backup was loaded.</b> A little recent progress may be missing.</> : <><b>Your save was repaired on loading.</b> {bootNotice.repairs.slice(0, 2).join('; ')}.</>}
            <button type="button" className="btn btn-s btn-ghost" onClick={dismissBootNotice}>Dismiss</button>
          </div>
        )}
        <ErrorBoundary key={cur.id} label={cur.label} onReset={() => setUi({ view: 'overview' })}>
        {locked ? (
          <div className="page">
            <div className="panel">
              <div className="empty">
                <Icon name="lock" size={32} />
                <p>
                  <b>{cur.label}</b> unlocks at {locked}. Keep growing — check the Overview for what you need.
                </p>
                <Btn onClick={() => setUi({ view: 'overview' })}>Back to overview</Btn>
              </div>
            </div>
          </div>
        ) : (
          cur.view()
        )}
        </ErrorBoundary>
      </main>

      <PlantDetailHost />

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>

      <AskHost />
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
      {beat != null && <StageUp stage={beat} />}
      {prefs.telemetry === 'ask' && s.totalTime > 180 && !offline && beat == null && (
        <Modal
          title="Help improve J2Grows?"
          onClose={() => setPrefs({ telemetry: 'off' })}
          footer={
            <>
              <Btn kind="ghost" onClick={() => setPrefs({ telemetry: 'off' })}>No thanks</Btn>
              <Btn kind="primary" onClick={() => setPrefs({ telemetry: 'on' })}>Share anonymous statistics</Btn>
            </>
          }
        >
          <p className="muted">
            We would like to learn how long each part of the game takes, so we can fix the slow or confusing parts. If you agree, the game sends your stage, time played and a few counters
            (plants grown, research done) under a random id. No name, no email and no save data are ever sent, and you can switch it off in Settings at any time.
          </p>
        </Modal>
      )}

      {offline && (
        <Modal
          title="Welcome back"
          onClose={dismissOffline}
          footer={
            <Btn kind="primary" onClick={dismissOffline}>
              Back to the lab
            </Btn>
          }
        >
          <Banner file={BRAND.banner} width={900} className="banner-modal" />
          <p className="muted">
            You were away for {dur(offline.seconds)}. Your laboratory kept working for {dur(offline.credited)} at reduced efficiency (offline caps and efficiency can be raised through research and upgrades).
          </p>
          <div className="stats-row">
            <Stat label="Money" value={<span className={offline.money >= 0 ? 'gold' : 'red'}>{offline.money >= 0 ? '+' : '−'}{money(Math.abs(offline.money))}</span>} />
            <Stat label="Research" value={`+${num(offline.rp)} RP`} tone="blue" />
            <Stat label="Matured" value={offline.matured} tone="green" />
            <Stat label="Discoveries" value={offline.discoveries} tone="purple" />
            <Stat label="Techs done" value={offline.techs} />
            <Stat label="Lost" value={offline.died} sub={offline.neglected ? `${offline.neglected} need care` : undefined} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function StageUp({ stage }: { stage: number }) {
  const def = STAGES[stage - 1];
  return (
    <Modal title={`Stage ${stage}`} onClose={dismissBeat} footer={<Btn kind="primary" onClick={dismissBeat}>Continue</Btn>}>
      <div className="stage-up">
        <Banner file={BRAND.banner} width={900} className="banner-modal" />
        <h2 className="stage-up-name">{def.name}</h2>
        <p className="muted">{def.blurb}</p>
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>New at this stage</div>
        <ul className="reqs">
          {def.perks.map((p) => (
            <li key={p} className="req met">
              <Icon name="check" size={13} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function AskHost() {
  const a = getAsk();
  const [text, setText] = useState('');
  useEffect(() => setText(a?.input ?? ''), [a]);
  if (!a) return null;
  const go = () => {
    if (a.input !== undefined && !text.trim()) return;
    closeAsk();
    a.yes(text.trim());
  };
  return (
    <Modal
      title={a.title}
      onClose={closeAsk}
      footer={
        <>
          <Btn kind="ghost" onClick={closeAsk}>
            Cancel
          </Btn>
          <Btn kind={a.danger ? 'danger' : 'primary'} onClick={go}>
            {a.confirm}
          </Btn>
        </>
      }
    >
      {a.message && <p className="muted">{a.message}</p>}
      {a.input !== undefined && (
        <input
          id="ask-input"
          type="text"
          style={{ width: '100%' }}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
        />
      )}
    </Modal>
  );
}
