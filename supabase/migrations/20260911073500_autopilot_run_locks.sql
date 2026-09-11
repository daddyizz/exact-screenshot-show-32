begin;

create table if not exists public.autopilot_run_locks (
  blog_id uuid primary key references public.blogs(id) on delete cascade,
  lock_token uuid not null,
  locked_at timestamptz not null default now()
);

alter table public.autopilot_run_locks enable row level security;
revoke all on table public.autopilot_run_locks from anon, authenticated;
grant all on table public.autopilot_run_locks to service_role;

create or replace function public.acquire_autopilot_run_lock(
  p_blog_id uuid,
  p_stale_after_minutes integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid := gen_random_uuid();
  v_existing public.autopilot_run_locks%rowtype;
begin
  select * into v_existing
  from public.autopilot_run_locks
  where blog_id = p_blog_id
  for update;

  if found then
    if v_existing.locked_at > now() - make_interval(mins => greatest(1, p_stale_after_minutes)) then
      return null;
    end if;

    update public.autopilot_run_locks
    set lock_token = v_token,
        locked_at = now()
    where blog_id = p_blog_id;
    return v_token;
  end if;

  begin
    insert into public.autopilot_run_locks (blog_id, lock_token, locked_at)
    values (p_blog_id, v_token, now());
    return v_token;
  exception when unique_violation then
    return null;
  end;
end;
$$;

create or replace function public.release_autopilot_run_lock(
  p_blog_id uuid,
  p_lock_token uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.autopilot_run_locks
    where blog_id = p_blog_id
      and lock_token = p_lock_token
    returning 1
  )
  select exists(select 1 from deleted);
$$;

revoke all on function public.acquire_autopilot_run_lock(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_autopilot_run_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.acquire_autopilot_run_lock(uuid, integer) to service_role;
grant execute on function public.release_autopilot_run_lock(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
