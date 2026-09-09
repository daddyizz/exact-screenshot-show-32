import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { missingObservabilitySchema } from "./operations.server";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

export const getOperationsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [blogs, posts, connections, bucket] = await Promise.all([
      admin.from("blogs").select("id,user_id,name,autopilot,autopilot_last_run_at"),
      admin.from("posts").select("id,status,updated_at").order("updated_at", { ascending: false }).limit(1),
      admin.from("blogger_connections").select("id,token_expires_at,blogger_blog_id"),
      admin.storage.getBucket("post-images"),
    ]);

    const coreError = blogs.error || posts.error || connections.error;
    if (coreError) throw new Error(coreError.message);

    let activities: any[] = [];
    let runs: any[] = [];
    let observabilityReady = true;

    const activityResult = await admin
      .from("activity_logs")
      .select("id,user_id,actor_user_id,event_type,entity_type,entity_id,status,message,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (activityResult.error) {
      if (!missingObservabilitySchema(activityResult.error)) throw new Error(activityResult.error.message);
      observabilityReady = false;
    } else activities = activityResult.data ?? [];

    const runsResult = await admin
      .from("autopilot_runs")
      .select("id,user_id,blog_id,post_id,trigger_source,status,detail,published_url,started_at,finished_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (runsResult.error) {
      if (!missingObservabilitySchema(runsResult.error)) throw new Error(runsResult.error.message);
      observabilityReady = false;
    } else runs = runsResult.data ?? [];

    const blogMap = new Map((blogs.data ?? []).map((b: any) => [b.id, b.name]));
    const now = Date.now();
    const expiredConnections = (connections.data ?? []).filter((c: any) =>
      !c.token_expires_at || new Date(c.token_expires_at).getTime() <= now,
    ).length;
    const enabledAutopilot = (blogs.data ?? []).filter((b: any) => b.autopilot).length;
    const recentErrors = runs.filter((r: any) => r.status === "error").slice(0, 20).length;

    return {
      observabilityReady,
      health: {
        database: "operational",
        storage: bucket.error ? "attention" : "operational",
        blogger: expiredConnections > 0 ? "attention" : "operational",
        autopilot: recentErrors > 0 ? "attention" : "operational",
      },
      metrics: {
        blogs: blogs.data?.length ?? 0,
        autopilotBlogs: enabledAutopilot,
        bloggerConnections: connections.data?.length ?? 0,
        expiredConnections,
        recentAutopilotErrors: recentErrors,
        lastContentUpdate: posts.data?.[0]?.updated_at ?? null,
      },
      runs: runs.map((r: any) => ({ ...r, blogName: blogMap.get(r.blog_id) ?? "Unknown blog" })),
      activities,
    };
  });
