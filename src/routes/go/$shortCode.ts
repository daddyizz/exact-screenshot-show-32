import { createFileRoute } from "@tanstack/react-router";

async function handle(shortCode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const lookup = await admin
    .from("affiliate_links")
    .select("destination_url,enabled")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (lookup.error) return new Response("Link unavailable", { status: 500 });
  if (!lookup.data?.enabled || !lookup.data.destination_url) return new Response("Link unavailable", { status: 404 });

  await admin.rpc("record_affiliate_click", { p_short_code: shortCode });

  return new Response(null, {
    status: 302,
    headers: {
      Location: lookup.data.destination_url,
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/go/$shortCode")({
  server: {
    handlers: {
      GET: ({ params }) => handle(params.shortCode),
    },
  },
});
