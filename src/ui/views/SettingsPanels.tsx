// Settings panels: sound and display, backups, cloud save and playtesting.

import { useState } from 'react';
import { listBackups } from '../../engine';
import { askConfirm, importText, raw, restoreBackup, toast, useGame } from '../../store';
import { cloudDownload, cloudEmail, cloudInfo, cloudUpload, requestCode, signOut, verifyCode, type CloudInfo } from '../../cloud';
import { THEMES, achievementCount } from '../../engine';
import { clearPlayLog, flush, playLog } from '../../telemetry';
import { Btn, Hint, Panel } from '../kit';
import { setAmbient, play } from '../audio';
import { setPrefs, usePrefs } from '../prefs';
import { dur, money } from '../format';

export function DisplayPanel() {
  const p = usePrefs();
  const s = useGame();
  const count = achievementCount(s);
  return (
    <Panel title="Sound and display" icon="gear">
      <div className="stack" style={{ gap: 12 }}>
        <div className="row between">
          <label htmlFor="sfx">Sound effects</label>
          <input id="sfx" type="range" min={0} max={1} step={0.05} value={p.sfx} onChange={(e) => setPrefs({ sfx: Number(e.target.value) })} onPointerUp={() => play('good')} aria-valuetext={p.sfx === 0 ? 'off' : `${Math.round(p.sfx * 100)}%`} />
        </div>
        <div className="row between">
          <label htmlFor="amb">Laboratory ambience</label>
          <input id="amb" type="range" min={0} max={1} step={0.05} value={p.ambient} onChange={(e) => { setPrefs({ ambient: Number(e.target.value) }); setAmbient(Number(e.target.value)); }} aria-valuetext={p.ambient === 0 ? 'off' : `${Math.round(p.ambient * 100)}%`} />
        </div>
        <div className="row between">
          <label htmlFor="ts">Interface size</label>
          <select id="ts" value={p.textScale} onChange={(e) => setPrefs({ textScale: Number(e.target.value) })}>
            <option value={0.9}>Small</option>
            <option value={1}>Normal</option>
            <option value={1.15}>Large</option>
            <option value={1.3}>Extra large</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={p.reduceMotion} onChange={(e) => setPrefs({ reduceMotion: e.target.checked })} /> Reduce motion (no animations)
        </label>
        <div className="row between">
          <label htmlFor="theme">Colour theme</label>
          <select id="theme" value={p.theme} onChange={(e) => setPrefs({ theme: e.target.value })}>
            {THEMES.map((t) => <option key={t.id} value={t.id} disabled={count < t.need}>{t.name}{count < t.need ? ` (${t.need} achievements)` : ''}</option>)}
          </select>
        </div>
        <Hint>Sound is made by your browser: no audio files are downloaded. These settings belong to this device, not to the save.</Hint>
      </div>
    </Panel>
  );
}

