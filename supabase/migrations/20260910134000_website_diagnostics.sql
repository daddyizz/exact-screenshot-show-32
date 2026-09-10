begin;

create table if not exists public.website_diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  severity text not null default 'error' check (severity in ('info','warning','error')),
  event_type text not null,
  page_url text,
  route_path text,
  message text,
  stack text,
  element text,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists website_diagnostics_created_at_idx on public.website_diagnostics(created_at desc);
create index if not exists website_diagnostics_user_id_idx on public.website_diagnostics(user_id, created_at desc);
create index if not exists website_diagnostics_event_type_idx on public.website_diagnostics(event_type, created_at desc);
create index if not exists website_diagnostics_severity_idx on public.website_diagnostics(severity, created_at desc);

alter table public.website_diagnostics enable row level security;
revoke all on table public.website_diagnostics from anon, authenticated;
grant all on table public.website_diagnostics to service_role;

notify pgrst, 'reload schema';
commit;
