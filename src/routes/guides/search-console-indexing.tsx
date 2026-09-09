import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides/search-console-indexing")({
  head: () => ({ meta: [
    { title: "Google Search Console Indexing Workflow for New Blog Posts — BlogPilot AI" },
    { name: "description", content: "A practical workflow for helping Google discover new blog pages using crawlable links, sitemaps, URL Inspection and sensible indexing checks." },
  ] }),
  component: SearchConsoleIndexingGuide,
});

function SearchConsoleIndexingGuide() {
  return <PublicPageLayout eyebrow="Search Visibility" title="A sensible Search Console indexing workflow for new blog posts" description="Publishing a URL and indexing it are different events. Build pages that are discoverable first, then use Search Console to diagnose important URLs rather than treating request indexing as a ranking button.">
    <p>New publishers often request indexing immediately after every edit and then worry when a page does not appear in search. Search discovery works better when the site has crawlable internal links, a current sitemap and pages that are genuinely worth indexing. Search Console is most useful for observing and diagnosing that system.</p>

    <h2>Make the page discoverable from your own site</h2>
    <p>Before requesting anything, link the new article from a relevant public page such as a guide hub, category page or related article. A URL that exists only in an editor or private dashboard is much harder for normal crawling to discover.</p>

    <h2>Keep the sitemap current</h2>
    <p>A sitemap provides a machine-readable list of important public URLs. Include canonical pages you actually want search engines to consider. Do not fill it with account screens, private dashboards or temporary utility URLs simply to make the sitemap larger.</p>

    <h2>Inspect the public URL</h2>
    <p>Use URL Inspection for an important page when you need to understand how Google sees it. Check whether crawling is allowed, whether the page is indexable and whether Google selected the expected canonical URL. Fix technical blockers before repeatedly requesting indexing.</p>

    <h2>Request indexing selectively</h2>
    <p>Request indexing can be useful for a new or meaningfully updated important page, but it does not guarantee inclusion or ranking. There is little value in repeatedly submitting an unchanged low-value page. Improve the page or resolve the technical issue instead.</p>

    <h2>Do not confuse discovery with ranking</h2>
    <p>An indexed page is merely eligible to appear. Its visibility depends on relevance, usefulness, competition and many other signals. A page can be technically perfect and still receive little search traffic if it does not provide a useful answer.</p>

    <h2>Check the whole site when many pages are missing</h2>
    <p>If one URL has a problem, inspect that page. If nearly every new URL is missing, look for a site-level cause: robots rules, noindex directives, inaccessible rendering, weak navigation, duplicate URLs or a domain that has not yet been discovered properly.</p>

    <h2>Allow time for crawling</h2>
    <p>Search systems do not update on a fixed schedule for every site. Avoid making unnecessary technical changes simply because a new article has not appeared immediately. Use the waiting period to improve internal links and continue publishing useful material.</p>

    <h2>Indexing workflow checklist</h2>
    <ol>
      <li>Open the final public URL and confirm it works without authentication.</li>
      <li>Ensure the page is intended to be indexed.</li>
      <li>Add at least one relevant crawlable internal link.</li>
      <li>Include the canonical URL in the public sitemap.</li>
      <li>Use URL Inspection when diagnosing an important page.</li>
      <li>Request indexing after a new publication or meaningful correction when useful.</li>
      <li>Monitor rather than repeatedly resubmitting an unchanged page.</li>
    </ol>

    <p>Before asking search engines to discover a page, run the <Link to="/guides/blog-seo-checklist">pre-publish SEO checklist</Link> so the URL is worth discovering.</p>
  </PublicPageLayout>;
}
