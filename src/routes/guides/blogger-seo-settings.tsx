import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides/blogger-seo-settings")({
  head: () => ({ meta: [
    { title: "Blogger SEO Settings: A Practical Setup Guide — BlogPilot AI" },
    { name: "description", content: "A practical guide to Blogger SEO settings, search descriptions, custom URLs, HTTPS, redirects, indexing and page-level checks." },
  ] }),
  component: BloggerSeoSettingsGuide,
});

function BloggerSeoSettingsGuide() {
  return <PublicPageLayout eyebrow="Blogger SEO" title="Blogger SEO settings: a practical setup guide" description="Good Blogger SEO starts with a clean technical foundation, then relies on useful pages, descriptive metadata and sensible internal links.">
    <p>Blogger can provide a solid technical base for a content site, but turning on every available setting is not an SEO strategy. The useful approach is to make the site easy to crawl, keep public URLs stable, describe each important page clearly and avoid accidentally blocking content that should appear in search.</p>

    <h2>Start with HTTPS and one consistent public address</h2>
    <p>Visitors and search engines should reach the secure HTTPS version of the blog consistently. If you use a custom domain, verify that the intended domain resolves correctly and that old or alternate addresses do not create confusing duplicate destinations. Avoid repeatedly changing domains or post URLs after publication unless there is a genuine reason.</p>

    <h2>Use a useful site-level search description</h2>
    <p>The blog description should explain the site's actual subject in natural language. It is not a place to repeat a long list of keywords. A focused description helps keep the site's positioning clear to readers and gives you a useful baseline for page metadata.</p>

    <h2>Write page-specific search descriptions</h2>
    <p>Important articles should have descriptions that summarize what the reader will learn. Keep them specific to the page. Five posts with nearly identical descriptions are less useful than five descriptions that accurately distinguish the pages.</p>
    <p>A good description normally identifies the problem, the scope of the answer and any important context. Do not promise information the article does not contain merely to improve clicks.</p>

    <h2>Choose post URLs before publication</h2>
    <p>Blogger allows a custom permalink when a post is being prepared. Prefer short, readable words that describe the subject. The URL does not need to reproduce the entire title. Once a useful URL is live and indexed, stability is usually more valuable than continually tweaking it.</p>

    <h2>Be careful with robots and indexing controls</h2>
    <p>Robots directives are powerful because a small mistake can hide useful pages from search. Public articles that you want indexed should not carry a noindex directive. Private product screens, account areas, duplicate utility pages or other content that should not appear in search can be treated differently.</p>
    <p>Do not copy advanced robots settings from another site without understanding them. A rule that is appropriate for one publishing setup can be harmful to another.</p>

    <h2>Use redirects for genuine URL changes</h2>
    <p>If a published URL must change, a redirect helps visitors and crawlers reach the replacement. Redirects are not a substitute for planning stable URLs in the first place. Maintain a small record of important URL changes so old internal links can also be corrected.</p>

    <h2>Keep navigation and internal links crawlable</h2>
    <p>Important guides and articles should be reachable through normal links from another public page. Category or resource hubs are useful because they help people discover related material without relying entirely on search. Use descriptive anchor text rather than vague labels when the context allows it.</p>

    <h2>Check the article itself, not only the settings panel</h2>
    <p>Technical settings cannot rescue a weak article. Before publication, confirm that the title accurately describes the page, the main answer is easy to find, headings organize the material, links work on mobile and any facts that can change have been checked.</p>

    <h2>A simple Blogger SEO setup checklist</h2>
    <ol>
      <li>Use HTTPS and a stable public domain.</li>
      <li>Write a focused site description.</li>
      <li>Create unique titles and search descriptions for important pages.</li>
      <li>Choose readable post URLs before publishing.</li>
      <li>Keep indexable articles free from accidental noindex directives.</li>
      <li>Use redirects when an established URL genuinely changes.</li>
      <li>Link important pages from relevant public pages.</li>
      <li>Review the actual content quality before requesting indexing.</li>
    </ol>

    <p>For the article-level checks that come next, use the <Link to="/guides/blog-seo-checklist">pre-publish SEO checklist</Link>.</p>
  </PublicPageLayout>;
}
