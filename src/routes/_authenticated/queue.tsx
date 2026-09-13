import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImagePlus, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateArticle, generateFeaturedImage, generateTopics } from "@/lib/ai.functions";
import { publishToBlogger } from "@/lib/blogger.functions";
import { recordWebsiteDiagnostic } from "@/lib/diagnostics.functions";
import { POST_STATUSES, slugify, statusLabel } from "@/lib/blogpilot";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({ meta: [{ title: "Content queue — BlogPilot AI" }, { name: "description", content: "Plan article ideas, outlines and SEO metadata, then track each post through the BlogPilot AI publishing queue." }, { property: "og:title", content: "Content queue — BlogPilot AI" }, { property: "og:description", content: "Track every article idea from outline to publish-ready." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: QueuePage,
});

function QueuePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const generateTopicsFn = useServerFn(generateTopics);
  const generateArticleFn = useServerFn(generateArticle);
  const publishFn = useServerFn(publishToBlogger);
  const imageFn = useServerFn(generateFeaturedImage);
  const diagnosticFn = useServerFn(recordWebsiteDiagnostic);
  const [blogId, setBlogId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [outline, setOutline] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [imageRefresh, setImageRefresh] = useState<Record<string, number>>({});

  const trace = (eventType: string, message: string, metadata: Record<string, unknown> = {}, severity: "info" | "warning" | "error" = "info") => {
    void diagnosticFn({ data: { severity, eventType, pageUrl: window.location.href, routePath: window.location.pathname, message, metadata, userAgent: navigator.userAgent } }).catch(() => undefined);
  };

  const blogs = useQuery({ queryKey: ["blogs"], queryFn: async () => { const { data, error } = await supabase.from("blogs").select("id, name, user_id").order("created_at", { ascending: false }); if (error) throw error; return data; } });
  useEffect(() => { const first = blogs.data?.[0]; if (!blogId && first) setBlogId(first.id); }, [blogs.data, blogId]);
  const posts = useQuery({ queryKey: ["posts", blogId], enabled: Boolean(blogId), queryFn: async () => { const { data, error } = await supabase.from("posts").select("*").eq("blog_id", blogId).order("created_at", { ascending: false }); if (error) throw error; return data; } });

  const addPost = useMutation({ mutationFn: async () => { if (!user || !blogId) throw new Error("Pick a blog first"); const existing = posts.data ?? []; if (existing.some((p) => p.title.trim().toLowerCase() === title.trim().toLowerCase())) throw new Error("That topic is already in the queue"); const { error } = await supabase.from("posts").insert({ user_id: user.id, blog_id: blogId, title: title.trim(), slug: slugify(title), outline: outline || null, meta_description: metaDescription || null, status: "idea" }); if (error) throw error; }, onSuccess: async () => { toast.success("Topic queued"); setTitle(""); setOutline(""); setMetaDescription(""); await queryClient.invalidateQueries({ queryKey: ["posts", blogId] }); await queryClient.invalidateQueries({ queryKey: ["post-counts"] }); }, onError: (error: Error) => toast.error(error.message) });
  const updateStatus = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => { const { error } = await supabase.from("posts").update({ status }).eq("id", id); if (error) throw error; }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["posts", blogId] }); await queryClient.invalidateQueries({ queryKey: ["post-counts"] }); }, onError: (error: Error) => toast.error(error.message) });
  const removePost = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("posts").delete().eq("id", id); if (error) throw error; }, onSuccess: async () => { toast.success("Removed"); await queryClient.invalidateQueries({ queryKey: ["posts", blogId] }); await queryClient.invalidateQueries({ queryKey: ["post-counts"] }); }, onError: (error: Error) => toast.error(error.message) });
  const planTopics = useMutation({ mutationFn: () => generateTopicsFn({ data: { blogId, count: 5 } }), onSuccess: async (result) => { toast.success(`${result.inserted} topics added`); await queryClient.invalidateQueries({ queryKey: ["posts", blogId] }); await queryClient.invalidateQueries({ queryKey: ["post-counts"] }); }, onError: (error: Error) => toast.error(error.message) });
  const writeArticle = useMutation({ mutationFn: (id: string) => generateArticleFn({ data: { postId: id } }), onSuccess: async () => { toast.success("Draft written"); await queryClient.invalidateQueries({ queryKey: ["posts", blogId] }); await queryClient.invalidateQueries({ queryKey: ["post-counts"] }); }, onError: (error: Error) => toast.error(error.message) });
  const makeImage = useMutation({ mutationFn: (id: string) => imageFn({ data: { postId: id } }), onSuccess: async (_result, id) => { setImageRefresh((current) => ({ ...current, [id]: Date.now() })); toast.success("Featured image ready"); await queryClient.invalidateQueries({ queryKey: ["posts", blogId] }); }, onError: (error: Error) => toast.error(error.message) });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      trace("blogger.publish_started", "Blogger publish requested from queue", { postId: id, blogId });
      try {
        const result = await publishFn({ data: { postId: id, origin: window.location.origin } });
        trace(
          result.recoveredMissingPost ? "blogger.publish_recovered_client" : result.republished ? "blogger.republish_succeeded_client" : "blogger.publish_succeeded_client",
          result.recoveredMissingPost ? "Blogger publish recovered a missing remote post" : result.republished ? "Blogger republish completed" : "Blogger publish completed",
          { postId: id, blogId, republished: Boolean(result.republished), recoveredMissingPost: Boolean(result.recoveredMissingPost) },
        );
        return result;
      } catch (error) {
        trace("blogger.publish_failed_client", error instanceof Error ? error.message : "Blogger publish failed", { postId: id, blogId }, "error");
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Published to Blogger");
      await queryClient.invalidateQueries({ queryKey: ["posts", blogId] });
      await queryClient.invalidateQueries({ queryKey: ["post-counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!blogs.isLoading && (blogs.data?.length ?? 0) === 0) return <div className="surface-panel p-10 text-center"><h1 className="text-xl font-semibold">Add a blog first</h1><p className="mt-2 text-sm text-muted-foreground">The content queue belongs to a blog. Create one from the overview page.</p></div>;

  return <div className="space-y-8"><div><p className="text-eyebrow">Content queue</p><h1 className="mt-1 text-3xl font-bold">Plan what gets written</h1></div><div className="grid gap-6 lg:grid-cols-[340px_1fr]"><div className="surface-panel h-fit p-5"><div className="space-y-2"><Label>Blog</Label><Select value={blogId} onValueChange={setBlogId}><SelectTrigger><SelectValue placeholder="Select blog" /></SelectTrigger><SelectContent>{blogs.data?.map((b) => <SelectItem key={b.id} value={b.id}><span className="flex items-center gap-2"><span>{b.name}</span>{user?.id === b.user_id ? <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Admin</span> : null}</span></SelectItem>)}</SelectContent></Select>{blogs.data?.some((b) => b.user_id !== user?.id) ? <p className="text-xs text-muted-foreground">Blogs marked <span className="font-medium text-primary">Admin</span> belong to your admin account. Unmarked blogs belong to other users.</p> : null}</div><div className="mt-5 space-y-4"><div className="space-y-2"><Label htmlFor="topic">Topic / working title</Label><Input id="topic" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Best espresso machines under $500" /></div><div className="space-y-2"><Label htmlFor="outline">Outline notes</Label><Textarea id="outline" rows={4} value={outline} onChange={(e) => setOutline(e.target.value)} placeholder="H2 sections, angles, search intent…" /></div><div className="space-y-2"><Label htmlFor="meta">Meta description</Label><Textarea id="meta" rows={2} maxLength={160} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} /><p className="text-xs text-muted-foreground">{metaDescription.length}/160</p></div><Button className="w-full" onClick={() => addPost.mutate()} disabled={!title.trim() || addPost.isPending}><Plus aria-hidden />Queue topic</Button><Button className="w-full" variant="outline" onClick={() => planTopics.mutate()} disabled={!blogId || planTopics.isPending}><Sparkles aria-hidden />{planTopics.isPending ? "Planning…" : "Auto-plan 5 topics with AI"}</Button></div></div><div className="space-y-3">{posts.isLoading ? <p className="text-sm text-muted-foreground">Loading queue…</p> : (posts.data?.length ?? 0) === 0 ? <div className="surface-panel p-8 text-center text-sm text-muted-foreground">Nothing queued yet for this blog.</div> : posts.data?.map((post) => <div key={post.id} className="surface-panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-semibold">{post.title}</h2>{post.slug ? <p className="mt-1 truncate text-xs text-muted-foreground">/{post.slug}</p> : null}</div><Badge variant={post.status === "published" ? "default" : "secondary"}>{statusLabel(post.status)}</Badge></div>{post.image_url ? <img src={`${post.image_url}${post.image_url.includes("?") ? "&" : "?"}v=${imageRefresh[post.id] ?? 0}`} alt={`Featured image for ${post.title}`} loading="lazy" className="mt-3 aspect-video w-full max-w-sm rounded-md border border-border object-cover" /> : null}{post.outline ? <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{post.outline}</p> : null}{post.body ? <div className="mt-3 rounded-md border border-border bg-muted/30 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Draft preview</p><p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{post.body}</p>{post.body.includes("blogpilot-owned-backlink:") ? <Badge className="mt-3" variant="outline">Owned backlink inserted</Badge> : null}</div> : null}<div className="mt-4 flex flex-wrap items-center gap-2"><Select value={post.status} onValueChange={(status) => updateStatus.mutate({ id: post.id, status })}><SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{POST_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="secondary" onClick={() => writeArticle.mutate(post.id)} disabled={writeArticle.isPending}><Sparkles aria-hidden />{writeArticle.isPending && writeArticle.variables === post.id ? "Writing…" : post.body ? "Rewrite with AI" : "Write with AI"}</Button><Button size="sm" variant="secondary" onClick={() => makeImage.mutate(post.id)} disabled={makeImage.isPending}><ImagePlus aria-hidden />{makeImage.isPending && makeImage.variables === post.id ? "Generating…" : post.image_url ? "Regenerate image" : "AI image"}</Button><Button size="sm" variant="secondary" onClick={() => publish.mutate(post.id)} disabled={!post.body || publish.isPending}><Upload aria-hidden />{publish.isPending && publish.variables === post.id ? "Publishing…" : "Publish to Blogger"}</Button>{post.blogger_url ? <Button size="sm" variant="ghost" asChild><a data-diagnostic-ignore="true" href={post.blogger_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden />View live</a></Button> : null}<Button variant="ghost" size="icon" aria-label="Remove topic" onClick={() => removePost.mutate(post.id)}><Trash2 aria-hidden /></Button></div></div>)}</div></div></div>;
}
