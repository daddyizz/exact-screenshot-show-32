import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides/ai-content-fact-checking")({
  head: () => ({ meta: [
    { title: "Fact-Checking AI-Written Blog Content — BlogPilot AI" },
    { name: "description", content: "A practical fact-checking workflow for AI-assisted blog drafts covering claims, sources, dates, quotations, links and high-risk topics." },
  ] }),
  component: AiFactCheckingGuide,
});

function AiFactCheckingGuide() {
  return <PublicPageLayout eyebrow="AI Editorial Workflow" title="Fact-checking AI-written blog content before publication" description="AI can produce a fluent draft while still getting an important detail wrong. A repeatable verification process helps editors separate plausible wording from publishable information.">
    <p>Fluent writing can create false confidence. An AI-generated sentence may sound precise even when a date is outdated, a product feature has changed or a source does not support the claim. Fact-checking therefore needs to be a separate editorial step rather than a quick reread for grammar.</p>

    <h2>Mark claims that can be verified</h2>
    <p>Read the draft once specifically for factual claims. Highlight names, dates, prices, statistics, quotations, product specifications, legal requirements, medical or financial statements and claims about what a company currently offers. These deserve more scrutiny than general transitions or editorial opinion.</p>

    <h2>Prefer primary sources for changing facts</h2>
    <p>For software features, policies, prices and official requirements, start with the organization responsible for the information. Secondary sources can provide useful context, but they may be outdated or may repeat an earlier error. Record the source while reviewing so another editor can understand where the claim came from.</p>

    <h2>Verify that the source supports the exact sentence</h2>
    <p>A real source is not enough if it says something different from the draft. Check the relevant passage and narrow the wording when the evidence is more limited. Avoid turning “may”, “can” or “in some cases” into a universal claim.</p>

    <h2>Treat quotations and statistics carefully</h2>
    <p>Do not publish a quotation merely because it sounds credible. Confirm the speaker, wording and context. For statistics, check the measurement period, population and original publication date. A number can be technically real while being misleading in a different context.</p>

    <h2>Check links as a reader would</h2>
    <p>Open important references. Confirm that the destination loads, supports the surrounding statement and is appropriate for the audience. Avoid linking to a generic homepage when a specific documentation or policy page is the actual evidence.</p>

    <h2>Use stronger review for higher-risk topics</h2>
    <p>Health, legal, financial and safety information can cause real harm when wrong. Automated drafting should not lower the verification standard. Where qualified professional review is appropriate, make that part of the workflow rather than presenting an AI draft as authoritative.</p>

    <h2>Separate uncertainty from error</h2>
    <p>Sometimes reliable sources disagree or a current answer is not available. Say that clearly instead of forcing a confident conclusion. A useful article can explain what is known, what remains uncertain and what readers should verify for their own situation.</p>

    <h2>Fact-checking checklist</h2>
    <ol>
      <li>Identify every claim that can materially affect the reader's decision.</li>
      <li>Check time-sensitive facts against current authoritative sources.</li>
      <li>Confirm quotations and statistics in context.</li>
      <li>Open important links and verify the destination supports the claim.</li>
      <li>Remove invented specificity when evidence is unavailable.</li>
      <li>Escalate high-risk subjects for appropriate expert review.</li>
      <li>Do a final read after corrections so edits have not created contradictions.</li>
    </ol>

    <p>Fact-checking is one part of the broader editing process. Continue with the <Link to="/guides/review-ai-articles">AI article review workflow</Link> for structure, usefulness and editorial quality checks.</p>
  </PublicPageLayout>;
}
