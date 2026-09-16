begin;

alter table public.affiliate_links
  add column if not exists campaign_name text,
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists max_clicks bigint;

alter table public.affiliate_links
  drop constraint if exists affiliate_links_schedule_valid,
  add constraint affiliate_links_schedule_valid
    check (expires_at is null or starts_at is null or expires_at > starts_at);

alter table public.affiliate_links
  drop constraint if exists affiliate_links_max_clicks_valid,
  add constraint affiliate_links_max_clicks_valid
    check (max_clicks is null or max_clicks > 0);

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
    and enabled = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
    and (max_clicks is null or click_count < max_clicks);
end;
$$;

revoke all on function public.record_affiliate_click(text) from public;
grant execute on function public.record_affiliate_click(text) to service_role;

notify pgrst, 'reload schema';
commit;