export function BackupsPanel() {
  const [tick, setTick] = useState(0);
  const list = listBackups();
  void tick;
  return (
    <Panel title="Automatic backups" icon="save">
      {list.length === 0 ? (
        <Hint>The game keeps up to three older copies of your save, one every ten minutes or so. None exist yet.</Hint>
      ) : (
        <div className="list">
          {list.map((b) => (
            <div className="item" key={b.slot}>
              <div className="grow-1">
                <div className="item-title">{new Date(b.savedAt).toLocaleString()}</div>
                <div className="item-sub">Stage {b.stage} · {dur(b.playedSeconds)} played · {money(b.money)}</div>
              </div>
              <Btn small onClick={() => askConfirm('This replaces your current game with this older copy. Your current game is lost unless you export it first.', () => { if (restoreBackup(b.slot)) { toast('Backup restored.', 'good'); setTick((x) => x + 1); } else toast('That backup could not be read.', 'bad'); }, { title: 'Restore this backup?', confirm: 'Restore', danger: true })}>
                Restore
              </Btn>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function CloudPanel() {
  const s = useGame();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [signed, setSigned] = useState<string | null>(cloudEmail());
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<CloudInfo | null | undefined>(undefined);
  const [msg, setMsg] = useState('');
  const run = async (f: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setMsg('');
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  const check = (): Promise<void> => run(async () => {
    const r = await cloudInfo();
    if (r.ok) setInfo(r.value);
    else setMsg(r.why);
  });
  return (
    <Panel title="Cloud save" icon="save" sub={signed ?? 'optional'}>
      {!signed ? (
        <div className="stack" style={{ gap: 10 }}>
          <Hint>Sign in with your email to keep a copy of your save online and continue on another device. We email you a one-time code; there is no password.</Hint>
          {!sent ? (
            <div className="row wrap">
              <input type="email" placeholder="you@example.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
              <Btn disabled={busy || !email.trim()} onClick={() => run(async () => { const r = await requestCode(email.trim()); if (r.ok) setSent(true); else setMsg(r.why); })}>Send code</Btn>
            </div>
          ) : (
            <div className="row wrap">
              <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Code from the email" aria-label="One-time code" value={code} onChange={(e) => setCode(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <Btn kind="primary" disabled={busy || code.trim().length < 4} onClick={() => run(async () => { const r = await verifyCode(email.trim(), code); if (r.ok) { setSigned(cloudEmail()); setSent(false); setCode(''); toast('Signed in.', 'good'); } else setMsg(r.why); })}>Sign in</Btn>
              <Btn kind="ghost" onClick={() => setSent(false)}>Back</Btn>
            </div>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row wrap">
            <Btn disabled={busy} onClick={() => run(async () => { const r = await cloudUpload(raw(), { stage: s.stage, played: s.totalTime, money: s.money }); if (r.ok) { toast('Saved to the cloud.', 'good'); setInfo(undefined); } else setMsg(r.why); })}>Upload this game</Btn>
            <Btn disabled={busy} onClick={() => run(async () => {
              const r = await cloudDownload();
              if (!r.ok) return void setMsg(r.why);
              if (!r.value) return void setMsg('There is no cloud save yet.');
              const text = r.value;
              askConfirm('This replaces your current game with the cloud copy. Export your current game first if you want to keep it.', () => { toast(importText(text) ? 'Cloud save loaded.' : 'The cloud save could not be read.', importText(text) ? 'good' : 'bad'); }, { title: 'Load the cloud save?', confirm: 'Load it', danger: true });
            })}>Download cloud game</Btn>
            <Btn kind="ghost" disabled={busy} onClick={check}>Compare</Btn>
            <Btn kind="ghost" onClick={() => { signOut(); setSigned(null); setInfo(undefined); }}>Sign out</Btn>
          </div>
          {info !== undefined && (
            <p className="muted">
              {info === null ? 'No cloud save yet.' : <>Cloud copy: Stage {info.stage} · {dur(info.played)} played · {money(info.money)} · saved {new Date(info.updatedAt).toLocaleString()}. This game: Stage {s.stage} · {dur(s.totalTime)} played · {money(s.money)}.</>}
            </p>
          )}
        </div>
      )}
      {msg && <p className="red" role="alert">{msg}</p>}
    </Panel>
  );
}

export function PlaytestPanel({ onFeedback }: { onFeedback: () => void }) {
  const p = usePrefs();
  const n = playLog().length;
  return (
    <Panel title="Playtesting" icon="info">
      <div className="stack" style={{ gap: 10 }}>
        <label className="check">
          <input type="checkbox" checked={p.telemetry === 'on'} onChange={(e) => { setPrefs({ telemetry: e.target.checked ? 'on' : 'off' }); if (e.target.checked) void flush(); }} /> Share anonymous progress statistics
        </label>
        <Hint>Sends only your stage, time played and a few counters under a random id: no name, email or save data. {n} milestone{n === 1 ? '' : 's'} are kept in this browser either way.</Hint>
        <div className="row wrap">
          <Btn onClick={onFeedback}>Send feedback</Btn>
          <Btn kind="ghost" disabled={!n} onClick={() => askConfirm('Clear the milestone log kept in this browser?', () => clearPlayLog(), { title: 'Clear log?', confirm: 'Clear' })}>Clear milestone log</Btn>
        </div>
      </div>
    </Panel>
  );
}
