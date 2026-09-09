create or replace function public.admin_console_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
  v_period date := date_trunc('month', now())::date;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;

  with base_users as (
    select
      au.id,
      coalesce(p.display_name, au.raw_user_meta_data->>'full_name', '(no name)') as display_name,
      coalesce(au.email, '') as email,
      coalesce(p.created_at, au.created_at) as created_at,
      au.last_sign_in_at,
      coalesce(s.plan, 'free') as plan,
      coalesce(s.status, 'active') as subscription_status,
      coalesce(s.billing_provider, 'manual') as billing_provider,
      s.current_period_end,
      coalesce(s.cancel_at_period_end, false) as cancel_at_period_end,
      coalesce(mu.ai_drafts, 0) as ai_drafts,
      coalesce(mu.ai_images, 0) as ai_images,
      coalesce(mu.autopilot_runs, 0) as autopilot_runs,
      coalesce((select count(*) from public.blogs b where b.user_id = au.id), 0) as blogs,
      coalesce((select count(*) from public.blogs b where b.user_id = au.id and coalesce(b.autopilot,false)), 0) as autopilot_blogs,
      coalesce((select count(*) from public.posts po where po.user_id = au.id), 0) as posts,
      coalesce((select count(*) from public.posts po where po.user_id = au.id and po.status = 'published'), 0) as published,
      coalesce((select array_agg(ur.role::text order by ur.role::text) from public.user_roles ur where ur.user_id = au.id), array[]::text[]) as roles
    from auth.users au
    left join public.profiles p on p.id = au.id
    left join public.user_subscriptions s on s.user_id = au.id
    left join public.monthly_usage mu on mu.user_id = au.id and mu.period_start = v_period
  ),
  totals as (
    select
      count(*)::int as users,
      count(*) filter (where plan = 'pro' and subscription_status in ('active','trialing'))::int as pro_users,
      count(*) filter (where not (plan = 'pro' and subscription_status in ('active','trialing')))::int as free_users,
      coalesce(sum(blogs),0)::int as blogs,
      coalesce(sum(posts),0)::int as posts,
      coalesce(sum(published),0)::int as published,
      coalesce(sum(autopilot_blogs),0)::int as autopilot_blogs,
      coalesce(sum(ai_drafts),0)::int as ai_drafts,
      coalesce(sum(ai_images),0)::int as ai_images
    from base_users
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', t.users,
      'freeUsers', t.free_users,
      'proUsers', t.pro_users,
      'mrr', t.pro_users * 49,
      'blogs', t.blogs,
      'posts', t.posts,
      'published', t.published,
      'autopilotBlogs', t.autopilot_blogs,
      'aiDrafts', t.ai_drafts,
      'aiImages', t.ai_images
    ),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'displayName', u.display_name,
        'email', u.email,
        'createdAt', u.created_at,
        'lastSignInAt', u.last_sign_in_at,
        'blogs', u.blogs,
        'autopilotBlogs', u.autopilot_blogs,
        'posts', u.posts,
        'published', u.published,
        'roles', to_jsonb(u.roles),
        'plan', u.plan,
        'subscriptionStatus', u.subscription_status,
        'billingProvider', u.billing_provider,
        'currentPeriodEnd', u.current_period_end,
        'cancelAtPeriodEnd', u.cancel_at_period_end,
        'usage', jsonb_build_object(
          'aiDrafts', u.ai_drafts,
          'aiImages', u.ai_images,
          'autopilotRuns', u.autopilot_runs
        )
      ) order by u.created_at desc)
      from base_users u
    ), '[]'::jsonb)
  ) into v_result
  from totals t;

  return v_result;
end;
$$;

revoke all on function public.admin_console_snapshot() from public, anon;
grant execute on function public.admin_console_snapshot() to authenticated;
