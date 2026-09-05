import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/post-image/$postId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const postId = params.postId;
        if (!/^[0-9a-f-]{36}$/i.test(postId)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("post-images")
          .download(`${postId}.png`);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
