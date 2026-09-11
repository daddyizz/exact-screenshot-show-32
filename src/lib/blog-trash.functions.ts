import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeActivity } from "./operations.server";

const BLOG_RETENTION_DAYS = 90;

export const listDeletedBlogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: blogs, error } = await admin
      .from("blogs")
      .select("id,name,niche,blog_url,deleted_at,purge_after,created_at,posts_per_week,tone,language,target_country,article_length,keyword_focus,autopilot,autopilot_auto_publish,ai_image_aspect_ratio,ai_image_style,ai_image_custom_width,ai_image_custom_height")
      .eq("user_id", context.userId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (blogs ?? []).map((blog: any) => blog.id);
    let counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: posts, error: postsError } = await admin
        .from("posts")
        .select("blog_id")
        .in("blog_id", ids);
      if (postsError) throw new Error(postsError.message);
      counts = new Map();
      for (const row of posts ?? []) counts.set(row.blog_id, (counts.get(row.blog_id) ?? 0) + 1);
    }

    return (blogs ?? []).map((blog: any) => ({
      ...blog,
      postCount: counts.get(blog.id) ?? 0,
    }));
  });

export const deleteBlogToTrash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ blogId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: blog, error: lookupError } = await admin
      .from("blogs")
      .select("id,name,deleted_at")
      .eq("id", data.blogId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!blog) throw new Error("Blog not found.");
    if (blog.deleted_at) return { ok: true, alreadyDeleted: true };

    const deletedAt = new Date();
    const purgeAfter = new Date(deletedAt.getTime() + BLOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await admin
      .from("blogs")
      .update({ deleted_at: deletedAt.toISOString(), purge_after: purgeAfter.toISOString() })
      .eq("id", data.blogId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    await writeActivity(admin, {
      userId: context.userId,
      actorUserId: context.userId,
      eventType: "blog.trashed",
      entityType: "blog",
      entityId: data.blogId,
      status: "info",
      message: `Blog moved to Trash: ${blog.name}`,
      metadata: { purgeAfter: purgeAfter.toISOString(), retentionDays: BLOG_RETENTION_DAYS },
    });

    return { ok: true, purgeAfter: purgeAfter.toISOString() };
  });

export const restoreDeletedBlog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ blogId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: blog, error: lookupError } = await admin
      .from("blogs")
      .select("id,name,deleted_at,purge_after")
      .eq("id", data.blogId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!blog) throw new Error("Deleted blog not found.");
    if (!blog.deleted_at) return { ok: true, alreadyRestored: true };

    if (blog.purge_after && new Date(blog.purge_after).getTime() <= Date.now()) {
      throw new Error("This blog has passed its 90-day recovery window and can no longer be restored.");
    }

    const { error } = await admin
      .from("blogs")
      .update({ deleted_at: null, purge_after: null })
      .eq("id", data.blogId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    await writeActivity(admin, {
      userId: context.userId,
      actorUserId: context.userId,
      eventType: "blog.restored",
      entityType: "blog",
      entityId: data.blogId,
      status: "success",
      message: `Blog restored with its saved content and settings: ${blog.name}`,
      metadata: { restoredFromTrash: true },
    });

    return { ok: true };
  });
