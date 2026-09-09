begin;

create or replace function public.refund_ai_draft_usage(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.monthly_usage
  set ai_drafts = greatest(coalesce(ai_drafts, 0) - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and period_start = date_trunc('month', now())::date;
end;
$$;

create or replace function public.refund_ai_image_usage(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.monthly_usage
  set ai_images = greatest(coalesce(ai_images, 0) - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and period_start = date_trunc('month', now())::date;
end;
$$;

revoke all on function public.refund_ai_draft_usage(uuid) from public, anon, authenticated;
revoke all on function public.refund_ai_image_usage(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_draft_usage(uuid) to service_role;
grant execute on function public.refund_ai_image_usage(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
