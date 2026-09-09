begin;

create table if not exists public.ad_daily_stats (
  placement_id uuid not null references public.ad_placements(id) on delete cascade,
  stat_date date not null default current_date,
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  updated_at timestamptz not null default now(),
  primary key (placement_id, stat_date)
);

alter table public.ad_daily_stats enable row level security;
revoke all on table public.ad_daily_stats from anon, authenticated;
grant all on table public.ad_daily_stats to service_role;

create or replace function public.record_ad_event(p_placement_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in ('impression','click') then return; end if;
  if not exists (select 1 from public.ad_placements where id = p_placement_id and is_active = true) then return; end if;
  insert into public.ad_daily_stats(placement_id, stat_date, impressions, clicks)
  values (p_placement_id, current_date, case when p_event='impression' then 1 else 0 end, case when p_event='click' then 1 else 0 end)
  on conflict (placement_id, stat_date) do update set
    impressions = public.ad_daily_stats.impressions + case when p_event='impression' then 1 else 0 end,
    clicks = public.ad_daily_stats.clicks + case when p_event='click' then 1 else 0 end,
    updated_at = now();
end;
$$;
revoke all on function public.record_ad_event(uuid,text) from public;
grant execute on function public.record_ad_event(uuid,text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
