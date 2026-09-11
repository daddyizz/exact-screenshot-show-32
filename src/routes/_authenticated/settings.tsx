import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, LANGUAGES, NICHES, TONES } from "@/lib/blogpilot";
import {
  disconnectBlogger,
  getBloggerStatus,
  startBloggerAuth,
} from "@/lib/blogger.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BlogPilot AI" },
      {
        name: "description",
        content:
          "Update your BlogPilot AI profile, per-blog niche, tone, language, AI image style and publishing cadence.",
      },
      { property: "og:title", content: "Settings — BlogPilot AI" },
      {
        property: "og:description",
        content: "Manage your profile and blog automation defaults in BlogPilot AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bloggerStatusFn = useServerFn(getBloggerStatus);
  const startAuthFn = useServerFn(startBloggerAuth);
  const disconnectFn = useServerFn(disconnectBlogger);
  const [displayName, setDisplayName] = useState("");
  const [blogId, setBlogId] = useState<string>("");

  const googleAvatar = (user?.user_metadata?.['avatar_url'] ?? user?.user_metadata?.['picture'] ?? null) as string | null;
  const googleName = (user?.user_metadata?.['full_name'] ?? user?.user_metadata?.['name'] ?? "") as string;

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const blogsQuery = useQuery({
    queryKey: ["blogs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user || profileQuery.isLoading) return;
    const savedName = profileQuery.data?.display_name ?? googleName;
    setDisplayName(savedName ?? "");

    if (googleAvatar && profileQuery.data?.avatar_url !== googleAvatar) {
      void supabase.from("profiles").upsert({
        id: user.id,
        display_name: profileQuery.data?.display_name ?? (googleName || null),
        avatar_url: googleAvatar,
      }, { onConflict: "id" });
    }
  }, [user, profileQuery.isLoading, profileQuery.data?.display_name, profileQuery.data?.avatar_url, googleAvatar, googleName]);

  const blogs = blogsQuery.data ?? [];
  const selected = blogs.find((b) => b.id === blogId) ?? blogs[0];
  const selectedAny = selected as any;

  useEffect(() => {
    if (!blogId && blogs[0]) setBlogId(blogs[0].id);
  }, [blogId, blogs]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not found");
      const value = displayName.trim();
      if (!value) throw new Error("Writer name is required.");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: value, avatar_url: googleAvatar }, { onConflict: "id" });
      if (error) throw error;
      return value;
    },
    onSuccess: async (savedName) => {
      setDisplayName(savedName);
      toast.success("Writer name saved");
      await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBlog = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!selected) return;
      const { error } = await supabase.from("blogs").update(patch as any).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Blog settings saved");
      await queryClient.invalidateQueries({ queryKey: ["blogs", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["blogs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bloggerStatus = useQuery({
    queryKey: ["blogger-status", selected?.id],
    enabled: !!selected,
    queryFn: () => bloggerStatusFn({ data: { blogId: selected!.id } }),
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { url } = await startAuthFn({
        data: {
          blogId: selected!.id,
          redirectUri: `${window.location.origin}/blogger/callback`,
        },
      });
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn({ data: { blogId: selected!.id } }),
    onSuccess: () => {
      toast.success("Blogger disconnected");
      void queryClient.invalidateQueries({ queryKey: ["blogger-status", selected?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-eyebrow">Settings</p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight">Workspace preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account details and the automation defaults used for every generated post.</p>
      </header>

      <section className="surface-panel space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Your saved writer identity inside BlogPilot AI.</p>
        </div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {googleAvatar || profileQuery.data?.avatar_url ? (
              <img src={googleAvatar ?? profileQuery.data?.avatar_url ?? ""} alt="Google profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-xl font-semibold">{(displayName || user?.email || "U").charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">Writer name</Label>
              <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              <p className="text-xs text-muted-foreground">This value stays visible after saving so you can confirm exactly which name is stored.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} readOnly disabled />
              <p className="text-xs text-muted-foreground">Profile photo is synced from your Google account when available.</p>
            </div>
          </div>
        </div>
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending || !displayName.trim()}>
          {saveProfile.isPending ? "Saving…" : "Save writer profile"}
        </Button>
      </section>

      <section className="surface-panel space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Blog automation defaults</h2>
            <p className="text-sm text-muted-foreground">Applied whenever BlogPilot plans, drafts, creates images or publishes content for a blog.</p>
          </div>
          {blogs.length > 1 && (
            <Select value={selected?.id ?? ""} onValueChange={setBlogId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choose blog" /></SelectTrigger>
              <SelectContent>{blogs.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        {!selected ? (
          <p className="text-sm text-muted-foreground">Create a blog on the overview page to configure automation defaults.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Niche</Label>
              <Select value={selected.niche} onValueChange={(v) => saveBlog.mutate({ niche: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone of voice</Label>
              <Select value={selected.tone} onValueChange={(v) => saveBlog.mutate({ tone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target country</Label>
              <Select value={selected.target_country} onValueChange={(v) => saveBlog.mutate({ target_country: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={selected.language} onValueChange={(v) => saveBlog.mutate({ language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ppw">Posts per week</Label>
              <Input id="ppw" type="number" min={1} max={21} defaultValue={selected.posts_per_week} onBlur={(e) => saveBlog.mutate({ posts_per_week: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="len">Target article length (words)</Label>
              <Input id="len" type="number" min={300} max={5000} step={100} defaultValue={selected.article_length} onBlur={(e) => saveBlog.mutate({ article_length: Math.max(300, Number(e.target.value) || 300) })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kw">Keyword focus</Label>
              <Textarea id="kw" rows={3} defaultValue={selected.keyword_focus ?? ""} placeholder="Comma-separated seed keywords, e.g. budget travel malaysia, cheap flights kl" onBlur={(e) => saveBlog.mutate({ keyword_focus: e.target.value.trim() || null })} />
            </div>

            {isPro ? (
              <div className="rounded-lg border border-border p-4 sm:col-span-2">
                <div className="mb-4 flex items-start gap-3">
                  <ImageIcon className="mt-0.5 size-5 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">AI featured image</p>
                    <p className="text-xs text-muted-foreground">Autopilot always creates an AI image before an article can publish.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Image ratio</Label>
                    <Select value={selectedAny.ai_image_aspect_ratio ?? "16:9"} onValueChange={(v) => saveBlog.mutate({ ai_image_aspect_ratio: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 — Widescreen</SelectItem>
                        <SelectItem value="4:3">4:3 — Standard</SelectItem>
                        <SelectItem value="1:1">1:1 — Square</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Image style</Label>
                    <Select value={selectedAny.ai_image_style ?? "auto"} onValueChange={(v) => saveBlog.mutate({ ai_image_style: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="realistic">Realistic</SelectItem>
                        <SelectItem value="2d">2D</SelectItem>
                        <SelectItem value="3d">3D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(selectedAny.ai_image_aspect_ratio ?? "16:9") === "custom" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="custom-width">Custom width</Label>
                        <Input id="custom-width" type="number" min={320} max={4096} defaultValue={selectedAny.ai_image_custom_width ?? 1200} onBlur={(e) => saveBlog.mutate({ ai_image_custom_width: Math.min(4096, Math.max(320, Number(e.target.value) || 1200)) })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-height">Custom height</Label>
                        <Input id="custom-height" type="number" min={320} max={4096} defaultValue={selectedAny.ai_image_custom_height ?? 630} onBlur={(e) => saveBlog.mutate({ ai_image_custom_height: Math.min(4096, Math.max(320, Number(e.target.value) || 630)) })} />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-border p-4 sm:col-span-2">
              <p className="text-sm font-medium">SEO meta search description</p>
              {isPro ? (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">Leave the keywords empty and AI writes the whole description, or add keywords and AI builds the description around them. Maximum 150 characters.</p>
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="meta-kw">Description keywords (optional)</Label>
                    <Textarea id="meta-kw" rows={2} defaultValue={selectedAny.meta_description_keywords ?? ""} placeholder="e.g. tips jimat duit, bajet bulanan" onBlur={(e) => saveBlog.mutate({ meta_description_keywords: e.target.value.trim() || null })} />
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">On the Free plan you write the search description yourself for each article, in the Articles page. AI-written descriptions are a Pro feature.</p>
              )}
            </div>


            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Autopilot publishing</p>
                <p className="text-sm text-muted-foreground">Automatically draft, create the required AI image and publish on your cadence. Review settings before every manual run.</p>
              </div>
              <Switch checked={Boolean(selected.autopilot)} onCheckedChange={(checked) => saveBlog.mutate({ autopilot: checked })} aria-label="Autopilot publishing" />
            </div>
          </div>
        )}
      </section>

      <section className="surface-panel space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-lg font-semibold">Integrations</h2></div>
        <p className="text-sm text-muted-foreground">Connect Blogger to publish approved drafts straight to your site.</p>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Create a blog first.</p>
        ) : bloggerStatus.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking connection…</p>
        ) : bloggerStatus.data?.connected ? (
          <div className="space-y-3">
            {bloggerStatus.data.needsReconnect ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 text-destructive" aria-hidden />
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">Blogger needs to be reconnected</p>
                      <p className="text-sm text-muted-foreground">Google authorization expired or was revoked. Reconnect this blog before the next publish or Autopilot run.</p>
                    </div>
                    <Button onClick={() => connect.mutate()} disabled={connect.isPending}>{connect.isPending ? "Opening Google…" : "Reconnect Blogger"}</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="size-5 text-primary" aria-hidden />
                <p className="text-sm">Connected to <span className="font-medium">{bloggerStatus.data.bloggerBlogName ?? "your Blogger account"}</span></p>
              </div>
            )}
            <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>Disconnect</Button>
          </div>
        ) : (
          <Button onClick={() => connect.mutate()} disabled={connect.isPending}>{connect.isPending ? "Opening Google…" : "Connect Blogger"}</Button>
        )}
        <p className="pt-2 text-sm text-muted-foreground">Manual AI images and Autopilot images use the ratio and style selected above.</p>
      </section>
    </div>
  );
}
