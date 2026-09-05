import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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
import { ComingSoonBadge, ComingSoonButton } from "@/components/ComingSoon";
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
          "Update your BlogPilot AI profile, per-blog niche, tone, language and publishing cadence.",
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
  const [displayName, setDisplayName] = useState("");
  const [blogId, setBlogId] = useState<string>("");

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
    if (profileQuery.data?.display_name) setDisplayName(profileQuery.data.display_name);
  }, [profileQuery.data?.display_name]);

  const blogs = blogsQuery.data ?? [];
  const selected = blogs.find((b) => b.id === blogId) ?? blogs[0];

  useEffect(() => {
    if (!blogId && blogs[0]) setBlogId(blogs[0].id);
  }, [blogId, blogs]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBlog = useMutation({
    mutationFn: async (patch: Database["public"]["Tables"]["blogs"]["Update"]) => {
      if (!selected) return;
      const { error } = await supabase.from("blogs").update(patch).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blog settings saved");
      void queryClient.invalidateQueries({ queryKey: ["blogs", user?.id] });
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
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight">
          Workspace preferences
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account details and the automation defaults used for every generated post.
        </p>
      </header>

      <section className="surface-panel space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">How you appear inside BlogPilot AI.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} readOnly disabled />
          </div>
        </div>
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
          {saveProfile.isPending ? "Saving…" : "Save profile"}
        </Button>
      </section>

      <section className="surface-panel space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Blog automation defaults</h2>
            <p className="text-sm text-muted-foreground">
              Applied whenever BlogPilot plans or drafts content for a blog.
            </p>
          </div>
          {blogs.length > 1 && (
            <Select value={selected?.id ?? ""} onValueChange={setBlogId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose blog" />
              </SelectTrigger>
              <SelectContent>
                {blogs.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Create a blog on the overview page to configure automation defaults.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Niche</Label>
              <Select value={selected.niche} onValueChange={(v) => saveBlog.mutate({ niche: v })}>
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
              <Label>Tone of voice</Label>
              <Select value={selected.tone} onValueChange={(v) => saveBlog.mutate({ tone: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target country</Label>
              <Select
                value={selected.target_country}
                onValueChange={(v) => saveBlog.mutate({ target_country: v })}
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
                value={selected.language}
                onValueChange={(v) => saveBlog.mutate({ language: v })}
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

            <div className="space-y-2">
              <Label htmlFor="ppw">Posts per week</Label>
              <Input
                id="ppw"
                type="number"
                min={1}
                max={21}
                defaultValue={selected.posts_per_week}
                onBlur={(e) =>
                  saveBlog.mutate({ posts_per_week: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="len">Target article length (words)</Label>
              <Input
                id="len"
                type="number"
                min={300}
                max={5000}
                step={100}
                defaultValue={selected.article_length}
                onBlur={(e) =>
                  saveBlog.mutate({ article_length: Math.max(300, Number(e.target.value) || 300) })
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kw">Keyword focus</Label>
              <Textarea
                id="kw"
                rows={3}
                defaultValue={selected.keyword_focus ?? ""}
                placeholder="Comma-separated seed keywords, e.g. budget travel malaysia, cheap flights kl"
                onBlur={(e) => saveBlog.mutate({ keyword_focus: e.target.value.trim() || null })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Autopilot publishing</p>
                <p className="text-sm text-muted-foreground">
                  Automatically draft and publish on your cadence.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ComingSoonBadge />
                <Switch checked={false} disabled aria-label="Autopilot publishing" />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="surface-panel space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-semibold">Integrations</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Blogger to publish approved drafts straight to your site.
        </p>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Create a blog first.</p>
        ) : bloggerStatus.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking connection…</p>
        ) : bloggerStatus.data?.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Connected to{" "}
              <span className="font-medium">
                {bloggerStatus.data.bloggerBlogName ?? "your Blogger account"}
              </span>
            </p>
            <Button
              variant="outline"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending ? "Opening Google…" : "Connect Blogger"}
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <ComingSoonButton>Enable AI images</ComingSoonButton>
          <ComingSoonBadge />
        </div>
      </section>
    </div>
  );
}
