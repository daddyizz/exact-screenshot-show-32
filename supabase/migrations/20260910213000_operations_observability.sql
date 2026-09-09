begin;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  status text not null default 'success' check (status in ('success','failed','info')),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id, created_at desc);
create index if not exists activity_logs_event_type_idx on public.activity_logs(event_type, created_at desc);

create table if not exists public.autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  blog_id uuid references public.blogs(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  trigger_source text not null default 'scheduled' check (trigger_source in ('scheduled','manual','dashboard')),
  status text not null check (status in ('skipped','drafted','published','error')),
  detail text,
  published_url text,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists autopilot_runs_created_at_idx on public.autopilot_runs(created_at desc);
create index if not exists autopilot_runs_blog_id_idx on public.autopilot_runs(blog_id, created_at desc);
create index if not exists autopilot_runs_user_id_idx on public.autopilot_runs(user_id, created_at desc);

alter table public.activity_logs enable row level security;
alter table public.autopilot_runs enable row level security;

-- Operational data is server-managed. Users can only read their own autopilot history.
drop policy if exists "Users can read own autopilot runs" on public.autopilot_runs;
create policy "Users can read own autopilot runs"
on public.autopilot_runs for select to authenticated
using (auth.uid() = user_id);

revoke all on table public.activity_logs from anon, authenticated;
revoke insert, update, delete on table public.autopilot_runs from anon, authenticated;
grant select on table public.autopilot_runs to authenticated;
grant all on table public.activity_logs to service_role;
grant all on table public.autopilot_runs to service_role;

notify pgrst, 'reload schema';
commit;
