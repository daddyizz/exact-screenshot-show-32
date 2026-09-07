import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayCircle, Plus, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateTopics } from "@/lib/ai.functions";
import { runAutopilotNow, updateAutopilot } from "@/lib/autopilot.functions";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "@/components/AdSlot";
import { COUNTRIES, LANGUAGES, NICHES } from "@/lib/blogpilot";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — BlogPilot AI" },
      {
        name: "description",
        content: "Manage your blogs, niches and publishing cadence from the BlogPilot AI overview.",
      },
      { property: "og:title", content: "Dashboard — BlogPilot AI" },
      { property: "og:description", content: "Your blogs, plans and publishing cadence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const generateTopicsFn = useServerFn(generateTopics);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    blog_url: "",
    niche: NICHES[0],
    target_country: "US",
    language: "en",
    posts_per_week: 3,
  });

  const blogs = useQuery({
    queryKey: ["blogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const posts = useQuery({
    queryKey: ["post-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("id, blog_id, status");
      if (error) throw error;
      return data;
    },
  });

  const createBlog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("blogs").insert({
        user_id: user.id,
        name: form.name,
        blog_url: form.blog_url || null,
        niche: form.niche,
        target_country: form.target_country,
        language: form.language,
        posts_per_week: form.posts_per_week,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Blog added");
      setOpen(false);
      setForm({ ...form, name: "", blog_url: "" });
      await queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const autopilotFn = useServerFn(updateAutopilot);
  const runNowFn = useServerFn(runAutopilotNow);

  const toggleAutopilot = useMutation({
    mutationFn: (vars: { blogId: string; autopilot?: boolean; autoPublish?: boolean }) =>
      autopilotFn({ data: vars }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runNow = useMutation({
    mutationFn: (blogId: string) =>
      runNowFn({ data: { blogId, origin: window.location.origin } }),
    onSuccess: async (result) => {
      toast.success(
        result.status === "published"
          ? `Published: ${result.detail}`
          : result.status === "drafted"
            ? `Draft ready: ${result.detail}`
            : result.detail,
      );
      await queryClient.invalidateQueries({ queryKey: ["blogs"] });
      await queryClient.invalidateQueries({ queryKey: ["post-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const planTopics = useMutation({
    mutationFn: (id: string) => generateTopicsFn({ data: { blogId: id, count: 5 } }),
    onSuccess: async (result) => {
      toast.success(`${result.inserted} new topics added to the queue`);
      await queryClient.invalidateQueries({ queryKey: ["post-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalPosts = posts.data?.length ?? 0;
  const published = posts.data?.filter((p) => p.status === "published").length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Overview</p>
          <h1 className="mt-1 text-3xl font-bold">Your blogs</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link to="/settings">
              <Rocket aria-hidden />
              Connect Blogger
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus aria-hidden />
                Add blog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a blog</DialogTitle>
                <DialogDescription>
                  Set the basics now — you can fine-tune SEO rules afterwards.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="blog-name">Blog name</Label>
                  <Input
                    id="blog-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Coffee Gear Weekly"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-url">Blog URL (optional)</Label>
                  <Input
                    id="blog-url"
                    value={form.blog_url}
                    onChange={(e) => setForm({ ...form, blog_url: e.target.value })}
                    placeholder="https://myblog.blogspot.com"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Niche</Label>
                    <Select
                      value={form.niche}
                      onValueChange={(v) => setForm({ ...form, niche: v as typeof form.niche })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NICHES.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Posts per week</Label>
                    <Input
                      type="number"
                      min={1}
                      max={21}
                      value={form.posts_per_week}
                      onChange={(e) =>
                        setForm({ ...form, posts_per_week: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target country</Label>
                    <Select
                      value={form.target_country}
                      onValueChange={(v) => setForm({ ...form, target_country: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={form.language}
                      onValueChange={(v) => setForm({ ...form, language: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createBlog.mutate()}
                  disabled={!form.name.trim() || createBlog.isPending}
                >
                  {createBlog.isPending ? "Saving…" : "Save blog"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Blogs" value={String(blogs.data?.length ?? 0)} />
        <Stat label="Planned posts" value={String(totalPosts)} />
        <Stat label="Published" value={String(published)} />
      </div>

      {blogs.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading blogs…</p>
      ) : (blogs.data?.length ?? 0) === 0 ? (
        <div className="surface-panel p-10 text-center">
          <Sparkles className="mx-auto size-6 text-primary" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold">No blogs yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Add your first blog, pick a niche and BlogPilot will help you build a topic plan.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {blogs.data?.map((blog) => (
            <div key={blog.id} className="surface-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{blog.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {blog.niche} · {blog.target_country} · {blog.language}
                  </p>
                </div>
                <Badge variant={blog.autopilot ? "default" : "secondary"}>
                  {blog.autopilot ? "Autopilot" : "Manual"}
                </Badge>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {blog.posts_per_week} posts/week ·{" "}
                {posts.data?.filter((p) => p.blog_id === blog.id).length ?? 0} in queue
              </p>
              <div className="mt-4 space-y-3 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`autopilot-${blog.id}`} className="text-sm">
                    Autopilot
                  </Label>
                  <Switch
                    id={`autopilot-${blog.id}`}
                    checked={Boolean(blog.autopilot)}
                    onCheckedChange={(checked) =>
                      toggleAutopilot.mutate({ blogId: blog.id, autopilot: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`autopublish-${blog.id}`} className="text-sm">
                    Publish automatically to Blogger
                  </Label>
                  <Switch
                    id={`autopublish-${blog.id}`}
                    checked={Boolean(blog.autopilot_auto_publish)}
                    onCheckedChange={(checked) =>
                      toggleAutopilot.mutate({ blogId: blog.id, autoPublish: checked })
                    }
                  />
                </div>
                {blog.autopilot_last_run_at ? (
                  <p className="text-xs text-muted-foreground">
                    Last run: {new Date(blog.autopilot_last_run_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings">Configure</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/queue">Queue</Link>
                </Button>
                <Button
                  size="sm"
                  onClick={() => planTopics.mutate(blog.id)}
                  disabled={planTopics.isPending}
                >
                  <Sparkles aria-hidden />
                  {planTopics.isPending && planTopics.variables === blog.id
                    ? "Planning…"
                    : "Plan topics"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel p-5">
      <p className="text-eyebrow">{label}</p>
      <p className="font-display mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
