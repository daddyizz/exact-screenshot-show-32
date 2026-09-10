import { createFileRoute } from "@tanstack/react-router";
import { writeActivity } from "@/lib/operations.server";
import { createNotification } from "@/lib/notifications.server";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");

  return signatures.some((sig) => {
    const actualBuf = Buffer.from(sig, "utf8");
    return actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf);
  });
}

function normalizeStripeStatus(status: string | null | undefined) {
  if (status === "active") return "active" as const;
  if (status === "trialing") return "trialing" as const;
  if (status === "past_due") return "past_due" as const;
  if (status === "canceled") return "canceled" as const;
  if (status === "unpaid" || status === "paused" || status === "incomplete" || status === "incomplete_expired") return "suspended" as const;
  return "active" as const;
}

async function resolveUserId(admin: any, object: any) {
  const direct = object?.metadata?.blogpilot_user_id || object?.client_reference_id;
  if (direct) return String(direct);

  const subscriptionId = typeof object?.subscription === "string" ? object.subscription : object?.id?.startsWith?.("sub_") ? object.id : null;
  if (subscriptionId) {
    const found = await admin.from("user_subscriptions").select("user_id").eq("provider_subscription_id", subscriptionId).maybeSingle();
    if (!found.error && found.data?.user_id) return found.data.user_id as string;
  }

  const customerId = typeof object?.customer === "string" ? object.customer : null;
  if (customerId) {
    const found = await admin.from("user_subscriptions").select("user_id").eq("provider_customer_id", customerId).maybeSingle();
    if (!found.error && found.data?.user_id) return found.data.user_id as string;
  }

  return null;
}

async function syncEntitlement(admin: any, eventType: string, object: any) {
  const userId = await resolveUserId(admin, object);
  if (!userId) return { handled: false, reason: "user_not_found" };

  const isCheckout = eventType === "checkout.session.completed";
  const stripeStatus = isCheckout ? "active" : object?.status;
  const status = normalizeStripeStatus(stripeStatus);
  const plan = status === "active" || status === "trialing" || status === "past_due" ? "pro" : "free";
  const customerId = typeof object?.customer === "string" ? object.customer : null;
  const subscriptionId = isCheckout
    ? (typeof object?.subscription === "string" ? object.subscription : null)
    : (typeof object?.id === "string" && object.id.startsWith("sub_") ? object.id : null);
  const periodEnd = object?.current_period_end ? new Date(Number(object.current_period_end) * 1000).toISOString() : null;
  const cancelAtPeriodEnd = Boolean(object?.cancel_at_period_end);

  const existing = await admin.from("user_subscriptions").select("provider_customer_id,provider_subscription_id").eq("user_id", userId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const { error } = await admin.from("user_subscriptions").upsert({
    user_id: userId,
    plan,
    status,
    billing_provider: "stripe",
    provider_customer_id: customerId ?? existing.data?.provider_customer_id ?? null,
    provider_subscription_id: subscriptionId ?? existing.data?.provider_subscription_id ?? null,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);

  const userResult = await admin.auth.admin.getUserById(userId);
  if (!userResult.error && userResult.data?.user) {
    const app = userResult.data.user.app_metadata ?? {};
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...app,
        blogpilot_plan: plan,
        blogpilot_subscription_status: status,
      },
    });
  }

  if (!(status === "active" || status === "trialing")) {
    await admin.from("blogs").update({ autopilot: false }).eq("user_id", userId);
    const autoPublish = await admin.from("blogs").update({ autopilot_auto_publish: false }).eq("user_id", userId);
    if (autoPublish.error) {
      const msg = String(autoPublish.error.message ?? "").toLowerCase();
      if (!msg.includes("autopilot_auto_publish") && !msg.includes("schema cache")) throw new Error(autoPublish.error.message);
    }
  }

  const eventName = eventType === "checkout.session.completed"
    ? "billing.checkout_completed"
    : eventType === "customer.subscription.deleted"
      ? "billing.subscription_canceled"
      : "billing.subscription_updated";

  await writeActivity(admin, {
    userId,
    eventType: eventName,
    entityType: "user",
    entityId: userId,
    status: status === "past_due" || status === "suspended" ? "failed" : "success",
    message: eventType === "checkout.session.completed"
      ? "Stripe Checkout completed"
      : `Stripe subscription status: ${status}`,
    metadata: { stripeEventType: eventType, plan, status, cancelAtPeriodEnd },
  });

  if (eventType === "checkout.session.completed") {
    await createNotification(admin, {
      userId,
      type: "billing.upgraded",
      title: "Welcome to BlogPilot Pro",
      message: "Your Pro subscription is now active.",
      severity: "success",
      actionUrl: "/dashboard",
      actionLabel: "Open dashboard",
      dedupeKey: `stripe-upgrade:${subscriptionId ?? object?.id ?? "checkout"}`,
    });
  } else if (status === "past_due" || status === "suspended") {
    await createNotification(admin, {
      userId,
      type: "billing.payment_attention",
      title: "Payment needs attention",
      message: "Your BlogPilot Pro subscription needs billing attention.",
      severity: "warning",
      actionUrl: "/dashboard",
      actionLabel: "Manage billing",
      dedupeKey: `stripe-billing-attention:${subscriptionId ?? "subscription"}`,
    });
  }

  return { handled: true, userId, plan, status };
}

async function handle(request: Request) {
  const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe-Signature", { status: 400 });

  const payload = await request.text();
  if (!(await verifyStripeSignature(payload, signature, webhookSecret))) {
    return new Response("Invalid Stripe signature", { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(payload); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const supported = new Set([
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const seen = await admin.from("stripe_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (!seen.error && seen.data?.event_id) return Response.json({ received: true, duplicate: true });
  if (seen.error) {
    const msg = String(seen.error.message ?? "").toLowerCase();
    if (!msg.includes("stripe_webhook_events") && !msg.includes("schema cache") && !msg.includes("does not exist")) throw new Error(seen.error.message);
  }

  if (supported.has(event.type)) await syncEntitlement(admin, event.type, event.data?.object ?? {});

  if (!seen.error) {
    const recorded = await admin.from("stripe_webhook_events").insert({ event_id: event.id, event_type: event.type });
    if (recorded.error && !String(recorded.error.code ?? "").includes("23505")) throw new Error(recorded.error.message);
  }

  return Response.json({ received: true });
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
