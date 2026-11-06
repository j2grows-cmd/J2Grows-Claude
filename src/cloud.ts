// Cloud saves through Supabase Auth (email one-time code) and PostgREST, using plain fetch so no SDK is needed.
// The tables are created by supabase/migrations/001_*.sql; until that has been applied every call fails
// politely and the game keeps working from local storage.

export const CLOUD_URL = 'https://lwaxzivcjzpmmantryor.supabase.co';
// A publishable key is designed to ship in client code: what it may do is decided by row level security.
export const CLOUD_KEY = 'sb_publishable_gplxHER4N2g4oR6Sf0A6SA_khxiDCOq';
const SESSION_KEY = 'j2grows.cloud.session.v1';

interface Session {
  access: string;
  refresh: string;
  expires: number; // ms
  email: string;
  userId: string;
}
export interface CloudInfo {
  stage: number;
  played: number;
  money: number;
  updatedAt: number;
}
export type CloudResult<T = void> = { ok: true; value: T } | { ok: false; why: string };

const fail = (why: string): { ok: false; why: string } => ({ ok: false, why });

function load(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function store(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export const cloudEmail = (): string | null => load()?.email ?? null;

async function call(path: string, init: RequestInit & { auth?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { apikey: CLOUD_KEY, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
  if (init.auth) headers.Authorization = `Bearer ${init.auth}`;
  return fetch(`${CLOUD_URL}${path}`, { ...init, headers });
}

const message = async (r: Response): Promise<string> => {
  try {
    const j = (await r.json()) as { msg?: string; message?: string; error_description?: string; hint?: string };
    return j.msg ?? j.message ?? j.error_description ?? `Error ${r.status}`;
  } catch {
    return `Error ${r.status}`;
  }
};

/** Sends a six-digit code to the address. */
export async function requestCode(email: string): Promise<CloudResult> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('That does not look like an email address.');
  try {
    const r = await call('/auth/v1/otp', { method: 'POST', body: JSON.stringify({ email, create_user: true }) });
    return r.ok ? { ok: true, value: undefined } : fail(await message(r));
  } catch {
    return fail('The cloud service could not be reached.');
  }
}

export async function verifyCode(email: string, token: string): Promise<CloudResult> {
  try {
    const r = await call('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'email', email, token: token.trim() }) });
    if (!r.ok) return fail(await message(r));
    const j = (await r.json()) as { access_token: string; refresh_token: string; expires_in: number; user: { id: string } };
    store({ access: j.access_token, refresh: j.refresh_token, expires: Date.now() + j.expires_in * 1000 - 30000, email, userId: j.user.id });
    return { ok: true, value: undefined };
  } catch {
    return fail('The cloud service could not be reached.');
  }
}

export function signOut(): void {
  store(null);
}

async function token(): Promise<string | null> {
  const s = load();
  if (!s) return null;
  if (Date.now() < s.expires) return s.access;
  try {
    const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh }) });
    if (!r.ok) {
      store(null);
      return null;
    }
    const j = (await r.json()) as { access_token: string; refresh_token: string; expires_in: number };
    store({ ...s, access: j.access_token, refresh: j.refresh_token, expires: Date.now() + j.expires_in * 1000 - 30000 });
    return j.access_token;
  } catch {
    return null;
  }
}

export async function cloudInfo(): Promise<CloudResult<CloudInfo | null>> {
  const t = await token();
  if (!t) return fail('Sign in first.');
  try {
    const r = await call('/rest/v1/cloud_saves?select=stage,played,money,updated_at&limit=1', { auth: t });
    if (!r.ok) return fail(r.status === 404 ? 'Cloud saves are not set up on the server yet.' : await message(r));
    const rows = (await r.json()) as { stage: number; played: number; money: number; updated_at: string }[];
    return { ok: true, value: rows[0] ? { stage: rows[0].stage, played: rows[0].played, money: rows[0].money, updatedAt: Date.parse(rows[0].updated_at) } : null };
  } catch {
    return fail('The cloud service could not be reached.');
  }
}

export async function cloudUpload(data: string, meta: { stage: number; played: number; money: number }): Promise<CloudResult> {
  const t = await token();
  const u = load();
  if (!t || !u) return fail('Sign in first.');
  try {
    const r = await call('/rest/v1/cloud_saves?on_conflict=user_id', {
      method: 'POST',
      auth: t,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: u.userId, data, stage: meta.stage, played: Math.round(meta.played), money: meta.money, updated_at: new Date().toISOString() }),
    });
    if (r.ok) return { ok: true, value: undefined };
    return fail(r.status === 404 ? 'Cloud saves are not set up on the server yet.' : await message(r));
  } catch {
    return fail('The cloud service could not be reached.');
  }
}

export async function cloudDownload(): Promise<CloudResult<string | null>> {
  const t = await token();
  if (!t) return fail('Sign in first.');
  try {
    const r = await call('/rest/v1/cloud_saves?select=data&limit=1', { auth: t });
    if (!r.ok) return fail(r.status === 404 ? 'Cloud saves are not set up on the server yet.' : await message(r));
    const rows = (await r.json()) as { data: string }[];
    return { ok: true, value: rows[0]?.data ?? null };
  } catch {
    return fail('The cloud service could not be reached.');
  }
}
