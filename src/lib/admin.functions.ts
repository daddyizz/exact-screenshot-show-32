import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

function isMissingBillingSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("user_subscriptions") ||
    message.includes("monthly_usage") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

function metadataPlan(user: any) {
  const plan = user?.app_metadata?.blogpilot_plan;
  return plan === "pro" ? "pro" : "free";
}

function metadataStatus(user: any) {
  const status = user?.app_metadata?.blogpilot_subscription_status;
  return ["active", "trialing", "past_due", "canceled", "suspended"].includes(status)
    ? status
    : "active";
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: Boolean(data) };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    // Prefer the database snapshot when the new billing schema is installed.
    const snapshot = await (context.supabase as any).rpc("admin_console_snapshot");
    if (!snapshot.error && snapshot.data) return snapshot.data;

    // Legacy-safe fallback: only core tables are required.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [profiles, blogs, posts, roles, authUsers] = await Promise.all([
      admin.from("profiles").select("id, display_name, created_at"),
      admin.from("blogs").select("id, user_id, name, autopilot, posts_per_week"),
      admin.from("posts").select("id, user_id, status"),
      admin.from("user_roles").select("user_id, role"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const coreError = profiles.error || blogs.error || posts.error || roles.error || authUsers.error;
    if (coreError) throw new Error(coreError.message);

    let subscriptions: any[] = [];
    let usage: any[] = [];
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const period = periodStart.toISOString().slice(0, 10);

    const subResult = await admin
      .from("user_subscriptions")
      .select("user_id, plan, status, billing_provider, current_period_end, cancel_at_period_end");
    if (subResult.error && !isMissingBillingSchema(subResult.error)) throw new Error(subResult.error.message);
    if (!subResult.error) subscriptions = subResult.data ?? [];

    const usageResult = await admin
      .from("monthly_usage")
      .select("user_id, ai_drafts, ai_images, autopilot_runs")
      .eq("period_start", period);
    if (usageResult.error && !isMissingBillingSchema(usageResult.error)) throw new Error(usageResult.error.message);
    if (!usageResult.error) usage = usageResult.data ?? [];

    const authMap = new Map((authUsers.data?.users ?? []).map((u: any) => [u.id, u]));
    const subMap = new Map(subscriptions.map((s: any) => [s.user_id, s]));
    const usageMap = new Map(usage.map((u: any) => [u.user_id, u]));

    const users = (profiles.data ?? []).map((p: any) => {
      const userBlogs = (blogs.data ?? []).filter((b: any) => b.user_id === p.id);
      const userPosts = (posts.data ?? []).filter((x: any) => x.user_id === p.id);
      const authUser = authMap.get(p.id) as any;
      const subscription = subMap.get(p.id) as any;
      const monthly = (usageMap.get(p.id) as any) ?? { ai_drafts: 0, ai_images: 0, autopilot_runs: 0 };
      const plan = subscription?.plan === "pro" || subscription?.plan === "free"
        ? subscription.plan
        : metadataPlan(authUser);
      const subscriptionStatus = subscription?.status ?? metadataStatus(authUser);

      return {
        id: p.id,
        displayName: p.display_name ?? authUser?.user_metadata?.full_name ?? "(no name)",
        email: authUser?.email ?? "",
        createdAt: p.created_at,
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        blogs: userBlogs.length,
        autopilotBlogs: userBlogs.filter((b: any) => b.autopilot).length,
        posts: userPosts.length,
        published: userPosts.filter((x: any) => x.status === "published").length,
        roles: (roles.data ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role as string),
        plan,
        subscriptionStatus,
        billingProvider: subscription?.billing_provider ?? "manual",
        currentPeriodEnd: subscription?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
        usage: {
          aiDrafts: monthly.ai_drafts ?? 0,
          aiImages: monthly.ai_images ?? 0,
          autopilotRuns: monthly.autopilot_runs ?? 0,
        },
      };
    });

    users.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
    const proUsers = users.filter(
      (u: any) => u.plan === "pro" && ["active", "trialing"].includes(u.subscriptionStatus),
    ).length;

    return {
      totals: {
        users: users.length,
        freeUsers: users.length - proUsers,
        proUsers,
        mrr: proUsers * 49,
        blogs: blogs.data?.length ?? 0,
        posts: posts.data?.length ?? 0,
        published: (posts.data ?? []).filter((p: any) => p.status === "published").length,
        autopilotBlogs: (blogs.data ?? []).filter((b: any) => b.autopilot).length,
        aiDrafts: usage.reduce((sum: number, row: any) => sum + (row.ai_drafts ?? 0), 0),
        aiImages: usage.reduce((sum: number, row: any) => sum + (row.ai_images ?? 0), 0),
      },
      users,
      legacyMode: subscriptions.length === 0,
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "moderator", "user"]),
      grant: z.boolean(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.role === "user") return { ok: true };

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setUserSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      userId: z.string().uuid(),
      plan: z.enum(["free", "pro"]),
      status: z.enum(["active", "trialing", "past_due", "canceled", "suspended"]).default("active"),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const current = await admin.auth.admin.getUserById(data.userId);
    if (current.error) throw new Error(current.error.message);
    const existingAppMetadata = current.data?.user?.app_metadata ?? {};
    const metadataUpdate = await admin.auth.admin.updateUserById(data.userId, {
      app_metadata: {
        ...existingAppMetadata,
        blogpilot_plan: data.plan,
        blogpilot_subscription_status: data.status,
      },
    });
    if (metadataUpdate.error) throw new Error(metadataUpdate.error.message);

    const subscriptionResult = await admin.from("user_subscriptions").upsert(
      {
        user_id: data.userId,
        plan: data.plan,
        status: data.status,
        billing_provider: "manual",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (subscriptionResult.error && !isMissingBillingSchema(subscriptionResult.error)) {
      throw new Error(subscriptionResult.error.message);
    }

    if (data.plan === "free" || data.status === "suspended") {
      const autopilotResult = await admin.from("blogs").update({ autopilot: false }).eq("user_id", data.userId);
      if (autopilotResult.error) throw new Error(autopilotResult.error.message);

      const autoPublishResult = await admin
        .from("blogs")
        .update({ autopilot_auto_publish: false })
        .eq("user_id", data.userId);
      if (autoPublishResult.error) {
        const message = String(autoPublishResult.error.message ?? "").toLowerCase();
        if (!message.includes("autopilot_auto_publish") && !message.includes("schema cache")) {
          throw new Error(autoPublishResult.error.message);
        }
      }
    }
    return { ok: true, storage: subscriptionResult.error ? "metadata" : "database+metadata" };
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), displayName: z.string().trim().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { error } = await admin
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    const current = await admin.auth.admin.getUserById(data.userId);
    if (!current.error && current.data?.user) {
      await admin.auth.admin.updateUserById(data.userId, {
        user_metadata: {
          ...(current.data.user.user_metadata ?? {}),
          full_name: data.displayName,
        },
      });
    }
    return { ok: true };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      email: z.string().email(),
      displayName: z.string().trim().min(1).max(100),
      plan: z.enum(["free", "pro"]).default("free"),
      role: z.enum(["user", "moderator", "admin"]).default("user"),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.displayName },
    });
    if (error) throw new Error(error.message);
    const userId = invited.user?.id;
    if (!userId) throw new Error("Invite created without a user id");

    const metadataResult = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(invited.user?.app_metadata ?? {}),
        blogpilot_plan: data.plan,
        blogpilot_subscription_status: "active",
      },
    });
    if (metadataResult.error) throw new Error(metadataResult.error.message);

    const profileResult = await admin
      .from("profiles")
      .upsert({ id: userId, display_name: data.displayName }, { onConflict: "id" });
    if (profileResult.error) throw new Error(profileResult.error.message);

    const subscriptionResult = await admin.from("user_subscriptions").upsert(
      { user_id: userId, plan: data.plan, status: "active", billing_provider: "manual" },
      { onConflict: "user_id" },
    );
    if (subscriptionResult.error && !isMissingBillingSchema(subscriptionResult.error)) {
      throw new Error(subscriptionResult.error.message);
    }

    if (data.role !== "user") {
      const roleResult = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
      if (roleResult.error) throw new Error(roleResult.error.message);
    }
    return { ok: true, userId };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own admin account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
