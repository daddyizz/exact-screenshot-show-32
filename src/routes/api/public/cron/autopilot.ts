import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { isBlogDue, runAutopilotForBlog, type AutopilotOutcome } from "@/lib/autopilot.server";

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
    const outcome = await runAutopilotForBlog(supabaseAdmin, blog, origin);
    results.push(outcome);
    await supabaseAdmin
      .from("blogs")
      .update({ autopilot_last_run_at: new Date().toISOString() })
      .eq("id", blog.id);
  }

  return Response.json({ checked: blogs?.length ?? 0, ran: results.length, results });
}

export const Route = createFileRoute("/api/public/cron/autopilot")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
