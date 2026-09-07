import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        blogId: z.string().uuid(),
        autopilot: z.boolean().optional(),
        autoPublish: z.boolean().optional(),
        postsPerWeek: z.number().min(1).max(14).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      autopilot?: boolean;
      autopilot_auto_publish?: boolean;
      posts_per_week?: number;
    } = {};
    if (data.autopilot !== undefined) patch.autopilot = data.autopilot;
    if (data.autoPublish !== undefined) patch.autopilot_auto_publish = data.autoPublish;
    if (data.postsPerWeek !== undefined) patch.posts_per_week = data.postsPerWeek;
    if (Object.keys(patch).length === 0) return { ok: true };


    const { error } = await context.supabase.from("blogs").update(patch).eq("id", data.blogId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runAutopilotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ blogId: z.string().uuid(), origin: z.string().url().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: blog, error } = await context.supabase
      .from("blogs")
      .select("*")
      .eq("id", data.blogId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!blog) throw new Error("Blog not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAutopilotForBlog } = await import("./autopilot.server");
    const outcome = await runAutopilotForBlog(supabaseAdmin, blog, data.origin);

    await supabaseAdmin
      .from("blogs")
      .update({ autopilot_last_run_at: new Date().toISOString() })
      .eq("id", blog.id);

    if (outcome.status === "error") throw new Error(outcome.detail);
    return outcome;
  });
