import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Gauge,
  Globe2,
  ListChecks,
  PenLine,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { AdSlot } from "@/components/AdSlot";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BlogPilot AI — SEO blog content on autopilot" },
      {
        name: "description",
        content:
          "Plan, draft and schedule SEO blog posts for every niche. BlogPilot AI turns keyword research into a publish-ready content queue for your Blogger site.",
      },
      { property: "og:title", content: "BlogPilot AI — SEO blog content on autopilot" },
      {
        property: "og:description",
        content:
          "Turn keyword research into a publish-ready content queue for your blog, in any niche and language.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Search,
    title: "Keyword-led planning",
    body: "Pick a niche, country and language. BlogPilot builds a topic queue around the searches that actually convert.",
  },
  {
    icon: ListChecks,
    title: "A real content queue",
    body: "Every topic carries an outline, SEO title, meta description and status so nothing stalls at half-done.",
  },
  {
    icon: Globe2,
    title: "Multi-market ready",
    body: "English, Bahasa Melayu, Indonesian, Spanish and more — with country targeting per blog.",
  },
  {
    icon: Gauge,
    title: "Cadence you control",
    body: "Set posts per week and article length once; the plan paces itself to match.",
  },
  {
    icon: PenLine,
    title: "AI drafting",
    body: "One click turns an approved outline into a full, on-brand article draft.",
  },
  {
    icon: CalendarClock,
    title: "Auto-publish to Blogger",
    body: "Approved drafts go live on schedule, with images attached, hands-free.",
  },
];

const plans = [
  {
    name: "Free",
    price: "RM0",
    note: "forever",
    perks: ["1 blog", "Topic planning + outlines", "5 AI drafts / month", "Manual publishing"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "RM49",
    note: "per month",
    perks: [
      "5 blogs",
      "Unlimited AI drafts",
      "Autopilot daily publishing",
      "AI cover images",
      "Priority support",
    ],
    cta: "Start free, upgrade later",
    highlight: true,
  },
];

const faqs = [
  {
    q: "Do I need my own AI key?",
    a: "No. Drafting, topic planning and cover images are built in — just sign in with Google.",
  },
  {
    q: "Which blog platforms are supported?",
    a: "Blogger is supported today: connect your Google account, pick a blog, and posts publish straight to it.",
  },
  {
    q: "What does autopilot actually do?",
    a: "It picks the next topic, writes the full article with SEO title, meta description and keywords, then publishes it on your chosen cadence.",
  },
  {
    q: "Can I edit before anything goes live?",
    a: "Yes. Turn off automatic publishing and every article waits in your Articles library until you approve it.",
  },
];

const steps = [
  { n: "01", title: "Add your blog", body: "Name it, drop the URL, choose niche, market and tone." },
  { n: "02", title: "Build the queue", body: "Add topics with outlines and SEO metadata as you go." },
  { n: "03", title: "Approve and ship", body: "Move posts from idea to approved, then published." },
];

function Landing() {
  const { session, loading } = useAuth();
  const signedIn = !loading && !!session;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-sm font-bold tracking-tight">
            BlogPilot<span className="text-primary">.</span>AI
          </Link>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth" search={{ next: undefined }}>Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/auth" search={{ next: undefined }}>Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>


      <main>
        <section className="grid-backdrop border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Free to start
            </Badge>
            <h1 className="font-display mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              SEO blog content, planned and shipped on{" "}
              <span className="text-primary">autopilot</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              BlogPilot AI turns a niche and a target market into a working content queue —
              outlines, SEO titles and meta descriptions included — so your blog never runs dry.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/auth" search={{ next: undefined }}>
                  Start planning free
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/auth" search={{ next: undefined }}>I already have an account</Link>
              </Button>
            </div>
            <p className="text-eyebrow mt-6">
              No card required · Google sign-in · 12 niches · 8 languages
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="text-eyebrow">What you get</p>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Everything a one-person publishing team needs
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.title} className="surface-panel p-5">
                <f.icon className="size-5 text-primary" aria-hidden />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-semibold">{f.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 pb-4">
          <AdSlot id="landing-mid" format="leaderboard" />
        </div>



        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <p className="text-eyebrow">How it works</p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Three steps to a full editorial calendar
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="surface-panel p-5">
                  <span className="font-display text-primary text-2xl font-bold">{s.n}</span>
                  <h3 className="font-display mt-3 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="text-eyebrow">Pricing</p>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Simple plans, no card to start
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`surface-panel p-6 ${p.highlight ? "border-primary/50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                  {p.highlight && <Badge>Most popular</Badge>}
                </div>
                <p className="font-display mt-3 text-3xl font-bold">
                  {p.price}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{p.note}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {p.perks.map((perk) => (
                    <li key={perk}>· {perk}</li>
                  ))}
                </ul>
                <Button className="mt-6" variant={p.highlight ? "default" : "secondary"} asChild>
                  <Link to="/auth" search={{ next: undefined }}>
                    {p.cta}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <p className="text-eyebrow">FAQ</p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Questions people ask first
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {faqs.map((item) => (
                <div key={item.q} className="surface-panel p-5">
                  <h3 className="font-display text-base font-semibold">{item.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="surface-panel flex flex-col items-start gap-5 p-8 sm:p-12">
            <h2 className="font-display max-w-2xl text-2xl font-bold tracking-tight sm:text-4xl">
              Your next 30 blog posts are one sign-in away.
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              Set up your first blog in under a minute — planning, AI drafting and Blogger
              auto-publishing are all live today.
            </p>
            <Button size="lg" asChild>
              <Link to="/auth" search={{ next: undefined }}>
                Create your workspace
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground">
          <span className="font-display font-bold tracking-tight text-foreground">
            BlogPilot<span className="text-primary">.</span>AI
          </span>
          <span>© {new Date().getFullYear()} BlogPilot AI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
