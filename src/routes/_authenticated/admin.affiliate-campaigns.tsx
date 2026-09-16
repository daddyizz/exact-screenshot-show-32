import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { duplicateAffiliateCampaign, listAffiliateCampaignSummary, setAffiliateCampaignEnabled } from "@/lib/affiliate.campaign.functions";
import { listAffiliateAdmin } from "@/lib/affiliate.functions";

export const Route = createFileRoute("/_authenticated/admin/affiliate-campaigns")({
  head: () => ({ meta: [{ title: "Affiliate Campaigns — BlogPilot AI" }] }),
  component: AffiliateCampaignsPage,
});

type Campaign = { name: string; links: number; enabled: number; clicks: number; capped: number; platforms: string[]; startsAt: string | null; expiresAt: string | null };

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
  const [source, setSource] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const summary = useQuery({ queryKey: ["affiliate-campaign-summary"], queryFn: () => summaryFn(), retry: false });
  const all = useQuery({ queryKey: ["affiliate-admin-export"], queryFn: () => listFn(), retry: false });
  const campaigns = (summary.data ?? []) as Campaign[];
  const totalClicks = useMemo(() => campaigns.reduce((sum, c) => sum + Number(c.clicks || 0), 0), [campaigns]);

  const toggle = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) => toggleFn({ data: { campaignName: name, enabled } }),
    onSuccess: async (r, v) => { toast.success(`${v.enabled ? "Enabled" : "Disabled"} ${r.affected} links`); await qc.invalidateQueries({ queryKey: ["affiliate-campaign-summary"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: () => duplicateFn({ data: { sourceCampaign: source!, newCampaign: newName } }),
    onSuccess: async (r) => { toast.success(`Copied ${r.copied} links into new disabled campaign`); setSource(null); setNewName(""); await qc.invalidateQueries({ queryKey: ["affiliate-campaign-summary"] }); await qc.invalidateQueries({ queryKey: ["affiliate-admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-eyebrow">Admin · Affiliate</p><h1 className="font-display mt-1 text-2xl font-bold tracking-tight">Campaign controls</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pause or resume an entire campaign, duplicate it as a safe disabled copy, and export the full affiliate inventory for reporting or backup.</p></div><Button variant="outline" disabled={!all.data?.links?.length} onClick={() => downloadCsv(all.data?.links ?? [])}><Download aria-hidden />Export CSV</Button></header>

    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Campaigns" value={campaigns.length} /><Stat label="Total clicks" value={totalClicks} /><Stat label="Links" value={campaigns.reduce((sum,c)=>sum+c.links,0)} /></div>

    {summary.isLoading ? <div className="surface-panel p-6 text-sm text-muted-foreground">Loading campaigns…</div> : null}
    {summary.isError ? <div className="surface-panel p-6 text-sm text-destructive">{(summary.error as Error).message}</div> : null}
    {!summary.isLoading && !summary.isError ? <div className="surface-panel divide-y divide-border">{campaigns.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No named campaigns yet. Add a Campaign name to affiliate links first.</div> : campaigns.map((c) => { const fullyEnabled = c.enabled === c.links && c.links > 0; return <div key={c.name} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{c.name}</p><Badge variant={fullyEnabled ? "default" : "secondary"}>{fullyEnabled ? "Enabled" : c.enabled > 0 ? "Partly enabled" : "Disabled"}</Badge>{c.platforms.map((p) => <Badge variant="outline" key={p}>{p}</Badge>)}</div><p className="mt-2 text-xs text-muted-foreground">{c.links} links · {c.enabled} enabled · {c.clicks} clicks · {c.capped} capped</p>{c.startsAt || c.expiresAt ? <p className="mt-1 text-xs text-muted-foreground">Window: {c.startsAt ? new Date(c.startsAt).toLocaleString() : "Any time"} → {c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "No expiry"}</p> : null}</div><Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate({ name: c.name, enabled: !fullyEnabled })}><Power aria-hidden />{fullyEnabled ? "Kill campaign" : "Enable campaign"}</Button><Button size="sm" variant="outline" onClick={() => { setSource(c.name); setNewName(`${c.name} Copy`); }}><Copy aria-hidden />Duplicate</Button></div>; })}</div> : null}

    <section className="surface-panel p-5"><h2 className="font-display text-lg font-semibold">How duplication works</h2><p className="mt-1 text-sm text-muted-foreground">A duplicate copies the links, platform, matching rules, CTA, priority and click cap. The new campaign starts disabled with zero clicks and no schedule, so it cannot go live accidentally.</p></section>

    <Dialog open={Boolean(source)} onOpenChange={(v) => { if (!v) { setSource(null); setNewName(""); } }}><DialogContent><DialogHeader><DialogTitle>Duplicate campaign</DialogTitle><DialogDescription>Copy {source} into a new disabled campaign.</DialogDescription></DialogHeader><div className="space-y-2"><Label>New campaign name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus /></div><DialogFooter><Button disabled={!newName.trim() || duplicate.isPending} onClick={() => duplicate.mutate()}>{duplicate.isPending ? "Copying…" : "Duplicate campaign"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="surface-panel p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="font-display mt-2 text-2xl font-bold">{value}</p></div>;
}
