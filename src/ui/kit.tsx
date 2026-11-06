// Small shared UI components.

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { cls } from './format';

// ---------------------------------------------------------------------------------------------
// icons
// ---------------------------------------------------------------------------------------------
const ICONS: Record<string, string> = {
  overview: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  grow: 'M12 21v-9M12 12c0-4-3-7-7-7 0 4 3 7 7 7zm0 0c0-4 3-7 7-7 0 4-3 7-7 7z',
  flask: 'M9 3h6M10 3v6L4.5 19a1.6 1.6 0 0 0 1.4 2.4h12.2a1.6 1.6 0 0 0 1.4-2.4L14 9V3M7.5 15h9',
  dna: 'M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12M8.5 7h7M8.5 17h7M10 12h4',
  research: 'M4 19V8l8-4 8 4v11M4 19h16M9 19v-6h6v6M12 8v2',
  lab: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6',
  market: 'M4 7h16l-1.5 5H5.5L4 7zM6 12v8h12v-8M9 20v-4h6v4',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6l1-8z',
  legacy: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.4 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19 12l2-1.2-2-3.4-2.3.7a7 7 0 0 0-1.6-.9L14.6 4h-4l-.5 2.2a7 7 0 0 0-1.6.9L6.2 6.4l-2 3.4L6 12l-.2 1.2L4.2 14.6l2 3.4 2.3-.7a7 7 0 0 0 1.6.9l.5 2.2h4l.5-2.2a7 7 0 0 0 1.6-.9l2.3.7 2-3.4-1.8-1.4z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 14.5c.4 1 1.4 1.5 2.5 1.5 1.5 0 2.5-.7 2.5-1.8 0-2.6-5-1.4-5-4 0-1.1 1-1.9 2.5-1.9 1.1 0 2 .5 2.4 1.4M12 6.5v1.6M12 16v1.6',
  rp: 'M9 3h6M10 3v6l-5 9a1.6 1.6 0 0 0 1.4 2.4h11.2A1.6 1.6 0 0 0 19 18l-5-9V3',
  plant: 'M12 22v-8M12 14c-4 0-7-3-7-8 5 0 7 3 7 8zm0 0c0-4 3-7 8-7 0 5-4 7-8 7z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  warn: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.4 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z',
  x: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a3 3 0 1 0 0-6M17 14c2.5.4 4 2.7 4 6',
  scissors: 'M6 7a2.5 2.5 0 1 0 0-.01zM6 17a2.5 2.5 0 1 0 0-.01zM8 8.5L20 18M8 15.5L20 6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  temp: 'M10 14.8V5a2 2 0 0 1 4 0v9.8a4 4 0 1 1-4 0z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
};
export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={cls('icon', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ICONS.info} />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// layout blocks
// ---------------------------------------------------------------------------------------------
export function Panel({ title, icon, right, children, className, pad = true, sub }: { title?: ReactNode; icon?: string; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean; sub?: ReactNode }) {
  return (
    <section className={cls('panel', className)}>
      {(title || right) && (
        <header className="panel-h">
          <div className="panel-t">
            {icon && <Icon name={icon} size={16} />}
            <h3>{title}</h3>
            {sub && <span className="panel-sub">{sub}</span>}
          </div>
          {right && <div className="panel-r">{right}</div>}
        </header>
      )}
      <div className={pad ? 'panel-b' : undefined}>{children}</div>
    </section>
  );
}

export function PageHead({ title, blurb, right }: { title: string; blurb?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {blurb && <p className="blurb">{blurb}</p>}
      </div>
      {right && <div className="page-head-r">{right}</div>}
    </div>
  );
}

export function Btn({ children, onClick, kind = 'default', disabled, small, title, icon, wide, className }: { children?: ReactNode; onClick?: () => void; kind?: 'default' | 'primary' | 'danger' | 'ghost' | 'gold'; disabled?: boolean; small?: boolean; title?: string; icon?: string; wide?: boolean; className?: string }) {
  return (
    <button type="button" className={cls('btn', `btn-${kind}`, small && 'btn-s', wide && 'btn-w', className)} onClick={onClick} disabled={disabled} title={title}>
      {icon && <Icon name={icon} size={small ? 13 : 15} />}
      {children}
    </button>
  );
}

export function Bar({ value, max = 100, tone = 'green', label, thin, marker }: { value: number; max?: number; tone?: 'green' | 'blue' | 'gold' | 'red' | 'purple' | 'olive'; label?: ReactNode; thin?: boolean; marker?: number }) {
  const p = Math.max(0, Math.min(1, value / max));
  return (
    <div className={cls('bar', thin && 'bar-thin')} role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cls('bar-fill', `tone-${tone}`)} style={{ width: `${p * 100}%` }} />
      {marker != null && <div className="bar-marker" style={{ left: `${Math.max(0, Math.min(1, marker / max)) * 100}%` }} />}
      {label && <span className="bar-label">{label}</span>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={cls('stat', tone && `stat-${tone}`)}>
      <div className="stat-l">{label}</div>
      <div className="stat-v">{value}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}

export function Chip({ children, tone = 'default', title }: { children: ReactNode; tone?: 'default' | 'green' | 'gold' | 'red' | 'blue' | 'purple' | 'olive' | 'muted'; title?: string }) {
  return (
    <span className={cls('chip', `chip-${tone}`)} title={title}>
      {children}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: ReactNode; badge?: ReactNode; locked?: boolean }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={cls('tab', value === t.id && 'on', t.locked && 'locked')} onClick={() => onChange(t.id)}>
          {t.locked && <Icon name="lock" size={12} />}
          {t.label}
          {t.badge != null && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide, footer }: { title?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cls('modal', wide && 'modal-wide')} role="dialog" aria-modal="true">
        <header className="modal-h">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-b">{children}</div>
        {footer && <footer className="modal-f">{footer}</footer>}
      </div>
    </div>
  );
}

export function Empty({ icon = 'plant', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p>{children}</p>
    </div>
  );
}

export function Slider({ label, icon, value, min, max, step = 1, unit = '', onChange, hint, actual, range, disabled }: { label: string; icon?: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; hint?: ReactNode; actual?: number; range?: [number, number] | null; disabled?: boolean }) {
  const pc = (v: number): number => ((v - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider-top">
        <span className="slider-l">
          {icon && <Icon name={icon} size={14} />}
          {label}
        </span>
        <span className="slider-v">
          {value}
          {unit}
          {actual != null && <em title="Measured in the room right now"> → {actual.toFixed(1)}{unit}</em>}
        </span>
      </div>
      <div className="slider-track">
        {range && <div className="slider-ideal" style={{ left: `${pc(Math.max(min, range[0]))}%`, width: `${Math.max(2, pc(Math.min(max, range[1])) - pc(Math.max(min, range[0])))}%` }} title={`Plants here prefer ${Math.round(range[0])}–${Math.round(range[1])}${unit}`} />}
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
      {hint && <div className="slider-h">{hint}</div>}
    </div>
  );
}

export function Req({ ok, children, have }: { ok: boolean; children: ReactNode; have?: ReactNode }) {
  return (
    <li className={cls('req', ok && 'met')}>
      <Icon name={ok ? 'check' : 'x'} size={13} />
      <span>{children}</span>
      {have != null && <em>{have}</em>}
    </li>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}

/** A value that briefly flashes when it changes. */
export function Flash({ value, children }: { value: number; children: ReactNode }) {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (value === prev) return;
    setDir(value > prev ? 'up' : 'down');
    setPrev(value);
    const t = setTimeout(() => setDir(null), 600);
    return () => clearTimeout(t);
  }, [value, prev]);
  return <span className={cls('flash', dir && `flash-${dir}`)}>{children}</span>;
}

export const style = (s: CSSProperties): CSSProperties => s;
