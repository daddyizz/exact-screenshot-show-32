-- Blogger connections: owner-scoped writes
DROP POLICY IF EXISTS blogger_connections_insert_own ON public.blogger_connections;
CREATE POLICY blogger_connections_insert_own ON public.blogger_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS blogger_connections_update_own ON public.blogger_connections;
CREATE POLICY blogger_connections_update_own ON public.blogger_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT INSERT, UPDATE ON public.blogger_connections TO authenticated;

-- Admin visibility policies for backend-owned tables
GRANT SELECT ON public.ad_daily_stats TO authenticated;
GRANT ALL ON public.ad_daily_stats TO service_role;
DROP POLICY IF EXISTS ad_daily_stats_admin_select ON public.ad_daily_stats;
CREATE POLICY ad_daily_stats_admin_select ON public.ad_daily_stats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.autopilot_run_locks TO authenticated;
GRANT ALL ON public.autopilot_run_locks TO service_role;
DROP POLICY IF EXISTS autopilot_run_locks_admin_select ON public.autopilot_run_locks;
CREATE POLICY autopilot_run_locks_admin_select ON public.autopilot_run_locks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
DROP POLICY IF EXISTS stripe_webhook_events_admin_select ON public.stripe_webhook_events;
CREATE POLICY stripe_webhook_events_admin_select ON public.stripe_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.website_diagnostics TO authenticated;
GRANT ALL ON public.website_diagnostics TO service_role;
DROP POLICY IF EXISTS website_diagnostics_admin_select ON public.website_diagnostics;
CREATE POLICY website_diagnostics_admin_select ON public.website_diagnostics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS website_diagnostics_select_own ON public.website_diagnostics;
CREATE POLICY website_diagnostics_select_own ON public.website_diagnostics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- SECURITY DEFINER routines are backend-only: revoke direct API execution
REVOKE ALL ON FUNCTION public.acquire_autopilot_run_lock(uuid, integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.release_autopilot_run_lock(uuid, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.consume_ai_draft_usage(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.consume_ai_image_usage(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.refund_ai_draft_usage(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.refund_ai_image_usage(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.resolve_effective_plan(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.record_ad_event(uuid, text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.acquire_autopilot_run_lock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_autopilot_run_lock(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_draft_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_image_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_draft_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_image_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_effective_plan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_ad_event(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';