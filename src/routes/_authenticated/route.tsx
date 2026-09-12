import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, FileText, LayoutDashboard, Link2, LogOut, Megaphone, Notebook, SearchCheck, Settings, Shield, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/NotificationCenter";
import { DiagnosticReporter } from "@/components/DiagnosticReporter";
import { amIAdmin } from "@/lib/admin.functions";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }] }),
  component: AuthenticatedLayout,
});
const nav = [{ to: "/dashboard", label: "Overview", icon: LayoutDashboard }, { to: "/queue", label: "Content queue", icon: Notebook }, { to: "/articles", label: "Articles", icon: FileText }, { to: "/settings", label: "Settings", icon: Settings }, { to: "/trash", label: "Trash", icon: Trash2 }] as const;

function AuthenticatedLayout() {
  const { session, loading, user } = useAuth(); const navigate = useNavigate(); const pathname = useRouterState({ select: (s) => s.location.pathname }); const intended = useRef<string | null>(null);
  useEffect(() => { if (!loading && !session) { if (!intended.current) intended.current = pathname.startsWith("/auth") ? "/dashboard" : pathname; void navigate({ to: "/auth", search: { next: intended.current } }); } }, [loading, session, navigate, pathname]);
  const amIAdminFn = useServerFn(amIAdmin); const admin = useQuery({ queryKey: ["am-i-admin"], queryFn: () => amIAdminFn(), enabled: Boolean(session) });
  if (loading || !session) return <div className="flex min-h-screen items-center justify-center"><p className="text-eyebrow">Loading workspace…</p></div>;
  const adminNav = admin.data?.isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }, { to: "/admin/search-console", label: "Search Console", icon: SearchCheck }, { to: "/admin/backlinks", label: "Backlinks", icon: Link2 }, { to: "/admin/ads", label: "Ads", icon: Megaphone }, { to: "/admin/operations", label: "Operations", icon: Activity }] : [];
  const avatarUrl = (user?.user_metadata?.['avatar_url'] ?? user?.user_metadata?.['picture'] ?? null) as string | null;
  const profileName = (user?.user_metadata?.['full_name'] ?? user?.user_metadata?.['name'] ?? user?.email ?? "User") as string;
  return <div className="min-h-screen"><DiagnosticReporter /><header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3"><Link to="/dashboard" className="font-display text-sm font-bold tracking-tight">BlogPilot<span className="text-primary">.</span>AI</Link><nav className="flex flex-1 items-center gap-1 overflow-x-auto">{[...nav, ...adminNav].map((item) => { const active = pathname === item.to; return <Link key={item.to} to={item.to as any} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><item.icon className="size-4" aria-hidden /><span className="hidden sm:inline">{item.label}</span></Link>; })}</nav><div className="hidden items-center gap-2 md:flex">{avatarUrl ? <img src={avatarUrl} alt={profileName} className="size-7 rounded-full border border-border object-cover" referrerPolicy="no-referrer" /> : <div className="flex size-7 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold">{profileName.charAt(0).toUpperCase()}</div>}<span className="max-w-36 truncate text-xs text-muted-foreground">{profileName}</span></div><NotificationCenter userId={user?.id} /><Button variant="ghost" size="icon" aria-label="Sign out" onClick={async () => { await supabase.auth.signOut(); void navigate({ to: "/" }); }}><LogOut aria-hidden /></Button></div></header><div className="mx-auto max-w-6xl px-4 py-8"><Outlet /></div></div>;
}
