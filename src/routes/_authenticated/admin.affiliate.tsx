import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Link2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteAffiliateLink, importAffiliateCsv, listAffiliateAdmin, saveAffiliateBlogSetting, saveAffiliateLink, saveAffiliatePromptSettings } from "@/lib/affiliate.functions";

export const Route = createFileRoute("/_authenticated/admin/affiliate")({
  head: () => ({ meta: [{ title: "Smart Affiliate Network — BlogPilot AI" }] }),
  component: AffiliateAdminPage,
});

type AffiliateLink = {
  id: string;
  name: string;
  destination_url: string;
  platform: "shopee" | "tiktok" | "amazon" | "other";
  link_type: "product" | "category";
  category: string | null;
  keywords: string;
  cta_text: string;
  short_code: string;
  priority: number;
  enabled: boolean;
  click_count: number;
  last_clicked_at: string | null;
  campaign_name: string | null;
  starts_at: string | null;
  expires_at: string | null;
  max_clicks: number | null;
};

type BlogRow = { id: string; name: string; url: string; user_id: string; affiliate_recommendations_enabled: boolean };
type Status = "active" | "scheduled" | "expired" | "capped" | "disabled";

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  destinationUrl: "",
  platform: "shopee" as const,
  linkType: "product" as const,
  category: "",
  keywords: "",
  ctaText: "Semak harga terkini",
  priority: 100,
  enabled: true,
  campaignName: "",
  startsAt: "",
  expiresAt: "",
  maxClicks: null as number | null,
};

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function statusOf(link: AffiliateLink): Status {
  if (!link.enabled) return "disabled";
  const now = Date.now();
  if (link.starts_at && new Date(link.starts_at).getTime() > now) return "scheduled";
  if (link.expires_at && new Date(link.expires_at).getTime() <= now) return "expired";
  if (link.max_clicks && Number(link.click_count || 0) >= link.max_clicks) return "capped";
  return "active";
}

