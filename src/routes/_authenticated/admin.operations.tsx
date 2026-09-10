import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Bot, ClipboardCopy, Database, Globe2, HardDrive, RefreshCw, Radio, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOperationsDashboard, retryAutopilotRun } from "@/lib/operations.functions";
import { probeAiActivityLogging } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/admin/operations")({ head: () => ({ meta: [{ title: "Operations — BlogPilot AI Admin" }] }), component: OperationsPage });
function StatusBadge({ value }: { value: string }) { return <Badge variant={value === "operational" ? "default" : "secondary"}>{value === "operational" ? "Operational" : "Attention"}</Badge>; }

function buildDiagnosticReport(data: any) {
  const diagnostics = (data.diagnostics ?? []).slice(0, 80);
  const activities = (data.activities ?? []).slice(0, 80);
  const runs = (data.runs ?? []).slice(0, 40);
  const lines = [
    "BLOGPILOT AI — WEBSITE DIAGNOSTIC REPORT",
    `Generated: ${new Date().toISOString()}`,
    `Website health: ${data.health.website}`,
    `Recent website issues: ${data.metrics.recentWebsiteIssues}`,
    `Activity events included: ${activities.length}`,
    `Autopilot runs included: ${runs.length}`,
    "",
    "=== SYSTEM HEALTH ===",
    JSON.stringify(data.health),
    "",
    "=== METRICS ===",
    JSON.stringify(data.metrics),
    "",
    "=== ACTIVITY LOG ===",
  ];

  if (activities.length === 0) lines.push("No activity events recorded.", "");
  for (const item of activities) {
    lines.push(`[${item.created_at}] ${String(item.status ?? "info").toUpperCase()} ${item.event_type}`);
    if (item.message) lines.push(`Message: ${item.message}`);
    if (item.entity_type) lines.push(`Entity: ${item.entity_type}${item.entity_id ? `:${item.entity_id}` : ""}`);
    if (item.user_id) lines.push(`User ID: ${item.user_id}`);
    if (item.actor_user_id) lines.push(`Actor ID: ${item.actor_user_id}`);
    if (item.metadata && Object.keys(item.metadata).length) lines.push(`Metadata: ${JSON.stringify(item.metadata)}`);
    lines.push("");
  }

  lines.push("=== AUTOPILOT RUN HISTORY ===");
  if (runs.length === 0) lines.push("No Autopilot runs recorded.", "");
  for (const run of runs) {
    lines.push(`[${run.created_at}] ${String(run.status).toUpperCase()} ${run.trigger_source} — ${run.blogName ?? "Unknown blog"}`);
    if (run.detail) lines.push(`Detail: ${run.detail}`);
    if (run.blog_id) lines.push(`Blog ID: ${run.blog_id}`);
    if (run.post_id) lines.push(`Post ID: ${run.post_id}`);
    if (run.published_url) lines.push(`Published URL: ${run.published_url}`);
    lines.push("");
  }

  lines.push("=== WEBSITE DIAGNOSTICS ===");
  if (diagnostics.length === 0) lines.push("No website diagnostic events recorded.", "");
  for (const item of diagnostics) {
    lines.push(`[${item.created_at}] ${String(item.severity).toUpperCase()} ${item.event_type}`);
    lines.push(`Route: ${item.route_path || "unknown"}`);
    if (item.element) lines.push(`Element: ${item.element}`);
    if (item.message) lines.push(`Message: ${item.message}`);
    if (item.stack) lines.push(`Stack: ${item.stack}`);
    if (item.metadata && Object.keys(item.metadata).length) lines.push(`Metadata: ${JSON.stringify(item.metadata)}`);
    lines.push("");
  }
  return lines.join("\n");
}

