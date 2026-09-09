begin;

-- 1) Protect Blogger OAuth tokens with explicit owner-scoped RLS policies.
do $$
begin
  if to_regclass('public.blogger_connections') is not null then
    execute 'alter table public.blogger_connections enable row level security';

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='blogger_connections'
        and policyname='Users can read own Blogger connection'
    ) then
      execute 'create policy "Users can read own Blogger connection" on public.blogger_connections for select to authenticated using (auth.uid() = user_id)';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='blogger_connections'
        and policyname='Users can insert own Blogger connection'
    ) then
      execute 'create policy "Users can insert own Blogger connection" on public.blogger_connections for insert to authenticated with check (auth.uid() = user_id)';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='blogger_connections'
        and policyname='Users can update own Blogger connection'
    ) then
      execute 'create policy "Users can update own Blogger connection" on public.blogger_connections for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='blogger_connections'
        and policyname='Users can delete own Blogger connection'
    ) then
      execute 'create policy "Users can delete own Blogger connection" on public.blogger_connections for delete to authenticated using (auth.uid() = user_id)';
    end if;
  end if;
end $$;

-- 2) Let signed-in users read only their own role row.
do $$
begin
  if to_regclass('public.user_roles') is not null then
    execute 'alter table public.user_roles enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='user_roles'
        and policyname='Users can read own roles'
    ) then
      execute 'create policy "Users can read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id)';
    end if;
  end if;
end $$;

-- 3) has_role does not need elevated privileges when RLS permits own-role reads.
do $$
begin
  if to_regprocedure('public.has_role(uuid,public.app_role)') is not null then
    execute 'alter function public.has_role(uuid, public.app_role) security invoker';
    execute 'revoke all on function public.has_role(uuid, public.app_role) from public, anon';
    execute 'grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role';
  end if;
end $$;

-- 4) Admin snapshot exposes auth.users data and must never be client-callable.
do $$
begin
  if to_regprocedure('public.admin_console_snapshot()') is not null then
    execute 'revoke all on function public.admin_console_snapshot() from public, anon, authenticated';
    execute 'grant execute on function public.admin_console_snapshot() to service_role';
  end if;
end $$;

-- 5) Trigger helpers should not be directly executable from the API.
do $$
begin
  if to_regprocedure('public.enforce_blog_plan_limits()') is not null then
    execute 'revoke all on function public.enforce_blog_plan_limits() from public, anon, authenticated';
    execute 'grant execute on function public.enforce_blog_plan_limits() to service_role';
  end if;
end $$;

-- 6) Usage-mutating SECURITY DEFINER functions remain backend-only.
do $$
begin
  if to_regprocedure('public.consume_ai_draft_usage(uuid)') is not null then
    execute 'revoke all on function public.consume_ai_draft_usage(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.consume_ai_draft_usage(uuid) to service_role';
  end if;
  if to_regprocedure('public.consume_ai_image_usage(uuid)') is not null then
    execute 'revoke all on function public.consume_ai_image_usage(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.consume_ai_image_usage(uuid) to service_role';
  end if;
end $$;

-- Refresh PostgREST after privilege/policy changes.
notify pgrst, 'reload schema';

commit;
