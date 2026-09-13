create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination_url text not null check (destination_url ~* '^https?://'),
  platform text not null default 'other',
  category text,
  keywords text not null,
  cta_text text not null default 'Check the latest deal',
  short_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  priority integer not null default 0,
  enabled boolean not null default true,
  click_count bigint not null default 0,
  last_clicked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_prompt_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  delay_seconds integer not null default 8 check (delay_seconds between 0 and 120),
  close_snooze_minutes integer not null default 30 check (close_snooze_minutes between 1 and 1440),
  clicked_cooldown_hours integer not null default 24 check (clicked_cooldown_hours between 1 and 168),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.affiliate_prompt_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.affiliate_links enable row level security;
alter table public.affiliate_prompt_settings enable row level security;

revoke all on public.affiliate_links from anon, authenticated;
revoke all on public.affiliate_prompt_settings from anon, authenticated;
grant all on public.affiliate_links to service_role;
grant all on public.affiliate_prompt_settings to service_role;

create or replace function public.record_affiliate_click(p_short_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.affiliate_links
  set click_count = click_count + 1,
      last_clicked_at = now()
  where short_code = p_short_code
    and enabled = true;
end;
$$;

revoke all on function public.record_affiliate_click(text) from public;
grant execute on function public.record_affiliate_click(text) to service_role;
