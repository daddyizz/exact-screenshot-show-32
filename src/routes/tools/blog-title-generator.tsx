import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublicPageLayout } from "@/components/PublicPageLayout";
import { AdSlot } from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateBlogTitles, type TitleIdea } from "@/lib/tools.functions";

export const Route = createFileRoute("/tools/blog-title-generator")({
  head: () => ({
    meta: [
      { title: "Free SEO Blog Title Generator — BlogPilot AI" },
      { name: "description", content: "Generate 8 SEO blog title ideas with ready-to-use meta descriptions. Free, no sign-up, built for bloggers planning search-focused content." },
      { property: "og:title", content: "Free SEO Blog Title Generator" },
      { property: "og:description", content: "Enter your niche and get 8 search-intent blog titles plus meta descriptions. Free and no sign-up required." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TitleGeneratorPage,
});

function TitleGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [ideas, setIdeas] = useState<TitleIdea[]>([]);
  const run = useServerFn(generateBlogTitles);

  const mutation = useMutation({
    mutationFn: (input: { topic: string; audience?: string | undefined }) => run({ data: input }),
    onSuccess: (result) => setIdeas(result.ideas),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Something went wrong."),
  });

  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  return (
    <PublicPageLayout
      eyebrow="Free tool"
      title="SEO blog title generator"
      description="Enter a topic or niche and get eight blog title ideas, each with a different search intent and a ready-to-use meta description. Free, no account needed."
    >
      <form
        className="rounded-xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (topic.trim().length < 3) {
            toast.error("Describe your topic in a few words first.");
            return;
          }
          mutation.mutate({ topic: topic.trim(), audience: audience.trim() || undefined });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic or niche</Label>
            <Input id="topic" value={topic} maxLength={120} placeholder="Home coffee brewing" onChange={(event) => setTopic(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Target reader (optional)</Label>
            <Input id="audience" value={audience} maxLength={120} placeholder="Beginners buying their first grinder" onChange={(event) => setAudience(event.target.value)} />
          </div>
        </div>
        <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {mutation.isPending ? "Generating..." : "Generate titles"}
        </Button>
      </form>

      {ideas.length > 0 && (
        <div className="mt-8 space-y-3 not-prose">
          {ideas.map((idea, index) => (
            <div key={`${idea.title}-${index}`} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground">{idea.title}</h3>
                <Button type="button" variant="ghost" size="icon" aria-label="Copy title" onClick={() => copy(idea.title)}>
                  <Copy className="size-4" aria-hidden />
                </Button>
              </div>
              {idea.angle && <p className="mt-1 text-xs uppercase tracking-wide text-primary">{idea.angle}</p>}
              {idea.metaDescription && <p className="mt-3 text-sm leading-6 text-muted-foreground">{idea.metaDescription}</p>}
            </div>
          ))}
          <div className="rounded-xl border border-primary/30 bg-accent/30 p-5">
            <p className="text-sm text-foreground">Want these turned into full drafts and published to your blog automatically?</p>
            <Button className="mt-3" asChild>
              <Link to="/auth" search={{ next: undefined }}>Start free with BlogPilot AI</Link>
            </Button>
          </div>
        </div>
      )}

      <AdSlot id="tool-blog-title-generator" className="my-10" />

      <h2>How to pick the right title</h2>
      <p>A good blog title makes one promise a reader can verify at a glance. Before choosing one of the ideas above, check it against the article you can genuinely write: does the page deliver the outcome the title suggests, and is that outcome different from your other posts?</p>
      <ul>
        <li><strong>Match the intent.</strong> A how-to title needs steps; a comparison title needs at least two real options weighed fairly.</li>
        <li><strong>Keep it readable in search.</strong> Around 60 characters usually survives truncation on desktop results.</li>
        <li><strong>Avoid cannibalising yourself.</strong> If an existing post already targets the same question, update that post instead of writing a near-duplicate.</li>
        <li><strong>Edit the meta description.</strong> Treat the generated text as a first draft and adjust it to what your page really covers.</li>
      </ul>

      <h2>What to do next</h2>
      <p>Turn the shortlisted titles into briefs before drafting, so each article has a defined reader, scope and set of sources. Our <Link to="/guides/seo-content-brief">content brief template</Link> and <Link to="/guides/seo-content-plan">SEO content plan guide</Link> walk through that step, and the <Link to="/guides/blog-seo-checklist">pre-publish checklist</Link> covers the final review.</p>
      <p>This tool is free and limited to a handful of generations per hour. A free BlogPilot account adds saved topic queues, full article drafting and one-click publishing to Blogger.</p>
    </PublicPageLayout>
  );
}
