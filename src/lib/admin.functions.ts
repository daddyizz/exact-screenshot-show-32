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
    const { data, error } = await (context.supabase as any).rpc("admin_console_snapshot");
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Admin console returned no data");
    return data;
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
