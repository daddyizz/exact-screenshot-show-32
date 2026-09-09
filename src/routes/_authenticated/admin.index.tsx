import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Bot,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdSlot } from "@/components/AdSlot";
import {
  adminOverview,
  amIAdmin,
  deleteUserAccount,
  inviteUser,
  setUserRole,
  setUserSubscription,
  updateAdminUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — BlogPilot AI" }] }),
  component: AdminPage,
});

type Filter = "all" | "free" | "pro" | "admin" | "suspended";

type AdminUser = {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
  plan: "free" | "pro";
  subscriptionStatus: string;
  billingProvider: string;
  blogs: number;
  posts: number;
  usage: { aiDrafts: number; aiImages: number; autopilotRuns: number };
};

function AdminPage() {
  const overviewFn = useServerFn(adminOverview);
  const adminCheckFn = useServerFn(amIAdmin);
  const setRoleFn = useServerFn(setUserRole);
  const setSubscriptionFn = useServerFn(setUserSubscription);
  const updateUserFn = useServerFn(updateAdminUser);
  const inviteUserFn = useServerFn(inviteUser);
  const deleteUserFn = useServerFn(deleteUserAccount);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [invite, setInvite] = useState({ email: "", displayName: "", plan: "free", role: "user" });
  const [edit, setEdit] = useState({ displayName: "", plan: "free", status: "active" });

  const adminCheck = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => adminCheckFn(),
    retry: false,
    staleTime: 0,
  });

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    retry: false,
    enabled: adminCheck.data?.isAdmin === true,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["am-i-admin"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "moderator"; grant: boolean }) =>
      setRoleFn({ data: vars }),
    onSuccess: async () => {
      toast.success("Role updated");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const subscriptionMutation = useMutation({
    mutationFn: (vars: {
      userId: string;
      plan: "free" | "pro";
      status: "active" | "trialing" | "past_due" | "canceled" | "suspended";
    }) => setSubscriptionFn({ data: vars }),
    onSuccess: async () => {
      toast.success("Plan and status updated");
      setEditUser(null);
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const profileMutation = useMutation({
    mutationFn: (vars: { userId: string; displayName: string }) => updateUserFn({ data: vars }),
    onError: (error: Error) => toast.error(error.message),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteUserFn({
        data: {
          email: invite.email,
          displayName: invite.displayName,
          plan: invite.plan as "free" | "pro",
          role: invite.role as "user" | "moderator" | "admin",
        },
      }),
    onSuccess: async () => {
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInvite({ email: "", displayName: "", plan: "free", role: "user" });
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUserFn({ data: { userId } }),
    onSuccess: async () => {
      toast.success("User deleted");
      setEditUser(null);
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const users = (overview.data?.users ?? []) as AdminUser[];
  const needle = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !needle ||
      u.displayName.toLowerCase().includes(needle) ||
      (u.email ?? "").toLowerCase().includes(needle);
    const matchesFilter =
      filter === "all" ||
      (filter === "free" && u.plan === "free") ||
      (filter === "pro" && u.plan === "pro") ||
      (filter === "admin" && u.roles.includes("admin")) ||
      (filter === "suspended" && u.subscriptionStatus === "suspended");
    return matchesSearch && matchesFilter;
  });

  if (adminCheck.isLoading) return <p className="text-sm text-muted-foreground">Checking admin access…</p>;
  if (adminCheck.isError) return <ErrorPanel title="Could not verify admin access" message={(adminCheck.error as Error).message} onRetry={() => void adminCheck.refetch()} />;
  if (!adminCheck.data?.isAdmin) {
    return (
      <div className="surface-panel p-10 text-center">
        <ShieldCheck className="mx-auto size-6 text-primary" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">This signed-in account does not currently have the admin role.</p>
      </div>
    );
  }
  if (overview.isLoading) return <p className="text-sm text-muted-foreground">Loading admin console…</p>;
  if (overview.isError) return <ErrorPanel title="Admin access confirmed, but the console failed to load" message={(overview.error as Error).message} onRetry={() => void overview.refetch()} />;

  const data = overview.data! as any;

  const openEditor = (u: AdminUser) => {
    setEditUser(u);
    setEdit({ displayName: u.displayName, plan: u.plan, status: u.subscriptionStatus });
  };

  const saveEditor = async () => {
    if (!editUser) return;
    if (edit.displayName.trim() !== editUser.displayName) {
      await profileMutation.mutateAsync({ userId: editUser.id, displayName: edit.displayName.trim() });
    }
    subscriptionMutation.mutate({
      userId: editUser.id,
      plan: edit.plan as "free" | "pro",
      status: edit.status as "active" | "trialing" | "past_due" | "canceled" | "suspended",
    });
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Admin console</p>
          <h1 className="mt-1 text-3xl font-bold">Platform control center</h1>
          <p className="mt-2 text-sm text-muted-foreground">Users, plans, roles and usage in one place.</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild><Button><Plus aria-hidden /> Add user</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite a user</DialogTitle><DialogDescription>Send an invitation and choose the starting plan and role.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2"><Label>Display name</Label><Input value={invite.displayName} onChange={(e) => setInvite({ ...invite, displayName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Plan</Label><Select value={invite.plan} onValueChange={(v) => setInvite({ ...invite, plan: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Role</Label><Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="moderator">Moderator</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !invite.email || !invite.displayName}>{inviteMutation.isPending ? "Sending…" : "Send invitation"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {data.legacyMode ? <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Compatibility mode is active. Manual plans are stored safely in account metadata until the billing migration is available on this database.</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={UsersRound} label="Total users" value={data.totals.users} note={`${data.totals.proUsers} Pro · ${data.totals.freeUsers} Free`} />
        <Stat icon={BadgeDollarSign} label="Estimated MRR" value={`RM${data.totals.mrr}`} note="Manual estimate; Stripe not connected" />
        <Stat icon={Bot} label="Autopilot active" value={data.totals.autopilotBlogs} note={`${data.totals.blogs} total blogs`} />
        <Stat icon={Sparkles} label="AI this month" value={data.totals.aiDrafts + data.totals.aiImages} note={`${data.totals.aiDrafts} drafts · ${data.totals.aiImages} images`} />
      </div>

      <AdSlot id="admin-top" format="leaderboard" />

      <Tabs defaultValue="users" className="space-y-5">
        <TabsList className="h-auto flex-wrap"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="users">Users</TabsTrigger><TabsTrigger value="billing">Plans & usage</TabsTrigger></TabsList>
        <TabsContent value="overview"><div className="grid gap-4 lg:grid-cols-3"><MiniPanel title="Content" rows={[["Posts", data.totals.posts], ["Published", data.totals.published], ["Blogs", data.totals.blogs]]} /><MiniPanel title="Subscribers" rows={[["Pro", data.totals.proUsers], ["Free", data.totals.freeUsers], ["MRR estimate", `RM${data.totals.mrr}`]]} /><MiniPanel title="AI usage" rows={[["Drafts", data.totals.aiDrafts], ["Images", data.totals.aiImages], ["Autopilot blogs", data.totals.autopilotBlogs]]} /></div></TabsContent>
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="relative w-full md:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-9" /></div><div className="flex flex-wrap gap-2">{(["all", "free", "pro", "admin", "suspended"] as Filter[]).map((f) => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>)}</div></div>
          <div className="surface-panel divide-y divide-border">{filteredUsers.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No users match this filter.</p> : filteredUsers.map((u) => <div key={u.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-medium">{u.displayName}</p><p className="truncate text-xs text-muted-foreground">{u.email || "No email"}</p></div><PlanBadge plan={u.plan} /><Badge variant="secondary">{u.subscriptionStatus}</Badge>{u.roles.includes("admin") ? <Badge variant="outline">ADMIN</Badge> : null}{u.roles.includes("moderator") ? <Badge variant="outline">MODERATOR</Badge> : null}<span className="text-xs text-muted-foreground">{u.blogs} blogs · {u.posts} posts</span><Button size="sm" variant="outline" onClick={() => openEditor(u)}><Pencil aria-hidden /> Manage</Button></div>)}</div>
        </TabsContent>
        <TabsContent value="billing"><div className="surface-panel divide-y divide-border">{users.map((u) => <div key={u.id} className="grid gap-2 p-4 sm:grid-cols-6 sm:items-center"><div className="sm:col-span-2"><p className="font-medium">{u.displayName}</p><p className="text-xs text-muted-foreground">{u.email}</p></div><PlanBadge plan={u.plan} /><span className="text-sm capitalize">{u.billingProvider}</span><span className="text-sm">{u.usage.aiDrafts}{u.plan === "free" ? " / 5 drafts" : " drafts"}</span><span className="text-sm capitalize">{u.subscriptionStatus}</span></div>)}</div></TabsContent>
      </Tabs>

      <Dialog open={Boolean(editUser)} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage user</DialogTitle><DialogDescription>{editUser?.email}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Display name</Label><Input value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Plan</Label><Select value={edit.plan} onValueChange={(v) => setEdit({ ...edit, plan: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="trialing">Trialing</SelectItem><SelectItem value="past_due">Past due</SelectItem><SelectItem value="canceled">Canceled</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div>
            </div>
            {editUser && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => roleMutation.mutate({ userId: editUser.id, role: "admin", grant: !editUser.roles.includes("admin") })}>{editUser.roles.includes("admin") ? "Remove admin" : "Make admin"}</Button><Button type="button" variant="outline" onClick={() => roleMutation.mutate({ userId: editUser.id, role: "moderator", grant: !editUser.roles.includes("moderator") })}>{editUser.roles.includes("moderator") ? "Remove moderator" : "Make moderator"}</Button></div>}
            {editUser ? <div className="rounded-lg border border-destructive/30 p-4"><p className="text-sm font-medium">Danger zone</p><p className="mt-1 text-xs text-muted-foreground">Deleting a user removes the authentication account and any data linked by cascade rules. Your own admin account cannot be deleted here.</p><Button type="button" variant="destructive" className="mt-3" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Delete ${editUser.email || editUser.displayName}? This cannot be undone.`)) deleteMutation.mutate(editUser.id); }}><Trash2 aria-hidden /> {deleteMutation.isPending ? "Deleting…" : "Delete user"}</Button></div> : null}
          </div>
          <DialogFooter><Button onClick={() => void saveEditor()} disabled={!edit.displayName.trim() || subscriptionMutation.isPending || profileMutation.isPending}>{subscriptionMutation.isPending || profileMutation.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <div className="surface-panel p-8"><ShieldCheck className="size-6 text-primary" aria-hidden /><h1 className="mt-4 text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><Button className="mt-5" variant="outline" onClick={onRetry}>Retry</Button></div>;
}

function Stat({ icon: Icon, label, value, note }: { icon: any; label: string; value: string | number; note: string }) {
  return <div className="surface-panel p-5"><Icon className="size-5 text-primary" aria-hidden /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function PlanBadge({ plan }: { plan: string }) {
  return <Badge variant={plan === "pro" ? "default" : "secondary"}>{plan === "pro" ? "PRO" : "FREE"}</Badge>;
}

function MiniPanel({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return <div className="surface-panel p-5"><h3 className="font-semibold">{title}</h3><div className="mt-4 space-y-3">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>)}</div></div>;
}
