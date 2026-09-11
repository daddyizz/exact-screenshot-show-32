import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  placementId: z.string().uuid(),
  event: z.enum(["impression", "click"]),
});

async function handle(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return new Response("Invalid payload", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any).rpc("record_ad_event", {
    p_placement_id: parsed.data.placementId,
    p_event: parsed.data.event,
  });
  if (error) {
    console.error("record_ad_event failed", error);
    return new Response("Unable to record ad event", { status: 500 });
  }

  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/ad-event")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
