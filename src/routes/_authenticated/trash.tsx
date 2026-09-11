import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Clock3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listDeletedBlogs, restoreDeletedBlog } from "@/lib/blog-trash.functions";

export const Route = createFileRoute("/_authenticated/trash")({
  head: () => ({
    meta: [
      { title: "Trash — BlogPilot AI" },
      { name: "description", content: "Restore deleted BlogPilot blogs during the 90-day recovery period." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrashPage,
});

function daysRemaining(purgeAfter: string | null) {
  if (!purgeAfter) return 90;
  return Math.max(0, Math.ceil((new Date(purgeAfter).getTime() - Date.now()) / 86_400_000));
}

function TrashPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDeletedBlogs);
  const restoreFn = useServerFn(restoreDeletedBlog);

  const deleted = useQuery({
    queryKey: ["deleted-blogs"],
    queryFn: () => listFn(),
  });

  const restore = useMutation({
    mutationFn: (blogId: string) => restoreFn({ data: { blogId } }),
    onSuccess: async () => {
      toast.success("Blog restored with its articles, Blogger connection and saved settings");
      await queryClient.invalidateQueries({ queryKey: ["deleted-blogs"] });
      await queryClient.invalidateQueries({ queryKey: ["blogs"] });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await queryClient.invalidateQueries({ queryKey: ["post-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["my-plan-usage"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-eyebrow">Recovery</p>
        <h1 className="mt-1 text-3xl font-bold">Deleted blogs</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Deleted blogs stay here for 90 days. Restore brings back the same blog record, all saved articles, AI image preferences, automation settings and Blogger connection — not an empty replacement.
        </p>
      </div>
      <Button variant="outline" asChild><Link to="/dashboard">Back to blogs</Link></Button>
    </div>

    {deleted.isLoading ? <p className="text-sm text-muted-foreground">Loading Trash…</p> : deleted.isError ? <div className="surface-panel p-6 text-sm text-destructive">Could not load deleted blogs.</div> : (deleted.data?.length ?? 0) === 0 ? <div className="surface-panel p-10 text-center"><Trash2 className="mx-auto size-7 text-muted-foreground" aria-hidden /><h2 className="mt-4 text-lg font-semibold">Trash is empty</h2><p className="mt-2 text-sm text-muted-foreground">Blogs you delete will remain recoverable here for 90 days.</p></div> : <div className="space-y-4">
      {deleted.data?.map((blog: any) => {
        const remaining = daysRemaining(blog.purge_after);
        return <article key={blog.id} className="surface-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{blog.name}</h2><Badge variant="secondary">Deleted</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">{blog.niche} · {blog.target_country} · {blog.language}</p>
              <p className="mt-3 text-sm">{blog.postCount} saved article{blog.postCount === 1 ? "" : "s"} · {blog.posts_per_week} posts/week · {blog.tone} tone</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4" aria-hidden /><span>{remaining} day{remaining === 1 ? "" : "s"} left before permanent deletion</span></div>
            </div>
            <Button onClick={() => restore.mutate(blog.id)} disabled={restore.isPending && restore.variables === blog.id}><ArchiveRestore aria-hidden />{restore.isPending && restore.variables === blog.id ? "Restoring…" : "Restore everything"}</Button>
          </div>
        </article>;
      })}
    </div>}
  </div>;
}
