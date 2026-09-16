import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, CopyPlus, Download, Power, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cloneAffiliateLink, duplicateAffiliateCampaign, listAffiliateCampaignSummary, resetAffiliateLinkClicks, setAffiliateCampaignEnabled } from "@/lib/affiliate.campaign.functions";
import { listAffiliateAdmin } from "@/lib/affiliate.functions";

export const Route = createFileRoute("/_authenticated/admin/affiliate-campaigns")({
  head: () => ({ meta: [{ title: "Affiliate Campaigns — BlogPilot AI" }] }),
  component: AffiliateCampaignsPage,
});

type Campaign = { name: string; links: number; enabled: number; clicks: number; capped: number; platforms: string[]; startsAt: string | null; expiresAt: string | null };
type AffiliateLink = { id: string; name: string; campaign_name: string | null; platform: string; enabled: boolean; click_count: number; max_clicks: number | null; short_code: string };

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(rows: any[]) {
  const header = ["name","destination_url","platform","link_type","category","keywords","cta_text","priority","campaign_name","starts_at","expires_at","max_clicks","enabled","click_count","last_clicked_at","short_code"];
  const csv = [header.join(","), ...rows.map((row) => header.map((key) => csvCell(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blogpilot-affiliate-report-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AffiliateCampaignsPage() {
  const qc = useQueryClient();
  const summaryFn = useServerFn(listAffiliateCampaignSummary);
  const listFn = useServerFn(listAffiliateAdmin);
  const toggleFn = useServerFn(setAffiliateCampaignEnabled);
  const duplicateFn = useServerFn(duplicateAffiliateCampaign);
  const resetClicksFn = useServerFn(resetAffiliateLinkClicks);
  const cloneLinkFn = useServerFn(cloneAffiliateLink);
  const [source, setSource] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const summary = useQuery({ queryKey: ["affiliate-campaign-summary"], queryFn: () => summaryFn(), retry: false });
  const all = useQuery({ queryKey: ["affiliate-admin-export"], queryFn: () => listFn(), retry: false });
  const campaigns = (summary.data ?? []) as Campaign[];
  const links = (all.data?.links ?? []) as AffiliateLink[];
  const totalClicks = useMemo(() => campaigns.reduce((sum, c) => sum + Number(c.clicks || 0), 0), [campaigns]);

  const toggle = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) => toggleFn({ data: { campaignName: name, enabled } }),
    onSuccess: async (r, v) => { toast.success(`${v.enabled ? "Enabled" : "Disabled"} ${r.affected} links`); await qc.invalidateQueries({ queryKey: ["affiliate-campaign-summary"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin-export"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: () => duplicateFn({ data: { sourceCampaign: source!, newCampaign: newName } }),
    onSuccess: async (r) => { toast.success(`Copied ${r.copied} links into new disabled campaign`); setSource(null); setNewName(""); await qc.invalidateQueries({ queryKey: ["affiliate-campaign-summary"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin-export"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetClicks = useMutation({
    mutationFn: (id: string) => resetClicksFn({ data: { id } }),
    onSuccess: async (r) => { toast.success(`Click counter reset from ${r.previousClicks} to 0`); await qc.invalidateQueries({ queryKey: ["affiliate-campaign-summary"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin-export"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloneLink = useMutation({
    mutationFn: (id: string) => cloneLinkFn({ data: { id } }),
    onSuccess: async (r) => { toast.success(`Cloned as ${r.name}; copy starts disabled`); await qc.invalidateQueries({ queryKey: ["affiliate-campaign-summary"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin-export"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-eyebrow">Admin · Affiliate</p><h1 className="font-display mt-1 text-2xl font-bold tracking-tight">Campaign controls</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pause or resume an entire campaign, duplicate it safely, export inventory, reset test counters and clone individual links.</p></div><Button variant="outline" disabled={!all.data?.links?.length} onClick={() => downloadCsv(all.data?.links ?? [])}><Download aria-hidden />Export CSV</Button></header>

    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Campaigns" value={campaigns.length} /><Stat label="Total clicks" value={totalClicks} /><Stat label="Links" value={campaigns.reduce((sum,c)=>sum+c.links,0)} /></div>

    {summary.isLoading ? <div className="surface-panel p-6 text-sm text-muted-foreground">Loading campaigns…</div> : null}
    {summary.isError ? <div className="surface-panel p-6 text-sm text-destructive">{(summary.error as Error).message}</div> : null}
    {!summary.isLoading && !summary.isError ? <div className="surface-panel divide-y divide-border">{campaigns.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No named campaigns yet. Add a Campaign name to affiliate links first.</div> : campaigns.map((c) => { const fullyEnabled = c.enabled === c.links && c.links > 0; return <div key={c.name} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{c.name}</p><Badge variant={fullyEnabled ? "default" : "secondary"}>{fullyEnabled ? "Enabled" : c.enabled > 0 ? "Partly enabled" : "Disabled"}</Badge>{c.platforms.map((p) => <Badge variant="outline" key={p}>{p}</Badge>)}</div><p className="mt-2 text-xs text-muted-foreground">{c.links} links · {c.enabled} enabled · {c.clicks} clicks · {c.capped} capped</p>{c.startsAt || c.expiresAt ? <p className="mt-1 text-xs text-muted-foreground">Window: {c.startsAt ? new Date(c.startsAt).toLocaleString() : "Any time"} → {c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "No expiry"}</p> : null}</div><Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate({ name: c.name, enabled: !fullyEnabled })}><Power aria-hidden />{fullyEnabled ? "Kill campaign" : "Enable campaign"}</Button><Button size="sm" variant="outline" onClick={() => { setSource(c.name); setNewName(`${c.name} Copy`); }}><Copy aria-hidden />Duplicate</Button></div>; })}</div> : null}

    <section className="surface-panel space-y-4 p-5">
      <div><h2 className="font-display text-lg font-semibold">Link maintenance</h2><p className="text-sm text-muted-foreground">Useful before launch testing: clone one link as a disabled copy or reset its tracked click counter back to zero.</p></div>
      {all.isLoading ? <p className="text-sm text-muted-foreground">Loading links…</p> : null}
      {all.isError ? <p className="text-sm text-destructive">{(all.error as Error).message}</p> : null}
      {!all.isLoading && !all.isError ? <div className="divide-y divide-border rounded-lg border border-border">{links.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No affiliate links yet.</p> : links.map((link) => <div key={link.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{link.name}</p><Badge variant={link.enabled ? "default" : "secondary"}>{link.enabled ? "Enabled" : "Disabled"}</Badge><Badge variant="outline">{link.platform}</Badge>{link.campaign_name ? <Badge variant="outline">{link.campaign_name}</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">Clicks: {Number(link.click_count || 0)}{link.max_clicks ? ` / ${link.max_clicks}` : ""} · Redirect: /go/{link.short_code}</p></div><Button size="sm" variant="outline" disabled={cloneLink.isPending} onClick={() => cloneLink.mutate(link.id)}><CopyPlus aria-hidden />Clone link</Button><Button size="sm" variant="outline" disabled={resetClicks.isPending || Number(link.click_count || 0) === 0} onClick={() => { if (window.confirm(`Reset click counter for ${link.name} to 0?`)) resetClicks.mutate(link.id); }}><RotateCcw aria-hidden />Reset clicks</Button></div>)}</div> : null}
    </section>

    <section className="surface-panel p-5"><h2 className="font-display text-lg font-semibold">Safe-copy behavior</h2><p className="mt-1 text-sm text-muted-foreground">Campaign duplicates and individual link clones start disabled with zero clicks and no schedule. They cannot begin redirecting traffic until an admin explicitly enables them.</p></section>

    <Dialog open={Boolean(source)} onOpenChange={(v) => { if (!v) { setSource(null); setNewName(""); } }}><DialogContent><DialogHeader><DialogTitle>Duplicate campaign</DialogTitle><DialogDescription>Copy {source} into a new disabled campaign.</DialogDescription></DialogHeader><div className="space-y-2"><Label>New campaign name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus /></div><DialogFooter><Button disabled={!newName.trim() || duplicate.isPending} onClick={() => duplicate.mutate()}>{duplicate.isPending ? "Copying…" : "Duplicate campaign"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="surface-panel p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="font-display mt-2 text-2xl font-bold">{value}</p></div>;
}
