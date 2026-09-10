import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function isMissingSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("user_subscriptions") ||
    message.includes("monthly_usage") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

function stripePeriodEnd(object: any) {
  const raw = object?.current_period_end
    ?? object?.items?.data?.[0]?.current_period_end
    ?? object?.cancel_at
    ?? null;
  return raw ? new Date(Number(raw) * 1000).toISOString() : null;
}

async function refreshStripeSubscription(admin: any, row: any, userId: string) {
  if (row?.billing_provider !== "stripe" || !row?.provider_subscription_id || !process.env.STRIPE_SECRET_KEY) return row;

  try {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(row.provider_subscription_id)}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (!response.ok) return row;

    const stripe = await response.json();
    const status = ["active", "trialing", "past_due", "canceled"].includes(stripe?.status)
      ? stripe.status
      : ["unpaid", "paused", "incomplete", "incomplete_expired"].includes(stripe?.status)
        ? "suspended"
        : row.status;
    const plan = ["active", "trialing", "past_due"].includes(status) ? "pro" : "free";
    const currentPeriodEnd = stripePeriodEnd(stripe) ?? row.current_period_end ?? null;
    // Some Stripe cancellation flows expose a concrete cancel_at timestamp instead of
    // relying only on cancel_at_period_end. Treat either as a scheduled cancellation.
    const cancelAtPeriodEnd = Boolean(stripe?.cancel_at_period_end || stripe?.cancel_at);

    const changed = row.plan !== plan
      || row.status !== status
      || row.current_period_end !== currentPeriodEnd
      || Boolean(row.cancel_at_period_end) !== cancelAtPeriodEnd;

    if (changed) {
      const updated = {
        ...row,
        plan,
        status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
      };
      const { error } = await admin.from("user_subscriptions").update({
        plan,
        status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
      if (!error) return updated;
    }

    return {
      ...row,
      plan,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    };
  } catch {
    return row;
  }
}

export const getMyPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const userResult = await admin.auth.admin.getUserById(context.userId);
    if (userResult.error) throw new Error(userResult.error.message);
    const user = userResult.data?.user;
    if (!user) throw new Error("User not found");

    const roleResult = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleResult.error) throw new Error(roleResult.error.message);
    const isAdmin = (roleResult.data ?? []).some((r: any) => r.role === "admin");

    let dbPlan: string | null = null;
    let dbStatus: string | null = null;
    const subscription = await admin
      .from("user_subscriptions")
      .select("plan,status,billing_provider,provider_subscription_id,current_period_end,cancel_at_period_end")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (subscription.error && !isMissingSchema(subscription.error)) throw new Error(subscription.error.message);

    const subscriptionData = !subscription.error && subscription.data
      ? await refreshStripeSubscription(admin, subscription.data, context.userId)
      : null;

    if (subscriptionData) {
      dbPlan = subscriptionData.plan;
      dbStatus = subscriptionData.status;
    }

    const app = user.app_metadata ?? {};
    const explicitMetadataPlan = app.blogpilot_plan === "pro" || app.blogpilot_plan === "free"
      ? app.blogpilot_plan
      : null;
    const metadataStatus = ["active", "trialing", "past_due", "canceled", "suspended"].includes(app.blogpilot_subscription_status)
      ? app.blogpilot_subscription_status
      : null;

    const rawPlan = dbPlan ?? explicitMetadataPlan ?? (isAdmin ? "pro" : "free");
    const status = dbStatus ?? metadataStatus ?? "active";
    const plan = rawPlan === "pro" && ["active", "trialing"].includes(status) ? "pro" : "free";

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const period = periodStart.toISOString().slice(0, 10);

    let aiDrafts = 0;
    let aiImages = 0;
    let autopilotRuns = 0;
    const usage = await admin
      .from("monthly_usage")
      .select("ai_drafts,ai_images,autopilot_runs")
      .eq("user_id", context.userId)
      .eq("period_start", period)
      .maybeSingle();
    if (usage.error && !isMissingSchema(usage.error)) throw new Error(usage.error.message);
    if (!usage.error && usage.data) {
      aiDrafts = Number(usage.data.ai_drafts ?? 0);
      aiImages = Number(usage.data.ai_images ?? 0);
      autopilotRuns = Number(usage.data.autopilot_runs ?? 0);
    } else {
      const month = new Date().toISOString().slice(0, 7);
      if (app.blogpilot_usage_month === month) {
        aiDrafts = Number(app.blogpilot_ai_drafts ?? 0);
        aiImages = Number(app.blogpilot_ai_images ?? 0);
      }
    }

    const { count: blogCount, error: blogError } = await admin
      .from("blogs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if (blogError) throw new Error(blogError.message);

    return {
      plan,
      status,
      isAdmin,
      blogCount: blogCount ?? 0,
      blogLimit: plan === "pro" ? 5 : 1,
      aiDrafts,
      aiDraftLimit: plan === "pro" ? null : 5,
      aiImages,
      autopilotRuns,
      autopilotEnabled: plan === "pro",
      aiImagesEnabled: plan === "pro",
      billingProvider: subscriptionData?.billing_provider ?? "manual",
      currentPeriodEnd: subscriptionData?.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(subscriptionData?.cancel_at_period_end),
    };
  });
