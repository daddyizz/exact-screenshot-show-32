import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteOwnedBacklinkSite,
  listOwnedBacklinkSites,
  saveOwnedBacklinkSite,
} from "@/lib/backlinks.functions";

export const Route = createFileRoute("/_authenticated/admin/backlinks")({
  head: () => ({ meta: [{ title: "Backlink Network — BlogPilot AI" }] }),
  component: BacklinkNetworkPage,
});

type Site = {
  id: string;
  name: string;
  url: string;
  topics: string;
  anchor_hint: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

const emptyForm = { id: undefined as string | undefined, name: "", url: "", topics: "", anchorHint: "", enabled: true };

function BacklinkNetworkPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listOwnedBacklinkSites);
  const saveFn = useServerFn(saveOwnedBacklinkSite);
  const deleteFn = useServerFn(deleteOwnedBacklinkSite);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);

  const query = useQuery({ queryKey: ["owned-backlink-sites"], queryFn: () => listFn(), retry: false });
  const sites = (query.data?.sites ?? []) as Site[];

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: async () => {
      toast.success(form.id ? "Backlink site updated" : "Backlink site added");
      setOpen(false);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["owned-backlink-sites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Backlink site removed");
      await queryClient.invalidateQueries({ queryKey: ["owned-backlink-sites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const enabledCount = useMemo(() => sites.filter((site) => site.enabled).length, [sites]);

  const editSite = (site: Site) => {
    setForm({ id: site.id, name: site.name, url: site.url, topics: site.topics, anchorHint: site.anchor_hint ?? "", enabled: site.enabled });
    setOpen(true);
  };

  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-eyebrow">Admin</p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight">Owned Sites / Backlink Network</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Add websites you own. BlogPilot only inserts one contextual backlink when the article title, keywords or outline matches that site's approved topics.</p>
      </div>
      <Button onClick={() => { setForm(emptyForm); setOpen(true); }}><Plus aria-hidden /> Add owned site</Button>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Owned sites" value={sites.length} />
      <Stat label="Enabled" value={enabledCount} />
      <Stat label="Per article" value="Max 1" />
    </div>

    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">How insertion works</p>
      <p className="mt-1">No forced sitewide link. A backlink is added only when at least one comma-separated topic matches the generated article context. The marker prevents duplicate insertion when an article is regenerated.</p>
    </div>

    {query.isLoading ? <div className="surface-panel p-6 text-sm text-muted-foreground">Loading backlink network…</div> : null}
    {query.isError ? <div className="surface-panel p-6 text-sm text-destructive">{(query.error as Error).message}</div> : null}

    {!query.isLoading && !query.isError ? <div className="surface-panel divide-y divide-border">
      {sites.length === 0 ? <div className="p-8 text-center"><Link2 className="mx-auto size-6 text-primary" aria-hidden /><p className="mt-3 font-medium">No owned sites yet</p><p className="mt-1 text-sm text-muted-foreground">Add a site and a few focused topics such as “Blogger SEO, AI blogging, content automation”.</p></div> : sites.map((site) => <div key={site.id} className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{site.name}</p><Badge variant={site.enabled ? "default" : "secondary"}>{site.enabled ? "Enabled" : "Disabled"}</Badge></div>
          <a href={site.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline">{site.url}<ExternalLink className="size-3" aria-hidden /></a>
          <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Topics:</span> {site.topics}</p>
          {site.anchor_hint ? <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Anchor:</span> {site.anchor_hint}</p> : null}
        </div>
        <Button size="sm" variant="outline" onClick={() => editSite(site)}><Pencil aria-hidden /> Edit</Button>
        <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${site.name} from the backlink network?`)) remove.mutate(site.id); }}><Trash2 aria-hidden /> Remove</Button>
      </div>)}
    </div> : null}

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setForm(emptyForm); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{form.id ? "Edit owned site" : "Add owned site"}</DialogTitle><DialogDescription>Only add sites you control. Keep topics specific so links are inserted only into genuinely relevant articles.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Site name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Izz.co.in" /></div>
          <div className="space-y-2"><Label>Website URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://izz.co.in/" /></div>
          <div className="space-y-2"><Label>Relevant topics</Label><Textarea value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} placeholder="Android, AI tools, Blogger SEO, technology" /><p className="text-xs text-muted-foreground">Comma separated. At least one topic must match the article context before a backlink is inserted.</p></div>
          <div className="space-y-2"><Label>Preferred anchor text (optional)</Label><Input value={form.anchorHint} onChange={(e) => setForm({ ...form, anchorHint: e.target.value })} placeholder="More practical AI and Android guides" /></div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium">Enabled</p><p className="text-xs text-muted-foreground">Allow BlogPilot to use this site for relevant generated articles.</p></div><Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} /></div>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || !form.url.trim() || !form.topics.trim()}>{save.isPending ? "Saving…" : "Save owned site"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="surface-panel p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="font-display mt-2 text-2xl font-bold">{value}</p></div>;
}
