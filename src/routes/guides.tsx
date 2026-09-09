import { createFileRoute } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides")({
  head: () => ({ meta: [{ title: "Publishing Guides — BlogPilot AI" }, { name: "description", content: "Practical guides for planning SEO content, reviewing AI-assisted drafts and building a reliable Blogger publishing workflow." }] }),
  component: GuidesPage,
});

function GuidesPage() {
  return <PublicPageLayout eyebrow="Resources" title="Practical publishing guides" description="Use these guides to build a repeatable editorial workflow, review AI-assisted drafts responsibly and publish to Blogger without sacrificing quality.">
    <h2>1. Build an SEO content plan that is actually usable</h2>
    <p>A useful content plan starts with the audience, not a giant keyword list. Define the reader, the problem they are trying to solve and the type of page that would satisfy that search. Group ideas by intent: informational, comparison, transactional and navigational. This prevents a queue full of near-duplicate topics.</p>
    <p>For each article, write a working title, primary keyword, supporting terms, a short outline and the action you want the reader to take next. Keep the outline focused enough that every section earns its place. A content calendar should also reflect how often you can review and maintain posts after publication, not just how fast you can generate them.</p>
    <h3>Before drafting</h3>
    <p>Check whether you already published something that answers the same question. If so, update or expand the existing article instead of creating a competing page. Confirm that the topic fits the site niche and that you can provide useful context rather than a generic summary.</p>

    <h2>2. Review AI-assisted articles before publishing</h2>
    <p>AI can accelerate drafting, but the editor remains responsible for the final page. Review names, dates, product details, statistics, prices and legal or financial claims. Remove anything that cannot be verified. Look for repetitive introductions, vague conclusions and sentences that sound authoritative without evidence.</p>
    <p>Then review structure. Use one clear page title, descriptive H2 sections and H3 headings only where they genuinely organise a subsection. Break long paragraphs into readable blocks and make sure every link points to a relevant destination. Add examples or original explanations where they help the reader understand the topic.</p>
    <h3>Final quality check</h3>
    <p>Ask whether the article answers the searcher's main question early, whether it adds something useful beyond common summaries, and whether a human editor would be comfortable putting their site name behind every claim. If not, keep editing.</p>

    <h2>3. Keep Blogger automation reliable</h2>
    <p>Automation works best when the publishing workflow has clear states: idea, drafted, reviewed and published. Avoid auto-publishing unfinished ideas. Connect the correct Blogger site, verify the selected blog name and periodically confirm that OAuth access still works.</p>
    <p>If a publish attempt fails, do not repeatedly click the publish button without checking the error. Determine whether the issue is authentication, a missing Blogger connection, an invalid post state or a temporary provider problem. A reliable system should record failures and allow a controlled retry rather than silently creating duplicate posts.</p>
    <h3>Use a safe cadence</h3>
    <p>A sustainable cadence is better than a burst of low-quality pages. Choose a posting frequency that leaves time for review, fact-checking, internal linking and updates to older articles. Search visibility and reader trust depend more on useful pages than on raw publishing volume.</p>

    <h2>4. Separate editorial content from advertising</h2>
    <p>Ads should not be styled in a way that makes them look like navigation, download buttons or required steps. Keep advertising visually distinct from editorial content and avoid placing ads on screens that have little or no publisher content. The page should still be useful if every ad disappeared.</p>
    <p>For a SaaS product, public documentation, guides, policies and help resources should stand on their own. Logged-in dashboards are product interfaces; they should not be treated as substitutes for public editorial content when preparing a site for advertising review.</p>
  </PublicPageLayout>;
}
