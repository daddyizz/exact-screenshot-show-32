import { createFileRoute } from "@tanstack/react-router";

// Legacy route kept only so any old crawler/bookmark using /sitemap/xml
// is sent to the canonical static sitemap at /sitemap.xml.
export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return Response.redirect(`${url.origin}/sitemap.xml`, 301);
      },
    },
  },
});
