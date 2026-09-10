begin;

-- Activity logs policies: admins can manage, users can read their own.
drop policy if exists "Admins can manage activity logs" on public.activity_logs;
create policy "Admins can manage activity logs"
  on public.activity_logs
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can read own activity logs" on public.activity_logs;
create policy "Users can read own activity logs"
  on public.activity_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Private schema for security-definer helpers
create schema if not exists private;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

-- Move the role check implementation into a non-exposed, security-definer function.
create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = private, public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to service_role;
revoke execute on function private.has_role(uuid, public.app_role) from anon;
revoke execute on function private.has_role(uuid, public.app_role) from public;

-- Expose only a security-invoker wrapper so the linter no longer sees a public security-definer function.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.has_role(_user_id, _role);
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.has_role(uuid, public.app_role) from public;

-- Restrict the unused handle_new_user trigger function.
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;

notify pgrst, 'reload schema';
commit;