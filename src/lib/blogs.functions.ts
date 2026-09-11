import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function isMissingBillingSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("user_subscriptions") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

async function resolveEffectivePlan(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const subscription = await admin
    .from("user_subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!subscription.error && subscription.data) {
    return subscription.data.plan === "pro" && ["active", "trialing"].includes(subscription.data.status)
      ? "pro"
      : "free";
  }
  if (subscription.error && !isMissingBillingSchema(subscription.error)) {
    throw new Error(subscription.error.message);
  }

  const userResult = await admin.auth.admin.getUserById(userId);
  if (userResult.error) throw new Error(userResult.error.message);
  const user = userResult.data?.user;
  if (!user) throw new Error("User not found");

  const app = user.app_metadata ?? {};
  const metadataStatus = app.blogpilot_subscription_status ?? "active";
  if (app.blogpilot_plan === "pro") {
    return ["active", "trialing"].includes(metadataStatus) ? "pro" : "free";
  }
  if (app.blogpilot_plan === "free" || ["past_due", "canceled", "suspended"].includes(metadataStatus)) {
    return "free";
  }

  const role = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role.error) throw new Error(role.error.message);
  return role.data ? "pro" : "free";
}

export const createBlog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      name: z.string().trim().min(1).max(120),
      blogUrl: z.string().trim().url().max(500).nullable().optional(),
      niche: z.string().trim().min(1).max(120),
      targetCountry: z.string().trim().min(2).max(8),
      language: z.string().trim().min(2).max(16),
      postsPerWeek: z.number().int().min(1).max(21),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const plan = await resolveEffectivePlan(context.userId);
    const blogLimit = plan === "pro" ? 5 : 1;

    const { count, error: countError } = await admin
      .from("blogs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("deleted_at", null);
    if (countError) throw new Error(countError.message);

    if ((count ?? 0) >= blogLimit) {
      throw new Error(
        plan === "pro"
          ? "Your Pro plan supports up to 5 active blogs. Move an existing blog to Trash before adding another."
          : "Your Free plan supports 1 active blog. Upgrade to Pro to manage up to 5 blogs.",
      );
    }

    const { data: blog, error } = await admin
      .from("blogs")
      .insert({
        user_id: context.userId,
        name: data.name,
        blog_url: data.blogUrl || null,
        niche: data.niche,
        target_country: data.targetCountry,
        language: data.language,
        posts_per_week: data.postsPerWeek,
      })
      .select("id,name")
      .single();

    if (error) {
      const message = String(error.message ?? "");
      if (message.toLowerCase().includes("blog") && message.toLowerCase().includes("limit")) {
        throw new Error(plan === "pro" ? "Your Pro plan supports up to 5 active blogs." : "Your Free plan supports 1 active blog.");
      }
      throw new Error(message);
    }

    return { blog, plan, blogLimit };
  });
