import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { isBlogDue, runAutopilotForBlog, type AutopilotOutcome } from "@/lib/autopilot.server";
import { writeActivity, writeAutopilotRun } from "@/lib/operations.server";

async function handle(request: Request) {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const origin = new URL(request.url).origin;

  const { data: blogs, error } = await supabaseAdmin
    .from("blogs")
    .select("*")
    .eq("autopilot", true);
  if (error) return new Response(error.message, { status: 500 });

  const due = (blogs ?? []).filter(isBlogDue).slice(0, 5);
  const results: AutopilotOutcome[] = [];

  for (const blog of due) {
    const startedAt = new Date().toISOString();
    const outcome = await runAutopilotForBlog(supabaseAdmin, blog, origin);
    results.push(outcome);

    await writeAutopilotRun(supabaseAdmin, {
      userId: blog.user_id ?? null,
      blogId: blog.id,
      postId: outcome.postId ?? null,
      triggerSource: "scheduled",
      status: outcome.status,
      detail: outcome.detail,
      publishedUrl: outcome.url ?? null,
      startedAt,
    });

    await writeActivity(supabaseAdmin, {
      userId: blog.user_id ?? null,
      eventType: `autopilot.${outcome.status}`,
      entityType: "blog",
      entityId: blog.id,
      status: outcome.status === "error" ? "failed" : outcome.status === "skipped" ? "info" : "success",
      message: outcome.status === "error"
        ? `Scheduled Autopilot failed: ${outcome.detail}`
        : `Scheduled Autopilot ${outcome.status}`,
      metadata: {
        triggerSource: "scheduled",
        blogName: blog.name ?? null,
        postId: outcome.postId ?? null,
        publishedUrl: outcome.url ?? null,
      },
    });

    await supabaseAdmin
      .from("blogs")
      .update({ autopilot_last_run_at: new Date().toISOString() })
      .eq("id", blog.id);
  }

  return Response.json({ checked: blogs?.length ?? 0, due: due.length, ran: results.length, results });
}

export const Route = createFileRoute("/api/public/cron/autopilot")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
