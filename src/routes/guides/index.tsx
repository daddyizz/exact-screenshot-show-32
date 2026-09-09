import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/guides/")({
  head: () => ({ meta: [{ title: "Publishing Guides — BlogPilot AI" }, { name: "description", content: "Practical, in-depth guides for SEO content planning, AI-assisted editing, Blogger automation, indexing and sustainable publishing workflows." }] }),
  component: GuidesPage,
});

const guides = [
  { to: "/guides/seo-content-plan", title: "How to build an SEO content plan", body: "Turn audience needs and search intent into distinct topics, useful briefs and maintainable topic clusters." },
  { to: "/guides/seo-content-brief", title: "SEO content brief template", body: "Define the audience, intent, evidence, structure and review requirements before drafting begins." },
  { to: "/guides/review-ai-articles", title: "How to review AI-generated articles", body: "Fact-check claims, remove filler, verify links and add the editorial value a raw generated draft still needs." },
  { to: "/guides/ai-content-fact-checking", title: "Fact-checking AI-written content", body: "Verify changing facts, quotations, statistics and sources before fluent AI text becomes public information." },
  { to: "/guides/blog-post-workflow", title: "Blog post workflow: idea to published", body: "Move ideas through briefs, research, drafting, approval, publishing and maintenance with clear editorial states." },
  { to: "/guides/blogger-automation", title: "A reliable Blogger automation workflow", body: "Structure publishing states, OAuth recovery, retries, remote post updates and operational history without losing control." },
  { to: "/guides/blogger-seo-settings", title: "Blogger SEO settings guide", body: "Set up descriptions, URLs, indexing controls, redirects and crawlable navigation without overcomplicating Blogger." },
  { to: "/guides/blog-seo-checklist", title: "Blog SEO checklist before you publish", body: "Check titles, headings, links, mobile readability, crawlability, indexing intent and ad separation before a page goes live." },
  { to: "/guides/internal-linking-strategy", title: "Internal linking strategy for blogs", body: "Connect topic hubs and supporting articles with useful, descriptive links instead of keyword clutter." },
  { to: "/guides/search-console-indexing", title: "Search Console indexing workflow", body: "Help new pages get discovered with internal links, sitemaps and URL Inspection while diagnosing indexing blockers sensibly." },
  { to: "/guides/content-calendar", title: "Build a sustainable content calendar", body: "Choose a realistic cadence that balances new articles with review, maintenance and the actual capacity of your workflow." },
  { to: "/guides/update-old-blog-posts", title: "How to update old blog posts", body: "Refresh stale facts, consolidate overlapping pages and preserve useful URLs instead of creating unnecessary duplicates." },
] as const;

function GuidesPage() {
  return <PublicPageLayout eyebrow="Resources" title="Practical publishing guides" description="Original, practical resources for planning useful content, reviewing AI-assisted drafts and running a reliable Blogger publishing workflow.">
    <div className="grid gap-4 sm:grid-cols-2">
      {guides.map((guide) => <Link key={guide.to} to={guide.to} className="group rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-accent/30">
        <h2 className="font-display text-lg font-semibold tracking-tight">{guide.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.body}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Read guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
      </Link>)}
    </div>

    <h2>Why these guides exist</h2>
    <p>Publishing automation is useful only when it sits on top of a sound editorial process. These resources focus on the decisions that still matter when drafting becomes faster: choosing topics with a clear purpose, checking factual claims, keeping search pages distinct, handling publishing failures and maintaining older content.</p>
    <p>They are designed to stand on their own whether or not you use BlogPilot AI. Product features can speed up parts of the workflow, but the publisher remains responsible for what ultimately appears on a public blog.</p>

    <h2>A sensible order for a new blog</h2>
    <ol>
      <li>Start with the SEO content planning and content brief guides.</li>
      <li>Use the AI review and fact-checking guides whenever automation assists with a draft.</li>
      <li>Run the pre-publish SEO checklist and add useful internal links.</li>
      <li>Introduce Blogger automation only after the review workflow is clear.</li>
      <li>Use Search Console to diagnose discovery and indexing after publication.</li>
      <li>Reserve calendar capacity for updates as well as new posts.</li>
    </ol>
  </PublicPageLayout>;
}
