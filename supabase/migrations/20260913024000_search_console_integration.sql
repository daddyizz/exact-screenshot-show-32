begin;

create table if not exists public.search_console_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz not null,
  selected_site_url text,
  selected_permission_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists search_console_connections_user_id_idx
  on public.search_console_connections(user_id);

alter table public.search_console_connections enable row level security;

revoke all on table public.search_console_connections from public, anon, authenticated;
grant select, insert, update, delete on table public.search_console_connections to service_role;

notify pgrst, 'reload schema';

commit;
