import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — BlogPilot AI" },
    { name: "description", content: "Sign in or create your BlogPilot AI account to plan, write and schedule SEO blog content on autopilot." },
    { name: "robots", content: "noindex, nofollow, noarchive" },
    { property: "og:title", content: "Sign in — BlogPilot AI" },
    { property: "og:description", content: "Access your BlogPilot AI workspace and keep your blog publishing on schedule." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (search: Record<string, unknown>) => ({ next: typeof search["next"] === "string" ? (search["next"] as string) : undefined }), component: AuthPage,
});
function safePath(next: string | undefined) { if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard"; return next; }
function AuthPage() {
  const { next } = useSearch({ from: "/auth" }); const navigate = useNavigate(); const { session, loading } = useAuth(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && session) void navigate({ to: safePath(next) }); }, [loading, session, navigate, next]);
  async function signIn(event: React.FormEvent) { event.preventDefault(); setBusy(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); setBusy(false); if (error) { toast.error(error.message); return; } void navigate({ to: safePath(next) }); }
  async function signUp(event: React.FormEvent) { event.preventDefault(); setBusy(true); const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}${safePath(next)}` } }); setBusy(false); if (error) { toast.error(error.message); return; } toast.success("Account created. Check your inbox if confirmation is required."); }
  async function google() { const target = safePath(next); const returnTo = `${window.location.origin}/auth?next=${encodeURIComponent(target)}`; const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: returnTo }); if (result.error) { toast.error("Google sign-in failed. Please try again."); return; } if (result.redirected) return; void navigate({ to: target }); }
  return <main className="grid-backdrop flex min-h-screen items-center justify-center px-4 py-16"><div className="w-full max-w-md"><Link to="/" className="text-eyebrow mb-6 block text-center hover:text-primary">← BlogPilot AI</Link><div className="surface-panel p-6 sm:p-8"><h1 className="text-2xl font-bold">Your blog cockpit</h1><p className="mt-2 text-sm text-muted-foreground">Set up niches, plans and schedules. Free to start.</p><Button variant="outline" className="mt-6 w-full" onClick={google}>Continue with Google</Button><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div><Tabs defaultValue="signin"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="signin">Sign in</TabsTrigger><TabsTrigger value="signup">Create account</TabsTrigger></TabsList><TabsContent value="signin"><form className="mt-4 space-y-4" onSubmit={signIn}><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div><Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button></form></TabsContent><TabsContent value="signup"><form className="mt-4 space-y-4" onSubmit={signUp}><div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="email-up">Email</Label><Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="password-up">Password</Label><Input id="password-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div><Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create free account"}</Button></form></TabsContent></Tabs></div></div></main>;
}
