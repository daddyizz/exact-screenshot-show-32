import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://exact-screenshot-show-32.lovable.app";

const urls = ["", "/auth"].map(
  (path) =>
    `  <url><loc>${BASE_URL}${path || "/"}</loc><changefreq>weekly</changefreq></url>`,
);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

export const Route = createFileRoute("/sitemap/xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(sitemap, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        }),
    },
  },
});
