import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, FileText, LayoutDashboard, LogOut, Megaphone, Notebook, Settings, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/AdSlot";
import { NotificationCenter } from "@/components/NotificationCenter";
import { amIAdmin } from "@/lib/admin.functions";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }] }),
  component: AuthenticatedLayout,
});
const nav = [{ to: "/dashboard", label: "Overview", icon: LayoutDashboard }, { to: "/queue", label: "Content queue", icon: Notebook }, { to: "/articles", label: "Articles", icon: FileText }, { to: "/settings", label: "Settings", icon: Settings }] as const;

function AuthenticatedLayout() {
  const { session, loading, user } = useAuth(); const navigate = useNavigate(); const pathname = useRouterState({ select: (s) => s.location.pathname }); const intended = useRef<string | null>(null);
  useEffect(() => { if (!loading && !session) { if (!intended.current) intended.current = pathname.startsWith("/auth") ? "/dashboard" : pathname; void navigate({ to: "/auth", search: { next: intended.current } }); } }, [loading, session, navigate, pathname]);
  const amIAdminFn = useServerFn(amIAdmin); const admin = useQuery({ queryKey: ["am-i-admin"], queryFn: () => amIAdminFn(), enabled: Boolean(session) });
  if (loading || !session) return <div className="flex min-h-screen items-center justify-center"><p className="text-eyebrow">Loading workspace…</p></div>;
  const adminNav = admin.data?.isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }, { to: "/admin/ads", label: "Ads", icon: Megaphone }, { to: "/admin/operations", label: "Operations", icon: Activity }] : [];
  return <div className="min-h-screen"><header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3"><Link to="/dashboard" className="font-display text-sm font-bold tracking-tight">BlogPilot<span className="text-primary">.</span>AI</Link><nav className="flex flex-1 items-center gap-1 overflow-x-auto">{[...nav, ...adminNav].map((item) => { const active = pathname === item.to; return <Link key={item.to} to={item.to as any} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><item.icon className="size-4" aria-hidden /><span className="hidden sm:inline">{item.label}</span></Link>; })}</nav><span className="hidden text-xs text-muted-foreground md:inline">{user?.email}</span><NotificationCenter userId={user?.id} /><Button variant="ghost" size="icon" aria-label="Sign out" onClick={async () => { await supabase.auth.signOut(); void navigate({ to: "/" }); }}><LogOut aria-hidden /></Button></div></header><div className="mx-auto max-w-6xl px-4 py-8"><AdSlot id="app-top" format="leaderboard" className="mb-6" /><Outlet /></div></div>;
}
