create type public.app_role as enum ('admin','moderator','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create policy "user_roles_admin_select" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "user_roles_admin_write" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "profiles_admin_select" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "blogs_admin_select" on public.blogs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "posts_admin_select" on public.posts
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

alter table public.blogs
  add column if not exists autopilot_last_run_at timestamptz,
  add column if not exists autopilot_auto_publish boolean not null default true;