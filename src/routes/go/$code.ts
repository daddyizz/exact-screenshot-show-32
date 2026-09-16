import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/go/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const code = String(params.code ?? "").trim();
        if (!/^[a-z0-9]{6,32}$/i.test(code)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const result = await admin
          .from("affiliate_links")
          .select("destination_url,enabled,starts_at,expires_at,max_clicks,click_count")
          .eq("short_code", code)
          .maybeSingle();

        const row = result.data;
        const now = Date.now();
        const startsAt = row?.starts_at ? new Date(row.starts_at).getTime() : null;
        const expiresAt = row?.expires_at ? new Date(row.expires_at).getTime() : null;
        const maxClicks = row?.max_clicks == null ? null : Number(row.max_clicks);
        const clickCount = Number(row?.click_count ?? 0);

        const unavailable =
          result.error ||
          !row?.enabled ||
          !row?.destination_url ||
          (startsAt !== null && now < startsAt) ||
          (expiresAt !== null && now >= expiresAt) ||
          (maxClicks !== null && clickCount >= maxClicks);

        if (unavailable) return new Response("Link unavailable", { status: 404 });

        const clickResult = await admin.rpc("record_affiliate_click", { p_short_code: code });
        if (clickResult.error) console.error("record_affiliate_click failed", clickResult.error);

        return new Response(null, {
          status: 302,
          headers: {
            Location: row.destination_url,
            "Cache-Control": "no-store, max-age=0",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
        });
      },
    },
  },
});
