import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { missingObservabilitySchema, writeActivity, writeAutopilotRun } from "./operations.server";
import { createNotification } from "./notifications.server";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

function missingDiagnosticsSchema(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("website_diagnostics") || message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find the table");
}

export const retryAutopilotRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ runId: z.string().uuid(), origin: z.string().url().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: run, error: runError } = await admin.from("autopilot_runs").select("id,user_id,blog_id,status").eq("id", data.runId).maybeSingle();
    if (runError) throw new Error(runError.message);
    if (!run) throw new Error("Autopilot run not found");
    if (run.status !== "error") throw new Error("Only failed Autopilot runs can be retried.");
    const { data: blog, error: blogError } = await admin.from("blogs").select("*").eq("id", run.blog_id).maybeSingle();
    if (blogError) throw new Error(blogError.message);
    if (!blog) throw new Error("Blog no longer exists");
    const { runAutopilotForBlog } = await import("./autopilot.server");
    const startedAt = new Date().toISOString();
    const outcome = await runAutopilotForBlog(admin, blog, data.origin);
    await admin.from("blogs").update({ autopilot_last_run_at: new Date().toISOString() }).eq("id", blog.id);
    await writeAutopilotRun(admin, { userId: run.user_id ?? blog.user_id, blogId: blog.id, postId: outcome.postId, triggerSource: "manual", status: outcome.status, detail: `Admin retry: ${outcome.detail}`, publishedUrl: outcome.url, startedAt });
    await writeActivity(admin, { userId: run.user_id ?? blog.user_id, actorUserId: context.userId, eventType: "autopilot.admin_retry", entityType: "blog", entityId: blog.id, status: outcome.status === "error" ? "failed" : "success", message: outcome.detail, metadata: { originalRunId: run.id, outcome: outcome.status } });
    if (outcome.status === "error") await createNotification(admin, { userId: run.user_id ?? blog.user_id, type: "autopilot.failed", title: "Autopilot needs attention", message: outcome.detail, severity: "error", actionUrl: "/dashboard", actionLabel: "Open dashboard", dedupeKey: `autopilot-failed:${blog.id}` });
    else await createNotification(admin, { userId: run.user_id ?? blog.user_id, type: "autopilot.recovered", title: "Autopilot recovered", message: `${blog.name}: ${outcome.detail}`, severity: "success", actionUrl: "/articles", actionLabel: "View content", dedupeKey: `autopilot-failed:${blog.id}` });
    return outcome;
  });

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
    let diagnostics: any[] = [];
    let observabilityReady = true;
    let diagnosticsReady = true;

    const activityResult = await admin.from("activity_logs").select("id,user_id,actor_user_id,event_type,entity_type,entity_id,status,message,metadata,created_at").order("created_at", { ascending: false }).limit(100);
    if (activityResult.error) {
      if (!missingObservabilitySchema(activityResult.error)) throw new Error(activityResult.error.message);
      observabilityReady = false;
    } else activities = activityResult.data ?? [];

    const runsResult = await admin.from("autopilot_runs").select("id,user_id,blog_id,post_id,trigger_source,status,detail,published_url,started_at,finished_at,created_at").order("created_at", { ascending: false }).limit(100);
    if (runsResult.error) {
      if (!missingObservabilitySchema(runsResult.error)) throw new Error(runsResult.error.message);
      observabilityReady = false;
    } else runs = runsResult.data ?? [];

    const diagnosticsResult = await admin.from("website_diagnostics").select("id,user_id,severity,event_type,page_url,route_path,message,stack,element,metadata,user_agent,created_at").order("created_at", { ascending: false }).limit(200);
    if (diagnosticsResult.error) {
      if (!missingDiagnosticsSchema(diagnosticsResult.error)) throw new Error(diagnosticsResult.error.message);
      diagnosticsReady = false;
    } else diagnostics = diagnosticsResult.data ?? [];

    const blogMap = new Map((blogs.data ?? []).map((b: any) => [b.id, b.name]));
    const now = Date.now();
    const expiredConnections = (connections.data ?? []).filter((c: any) => !c.token_expires_at || new Date(c.token_expires_at).getTime() <= now).length;
    const enabledAutopilot = (blogs.data ?? []).filter((b: any) => b.autopilot).length;
    const recentErrors = runs.filter((r: any) => r.status === "error").slice(0, 20).length;
    const recentWebsiteIssues = diagnostics.filter((d: any) => d.severity === "error" || d.severity === "warning").slice(0, 50).length;

    return {
      observabilityReady,
      diagnosticsReady,
      health: {
        database: "operational",
        storage: bucket.error ? "attention" : "operational",
        blogger: expiredConnections > 0 ? "attention" : "operational",
        autopilot: recentErrors > 0 ? "attention" : "operational",
        website: recentWebsiteIssues > 0 ? "attention" : "operational",
      },
      metrics: {
        blogs: blogs.data?.length ?? 0,
        autopilotBlogs: enabledAutopilot,
        bloggerConnections: connections.data?.length ?? 0,
        expiredConnections,
        recentAutopilotErrors: recentErrors,
        recentWebsiteIssues,
        lastContentUpdate: posts.data?.[0]?.updated_at ?? null,
      },
      runs: runs.map((r: any) => ({ ...r, blogName: blogMap.get(r.blog_id) ?? "Unknown blog" })),
      activities,
      diagnostics,
    };
  });
