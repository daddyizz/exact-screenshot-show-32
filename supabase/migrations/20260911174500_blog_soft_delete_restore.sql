begin;

alter table public.blogs
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz;

create index if not exists blogs_user_deleted_at_idx
  on public.blogs(user_id, deleted_at);

create index if not exists blogs_purge_after_idx
  on public.blogs(purge_after)
  where deleted_at is not null;

-- Existing app queries should see only active blogs. Deleted blogs are exposed
-- through server-side restore APIs so their complete state can remain intact.
drop policy if exists "BlogPilot hide deleted blogs" on public.blogs;
create policy "BlogPilot hide deleted blogs"
  on public.blogs
  as restrictive
  for select
  to authenticated
  using (deleted_at is null);

-- Keep posts intact for the full 90-day recovery window but hide them from
-- normal article/queue queries while their parent blog is in Trash.
drop policy if exists "BlogPilot hide posts from deleted blogs" on public.posts;
create policy "BlogPilot hide posts from deleted blogs"
  on public.posts
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.blogs b
      where b.id = posts.blog_id
        and b.deleted_at is null
    )
  );

create or replace function public.purge_expired_deleted_blogs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blog record;
  v_count integer := 0;
begin
  for v_blog in
    select id
    from public.blogs
    where deleted_at is not null
      and purge_after is not null
      and purge_after <= now()
    order by purge_after
  loop
    begin
      delete from public.autopilot_run_locks where blog_id = v_blog.id;
      delete from public.autopilot_runs where blog_id = v_blog.id;
      delete from public.blogger_connections where blog_id = v_blog.id;
      delete from public.posts where blog_id = v_blog.id;
      delete from public.blogs where id = v_blog.id;
      v_count := v_count + 1;
    exception when others then
      raise warning 'Could not purge deleted blog %: %', v_blog.id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.purge_expired_deleted_blogs() from public, anon, authenticated;
grant execute on function public.purge_expired_deleted_blogs() to service_role;

-- Run once every day when pg_cron is available. The schedule is duplicate-safe.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'blogpilot-purge-deleted-blogs') then
      perform cron.schedule(
        'blogpilot-purge-deleted-blogs',
        '17 3 * * *',
        'select public.purge_expired_deleted_blogs();'
      );
    end if;
  end if;
end
$$;

notify pgrst, 'reload schema';
commit;