function statusBadge(status: Status) {
  if (status === "active") return <Badge>Active</Badge>;
  if (status === "scheduled") return <Badge variant="outline">Scheduled</Badge>;
  if (status === "expired") return <Badge variant="secondary">Expired</Badge>;
  if (status === "capped") return <Badge variant="secondary">Capped</Badge>;
  return <Badge variant="secondary">Disabled</Badge>;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function AffiliateAdminPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAffiliateAdmin);
  const saveFn = useServerFn(saveAffiliateLink);
  const deleteFn = useServerFn(deleteAffiliateLink);
  const importFn = useServerFn(importAffiliateCsv);
  const saveSettingsFn = useServerFn(saveAffiliatePromptSettings);
  const saveBlogFn = useServerFn(saveAffiliateBlogSetting);

  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const query = useQuery({ queryKey: ["affiliate-admin"], queryFn: () => listFn(), retry: false });
  const links = (query.data?.links ?? []) as AffiliateLink[];
  const blogs = (query.data?.blogs ?? []) as BlogRow[];
  const settings = query.data?.settings;

  const metrics = useMemo(() => {
    const statuses = links.map(statusOf);
    return {
      total: links.length,
      active: statuses.filter((s) => s === "active").length,
      scheduled: statuses.filter((s) => s === "scheduled").length,
      expired: statuses.filter((s) => s === "expired").length,
      capped: statuses.filter((s) => s === "capped").length,
      clicks: links.reduce((sum, link) => sum + Number(link.click_count || 0), 0),
    };
  }, [links]);

  const campaigns = useMemo(() => Array.from(new Set(links.map((l) => l.campaign_name?.trim()).filter(Boolean) as string[])).sort(), [links]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((link) => {
      const status = statusOf(link);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (platformFilter !== "all" && link.platform !== platformFilter) return false;
      if (campaignFilter !== "all" && (link.campaign_name || "") !== campaignFilter) return false;
      if (!q) return true;
      return [link.name, link.category, link.keywords, link.campaign_name, link.cta_text, link.short_code].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [links, search, statusFilter, platformFilter, campaignFilter]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: async () => { toast.success(form.id ? "Affiliate link updated" : "Affiliate link added"); setOpen(false); setForm(emptyForm); await queryClient.invalidateQueries({ queryKey: ["affiliate-admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => { toast.success("Affiliate link removed"); await queryClient.invalidateQueries({ queryKey: ["affiliate-admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const importCsv = useMutation({
    mutationFn: () => importFn({ data: { csv } }),
    onSuccess: async (result) => { toast.success(`${result.imported} affiliate links imported`); setCsvOpen(false); setCsv(""); await queryClient.invalidateQueries({ queryKey: ["affiliate-admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveBlog = useMutation({
    mutationFn: ({ blogId, enabled }: { blogId: string; enabled: boolean }) => saveBlogFn({ data: { blogId, enabled } }),
    onSuccess: async () => { toast.success("Blog affiliate setting saved"); await queryClient.invalidateQueries({ queryKey: ["affiliate-admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const savePrompt = useMutation({
    mutationFn: (patch: Partial<{ enabled: boolean; delaySeconds: number; closeSnoozeMinutes: number; clickedCooldownHours: number }>) => saveSettingsFn({ data: {
      enabled: patch.enabled ?? Boolean(settings?.enabled),
      delaySeconds: patch.delaySeconds ?? Number(settings?.delay_seconds ?? 8),
      closeSnoozeMinutes: patch.closeSnoozeMinutes ?? Number(settings?.close_snooze_minutes ?? 30),
      clickedCooldownHours: patch.clickedCooldownHours ?? Number(settings?.clicked_cooldown_hours ?? 24),
    } }),
    onSuccess: async () => { toast.success("Affiliate prompt settings saved"); await queryClient.invalidateQueries({ queryKey: ["affiliate-admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const editLink = (link: AffiliateLink) => {
    setForm({
      id: link.id,
      name: link.name,
      destinationUrl: link.destination_url,
      platform: link.platform,
      linkType: link.link_type,
      category: link.category ?? "",
      keywords: link.keywords,
      ctaText: link.cta_text,
      priority: link.priority,
      enabled: link.enabled,
      campaignName: link.campaign_name ?? "",
      startsAt: toLocalInput(link.starts_at),
      expiresAt: toLocalInput(link.expires_at),
      maxClicks: link.max_clicks ?? null,
    });
    setOpen(true);
  };

  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-eyebrow">Admin</p><h1 className="font-display mt-1 text-2xl font-bold tracking-tight">Smart Affiliate Network</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage product and category affiliate links centrally, schedule campaigns, cap clicks and track performance before publishing contextual sponsored CTAs.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setCsvOpen(true)}><Upload aria-hidden />Import CSV</Button><Button onClick={() => { setForm(emptyForm); setOpen(true); }}><Plus aria-hidden />Add link</Button></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Stat label="Links" value={metrics.total} />
      <Stat label="Active" value={metrics.active} />
      <Stat label="Scheduled" value={metrics.scheduled} />
      <Stat label="Expired" value={metrics.expired} />
      <Stat label="Capped" value={metrics.capped} />
      <Stat label="Clicks" value={metrics.clicks} />
    </div>

    <section className="surface-panel space-y-4 p-5">
      <div><h2 className="font-display text-lg font-semibold">Blog rollout</h2><p className="text-sm text-muted-foreground">Enable Smart Affiliate only on blogs that should receive sponsored recommendations. Manual and Autopilot publishing insert at most one matching CTA.</p></div>
      <div className="divide-y divide-border rounded-lg border border-border">{blogs.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No active blogs found.</p> : blogs.map((blog) => <div key={blog.id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-medium">{blog.name}</p><p className="truncate text-xs text-muted-foreground">{blog.url}</p><code className="mt-1 block truncate text-[10px] text-muted-foreground">Prompt script blogId: {blog.id}</code></div><Switch checked={Boolean(blog.affiliate_recommendations_enabled)} disabled={saveBlog.isPending} onCheckedChange={(enabled) => saveBlog.mutate({ blogId: blog.id, enabled })} /></div>)}</div>
      <p className="text-xs text-muted-foreground">The reader prompt still needs a one-time Blogger theme script install. Contextual article CTA publishing works independently.</p>
    </section>

    <section className="surface-panel space-y-4 p-5">
      <div className="flex items-center justify-between gap-4"><div><h2 className="font-display text-lg font-semibold">Reader prompt</h2><p className="text-sm text-muted-foreground">Global defaults. Closing snoozes it; a genuine CTA click starts the longer cooldown.</p></div><Switch checked={Boolean(settings?.enabled)} onCheckedChange={(enabled) => savePrompt.mutate({ enabled })} /></div>
      <div className="grid gap-4 sm:grid-cols-3"><NumberSetting key={`delay-${settings?.delay_seconds ?? 8}`} label="Delay before showing (seconds)" value={Number(settings?.delay_seconds ?? 8)} onSave={(value) => savePrompt.mutate({ delaySeconds: value })} /><NumberSetting key={`snooze-${settings?.close_snooze_minutes ?? 30}`} label="Close snooze (minutes)" value={Number(settings?.close_snooze_minutes ?? 30)} onSave={(value) => savePrompt.mutate({ closeSnoozeMinutes: value })} /><NumberSetting key={`cooldown-${settings?.clicked_cooldown_hours ?? 24}`} label="After-click cooldown (hours)" value={Number(settings?.clicked_cooldown_hours ?? 24)} onSave={(value) => savePrompt.mutate({ clickedCooldownHours: value })} /></div>
    </section>

    <section className="surface-panel space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Campaign links</h2><p className="text-sm text-muted-foreground">Search, filter and inspect live campaign state without opening every link.</p></div><span className="text-xs text-muted-foreground">Showing {filtered.length} of {links.length}</span></div>
      <div className="grid gap-3 lg:grid-cols-[1fr_170px_170px_200px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, keyword, campaign, code…" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="capped">Capped</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}><SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger><SelectContent><SelectItem value="all">All platforms</SelectItem><SelectItem value="shopee">Shopee</SelectItem><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="amazon">Amazon</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}><SelectTrigger><SelectValue placeholder="Campaign" /></SelectTrigger><SelectContent><SelectItem value="all">All campaigns</SelectItem>{campaigns.map((campaign) => <SelectItem key={campaign} value={campaign}>{campaign}</SelectItem>)}</SelectContent></Select>
      </div>
    </section>

    {query.isLoading ? <div className="surface-panel p-6 text-sm text-muted-foreground">Loading affiliate network…</div> : null}
    {query.isError ? <div className="surface-panel p-6 text-sm text-destructive">{(query.error as Error).message}</div> : null}
    {!query.isLoading && !query.isError ? <div className="surface-panel divide-y divide-border">{filtered.length === 0 ? <div className="p-8 text-center"><Link2 className="mx-auto size-6 text-primary" aria-hidden /><p className="mt-3 font-medium">No matching affiliate links</p><p className="mt-1 text-sm text-muted-foreground">Clear the filters or add a new campaign link.</p></div> : filtered.map((link) => {
      const status = statusOf(link);
      return <div key={link.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{link.name}</p>{statusBadge(status)}<Badge variant="outline">{link.platform}</Badge><Badge variant="outline">{link.link_type}</Badge>{link.campaign_name ? <Badge variant="outline">{link.campaign_name}</Badge> : null}</div><a href={link.destination_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline">{link.destination_url}<ExternalLink className="size-3" aria-hidden /></a><p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Keywords:</span> {link.keywords}</p><p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">CTA:</span> {link.cta_text} · <span className="font-medium text-foreground">Priority:</span> {link.priority} · <span className="font-medium text-foreground">Clicks:</span> {link.click_count}{link.max_clicks ? ` / ${link.max_clicks}` : ""}</p><p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Starts:</span> {fmtDate(link.starts_at)} · <span className="font-medium text-foreground">Ends:</span> {fmtDate(link.expires_at)} · <span className="font-medium text-foreground">Last click:</span> {fmtDate(link.last_clicked_at)}</p><p className="mt-1 text-xs text-muted-foreground">Redirect: /go/{link.short_code}</p></div><Button size="sm" variant="outline" onClick={() => editLink(link)}><Pencil aria-hidden />Edit</Button><Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${link.name}?`)) remove.mutate(link.id); }}><Trash2 aria-hidden />Remove</Button></div>;
    })}</div> : null}

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setForm(emptyForm); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{form.id ? "Edit affiliate link" : "Add affiliate link"}</DialogTitle><DialogDescription>Use direct product links where possible. Scheduling and click caps are optional.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="UGREEN 20000mAh Power Bank" /></div><div className="space-y-2"><Label>Affiliate destination URL</Label><Input value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} placeholder="https://s.shopee.com.my/..." /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Platform</Label><Select value={form.platform} onValueChange={(platform: any) => setForm({ ...form, platform })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shopee">Shopee</SelectItem><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="amazon">Amazon</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Link type</Label><Select value={form.linkType} onValueChange={(linkType: any) => setForm({ ...form, linkType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="product">Product</SelectItem><SelectItem value="category">Category fallback</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Campaign name (optional)</Label><Input value={form.campaignName} onChange={(e) => setForm({ ...form, campaignName: e.target.value })} placeholder="Shopee 9.9 Tech" /></div><div className="space-y-2"><Label>Category (optional)</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Power banks" /></div><div className="space-y-2"><Label>Matching keywords</Label><Textarea value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="powerbank, fast charging, android battery, usb-c" /><p className="text-xs text-muted-foreground">Comma separated. Product links beat category fallback when both match.</p></div><div className="space-y-2"><Label>CTA text</Label><Input value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Campaign starts (optional)</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div><div className="space-y-2"><Label>Campaign ends (optional)</Label><Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Max clicks (optional)</Label><Input type="number" min={1} value={form.maxClicks ?? ""} onChange={(e) => setForm({ ...form, maxClicks: e.target.value ? Math.max(1, Number(e.target.value) || 1) : null })} placeholder="Unlimited" /></div><div className="space-y-2"><Label>Priority</Label><Input type="number" min={0} max={10000} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })} /><p className="text-xs text-muted-foreground">Lower number wins when match score is tied.</p></div></div><div className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium">Enabled</p><p className="text-xs text-muted-foreground">Allow this link to be matched while campaign limits permit.</p></div><Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} /></div></div><DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || !form.destinationUrl.trim() || !form.keywords.trim()}>{save.isPending ? "Saving…" : "Save affiliate link"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={csvOpen} onOpenChange={setCsvOpen}><DialogContent><DialogHeader><DialogTitle>Bulk import CSV</DialogTitle><DialogDescription>Required: name,destination_url,keywords. Optional: platform,link_type,category,cta_text,priority,campaign_name,starts_at,expires_at,max_clicks.</DialogDescription></DialogHeader><Textarea rows={12} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'name,destination_url,keywords,platform,link_type,category,cta_text,priority,campaign_name,starts_at,expires_at,max_clicks\nUGREEN Power Bank,https://s.shopee.com.my/...,"powerbank, fast charging, usb-c",shopee,product,Power banks,Semak harga terkini,50,Shopee Tech,2026-09-20T00:00:00+08:00,2026-09-30T23:59:00+08:00,500'} /><DialogFooter><Button onClick={() => importCsv.mutate()} disabled={!csv.trim() || importCsv.isPending}>{importCsv.isPending ? "Importing…" : "Import CSV"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="surface-panel p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="font-display mt-2 text-2xl font-bold">{value}</p></div>;
}

function NumberSetting({ label, value, onSave }: { label: string; value: number; onSave: (value: number) => void }) {
  const [local, setLocal] = useState(value);
  return <div className="space-y-2"><Label>{label}</Label><Input type="number" value={local} onChange={(e) => setLocal(Number(e.target.value) || 0)} onBlur={() => onSave(local)} /></div>;
}
