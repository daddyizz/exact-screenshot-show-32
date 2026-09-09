begin;

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','suspended')),
  billing_provider text not null default 'manual' check (billing_provider in ('manual','stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  ai_drafts integer not null default 0 check (ai_drafts >= 0),
  ai_images integer not null default 0 check (ai_images >= 0),
  autopilot_runs integer not null default 0 check (autopilot_runs >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

alter table public.user_subscriptions enable row level security;
alter table public.monthly_usage enable row level security;

drop policy if exists "Users can read own subscription" on public.user_subscriptions;
create policy "Users can read own subscription"
on public.user_subscriptions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own monthly usage" on public.monthly_usage;
create policy "Users can read own monthly usage"
on public.monthly_usage for select to authenticated
using (auth.uid() = user_id);

create or replace function public.enforce_blog_plan_limits()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_plan text;
  v_count int;
  v_limit int;
begin
  select coalesce((
    select plan from public.user_subscriptions
    where user_id = new.user_id and status in ('active','trialing')
  ), 'free') into v_plan;

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

drop trigger if exists trg_enforce_blog_plan_limits on public.blogs;
create trigger trg_enforce_blog_plan_limits
before insert or update of user_id,autopilot on public.blogs
for each row execute function public.enforce_blog_plan_limits();

create or replace function public.consume_ai_draft_usage(p_user_id uuid)
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

commit;
