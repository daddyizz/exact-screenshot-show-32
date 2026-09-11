import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { AUTOPILOT_LOCKED_DETAIL, isBlogDue, runAutopilotForBlog, type AutopilotOutcome } from "@/lib/autopilot.server";
import { writeActivity, writeAutopilotRun } from "@/lib/operations.server";

async function authenticateAutopilotCron(request: Request) {
  const customSecret = process.env['BLOGPILOT_CRON_SECRET'];
  if (customSecret) {
    const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
    const token = match?.[1];
    if (!token) return new Response("Unauthorized", { status: 401 });

    const { createHash, timingSafeEqual } = await import("node:crypto");
    const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
    const provided = digest(token);
    const expected = digest(customSecret);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return new Response("Unauthorized", { status: 401 });
    }
    return null;
  }

  return authenticateCronRequest(request);
}

async function handle(request: Request) {
  const denied = await authenticateAutopilotCron(request);
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
      eventType: outcome.detail === AUTOPILOT_LOCKED_DETAIL ? "autopilot.locked" : `autopilot.${outcome.status}`,
      entityType: "blog",
      entityId: blog.id,
      status: outcome.status === "error" ? "failed" : outcome.status === "skipped" ? "info" : "success",
      message: outcome.status === "error"
        ? `Scheduled Autopilot failed: ${outcome.detail}`
        : outcome.detail === AUTOPILOT_LOCKED_DETAIL
          ? "Scheduled Autopilot skipped because another run is already in progress"
          : `Scheduled Autopilot ${outcome.status}`,
      metadata: {
        triggerSource: "scheduled",
        blogName: blog.name ?? null,
        postId: outcome.postId ?? null,
        publishedUrl: outcome.url ?? null,
        locked: outcome.detail === AUTOPILOT_LOCKED_DETAIL,
      },
    });

    if (outcome.detail !== AUTOPILOT_LOCKED_DETAIL) {
      await supabaseAdmin
        .from("blogs")
        .update({ autopilot_last_run_at: new Date().toISOString() })
        .eq("id", blog.id);
    }
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
