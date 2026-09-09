import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides/seo-content-plan")({
  head: () => ({ meta: [
    { title: "How to Build an SEO Content Plan — BlogPilot AI" },
    { name: "description", content: "A practical framework for turning audience needs, search intent and topic clusters into a useful SEO editorial plan." },
  ] }),
  component: SeoContentPlanGuide,
});

function SeoContentPlanGuide() {
  return <PublicPageLayout eyebrow="SEO Guide" title="How to build an SEO content plan that stays useful" description="A content plan should help you decide what deserves to be published, why it matters to a reader and how each article fits the rest of your site.">
    <p>Publishing more pages is not the same as building a useful content library. A strong SEO plan begins with a defined audience and a set of real problems that audience needs to solve. Keywords are useful evidence of demand, but they should guide editorial decisions rather than replace them.</p>

    <h2>Start with the reader and the site purpose</h2>
    <p>Write down who the site is for, what subject it covers and what a successful visit looks like. A personal-finance blog, for example, might serve first-time car buyers who need to understand affordability, while a software blog might help small teams choose and configure tools. This boundary keeps unrelated traffic opportunities from diluting the site.</p>
    <p>For every proposed topic, ask whether a person in that audience would reasonably expect the site to answer it. If the connection is weak, leave the idea out even when a keyword tool reports attractive volume.</p>

    <h2>Map search intent before writing titles</h2>
    <p>Two queries containing similar words can require very different pages. Someone asking “what is a content calendar” probably needs an explanation. Someone searching “best content calendar tools” expects a comparison. A query about pricing or setup may need a product-oriented answer. Match the page format to the job the reader is trying to complete.</p>
    <ul>
      <li><strong>Learn:</strong> explanations, tutorials, definitions and troubleshooting.</li>
      <li><strong>Compare:</strong> alternatives, trade-offs, feature comparisons and buying criteria.</li>
      <li><strong>Do:</strong> checklists, workflows, templates and step-by-step instructions.</li>
      <li><strong>Navigate:</strong> pages that help a user reach a specific product, feature or resource.</li>
    </ul>

    <h2>Build topic clusters instead of isolated posts</h2>
    <p>Choose a broad subject that is central to the site and list the important questions around it. One comprehensive hub can explain the subject, while supporting articles can cover narrower problems in depth. Link those pages where the relationship genuinely helps a reader continue learning.</p>
    <p>A cluster should not become a reason to publish five versions of the same answer. If two planned articles would satisfy essentially the same search intent, combine them into one stronger page.</p>

    <h2>Give every article a useful brief</h2>
    <p>Before drafting, record a working title, the reader's main question, primary intent, key points that must be covered, useful examples, internal pages worth linking to and the next action a reader might take. This is more valuable than stuffing a brief with dozens of keyword variations.</p>
    <p>The outline should make the answer easy to scan. Put the central answer early, use descriptive H2 headings for major sections and add H3 headings only when a section genuinely needs subdivision.</p>

    <h2>Prioritise by value and effort</h2>
    <p>Do not automatically publish the topic with the largest estimated search volume first. Consider relevance to the site, how well you can answer the question, whether the topic supports an important existing page, and how much research is required. A smaller query that perfectly matches your audience can be more useful than a broad topic where the site has nothing distinctive to contribute.</p>

    <h2>Plan maintenance as well as publication</h2>
    <p>Articles containing prices, software features, regulations, dates or product availability can become stale. Add review dates to the editorial calendar and revisit important pages periodically. When an old article and a new idea overlap, improving the existing page is often better than creating another URL.</p>

    <h2>Use AI as a drafting tool, not the editorial strategy</h2>
    <p>AI can organise an outline, suggest missing questions and accelerate a first draft, but the site owner remains responsible for relevance and accuracy. Review generated claims, remove generic filler and add explanations that reflect the actual purpose of the site. Automation should make a good editorial process faster rather than mass-produce pages that nobody needed.</p>

    <h2>A simple pre-publish checklist</h2>
    <ol>
      <li>The article answers a real question for the site's intended audience.</li>
      <li>Its search intent is different enough from existing pages to justify a new URL.</li>
      <li>The main answer appears early and the heading structure is easy to scan.</li>
      <li>Facts that can change have been checked against reliable sources.</li>
      <li>Internal links help the reader rather than merely inserting keywords.</li>
      <li>The page contains useful explanation, examples or context beyond a generic summary.</li>
    </ol>

    <p>Once this foundation is in place, automation becomes much safer. Continue with the <Link to="/guides/review-ai-articles">AI article review guide</Link> before putting generated drafts on a publishing schedule.</p>
  </PublicPageLayout>;
}
