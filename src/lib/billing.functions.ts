import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeActivity } from "./operations.server";

function stripeConfig() {
  const secretKey = process.env['STRIPE_SECRET_KEY'];
  const proPriceId = process.env['STRIPE_PRO_PRICE_ID'];
  if (!secretKey) throw new Error("Stripe is not configured yet: missing STRIPE_SECRET_KEY.");
  if (!proPriceId) throw new Error("Stripe is not configured yet: missing STRIPE_PRO_PRICE_ID.");
  return { secretKey, proPriceId };
}

async function stripePost(path: string, params: URLSearchParams, secretKey: string) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function ensureStripeCustomer(admin: any, user: any, userId: string, secretKey: string) {
  const existing = await admin
    .from("user_subscriptions")
    .select("provider_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.provider_customer_id) return existing.data.provider_customer_id as string;

  const params = new URLSearchParams();
  if (user.email) params.set("email", user.email);
  params.set("metadata[blogpilot_user_id]", userId);
  const customer = await stripePost("/v1/customers", params, secretKey);

  const { error } = await admin.from("user_subscriptions").upsert({
    user_id: userId,
    plan: "free",
    status: "active",
    billing_provider: "stripe",
    provider_customer_id: customer.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return customer.id as string;
}

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ origin: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { secretKey, proPriceId } = stripeConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const userResult = await admin.auth.admin.getUserById(context.userId);
    if (userResult.error || !userResult.data?.user) throw new Error(userResult.error?.message || "User not found");

    const customerId = await ensureStripeCustomer(admin, userResult.data.user, context.userId, secretKey);
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("customer", customerId);
    params.set("line_items[0][price]", proPriceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${data.origin}/dashboard?stripe=success`);
    params.set("cancel_url", `${data.origin}/dashboard?stripe=cancelled`);
    params.set("client_reference_id", context.userId);
    params.set("subscription_data[metadata][blogpilot_user_id]", context.userId);
    params.set("metadata[blogpilot_user_id]", context.userId);
    params.set("allow_promotion_codes", "true");

    const session = await stripePost("/v1/checkout/sessions", params, secretKey);
    if (!session?.url) throw new Error("Stripe Checkout did not return a redirect URL.");
    await writeActivity(admin, { userId: context.userId, eventType: "billing.checkout_started", entityType: "user", entityId: context.userId, message: "Stripe Checkout session created", metadata: { mode: "test_or_live_from_key" } });
    return { url: session.url as string };
  });

export const createStripePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ origin: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { secretKey } = stripeConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const userResult = await admin.auth.admin.getUserById(context.userId);
    if (userResult.error || !userResult.data?.user) throw new Error(userResult.error?.message || "User not found");
    const customerId = await ensureStripeCustomer(admin, userResult.data.user, context.userId, secretKey);

    const params = new URLSearchParams();
    params.set("customer", customerId);
    params.set("return_url", `${data.origin}/dashboard`);
    const session = await stripePost("/v1/billing_portal/sessions", params, secretKey);
    if (!session?.url) throw new Error("Stripe Customer Portal did not return a redirect URL.");
    await writeActivity(admin, { userId: context.userId, eventType: "billing.portal_opened", entityType: "user", entityId: context.userId, message: "Stripe Customer Portal opened" });
    return { url: session.url as string };
  });
