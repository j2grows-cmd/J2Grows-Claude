// Keeps two tabs from overwriting each other's saves. One tab holds a short-lived lock in localStorage and
// renews it; any other tab becomes read-only and says so, until the player chooses to take over.

const KEY = 'j2grows.tablock.v1';
const STALE = 9000;
const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
let primary = true;
let listeners: (() => void)[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

interface Lock {
  id: string;
  t: number;
}
function read(): Lock | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Lock) : null;
  } catch {
    return null;
  }
}
function write(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, t: Date.now() } satisfies Lock));
  } catch {
    /* storage unavailable: nothing to protect */
  }
}
function set(p: boolean): void {
  if (p !== primary) {
    primary = p;
    listeners.forEach((l) => l());
  }
}

function beat(): void {
  const l = read();
  if (!l || l.id === id || Date.now() - l.t > STALE) {
    write();
    set(true);
  } else set(false);
}

export const isPrimaryTab = (): boolean => primary;
export const onTabChange = (fn: () => void): void => {
  listeners.push(fn);
};

/** Take the lock now (the other tab will notice within a few seconds and go read-only). */
export function takeOver(): void {
  write();
  set(true);
}

export function startTabLock(): void {
  if (timer || typeof window === 'undefined') return;
  beat();
  timer = setInterval(beat, 3000);
  window.addEventListener('storage', (e) => e.key === KEY && beat());
  window.addEventListener('pagehide', () => {
    const l = read();
    if (l?.id === id) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    }
  });
}
