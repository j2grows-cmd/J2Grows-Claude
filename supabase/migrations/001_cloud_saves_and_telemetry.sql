-- J2Grows: cloud saves (signed-in players only) and anonymous, opt-in progress statistics.
-- Applied to the project on 2026-11-06. Re-running it is safe.
-- Auth: enable "Email" sign-in with one-time codes (OTP) in Authentication > Providers.

-- ---------- cloud saves ----------
create table if not exists public.cloud_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  data       text not null check (length(data) < 4000000),
  stage      int  not null default 1,
  played     int  not null default 0,          -- seconds played in this run
  money      double precision not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.cloud_saves enable row level security;

drop policy if exists "own save: read"   on public.cloud_saves;
drop policy if exists "own save: insert" on public.cloud_saves;
drop policy if exists "own save: update" on public.cloud_saves;
drop policy if exists "own save: delete" on public.cloud_saves;
create policy "own save: read"   on public.cloud_saves for select to authenticated using (user_id = auth.uid());
create policy "own save: insert" on public.cloud_saves for insert to authenticated with check (user_id = auth.uid());
create policy "own save: update" on public.cloud_saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own save: delete" on public.cloud_saves for delete to authenticated using (user_id = auth.uid());

-- ---------- anonymous statistics (opt-in) ----------
-- Insert-only for the public key: nobody can read these rows through the API, only you in the dashboard.
create table if not exists public.telemetry_events (
  id      bigint generated always as identity primary key,
  device  text not null check (length(device) between 8 and 64),
  session text not null check (length(session) between 4 and 64),
  kind    text not null check (length(kind) between 1 and 32),
  data    jsonb not null default '{}'::jsonb check (pg_column_size(data) < 4000),
  build   text not null default '' check (length(build) < 32),
  at      timestamptz not null default now()
);
alter table public.telemetry_events enable row level security;
drop policy if exists "anyone may add events" on public.telemetry_events;
create policy "anyone may add events" on public.telemetry_events for insert to anon, authenticated with check (true);
create index if not exists telemetry_events_kind_at on public.telemetry_events (kind, at desc);

-- A ready-made view for pacing: when did players reach each stage?
create or replace view public.pacing_by_stage with (security_invoker = true) as
  select (data->>'stage')::int as stage,
         count(distinct device) as players,
         percentile_cont(0.5) within group (order by (data->>'played')::double precision / 3600) as median_hours,
         min((data->>'played')::double precision / 3600) as fastest_hours,
         max((data->>'played')::double precision / 3600) as slowest_hours
  from public.telemetry_events
  where kind = 'stage'
  group by 1 order by 1;