function OperationsPage() {
  const getOps = useServerFn(getOperationsDashboard); const retryFn = useServerFn(retryAutopilotRun); const probeAiFn = useServerFn(probeAiActivityLogging);
  const query = useQuery({ queryKey: ["admin-operations"], queryFn: () => getOps(), refetchInterval: 60000 }); const data = query.data;
  const retry = useMutation({ mutationFn: (runId: string) => retryFn({ data: { runId, origin: window.location.origin } }), onSuccess: (outcome) => { toast.success(`Retry finished: ${outcome.status}`); void query.refetch(); }, onError: (e: Error) => toast.error(e.message) });
  const probeAi = useMutation({ mutationFn: () => probeAiFn(), onSuccess: async (outcome) => { toast.success(`AI logging probe passed (${outcome.version})`); await query.refetch(); }, onError: (e: Error) => toast.error(e.message) });
  const copyReport = async () => { if (!data) return; await navigator.clipboard.writeText(buildDiagnosticReport(data)); toast.success("Diagnostic report copied"); };
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading operations…</p>;
  if (query.error) return <div className="surface-panel p-6"><h1 className="text-xl font-semibold">Operations unavailable</h1><p className="mt-2 text-sm text-destructive">{(query.error as Error).message}</p></div>; if (!data) return null;
  const health = [["Database", data.health.database, Database], ["Image storage", data.health.storage, HardDrive], ["Blogger", data.health.blogger, Radio], ["Autopilot", data.health.autopilot, Bot], ["Website", data.health.website, Globe2]] as const;
  return <div className="space-y-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-eyebrow">Admin operations</p><h1 className="mt-1 text-3xl font-bold">System health & diagnostics</h1><p className="mt-2 text-sm text-muted-foreground">See failures, dead clicks, page/network errors and automation history in one place.</p></div><div className="flex flex-wrap gap-2"><Button data-diagnostic-ignore="true" variant="outline" onClick={copyReport}><ClipboardCopy aria-hidden />Copy full report</Button><Button data-diagnostic-ignore="true" variant="outline" onClick={() => probeAi.mutate()} disabled={probeAi.isPending}><Bot aria-hidden />{probeAi.isPending?"Testing AI log…":"Test AI log"}</Button><Button variant="secondary" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} aria-hidden />Refresh</Button></div></div>
  {!data.observabilityReady ? <div className="surface-panel border-amber-500/30 p-4 text-sm">Operations migration is not applied to this database yet. Health checks still work; activity and run history will start filling after the migration is applied.</div> : null}
  {!data.diagnosticsReady ? <div className="surface-panel border-amber-500/30 p-4 text-sm">Website diagnostics migration is not applied yet. Apply the latest database migration before expecting browser issue logs here.</div> : null}
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{health.map(([label,value,Icon]) => <div key={label} className="surface-panel p-5"><div className="flex items-center justify-between gap-3"><Icon className="size-5 text-primary" aria-hidden /><StatusBadge value={value} /></div><p className="mt-4 text-sm font-semibold">{label}</p></div>)}</div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Autopilot blogs" value={data.metrics.autopilotBlogs}/><Metric label="Blogger connections" value={data.metrics.bloggerConnections}/><Metric label="Expired connections" value={data.metrics.expiredConnections}/><Metric label="Recent run errors" value={data.metrics.recentAutopilotErrors}/><Metric label="Website issues" value={data.metrics.recentWebsiteIssues}/></div>

  <section className="space-y-3"><div className="flex items-center gap-2"><Activity className="size-5" aria-hidden/><h2 className="text-xl font-semibold">Activity log</h2></div>{data.activities.length===0?<div className="surface-panel p-6 text-sm text-muted-foreground">No activity recorded yet.</div>:<div className="space-y-2">{data.activities.slice(0,12).map((item:any)=><div key={item.id} className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{item.event_type}</p><p className="mt-1 text-xs text-muted-foreground">{item.message||item.entity_type||"System event"} · {new Date(item.created_at).toLocaleString()}</p></div><Badge variant={item.status==="failed"?"destructive":"outline"}>{item.status}</Badge></div>)}</div>}</section>

  <section className="space-y-3"><div className="flex items-center gap-2"><Bot className="size-5" aria-hidden/><h2 className="text-xl font-semibold">Autopilot run history</h2></div>{data.runs.length===0?<div className="surface-panel p-6 text-sm text-muted-foreground">No recorded Autopilot runs yet.</div>:<div className="space-y-2">{data.runs.slice(0,10).map((run:any)=><div key={run.id} className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium">{run.blogName}</p><p className="mt-1 text-xs text-muted-foreground">{run.detail||"No detail"} · {new Date(run.created_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{run.trigger_source}</Badge><Badge variant={run.status==="error"?"destructive":"secondary"}>{run.status}</Badge>{run.status==="error"?<Button size="sm" variant="outline" disabled={retry.isPending} onClick={()=>retry.mutate(run.id)}><RotateCcw className={retry.isPending?"size-4 animate-spin":"size-4"} aria-hidden/>Retry</Button>:null}</div></div>)}</div>}</section>

  <details className="surface-panel group overflow-hidden">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
      <div className="flex items-center gap-2"><Globe2 className="size-5" aria-hidden/><div><h2 className="text-xl font-semibold">Website diagnostics</h2><p className="mt-1 text-xs text-muted-foreground">{data.metrics.recentWebsiteIssues} recent issue{data.metrics.recentWebsiteIssues===1?"":"s"} · tap to expand</p></div></div>
      <Badge variant="outline">{data.diagnostics?.length ?? 0}</Badge>
    </summary>
    <div className="border-t border-border p-4">
      <p className="mb-3 text-xs text-muted-foreground">Captures signed-in browser errors, rejected promises, failed/slow requests, slow pages and suspected dead clicks.</p>
      {(data.diagnostics?.length ?? 0)===0?<div className="p-3 text-sm text-muted-foreground">No website diagnostic events recorded yet.</div>:<div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">{data.diagnostics.slice(0,50).map((item:any)=><div key={item.id} className="rounded-lg border border-border p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.event_type}</p><Badge variant={item.severity==="error"?"destructive":"outline"}>{item.severity}</Badge></div><p className="mt-1 break-words text-xs text-muted-foreground">{item.message||"No message"}</p><p className="mt-2 break-all text-xs text-muted-foreground">{item.route_path||item.page_url||"Unknown route"} · {new Date(item.created_at).toLocaleString()}</p>{item.element?<p className="mt-1 break-words text-xs">Element: {item.element}</p>:null}{item.stack?<details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Stack trace</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{item.stack}</pre></details>:null}</div></div>)}</div>}
    </div>
  </details>

  <div className="surface-panel flex items-start gap-3 p-5"><ShieldCheck className="mt-0.5 size-5 text-primary" aria-hidden/><div><p className="font-semibold">Diagnostic records are admin-only</p><p className="mt-1 text-sm text-muted-foreground">The copied report includes system health, activity events, Autopilot history and website diagnostics. It avoids passwords, OAuth tokens and page content.</p></div></div></div>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="surface-panel p-5"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;}
