begin;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info','success','warning','error')),
  action_url text,
  action_label text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists user_notifications_dedupe_idx
on public.user_notifications(user_id, dedupe_key)
where dedupe_key is not null;
create index if not exists user_notifications_user_created_idx on public.user_notifications(user_id, created_at desc);

alter table public.user_notifications enable row level security;
drop policy if exists "Users can read own notifications" on public.user_notifications;
create policy "Users can read own notifications" on public.user_notifications
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can mark own notifications read" on public.user_notifications;
create policy "Users can mark own notifications read" on public.user_notifications
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke insert, delete on table public.user_notifications from anon, authenticated;
grant select, update on table public.user_notifications to authenticated;
grant all on table public.user_notifications to service_role;
notify pgrst, 'reload schema';
commit;
