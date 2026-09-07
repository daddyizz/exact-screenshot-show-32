import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdSlot } from "@/components/AdSlot";
import { adminOverview, setUserRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — BlogPilot AI" },
      {
        name: "description",
        content: "Manage BlogPilot AI users, roles and platform usage from the admin console.",
      },
      { property: "og:title", content: "Admin — BlogPilot AI" },
      { property: "og:description", content: "User management and platform usage overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const overviewFn = useServerFn(adminOverview);
  const setRoleFn = useServerFn(setUserRole);
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    retry: false,
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "moderator"; grant: boolean }) =>
      setRoleFn({ data: vars }),
    onSuccess: async () => {
      toast.success("Role updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (overview.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading admin console…</p>;
  }

  if (overview.isError) {
    return (
      <div className="surface-panel p-10 text-center">
        <ShieldCheck className="mx-auto size-6 text-primary" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          This area is limited to accounts with the admin role.
        </p>
      </div>
    );
  }

  const data = overview.data!;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-eyebrow">Admin</p>
        <h1 className="mt-1 text-3xl font-bold">Platform console</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Users" value={data.totals.users} />
        <Stat label="Blogs" value={data.totals.blogs} />
        <Stat label="Autopilot on" value={data.totals.autopilotBlogs} />
        <Stat label="Posts" value={data.totals.posts} />
        <Stat label="Published" value={data.totals.published} />
      </div>

      <AdSlot id="admin-top" format="leaderboard" />

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Blogs</th>
              <th className="px-4 py-3 font-medium">Posts</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {u.blogs}
                  {u.autopilotBlogs > 0 ? (
                    <span className="text-xs text-muted-foreground"> ({u.autopilotBlogs} auto)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {u.posts}
                  <span className="text-xs text-muted-foreground"> ({u.published} live)</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 ? (
                      <Badge variant="secondary">user</Badge>
                    ) : (
                      u.roles.map((r) => <Badge key={r}>{r}</Badge>)
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={roleMutation.isPending}
                      onClick={() =>
                        roleMutation.mutate({
                          userId: u.id,
                          role: "admin",
                          grant: !u.roles.includes("admin"),
                        })
                      }
                    >
                      {u.roles.includes("admin") ? "Remove admin" : "Make admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={roleMutation.isPending}
                      onClick={() =>
                        roleMutation.mutate({
                          userId: u.id,
                          role: "moderator",
                          grant: !u.roles.includes("moderator"),
                        })
                      }
                    >
                      {u.roles.includes("moderator") ? "Remove moderator" : "Make moderator"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-panel p-5">
      <p className="text-eyebrow">{label}</p>
      <p className="font-display mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
