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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profiles, blogs, posts, roles] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, created_at"),
      supabaseAdmin.from("blogs").select("id, user_id, name, autopilot, posts_per_week"),
      supabaseAdmin.from("posts").select("id, user_id, status"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const err = profiles.error || blogs.error || posts.error || roles.error;
    if (err) throw new Error(err.message);

    const users = (profiles.data ?? []).map((p) => {
      const userBlogs = (blogs.data ?? []).filter((b) => b.user_id === p.id);
      const userPosts = (posts.data ?? []).filter((x) => x.user_id === p.id);
      return {
        id: p.id,
        displayName: p.display_name ?? "(no name)",
        createdAt: p.created_at,
        blogs: userBlogs.length,
        autopilotBlogs: userBlogs.filter((b) => b.autopilot).length,
        posts: userPosts.length,
        published: userPosts.filter((x) => x.status === "published").length,
        roles: (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      };
    });

    users.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return {
      totals: {
        users: users.length,
        blogs: blogs.data?.length ?? 0,
        posts: posts.data?.length ?? 0,
        published: (posts.data ?? []).filter((p) => p.status === "published").length,
        autopilotBlogs: (blogs.data ?? []).filter((b) => b.autopilot).length,
      },
      users,
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "moderator", "user"]),
        grant: z.boolean(),
      })
      .parse(data),
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
