import { createFileRoute } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About BlogPilot AI" }, { name: "description", content: "Learn what BlogPilot AI does, who it is built for, and how it helps independent publishers plan, draft and publish blog content." }] }),
  component: AboutPage,
});

function AboutPage() {
  return <PublicPageLayout eyebrow="About" title="A practical publishing workspace for small blog teams" description="BlogPilot AI is designed to reduce the repetitive work around editorial planning, SEO preparation, drafting and Blogger publishing while keeping the user in control of what goes live.">
    <h2>What BlogPilot AI does</h2>
    <p>BlogPilot AI helps publishers organise blog ideas into a structured content queue. Each topic can include an outline, SEO title, meta description, target keywords and publishing status. AI tools can then turn approved ideas into drafts and, when enabled, publish them to a connected Blogger site.</p>
    <h2>Who it is for</h2>
    <p>The product is built for solo publishers, small teams and site owners who want a repeatable workflow instead of juggling spreadsheets, notes, writing tools and publishing tabs. It supports multiple markets, languages, niches and publishing cadences.</p>
    <h2>Automation with control</h2>
    <p>Automation is optional. Users can keep publishing manual, review drafts before release, or enable Autopilot for supported plans. BlogPilot is intended to assist editorial work, not remove responsibility for reviewing facts, links, claims and final content quality.</p>
    <h2>Current platform support</h2>
    <p>Blogger is the supported publishing platform today. The workspace includes topic planning, article drafting, AI cover-image generation, publishing tools, usage controls and operational monitoring.</p>
  </PublicPageLayout>;
}
