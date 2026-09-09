import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAdsAdmin, saveAdPlacement, deleteAdPlacement } from "@/lib/ads.functions";
import { amIAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/ads")({
  head: () => ({ meta: [{ title: "Ads — BlogPilot AI Admin" }] }),
  component: AdminAdsPage,
});

type AdRow = {
  id?: string;
  slot_key: string;
  name: string;
  headline: string;
  body?: string | null;
  image_url?: string | null;
  target_url: string;
  cta_label: string;
  is_active: boolean;
  opens_new_tab: boolean;
};

const blankForm = {
  id: undefined as string | undefined,
  slotKey: "",
  name: "",
  headline: "",
  body: "",
  imageUrl: "",
  targetUrl: "",
  ctaLabel: "Learn more",
  isActive: true,
  opensNewTab: true,
};

function AdminAdsPage() {
  const adminFn = useServerFn(amIAdmin);
  const listFn = useServerFn(listAdsAdmin);
  const saveFn = useServerFn(saveAdPlacement);
  const deleteFn = useServerFn(deleteAdPlacement);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);

  const admin = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => adminFn(),
    retry: false,
  });

  const ads = useQuery({
    queryKey: ["admin-ads"],
    queryFn: () => listFn(),
    enabled: admin.data?.isAdmin === true,
    retry: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
    await queryClient.invalidateQueries({ queryKey: ["ad-placement"] });
  };

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: async () => {
      toast.success("Ad placement saved");
      setOpen(false);
      setForm(blankForm);
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Ad placement deleted");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const edit = (ad: AdRow) => {
    setForm({
      id: ad.id,
      slotKey: ad.slot_key,
      name: ad.name,
      headline: ad.headline,
      body: ad.body ?? "",
      imageUrl: ad.image_url ?? "",
      targetUrl: ad.target_url,
      ctaLabel: ad.cta_label,
      isActive: ad.is_active,
      opensNewTab: ad.opens_new_tab,
    });
    setOpen(true);
  };

  if (admin.isLoading) return <p className="text-sm text-muted-foreground">Checking admin access…</p>;
  if (admin.isError || !admin.data?.isAdmin) {
    return <div className="surface-panel p-8"><h1 className="text-xl font-semibold">Admin access required</h1></div>;
  }
  if (ads.isLoading) return <p className="text-sm text-muted-foreground">Loading ad dashboard…</p>;
  if (ads.isError) return <div className="surface-panel p-8"><h1 className="text-xl font-semibold">Ads dashboard failed to load</h1><p className="mt-2 text-sm text-muted-foreground">{(ads.error as Error).message}</p></div>;

  const rows = (ads.data?.ads ?? []) as AdRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Admin · Advertising</p>
          <h1 className="mt-1 text-3xl font-bold">Ads dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage homepage and workspace ads without changing code.</p>
        </div>
        <Button onClick={() => { setForm(blankForm); setOpen(true); }}><Plus aria-hidden /> Add placement</Button>
      </div>

      {ads.data?.schemaMissing ? (
        <div className="surface-panel border-amber-500/40 p-5">
          <p className="font-medium">Ad database migration is not active yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">The visible slots are using built-in house ads until the ad_placements migration is applied.</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((ad) => (
          <article key={ad.id ?? ad.slot_key} className="surface-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Megaphone className="size-4 text-primary" aria-hidden />
                  <h2 className="font-semibold">{ad.name}</h2>
                  <Badge variant={ad.is_active ? "default" : "secondary"}>{ad.is_active ? "ACTIVE" : "OFF"}</Badge>
                </div>
                <p className="mt-1 text-xs font-mono text-muted-foreground">{ad.slot_key}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => edit(ad)}><Pencil aria-hidden /> Edit</Button>
            </div>

            {ad.image_url ? <img src={ad.image_url} alt="" className="mt-4 h-32 w-full rounded-lg object-cover" /> : null}
            <h3 className="mt-4 font-display text-lg font-semibold">{ad.headline}</h3>
            {ad.body ? <p className="mt-2 text-sm text-muted-foreground">{ad.body}</p> : null}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>CTA: {ad.cta_label}</span>
              <span>·</span>
              <span className="max-w-full truncate">{ad.target_url}</span>
              {ad.opens_new_tab ? <ExternalLink className="size-3" aria-hidden /> : null}
            </div>
            {ad.id ? (
              <Button className="mt-4" size="sm" variant="destructive" onClick={() => remove.mutate(ad.id!)} disabled={remove.isPending}>
                <Trash2 aria-hidden /> Delete
              </Button>
            ) : null}
          </article>
        ))}
        {rows.length === 0 ? (
          <div className="surface-panel p-8 text-center text-sm text-muted-foreground">No database-backed ads yet. The built-in house ads remain active.</div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit ad placement" : "Add ad placement"}</DialogTitle>
            <DialogDescription>Use landing-mid for the homepage and app-top for the workspace banner.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Slot key"><Input value={form.slotKey} onChange={(e) => setForm({ ...form, slotKey: e.target.value })} placeholder="landing-mid" /></Field>
              <Field label="Internal name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            </div>
            <Field label="Headline"><Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></Field>
            <Field label="Body"><Input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <Field label="Banner image URL (optional)"><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Destination URL"><Input value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} placeholder="https://partner.example/deal" /></Field>
            <Field label="CTA label"><Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleButton active={form.isActive} onClick={() => setForm({ ...form, isActive: !form.isActive })} label={form.isActive ? "Ad is active" : "Ad is disabled"} />
              <ToggleButton active={form.opensNewTab} onClick={() => setForm({ ...form, opensNewTab: !form.opensNewTab })} label={form.opensNewTab ? "Open in new tab" : "Open in same tab"} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.slotKey || !form.name || !form.headline || !form.targetUrl || !form.ctaLabel}>
              {save.isPending ? "Saving…" : "Save ad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <Button type="button" variant={active ? "default" : "outline"} onClick={onClick}>{label}</Button>;
}
