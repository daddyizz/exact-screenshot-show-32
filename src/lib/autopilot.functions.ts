import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeActivity, writeAutopilotRun } from "./operations.server";

function isMissingBillingSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("user_subscriptions") || message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table");
}

async function hasProEntitlement(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const subscription = await admin.from("user_subscriptions").select("plan, status").eq("user_id", userId).maybeSingle();
  if (!subscription.error && subscription.data) return subscription.data.plan === "pro" && ["active", "trialing"].includes(subscription.data.status);
  if (subscription.error && !isMissingBillingSchema(subscription.error)) throw new Error(subscription.error.message);

  const userResult = await admin.auth.admin.getUserById(userId);
  if (userResult.error) throw new Error(userResult.error.message);
  const user = userResult.data?.user;
  if (!user) throw new Error("User not found");
  const app = user.app_metadata ?? {};
  const metadataStatus = app.blogpilot_subscription_status ?? "active";
  if (app.blogpilot_plan === "pro" && ["active", "trialing"].includes(metadataStatus)) return true;
  if (metadataStatus === "suspended") return false;
  const role = await admin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (role.error) throw new Error(role.error.message);
  return Boolean(role.data);
}

async function requirePro(userId: string) {
  if (!(await hasProEntitlement(userId))) throw new Error("Autopilot is available on the Pro plan.");
}

function isMissingAutoPublishColumn(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("autopilot_auto_publish") || message.includes("schema cache");
}

export const updateAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ blogId: z.string().uuid(), autopilot: z.boolean().optional(), autoPublish: z.boolean().optional(), postsPerWeek: z.number().min(1).max(14).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.autopilot === true || data.autoPublish === true) await requirePro(context.userId);
    const basePatch: { autopilot?: boolean; posts_per_week?: number } = {};
    if (data.autopilot !== undefined) basePatch.autopilot = data.autopilot;
    if (data.postsPerWeek !== undefined) basePatch.posts_per_week = data.postsPerWeek;
    if (Object.keys(basePatch).length > 0) {
      const { error } = await context.supabase.from("blogs").update(basePatch).eq("id", data.blogId);
      if (error) throw new Error(error.message);
    }
    if (data.autoPublish !== undefined) {
      const { error } = await context.supabase.from("blogs").update({ autopilot_auto_publish: data.autoPublish } as any).eq("id", data.blogId);
      if (error && !isMissingAutoPublishColumn(error)) throw new Error(error.message);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await writeActivity(supabaseAdmin, { userId: context.userId, actorUserId: context.userId, eventType: "autopilot.settings_updated", entityType: "blog", entityId: data.blogId, message: "Autopilot settings updated", metadata: data });
    return { ok: true };
  });

export const runAutopilotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ blogId: z.string().uuid(), origin: z.string().url().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    await requirePro(context.userId);
    const { data: blog, error } = await context.supabase.from("blogs").select("*").eq("id", data.blogId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!blog) throw new Error("Blog not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAutopilotForBlog } = await import("./autopilot.server");
    const startedAt = new Date().toISOString();
    const outcome = await runAutopilotForBlog(supabaseAdmin, blog, data.origin);
    await supabaseAdmin.from("blogs").update({ autopilot_last_run_at: new Date().toISOString() }).eq("id", blog.id);
    await writeAutopilotRun(supabaseAdmin, { userId: context.userId, blogId: blog.id, postId: outcome.postId, triggerSource: "manual", status: outcome.status, detail: outcome.detail, publishedUrl: outcome.url, startedAt });
    await writeActivity(supabaseAdmin, { userId: context.userId, actorUserId: context.userId, eventType: "autopilot.run", entityType: "blog", entityId: blog.id, status: outcome.status === "error" ? "failed" : "success", message: outcome.detail, metadata: { outcome: outcome.status } });
    if (outcome.status === "error") throw new Error(outcome.detail);
    return outcome;
  });

export const runDueAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ origin: z.string().url().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    if (!(await hasProEntitlement(context.userId))) return { ran: 0, results: [], skipped: "pro_required" as const };
    const { data: blogs, error } = await context.supabase.from("blogs").select("*").eq("autopilot", true);
    if (error) throw new Error(error.message);
    const { isBlogDue, runAutopilotForBlog } = await import("./autopilot.server");
    const due = (blogs ?? []).filter(isBlogDue).slice(0, 2);
    if (due.length === 0) return { ran: 0, results: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results = [];
    for (const blog of due) {
      const startedAt = new Date().toISOString();
      const outcome = await runAutopilotForBlog(supabaseAdmin, blog, data.origin);
      results.push(outcome);
      await supabaseAdmin.from("blogs").update({ autopilot_last_run_at: new Date().toISOString() }).eq("id", blog.id);
      await writeAutopilotRun(supabaseAdmin, { userId: context.userId, blogId: blog.id, postId: outcome.postId, triggerSource: "dashboard", status: outcome.status, detail: outcome.detail, publishedUrl: outcome.url, startedAt });
    }
    return { ran: results.length, results };
  });
