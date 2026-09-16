import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/go/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const code = String(params.code ?? "").trim();
        if (!/^[a-z0-9]{6,32}$/i.test(code)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const result = await admin.from("affiliate_links").select("destination_url,enabled").eq("short_code", code).maybeSingle();
        if (result.error || !result.data?.enabled || !result.data?.destination_url) return new Response("Not found", { status: 404 });
        await admin.rpc("record_affiliate_click", { p_short_code: code });
        return new Response(null, { status: 302, headers: { Location: result.data.destination_url, "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "strict-origin-when-cross-origin" } });
      },
    },
  },
});
