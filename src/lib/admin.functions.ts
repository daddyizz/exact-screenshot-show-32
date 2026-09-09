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

    const snapshot = await (context.supabase as any).rpc("admin_console_snapshot");
    if (!snapshot.error && snapshot.data) return snapshot.data;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [profiles, blogs, posts, roles, authUsers] = await Promise.all([
      admin.from("profiles").select("id, display_name, created_at"),
      admin.from("blogs").select("id, user_id, name, autopilot, posts_per_week"),
      admin.from("posts").select("id, user_id, status"),
      admin.from("user_roles").select("user_id, role"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const err = profiles.error || blogs.error || posts.error || roles.error || authUsers.error;
    if (err) throw new Error(err.message);

    const authMap = new Map((authUsers.data?.users ?? []).map((u: any) => [u.id, u]));
    const users = (profiles.data ?? []).map((p: any) => {
      const userBlogs = (blogs.data ?? []).filter((b: any) => b.user_id === p.id);
      const userPosts = (posts.data ?? []).filter((x: any) => x.user_id === p.id);
      const authUser = authMap.get(p.id) as any;
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
        plan: "free" as const,
        subscriptionStatus: "active",
        billingProvider: "manual",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        usage: { aiDrafts: 0, aiImages: 0, autopilotRuns: 0 },
      };
    });

    users.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
    return {
      totals: {
        users: users.length,
        freeUsers: users.length,
        proUsers: 0,
        mrr: 0,
        blogs: blogs.data?.length ?? 0,
        posts: posts.data?.length ?? 0,
        published: (posts.data ?? []).filter((p: any) => p.status === "published").length,
        autopilotBlogs: (blogs.data ?? []).filter((b: any) => b.autopilot).length,
        aiDrafts: 0,
        aiImages: 0,
      },
      users,
      legacyMode: true,
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "moderator", "user"]), grant: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
    const { error } = await admin.from("user_subscriptions").upsert(
      {
        user_id: data.userId,
        plan: data.plan,
        status: data.status,
        billing_provider: "manual",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    if (data.plan === "free" || data.status === "suspended") {
      const { error: blogError } = await admin
        .from("blogs")
        .update({ autopilot: false, autopilot_auto_publish: false })
        .eq("user_id", data.userId);
      if (blogError) throw new Error(blogError.message);
    }
    return { ok: true };
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), displayName: z.string().trim().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.displayName, updated_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
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

    await admin.from("profiles").upsert({ id: userId, display_name: data.displayName }, { onConflict: "id" });
    await admin.from("user_subscriptions").upsert(
      { user_id: userId, plan: data.plan, status: "active", billing_provider: "manual" },
      { onConflict: "user_id" },
    );
    if (data.role !== "user") {
      await admin.from("user_roles").upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    }
    return { ok: true, userId };
  });
