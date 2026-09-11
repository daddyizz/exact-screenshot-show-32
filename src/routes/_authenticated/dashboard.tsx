import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, PlayCircle, Plus, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateTopics } from "@/lib/ai.functions";
import { runAutopilotNow, runDueAutopilot, updateAutopilot } from "@/lib/autopilot.functions";
import { createBlog as createBlogServer } from "@/lib/blogs.functions";
import { getMyPlanUsage } from "@/lib/account.functions";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "@/components/AdSlot";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import { COUNTRIES, LANGUAGES, NICHES, TONES } from "@/lib/blogpilot";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — BlogPilot AI" },
    { name: "description", content: "Manage your blogs, niches and publishing cadence from the BlogPilot AI overview." },
    { property: "og:title", content: "Dashboard — BlogPilot AI" },
    { property: "og:description", content: "Your blogs, plans and publishing cadence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

type RunSetup = {
  blogId: string;
  blogName: string;
  tone: string;
  articleLength: number;
  imageRatio: "16:9" | "4:3" | "1:1" | "custom";
  imageStyle: "auto" | "realistic" | "2d" | "3d";
  customWidth: number;
  customHeight: number;
  autoPublish: boolean;
};

function Dashboard() {
  const queryClient = useQueryClient();
  const generateTopicsFn = useServerFn(generateTopics);
  const createBlogFn = useServerFn(createBlogServer);
  const getPlanUsageFn = useServerFn(getMyPlanUsage);
  const [open, setOpen] = useState(false);
  const [runSetup, setRunSetup] = useState<RunSetup | null>(null);
  const [form, setForm] = useState({ name: "", blog_url: "", niche: NICHES[0], target_country: "US", language: "en", posts_per_week: 3 });

  const blogs = useQuery({ queryKey: ["blogs"], queryFn: async () => {
    const { data, error } = await supabase.from("blogs").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }});
  const posts = useQuery({ queryKey: ["post-counts"], queryFn: async () => {
    const { data, error } = await supabase.from("posts").select("id, blog_id, status");
    if (error) throw error;
    return data;
  }});
  const planUsage = useQuery({ queryKey: ["my-plan-usage"], queryFn: () => getPlanUsageFn() });

  const createBlog = useMutation({
    mutationFn: async () => createBlogFn({ data: { name: form.name, blogUrl: form.blog_url.trim() || null, niche: form.niche, targetCountry: form.target_country, language: form.language, postsPerWeek: form.posts_per_week } }),
    onSuccess: async () => {
      toast.success("Blog added");
      setOpen(false);
      setForm({ ...form, name: "", blog_url: "" });
      await queryClient.invalidateQueries({ queryKey: ["blogs"] });
      await queryClient.invalidateQueries({ queryKey: ["my-plan-usage"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleAddBlogClick = () => {
    if (planUsage.isLoading) { toast.info("Checking your plan…"); return; }
    if (planUsage.isError || !planUsage.data) { toast.error("Could not verify your blog limit. Please try again."); return; }
    if (planUsage.data.blogCount >= planUsage.data.blogLimit) {
      toast.error(planUsage.data.plan === "pro" ? "Pro plan supports up to 5 blogs." : "Free plan supports 1 blog. Upgrade to Pro to add more blogs.");
      return;
    }
    setOpen(true);
  };

  const autopilotFn = useServerFn(updateAutopilot);
  const runNowFn = useServerFn(runAutopilotNow);
  const toggleAutopilot = useMutation({
    mutationFn: (vars: { blogId: string; autopilot?: boolean; autoPublish?: boolean }) => autopilotFn({ data: vars }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["blogs"] }); await queryClient.invalidateQueries({ queryKey: ["my-plan-usage"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const openRunSetup = (blog: any) => {
    setRunSetup({
      blogId: blog.id,
      blogName: blog.name,
      tone: blog.tone ?? "professional",
      articleLength: Number(blog.article_length ?? 1200),
      imageRatio: (blog.ai_image_aspect_ratio ?? "16:9") as RunSetup["imageRatio"],
      imageStyle: (blog.ai_image_style ?? "auto") as RunSetup["imageStyle"],
      customWidth: Number(blog.ai_image_custom_width ?? 1200),
      customHeight: Number(blog.ai_image_custom_height ?? 630),
      autoPublish: Boolean(blog.autopilot_auto_publish),
    });
  };

  const runNow = useMutation({
    mutationFn: async (settings: RunSetup) => {
      if (settings.imageRatio === "custom" && (settings.customWidth < 320 || settings.customHeight < 320)) {
        throw new Error("Custom image size must be at least 320 × 320.");
      }
      const patch = {
        tone: settings.tone,
        article_length: Math.min(5000, Math.max(300, settings.articleLength)),
        ai_image_aspect_ratio: settings.imageRatio,
        ai_image_style: settings.imageStyle,
        ai_image_custom_width: settings.imageRatio === "custom" ? Math.min(4096, Math.max(320, settings.customWidth)) : null,
        ai_image_custom_height: settings.imageRatio === "custom" ? Math.min(4096, Math.max(320, settings.customHeight)) : null,
        autopilot_auto_publish: settings.autoPublish,
      };
      const { error } = await supabase.from("blogs").update(patch as any).eq("id", settings.blogId);
      if (error) throw error;
      return runNowFn({ data: { blogId: settings.blogId, origin: window.location.origin } });
    },
    onSuccess: async (result) => {
      setRunSetup(null);
      toast.success(result.status === "published" ? `Published with AI image: ${result.detail}` : result.status === "drafted" ? `Draft + AI image ready: ${result.detail}` : result.detail);
      await queryClient.invalidateQueries({ queryKey: ["blogs"] });
      await queryClient.invalidateQueries({ queryKey: ["post-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["my-plan-usage"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const planTopics = useMutation({
    mutationFn: (id: string) => generateTopicsFn({ data: { blogId: id, count: 5 } }),
    onSuccess: async (result) => { toast.success(`${result.inserted} new topics added to the queue`); await queryClient.invalidateQueries({ queryKey: ["post-counts"] }); await queryClient.invalidateQueries({ queryKey: ["posts"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const runDueFn = useServerFn(runDueAutopilot);
  const checkedDue = useRef(false);
  useEffect(() => {
    if (checkedDue.current || !blogs.data?.some((b) => b.autopilot)) return;
    checkedDue.current = true;
    void runDueFn({ data: { origin: window.location.origin } }).then(async (result) => {
      if (result.ran > 0) { toast.success(`Autopilot ran for ${result.ran} blog${result.ran > 1 ? "s" : ""}`); await queryClient.invalidateQueries({ queryKey: ["blogs"] }); await queryClient.invalidateQueries({ queryKey: ["post-counts"] }); await queryClient.invalidateQueries({ queryKey: ["my-plan-usage"] }); }
    }).catch(() => undefined);
  }, [blogs.data, runDueFn, queryClient]);

  const totalPosts = posts.data?.length ?? 0;
  const published = posts.data?.filter((p) => p.status === "published").length ?? 0;

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-eyebrow">Overview</p><h1 className="mt-1 text-3xl font-bold">Your blogs</h1></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild><Link to="/settings"><Rocket aria-hidden />Connect Blogger</Link></Button>
        <Button onClick={handleAddBlogClick}><Plus aria-hidden />Add blog</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a blog</DialogTitle><DialogDescription>Set the basics now — you can fine-tune SEO rules afterwards.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="blog-name">Blog name</Label><Input id="blog-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Coffee Gear Weekly" /></div>
              <div className="space-y-2"><Label htmlFor="blog-url">Blog URL (optional)</Label><Input id="blog-url" value={form.blog_url} onChange={(e) => setForm({ ...form, blog_url: e.target.value })} placeholder="https://myblog.blogspot.com" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Niche</Label><Select value={form.niche} onValueChange={(v) => setForm({ ...form, niche: v as typeof form.niche })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Posts per week</Label><Input type="number" min={1} max={21} value={form.posts_per_week} onChange={(e) => setForm({ ...form, posts_per_week: Number(e.target.value) || 1 })} /></div>
                <div className="space-y-2"><Label>Target country</Label><Select value={form.target_country} onValueChange={(v) => setForm({ ...form, target_country: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Language</Label><Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => createBlog.mutate()} disabled={!form.name.trim() || createBlog.isPending}>{createBlog.isPending ? "Saving…" : "Save blog"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <Dialog open={Boolean(runSetup)} onOpenChange={(value) => { if (!value && !runNow.isPending) setRunSetup(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review Autopilot settings</DialogTitle>
          <DialogDescription>Check these settings before BlogPilot writes the next article. An AI featured image is mandatory for every Autopilot run.</DialogDescription>
        </DialogHeader>
        {runSetup ? <div className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="font-medium">{runSetup.blogName}</p>
            <p className="mt-1 text-xs text-muted-foreground">AI will also generate SEO title, keywords and a meta search description capped at 150 characters.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Tone of voice</Label><Select value={runSetup.tone} onValueChange={(v) => setRunSetup({ ...runSetup, tone: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Article length</Label><Input type="number" min={300} max={5000} step={100} value={runSetup.articleLength} onChange={(e) => setRunSetup({ ...runSetup, articleLength: Number(e.target.value) || 300 })} /></div>
            <div className="space-y-2"><Label>AI image ratio</Label><Select value={runSetup.imageRatio} onValueChange={(v) => setRunSetup({ ...runSetup, imageRatio: v as RunSetup["imageRatio"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="16:9">16:9 — Widescreen</SelectItem><SelectItem value="4:3">4:3 — Standard</SelectItem><SelectItem value="1:1">1:1 — Square</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>AI image style</Label><Select value={runSetup.imageStyle} onValueChange={(v) => setRunSetup({ ...runSetup, imageStyle: v as RunSetup["imageStyle"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="realistic">Realistic</SelectItem><SelectItem value="2d">2D</SelectItem><SelectItem value="3d">3D</SelectItem></SelectContent></Select></div>
            {runSetup.imageRatio === "custom" ? <><div className="space-y-2"><Label>Custom width</Label><Input type="number" min={320} max={4096} value={runSetup.customWidth} onChange={(e) => setRunSetup({ ...runSetup, customWidth: Number(e.target.value) || 320 })} /></div><div className="space-y-2"><Label>Custom height</Label><Input type="number" min={320} max={4096} value={runSetup.customHeight} onChange={(e) => setRunSetup({ ...runSetup, customHeight: Number(e.target.value) || 320 })} /></div></> : null}
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div><p className="text-sm font-medium">Publish automatically to Blogger</p><p className="text-xs text-muted-foreground">If enabled, BlogPilot publishes only after the AI image has been generated and attached successfully.</p></div>
            <Switch checked={runSetup.autoPublish} onCheckedChange={(checked) => setRunSetup({ ...runSetup, autoPublish: checked })} />
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><ImageIcon className="mt-0.5 size-5 text-primary" aria-hidden /><p className="text-sm">This run cannot publish without an AI image. If image generation fails, publishing is blocked rather than sending an image-less article.</p></div>
        </div> : null}
        <DialogFooter><Button variant="outline" onClick={() => setRunSetup(null)} disabled={runNow.isPending}>Cancel</Button><Button onClick={() => runSetup && runNow.mutate(runSetup)} disabled={!runSetup || runNow.isPending}><PlayCircle aria-hidden />{runNow.isPending ? "Running Autopilot…" : "Save settings & run"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Blogs" value={String(blogs.data?.length ?? 0)} /><Stat label="Planned posts" value={String(totalPosts)} /><Stat label="Published" value={String(published)} /></div>
    <PlanUsageCard />
    {blogs.isLoading ? <p className="text-sm text-muted-foreground">Loading blogs…</p> : (blogs.data?.length ?? 0) === 0 ? <div className="surface-panel p-10 text-center"><Sparkles className="mx-auto size-6 text-primary" aria-hidden /><h2 className="mt-4 text-xl font-semibold">No blogs yet</h2><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add your first blog, pick a niche and BlogPilot will help you build a topic plan.</p></div> : <div className="grid gap-4 md:grid-cols-2">{blogs.data?.map((blog) => <div key={blog.id} className="surface-panel p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{blog.name}</h2><p className="mt-1 text-sm text-muted-foreground">{blog.niche} · {blog.target_country} · {blog.language}</p></div><Badge variant={blog.autopilot ? "default" : "secondary"}>{blog.autopilot ? "Autopilot" : "Manual"}</Badge></div>
      <p className="mt-4 text-sm text-muted-foreground">{blog.posts_per_week} posts/week · {posts.data?.filter((p) => p.blog_id === blog.id).length ?? 0} in queue</p>
      <div className="mt-4 space-y-3 rounded-lg border border-border/60 p-3">
        <div className="flex items-center justify-between gap-3"><Label htmlFor={`autopilot-${blog.id}`} className="text-sm">Autopilot</Label><Switch id={`autopilot-${blog.id}`} checked={Boolean(blog.autopilot)} onCheckedChange={(checked) => toggleAutopilot.mutate({ blogId: blog.id, autopilot: checked })} /></div>
        <div className="flex items-center justify-between gap-3"><Label htmlFor={`autopublish-${blog.id}`} className="text-sm">Publish automatically to Blogger</Label><Switch id={`autopublish-${blog.id}`} checked={Boolean(blog.autopilot_auto_publish)} onCheckedChange={(checked) => toggleAutopilot.mutate({ blogId: blog.id, autoPublish: checked })} /></div>
        {blog.autopilot_last_run_at ? <p className="text-xs text-muted-foreground">Last run: {new Date(blog.autopilot_last_run_at).toLocaleString()}</p> : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild><Link to="/settings">Configure</Link></Button><Button variant="outline" size="sm" asChild><Link to="/queue">Queue</Link></Button>
        <Button size="sm" onClick={() => planTopics.mutate(blog.id)} disabled={planTopics.isPending}><Sparkles aria-hidden />{planTopics.isPending && planTopics.variables === blog.id ? "Planning…" : "Plan topics"}</Button>
        <Button size="sm" variant="secondary" onClick={() => openRunSetup(blog as any)} disabled={runNow.isPending}><PlayCircle aria-hidden />Review & run Autopilot</Button>
      </div>
    </div>)}</div>}
    <AdSlot id="dashboard-bottom" format="leaderboard" />
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="surface-panel p-5"><p className="text-eyebrow">{label}</p><p className="font-display mt-2 text-3xl font-bold">{value}</p></div>;
}
