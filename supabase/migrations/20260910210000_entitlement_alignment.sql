begin;

create or replace function public.resolve_effective_plan(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_plan text;
  v_status text;
  v_meta jsonb;
  v_is_admin boolean := false;
begin
  select s.plan, s.status
    into v_plan, v_status
  from public.user_subscriptions s
  where s.user_id = p_user_id
  limit 1;

  if v_plan in ('free','pro') and v_status in ('active','trialing') then
    return v_plan;
  end if;

  select raw_app_meta_data into v_meta
  from auth.users
  where id = p_user_id;

  if coalesce(v_meta->>'blogpilot_plan','') in ('free','pro') then
    if coalesce(v_meta->>'blogpilot_subscription_status','active') in ('active','trialing') then
      return v_meta->>'blogpilot_plan';
    end if;
    return 'free';
  end if;

  if to_regclass('public.user_roles') is not null then
    select exists(
      select 1 from public.user_roles r
      where r.user_id = p_user_id and r.role::text = 'admin'
    ) into v_is_admin;
  end if;

  return case when v_is_admin then 'pro' else 'free' end;
end $$;

revoke all on function public.resolve_effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.resolve_effective_plan(uuid) to service_role;

create or replace function public.enforce_blog_plan_limits()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_plan text;
  v_count int;
  v_limit int;
begin
  v_plan := public.resolve_effective_plan(new.user_id);
  v_limit := case when v_plan='pro' then 5 else 1 end;

  if tg_op='INSERT' then
    select count(*) into v_count from public.blogs where user_id=new.user_id;
  else
    select count(*) into v_count from public.blogs where user_id=new.user_id and id<>new.id;
  end if;

  if v_count >= v_limit then
    raise exception 'Your % plan allows up to % blog(s).', upper(v_plan), v_limit;
  end if;

  if v_plan <> 'pro' and coalesce(new.autopilot,false) then
    raise exception 'Autopilot is available on the Pro plan.';
  end if;

  return new;
end $$;

revoke all on function public.enforce_blog_plan_limits() from public, anon, authenticated;
grant execute on function public.enforce_blog_plan_limits() to service_role;

create or replace function public.consume_ai_draft_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_plan text := public.resolve_effective_plan(p_user_id);
  v_period date := date_trunc('month', now())::date;
  v_used int;
begin
  insert into public.monthly_usage(user_id,period_start,ai_drafts)
  values(p_user_id,v_period,0)
  on conflict(user_id,period_start) do nothing;

  select ai_drafts into v_used
  from public.monthly_usage
  where user_id=p_user_id and period_start=v_period
  for update;

  if v_plan <> 'pro' and v_used >= 5 then
    raise exception 'Free plan limit reached: 5 AI drafts per month. Upgrade to Pro for unlimited drafts.';
  end if;

  update public.monthly_usage
  set ai_drafts=ai_drafts+1, updated_at=now()
  where user_id=p_user_id and period_start=v_period
  returning ai_drafts into v_used;

  return v_used;
end $$;

revoke all on function public.consume_ai_draft_usage(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_draft_usage(uuid) to service_role;

create or replace function public.consume_ai_image_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_plan text := public.resolve_effective_plan(p_user_id);
  v_period date := date_trunc('month', now())::date;
  v_used int;
begin
  if v_plan <> 'pro' then
    raise exception 'AI cover images are available on the Pro plan.';
  end if;

  insert into public.monthly_usage(user_id,period_start,ai_images)
  values(p_user_id,v_period,0)
  on conflict(user_id,period_start) do nothing;

  update public.monthly_usage
  set ai_images=ai_images+1, updated_at=now()
  where user_id=p_user_id and period_start=v_period
  returning ai_images into v_used;

  return v_used;
end $$;

revoke all on function public.consume_ai_image_usage(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_image_usage(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
