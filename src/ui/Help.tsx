// The manual, opened from the top bar, plus the feedback form used by playtesters.

import { useMemo, useState } from 'react';
import { HELP } from './manual';
import { Btn, Modal } from './kit';
import { game, toast } from '../store';
import { playReport } from '../telemetry';
import { dur } from './format';
import { discoveryCount } from '../engine';

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState(HELP[0].id);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? HELP.filter((h) => (h.title + ' ' + h.body.join(' ')).toLowerCase().includes(t)) : HELP;
  }, [q]);
  const topic = list.find((h) => h.id === id) ?? list[0];
  return (
    <Modal title="How to play" onClose={onClose} wide>
      <div className="help">
        <nav className="help-nav" aria-label="Help topics">
          <input type="search" placeholder="Search the manual…" aria-label="Search the manual" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.map((h) => (
            <button key={h.id} type="button" className={`help-link${topic?.id === h.id ? ' on' : ''}`} onClick={() => setId(h.id)}>
              {h.title}
            </button>
          ))}
          {list.length === 0 && <span className="muted">Nothing matches.</span>}
        </nav>
        <article className="help-body">
          {topic && (
            <>
              <h3>{topic.title}</h3>
              {groupBullets(topic.body).map((b, i) =>
                Array.isArray(b) ? (
                  <ul key={i}>{b.map((x, j) => <li key={j}>{x}</li>)}</ul>
                ) : (
                  <p key={i}>{b}</p>
                ),
              )}
            </>
          )}
        </article>
      </div>
    </Modal>
  );
}

function groupBullets(lines: string[]): (string | string[])[] {
  const out: (string | string[])[] = [];
  for (const l of lines) {
    if (l.startsWith('- ')) {
      const last = out[out.length - 1];
      if (Array.isArray(last)) last.push(l.slice(2));
      else out.push([l.slice(2)]);
    } else out.push(l);
  }
  return out;
}

/** What goes into a playtest report besides the player's own notes. Contains no personal information. */
export function reportSummary(): Record<string, string | number> {
  const s = game();
  return {
    stage: s.stage,
    played: dur(s.totalTime),
    legacyRuns: s.legacy.runs,
    money: Math.round(s.money),
    plants: s.plants.length,
    matured: s.stats.matured,
    sold: s.stats.sold,
    discoveries: discoveryCount(s),
    techs: s.stats.techs,
    achievements: Object.keys(s.ach).length,
    showsEntered: s.stats.shows ?? 0,
  };
}

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState('');
  const text = useMemo(() => playReport(reportSummary(), notes), [notes]);
  return (
    <Modal
      title="Send feedback"
      onClose={onClose}
      wide
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>Close</Btn>
          <Btn onClick={() => { navigator.clipboard?.writeText(text).then(() => toast('Report copied. Paste it into your message.', 'good'), () => toast('Copy was blocked: select the text and copy it.', 'bad')); }}>Copy report</Btn>
          <Btn kind="primary" onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'j2grows-playtest-report.txt';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          }}>Download report</Btn>
        </>
      }
    >
      <p className="muted">Tell us what was confusing, boring, slow or broken. The report below is attached automatically: your stage, time played, a few counters and the milestone log. It contains no personal information and no save data.</p>
      <textarea placeholder="What happened? What did you expect? Where did you get stuck or lose interest?" aria-label="Your notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 120 }} />
      <details>
        <summary className="muted">What is in the report</summary>
        <pre className="crash-msg" style={{ maxHeight: 220, overflow: 'auto' }}>{text}</pre>
      </details>
    </Modal>
  );
}
