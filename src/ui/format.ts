// Number, money and time formatting helpers shared by every view.

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

export function num(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a < 1000) return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(Math.min(digits, 1)) : n.toFixed(digits);
  const i = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(a) / 3));
  const v = n / 1000 ** i;
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(v >= 10 ? 1 : 2)}${SUFFIX[i]}`;
}

export const money = (n: number): string => `$${Math.abs(n) < 100 ? n.toFixed(2) : num(n)}`;
export const money0 = (n: number): string => `$${Math.abs(n) < 10000 ? Math.floor(n).toLocaleString('en-US') : num(n)}`;
export const pct = (x: number, d = 0): string => `${(x * 100).toFixed(d)}%`;

export function dur(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

/** The game keeps a cosmetic "plant age" in minutes of play. */
export const age = (now: number, born: number): string => dur(now - born);

export const ago = (now: number, t: number): string => `${dur(now - t)} ago`;

export const cls = (...a: (string | false | null | undefined)[]): string => a.filter(Boolean).join(' ');

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const band5 = (v: number): string => ['Very low', 'Low', 'Average', 'High', 'Very high'][Math.min(4, Math.floor(v * 5))];
