begin;

alter table public.blogs
  add column if not exists autopilot_auto_publish boolean not null default false;

create or replace function public.consume_ai_image_usage(p_user_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_plan text;
  v_period date := date_trunc('month', now())::date;
  v_used int;
begin
  select coalesce((
    select plan from public.user_subscriptions
    where user_id=p_user_id and status in ('active','trialing')
  ), 'free') into v_plan;

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

-- Existing legacy Free accounts must not keep paid-only autopilot enabled.
update public.blogs b
set autopilot=false, autopilot_auto_publish=false
where (b.autopilot=true or b.autopilot_auto_publish=true)
  and coalesce((
    select s.plan
    from public.user_subscriptions s
    where s.user_id=b.user_id and s.status in ('active','trialing')
  ), 'free') <> 'pro';

commit;
