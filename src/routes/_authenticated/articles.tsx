import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { publishToBlogger } from "@/lib/blogger.functions";
import { statusLabel } from "@/lib/blogpilot";

export const Route = createFileRoute("/_authenticated/articles")({
  head: () => ({
    meta: [
      { title: "Articles library — BlogPilot AI" },
      {
        name: "description",
        content:
          "Browse every article BlogPilot AI has written, edit the text, and republish it to your Blogger blog.",
      },
      { property: "og:title", content: "Articles library — BlogPilot AI" },
      {
        property: "og:description",
        content: "Every autopilot article stays here, ready to edit and republish.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArticlesPage,
});

function ArticlesPage() {
  const queryClient = useQueryClient();
  const publishFn = useServerFn(publishToBlogger);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const articles = useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .not("body", "is", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("posts")
        .update({ title: draftTitle.trim(), body: draftBody })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Article saved");
      setOpenId(null);
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      publishFn({ data: { postId: id, origin: window.location.origin } }),
    onSuccess: async () => {
      toast.success("Published to Blogger");
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
      await queryClient.invalidateQueries({ queryKey: ["post-counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-eyebrow">Library</p>
        <h1 className="mt-1 text-3xl font-bold">Your written articles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything autopilot and AI wrote lives here. Edit the text, then publish or republish.
        </p>
      </div>

      {articles.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading articles…</p>
      ) : (articles.data?.length ?? 0) === 0 ? (
        <div className="surface-panel p-8 text-center text-sm text-muted-foreground">
          No articles written yet. Use the content queue or autopilot to write your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {articles.data?.map((post) => {
            const open = openId === post.id;
            return (
              <article key={post.id} className="surface-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{post.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(post.body ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length}{" "}
                      words
                    </p>
                  </div>
                  <Badge variant={post.status === "published" ? "default" : "secondary"}>
                    {statusLabel(post.status)}
                  </Badge>
                </div>

                {open ? (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`title-${post.id}`}>Title</Label>
                      <Input
                        id={`title-${post.id}`}
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`body-${post.id}`}>Article text</Label>
                      <Textarea
                        id={`body-${post.id}`}
                        rows={16}
                        value={draftBody}
                        onChange={(e) => setDraftBody(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => save.mutate(post.id)}
                        disabled={save.isPending || !draftTitle.trim()}
                      >
                        <Save aria-hidden />
                        {save.isPending ? "Saving…" : "Save changes"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                    {(post.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 320)}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!open ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setOpenId(post.id);
                        setDraftTitle(post.title);
                        setDraftBody(post.body ?? "");
                      }}
                    >
                      View & edit
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => publish.mutate(post.id)}
                    disabled={publish.isPending}
                  >
                    <Upload aria-hidden />
                    {publish.isPending && publish.variables === post.id
                      ? "Publishing…"
                      : post.blogger_url
                        ? "Republish"
                        : "Publish to Blogger"}
                  </Button>
                  {post.blogger_url ? (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={post.blogger_url} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden />
                        View live
                      </a>
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
