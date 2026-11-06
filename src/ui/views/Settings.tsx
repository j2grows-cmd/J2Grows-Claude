// Settings, saves and about.

import { useState } from 'react';
import { act, askConfirm, exportText, importText, newRun, save, toast, useGame } from '../../store';
import { Btn, Hint, PageHead, Panel, Stat } from '../kit';
import { retryArtwork, setArtMode, useArt, type ArtMode } from '../artwork';
import { dur } from '../format';
import { BackupsPanel, CloudPanel, DisplayPanel, PlaytestPanel } from './SettingsPanels';
import { FeedbackModal } from '../Help';

export function Settings() {
  const s = useGame();
  const [text, setText] = useState('');
  const [exported, setExported] = useState('');
  const art = useArt();
  const [feedback, setFeedback] = useState(false);
  return (
    <div className="page">
      <PageHead title="Settings" blurb="Game speed, saving and fresh starts." />
      <div className="grid g2">
        <div className="stack">
          <Panel title="Game" icon="gear">
            <div className="stack" style={{ gap: 12 }}>
              <div className="row between">
                <label htmlFor="speed">Game speed</label>
                <select id="speed" value={s.settings.speed} onChange={(e) => act((g) => { g.settings.speed = Number(e.target.value); }, true)}>
                  <option value={1}>1× (normal)</option>
                  <option value={2}>2×</option>
                  <option value={5}>5×</option>
                  <option value={10}>10× (testing)</option>
                </select>
              </div>
              <label className="check">
                <input type="checkbox" checked={s.settings.autosave} onChange={(e) => act((g) => { g.settings.autosave = e.target.checked; }, true)} /> Autosave every 15 seconds
              </label>
              <div className="row">
                <Btn icon="save" onClick={() => { save(); toast('Game saved.', 'good'); }}>Save now</Btn>
              </div>
            </div>
          </Panel>
          <DisplayPanel />
          <Panel title="Artwork" icon="plant">
            <div className="stack" style={{ gap: 12 }}>
              <div className="row between">
                <label htmlFor="art">Plant pictures</label>
                <select id="art" value={art.mode} onChange={(e) => setArtMode(e.target.value as ArtMode)}>
                  <option value="hero">Species artwork</option>
                  <option value="drawn">Drawn plants (no downloads)</option>
                </select>
              </div>
              {art.mode === 'hero' && (art.unreachable || art.failed > 0) && (
                <div className="row between wrap">
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {art.unreachable ? 'The artwork server could not be reached, so plants are drawn instead.' : `${art.failed} picture${art.failed > 1 ? 's' : ''} could not be loaded and are drawn instead.`}
                  </span>
                  <Btn kind="ghost" onClick={retryArtwork}>Try again</Btn>
                </div>
              )}
              <Hint>Species pictures are downloaded as you browse and cached by your browser. Choose drawn plants to play without any downloads.</Hint>
            </div>
          </Panel>
          <Panel title="Export / import" icon="save">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row wrap">
                <Btn onClick={() => setExported(exportText())}>Export save</Btn>
                {exported && (
                  <Btn kind="ghost" onClick={() => { navigator.clipboard?.writeText(exported).then(() => toast('Copied to the clipboard.', 'good'), () => toast('Copy was blocked here: select the text above and copy it.', 'bad')); }}>Copy</Btn>
                )}
              </div>
              {exported && <textarea readOnly value={exported} onFocus={(e) => e.currentTarget.select()} aria-label="Exported save" />}
              <textarea placeholder="Paste a save here to import it…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Import save" />
              <div className="row">
                <Btn disabled={!text.trim()} onClick={() => { if (importText(text.trim())) { toast('Save imported.', 'good'); setText(''); } else toast('That does not look like a J2Grows save.', 'bad'); }}>
                  Import save
                </Btn>
              </div>
            </div>
          </Panel>
        </div>
        <div className="stack">
          <CloudPanel />
          <BackupsPanel />
          <PlaytestPanel onFeedback={() => setFeedback(true)} />
          <Panel title="This save" icon="info">
            <div className="stats-row">
              <Stat label="Played" value={dur(s.totalTime)} />
              <Stat label="Stage" value={s.stage} />
              <Stat label="Legacy runs" value={s.legacy.runs} />
            </div>
            <Hint>Your game is stored in this browser (local storage). Export a copy now and then — clearing site data deletes it.</Hint>
          </Panel>
          <Panel title="Danger zone" icon="trash">
            <Hint>Start over from the very beginning. This deletes your save, legacy points included.</Hint>
            <Btn kind="danger" icon="trash" onClick={() => askConfirm('This deletes your save, your collection and your legacy points, and starts a brand-new game. It cannot be undone.', () => newRun(), { title: 'Start over?', confirm: 'Delete everything', danger: true })}>
              Delete save and start over
            </Btn>
          </Panel>
          <Panel title="About J2Grows" icon="plant">
            <p className="muted">
              A premium botanical genetics and laboratory simulator. One-time purchase, no microtransactions, no pay-to-win. Genes are diploid, mutations are real, and every plant has a history.
            </p>
          </Panel>
        </div>
      </div>
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}
