import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeBloggerAuth, selectBloggerBlog } from "@/lib/blogger.functions";

type Search = { code: string | undefined; state: string | undefined; error: string | undefined };

export const Route = createFileRoute("/_authenticated/blogger/callback")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    state: typeof search["state"] === "string" ? search["state"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connecting Blogger — BlogPilot AI" },
      {
        name: "description",
        content: "Finishing the Blogger connection so BlogPilot AI can publish your drafts.",
      },
      { property: "og:title", content: "Connecting Blogger — BlogPilot AI" },
      { property: "og:description", content: "Finishing your Blogger connection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BloggerCallback,
});

function BloggerCallback() {
  const { code, state, error } = Route.useSearch();
  const navigate = useNavigate();
  const complete = useServerFn(completeBloggerAuth);
  const choose = useServerFn(selectBloggerBlog);
  const ran = useRef(false);
  const [status, setStatus] = useState<"working" | "choose" | "failed">("working");
  const [blogId, setBlogId] = useState<string>("");
  const [blogs, setBlogs] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [message, setMessage] = useState("Finishing the connection…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (error || !code || !state) {
      setStatus("failed");
      setMessage(error ? `Google returned: ${error}` : "The connection link was incomplete.");
      return;
    }

    void complete({
      data: { code, state, redirectUri: `${window.location.origin}/blogger/callback` },
    })
      .then((result) => {
        setBlogId(result.blogId);
        setBlogs(result.blogs);
        if (result.blogs.length > 1) {
          setStatus("choose");
          return;
        }
        toast.success("Blogger connected");
        void navigate({ to: "/settings" });
      })
      .catch((e: Error) => {
        setStatus("failed");
        setMessage(e.message);
      });
  }, [code, state, error, complete, navigate]);

  return (
    <div className="surface-panel mx-auto max-w-lg space-y-4 p-8 text-center">
      <h1 className="font-display text-xl font-semibold">Blogger connection</h1>

      {status === "working" && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {message}
        </p>
      )}

      {status === "failed" && (
        <>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button onClick={() => navigate({ to: "/settings" })}>Back to settings</Button>
        </>
      )}

      {status === "choose" && (
        <>
          <p className="text-sm text-muted-foreground">
            Pick which Blogger site BlogPilot should publish to.
          </p>
          <div className="space-y-2 text-left">
            {blogs.map((b) => (
              <Button
                key={b.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  void choose({
                    data: {
                      blogId,
                      bloggerBlogId: b.id,
                      bloggerBlogName: b.name,
                      bloggerBlogUrl: b.url,
                    },
                  })
                    .then(() => {
                      toast.success("Blogger connected");
                      void navigate({ to: "/settings" });
                    })
                    .catch((e: Error) => toast.error(e.message));
                }}
              >
                {b.name}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
