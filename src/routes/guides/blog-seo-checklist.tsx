import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides/blog-seo-checklist")({
  head: () => ({ meta: [
    { title: "Blog SEO Checklist Before You Publish — BlogPilot AI" },
    { name: "description", content: "A practical pre-publish SEO checklist covering search intent, titles, headings, links, crawlability, mobile readability and content quality." },
  ] }),
  component: BlogSeoChecklistGuide,
});

function BlogSeoChecklistGuide() {
  return <PublicPageLayout eyebrow="SEO Checklist" title="A practical blog SEO checklist before you publish" description="SEO works best as a quality-control process: make the page easy to understand, easy to navigate and technically accessible before worrying about clever optimisation tricks.">
    <p>No checklist can guarantee rankings. Search results depend on competition, relevance, site quality and many factors outside a publisher's control. What a checklist can do is prevent avoidable mistakes that make an otherwise useful article harder for readers and search engines to understand.</p>

    <h2>1. Confirm the page has a clear purpose</h2>
    <p>Write the main question the article answers in one sentence. Then read the finished page and check whether that answer is easy to find. If the draft wandered into several unrelated subjects, narrow it or split genuinely different intents into separate resources.</p>

    <h2>2. Use a descriptive title</h2>
    <p>The title should accurately describe the page and make sense to a person seeing it out of context. Include the important subject naturally, but do not repeat keyword variations simply to make the title longer. Avoid promises such as “guaranteed”, “ultimate” or “best” unless the content can genuinely support them.</p>

    <h2>3. Write a useful search description</h2>
    <p>A meta description is a short opportunity to explain what a visitor can expect. Summarise the value of the page in plain language. Do not stuff it with repeated keywords or write a description for content that is not actually on the page.</p>

    <h2>4. Check heading hierarchy</h2>
    <p>Use the page title as the primary heading, then organise major sections with H2 headings. Use H3 only for subsections inside an H2 topic. Headings should describe the content beneath them; they are navigation aids for readers, not just larger text.</p>

    <h2>5. Make the first screen useful</h2>
    <p>Readers should quickly understand that they reached the right page. Avoid huge empty areas, intrusive overlays or a long introduction that delays the answer. On mobile, check that the title and opening paragraph remain readable without awkward horizontal scrolling.</p>

    <h2>6. Review internal links</h2>
    <p>Link to related pages when the destination helps the reader understand a term, complete the next step or explore a closely related subject. Use descriptive anchor text. Avoid automatically inserting large numbers of links purely because two pages share a keyword.</p>

    <h2>7. Verify external references</h2>
    <p>When a claim depends on an external source, prefer authoritative and relevant material. Open the link, make sure it still works and confirm that it actually supports the statement. Avoid citing a source you have not reviewed.</p>

    <h2>8. Check images and media</h2>
    <p>Images should serve the page rather than merely fill space. Compress large assets, provide meaningful alternative text when an image communicates information, and avoid misleading captions. Decorative images can use empty alternative text so assistive technology does not announce unnecessary detail.</p>

    <h2>9. Confirm crawlability and indexing intent</h2>
    <p>Public editorial pages intended for search should not accidentally carry a noindex directive or sit behind authentication. Private dashboards, account settings and administrative interfaces usually should not be treated as public search content. Keep your sitemap focused on canonical public URLs you actually want discovered.</p>

    <h2>10. Read the page on a phone</h2>
    <p>Mobile review catches problems that a desktop editor can hide: paragraphs that feel enormous, tables wider than the screen, buttons packed too closely together and headings that wrap badly. Check both light and dark themes if the site supports them.</p>

    <h2>11. Look for accidental low-value content</h2>
    <p>Remove placeholder sections, empty category pages, duplicate drafts and pages created only to target slight keyword variations. A smaller collection of complete, useful resources is a healthier foundation than a large collection of unfinished or repetitive URLs.</p>

    <h2>12. Separate ads from navigation and content controls</h2>
    <p>If a site uses advertising, visitors should be able to distinguish ads from editorial links and interface controls. Do not position ads where they can be mistaken for menu items, download buttons or required actions. The underlying page should provide substantial value even when advertising is ignored.</p>

    <h2>Final pre-publish pass</h2>
    <ul>
      <li>The article satisfies the title and intended search question.</li>
      <li>The title and description are accurate rather than exaggerated.</li>
      <li>Heading levels form a logical outline.</li>
      <li>Important claims and links have been verified.</li>
      <li>Internal links are genuinely useful.</li>
      <li>The page works on a normal phone screen.</li>
      <li>There are no placeholders, duplicate sections or broken destinations.</li>
      <li>The page's index/noindex status matches its purpose.</li>
      <li>Ads, if present, are clearly separate from navigation and actions.</li>
    </ul>

    <p>If the article began as an AI draft, combine this checklist with the <Link to="/guides/review-ai-articles">AI editorial review checklist</Link> before publishing.</p>
  </PublicPageLayout>;
}
