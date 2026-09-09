import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides/seo-content-brief")({
  head: () => ({ meta: [
    { title: "SEO Content Brief Template for Blog Articles — BlogPilot AI" },
    { name: "description", content: "Build a useful SEO content brief with audience, intent, key questions, evidence, internal links, structure and review requirements before drafting." },
  ] }),
  component: SeoContentBriefGuide,
});

function SeoContentBriefGuide() {
  return <PublicPageLayout eyebrow="Content Planning" title="SEO content brief template: define the article before you draft" description="A good brief reduces generic writing because it tells the writer who the page is for, what problem it must solve and what evidence or examples are needed.">
    <p>A content brief should guide decisions, not become a spreadsheet full of keyword variations. Whether the first draft is written by a person or generated with AI assistance, the brief establishes the purpose of the page and the standard it must meet before publication.</p>

    <h2>1. Define the intended reader</h2>
    <p>Describe the reader narrowly enough to influence the explanation. A beginner setting up their first Blogger site needs different context from an experienced publisher troubleshooting indexing. This decision affects terminology, examples and how much background the article should provide.</p>

    <h2>2. Write the primary question</h2>
    <p>State the problem in one sentence. If the article cannot be summarized as a clear reader task or question, the topic may still be too broad. Use this statement to judge whether each planned section belongs.</p>

    <h2>3. Identify search intent and page type</h2>
    <p>Decide whether the reader primarily wants to learn, compare, troubleshoot or complete a task. Then choose a page format that fits: explanation, checklist, tutorial, comparison or another useful structure.</p>

    <h2>4. List the essential questions</h2>
    <p>Write the questions a satisfactory answer must cover. Do not add sections merely because competing pages use them. Include prerequisites, common mistakes and decision points when they genuinely help the reader finish the task.</p>

    <h2>5. Identify evidence requirements</h2>
    <p>Mark claims that need current sources: policies, prices, statistics, software behavior and other changing facts. When first-hand testing is available and appropriate, record what was tested. When it is not, avoid pretending the article contains personal experience.</p>

    <h2>6. Plan useful internal links</h2>
    <p>Choose existing pages that provide prerequisites or logical next steps. Also note older pages that should link to the new article after publication. This turns internal linking into part of the editorial design rather than an afterthought.</p>

    <h2>7. Draft a heading outline</h2>
    <p>Use H2 headings for the major stages or questions. Add H3 headings only when a major section needs meaningful subdivision. The outline should reveal a logical answer even before the paragraphs are written.</p>

    <h2>8. Define the review standard</h2>
    <p>Record what must happen before approval: fact-checking, link testing, screenshot updates, legal review or another specialist check. Automated generation should never silently bypass requirements that would apply to a human-written draft.</p>

    <h2>Copyable brief structure</h2>
    <ul>
      <li><strong>Working title:</strong> clear description of the page.</li>
      <li><strong>Audience:</strong> who needs this answer.</li>
      <li><strong>Main question:</strong> the task the article must resolve.</li>
      <li><strong>Intent:</strong> learn, compare, do or troubleshoot.</li>
      <li><strong>Essential sections:</strong> questions that must be answered.</li>
      <li><strong>Evidence:</strong> facts or claims requiring verification.</li>
      <li><strong>Internal links:</strong> prerequisites and next-step resources.</li>
      <li><strong>Review requirements:</strong> checks required before approval.</li>
    </ul>

    <p>Use the brief to populate an editorial queue, then organize those briefs with the <Link to="/guides/content-calendar">content calendar workflow</Link>.</p>
  </PublicPageLayout>;
}
