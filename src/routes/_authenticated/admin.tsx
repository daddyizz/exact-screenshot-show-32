import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  Bot,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
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
  inviteUser,
  setUserRole,
  setUserSubscription,
  updateAdminUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — BlogPilot AI" },
      {
        name: "description",
        content: "Manage BlogPilot AI users, subscriptions, roles and platform usage.",
      },
    ],
  }),
  component: AdminPage,
});

type Filter = "all" | "free" | "pro" | "admin" | "suspended";

function AdminPage() {
  const overviewFn = useServerFn(adminOverview);
  const setRoleFn = useServerFn(setUserRole);
  const setSubscriptionFn = useServerFn(setUserSubscription);
  const updateUserFn = useServerFn(updateAdminUser);
  const inviteUserFn = useServerFn(inviteUser);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [invite, setInvite] = useState({ email: "", displayName: "", plan: "free", role: "user" });
  const [edit, setEdit] = useState({ displayName: "", plan: "free", status: "active" });

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] });

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
    mutationFn: (vars: { userId: string; plan: "free" | "pro"; status: "active" | "trialing" | "past_due" | "canceled" | "suspended" }) =>
      setSubscriptionFn({ data: vars }),
    onSuccess: async () => {
      toast.success("Subscription updated");
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

  if (overview.isLoading) return <p className="text-sm text-muted-foreground">Loading admin console…</p>;

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
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.users.filter((u) => {
      const matchesSearch = !needle || u.displayName.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle);
      const matchesFilter =
        filter === "all" ||
        (filter === "free" && u.plan === "free") ||
        (filter === "pro" && u.plan === "pro") ||
        (filter === "admin" && u.roles.includes("admin")) ||
        (filter === "suspended" && u.subscriptionStatus === "suspended");
      return matchesSearch && matchesFilter;
    });
  }, [data.users, search, filter]);

  const openEditor = (u: any) => {
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
          <p className="mt-2 text-sm text-muted-foreground">Users, billing, roles and usage in one place.</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button><Plus aria-hidden /> Add user</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a user</DialogTitle>
              <DialogDescription>Send an account invitation and choose the starting plan and role.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Display name</Label>
                <Input id="invite-name" value={invite.displayName} onChange={(e) => setInvite({ ...invite, displayName: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="jane@example.com" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={invite.plan} onValueChange={(v) => setInvite({ ...invite, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="moderator">Moderator</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !invite.email || !invite.displayName}>{inviteMutation.isPending ? "Sending…" : "Send invitation"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={UsersRound} label="Total users" value={data.totals.users} note={`${data.totals.proUsers} Pro · ${data.totals.freeUsers} Free`} />
        <Stat icon={BadgeDollarSign} label="Estimated MRR" value={`RM${data.totals.mrr}`} note="RM49 per active Pro user" />
        <Stat icon={Bot} label="Autopilot active" value={data.totals.autopilotBlogs} note={`${data.totals.blogs} total blogs`} />
        <Stat icon={Sparkles} label="AI this month" value={data.totals.aiDrafts + data.totals.aiImages} note={`${data.totals.aiDrafts} drafts · ${data.totals.aiImages} images`} />
      </div>

      <AdSlot id="admin-top" format="leaderboard" />

      <Tabs defaultValue="users" className="space-y-5">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="billing">Billing & usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <MiniPanel title="Content" icon={Activity} rows={[['Posts', data.totals.posts], ['Published', data.totals.published], ['Blogs', data.totals.blogs]]} />
            <MiniPanel title="Subscribers" icon={BadgeDollarSign} rows={[['Pro', data.totals.proUsers], ['Free', data.totals.freeUsers], ['MRR', `RM${data.totals.mrr}`]]} />
            <MiniPanel title="AI usage" icon={Sparkles} rows={[['Drafts', data.totals.aiDrafts], ['Images', data.totals.aiImages], ['Autopilot blogs', data.totals.autopilotBlogs]]} />
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "free", "pro", "admin", "suspended"] as Filter[]).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
              ))}
            </div>
          </div>

          <div className="surface-panel overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Blogs</th><th className="px-4 py-3 font-medium">Posts</th><th className="px-4 py-3 font-medium">Last login</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 text-right font-medium">Action</th></tr></thead>
                <tbody>{filteredUsers.map((u) => <UserRow key={u.id} user={u} onEdit={() => openEditor(u)} />)}</tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {filteredUsers.map((u) => (
                <div key={u.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-medium">{u.displayName}</p><p className="text-xs text-muted-foreground">{u.email || "No email"}</p></div>
                    <PlanBadge plan={u.plan} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground"><span>{u.blogs} blogs</span><span>{u.posts} posts</span><span>{u.usage.aiDrafts} AI</span></div>
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openEditor(u)}><Pencil aria-hidden /> Manage user</Button>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Showing {filteredUsers.length} of {data.users.length} users.</p>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <div className="surface-panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Provider</th><th className="px-4 py-3 font-medium">AI drafts</th><th className="px-4 py-3 font-medium">AI images</th><th className="px-4 py-3 font-medium">Autopilot runs</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
              <tbody>{data.users.map((u) => <tr key={u.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="font-medium">{u.displayName}</p><p className="text-xs text-muted-foreground">{u.email}</p></td><td className="px-4 py-3"><PlanBadge plan={u.plan} /></td><td className="px-4 py-3 capitalize">{u.billingProvider}</td><td className="px-4 py-3">{u.usage.aiDrafts}{u.plan === 'free' ? ' / 5' : ''}</td><td className="px-4 py-3">{u.usage.aiImages}</td><td className="px-4 py-3">{u.usage.autopilotRuns}</td><td className="px-4 py-3"><StatusBadge status={u.subscriptionStatus} /></td></tr>)}</tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage user</DialogTitle><DialogDescription>Edit account profile, subscription and platform permissions.</DialogDescription></DialogHeader>
          {editUser ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="font-medium">{editUser.email || editUser.displayName}</p><p className="mt-1 text-xs text-muted-foreground">Joined {new Date(editUser.createdAt).toLocaleDateString()} · {editUser.blogs} blogs · {editUser.posts} posts</p></div>
              <div className="space-y-2"><Label>Display name</Label><Input value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Plan</Label><Select value={edit.plan} onValueChange={(v) => setEdit({ ...edit, plan: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Status</Label><Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="trialing">Trialing</SelectItem><SelectItem value="past_due">Past due</SelectItem><SelectItem value="canceled">Canceled</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>Roles</Label><div className="flex flex-wrap gap-2"><Button size="sm" variant={editUser.roles.includes('admin') ? 'default' : 'outline'} disabled={roleMutation.isPending} onClick={() => roleMutation.mutate({ userId: editUser.id, role: 'admin', grant: !editUser.roles.includes('admin') })}>Admin</Button><Button size="sm" variant={editUser.roles.includes('moderator') ? 'default' : 'outline'} disabled={roleMutation.isPending} onClick={() => roleMutation.mutate({ userId: editUser.id, role: 'moderator', grant: !editUser.roles.includes('moderator') })}>Moderator</Button></div></div>
            </div>
          ) : null}
          <DialogFooter><Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button><Button onClick={saveEditor} disabled={subscriptionMutation.isPending || profileMutation.isPending}>{subscriptionMutation.isPending || profileMutation.isPending ? 'Saving…' : 'Save changes'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserRow({ user, onEdit }: { user: any; onEdit: () => void }) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" aria-hidden /></div><div><p className="font-medium">{user.displayName}</p><p className="text-xs text-muted-foreground">{user.email || 'No email'}</p></div></div></td>
      <td className="px-4 py-3"><PlanBadge plan={user.plan} /></td>
      <td className="px-4 py-3"><StatusBadge status={user.subscriptionStatus} /></td>
      <td className="px-4 py-3">{user.blogs}{user.autopilotBlogs ? <span className="text-xs text-muted-foreground"> ({user.autopilotBlogs} auto)</span> : null}</td>
      <td className="px-4 py-3">{user.posts}<span className="text-xs text-muted-foreground"> ({user.published} live)</span></td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : 'Never'}</td>
      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{user.roles.length ? user.roles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>) : <Badge variant="outline">user</Badge>}</div></td>
      <td className="px-4 py-3 text-right"><Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Manage ${user.displayName}`}><MoreHorizontal aria-hidden /></Button></td>
    </tr>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return <Badge variant={plan === "pro" ? "default" : "secondary"}>{plan === "pro" ? "PRO" : "FREE"}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" || status === "trialing" ? "outline" : "secondary";
  return <Badge variant={variant} className="capitalize">{status.replace('_', ' ')}</Badge>;
}

function Stat({ icon: Icon, label, value, note }: { icon: any; label: string; value: string | number; note: string }) {
  return <div className="surface-panel p-5"><div className="flex items-center justify-between"><p className="text-eyebrow">{label}</p><Icon className="size-4 text-primary" aria-hidden /></div><p className="font-display mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function MiniPanel({ title, icon: Icon, rows }: { title: string; icon: any; rows: Array<[string, string | number]> }) {
  return <div className="surface-panel p-5"><div className="flex items-center gap-2"><Icon className="size-4 text-primary" aria-hidden /><h2 className="font-display font-semibold">{title}</h2></div><div className="mt-4 space-y-3">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0"><span className="text-sm text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>)}</div></div>;
}
