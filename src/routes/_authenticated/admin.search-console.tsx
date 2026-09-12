import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, ExternalLink, RefreshCw, SearchCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  disconnectSearchConsole,
  getSearchConsoleDashboard,
  selectSearchConsoleProperty,
  startSearchConsoleAuth,
} from "@/lib/search-console.functions";

export const Route = createFileRoute("/_authenticated/admin/search-console")({
  head: () => ({ meta: [{ title: "Search Console — BlogPilot AI" }] }),
  component: SearchConsoleAdminPage,
});

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function num(value: number) {
  return new Intl.NumberFormat().format(Math.round(value));
}

function SearchConsoleAdminPage() {
  const queryClient = useQueryClient();
  const dashboardFn = useServerFn(getSearchConsoleDashboard);
  const connectFn = useServerFn(startSearchConsoleAuth);
  const disconnectFn = useServerFn(disconnectSearchConsole);
  const selectFn = useServerFn(selectSearchConsoleProperty);

  const dashboard = useQuery({
    queryKey: ["admin-search-console"],
    queryFn: () => dashboardFn(),
    retry: false,
  });

  const connect = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/admin/search-console/callback`;
      const result = await connectFn({ data: { redirectUri } });
      window.location.href = result.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: async () => {
      toast.success("Search Console disconnected");
      await queryClient.invalidateQueries({ queryKey: ["admin-search-console"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectProperty = useMutation({
    mutationFn: async (siteUrl: string) => {
      const site = dashboard.data?.sites.find((s) => s.siteUrl === siteUrl);
      if (!site) throw new Error("Property not found");
      return selectFn({ data: { siteUrl: site.siteUrl, permissionLevel: site.permissionLevel } });
    },
    onSuccess: async () => {
      toast.success("Search Console property updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-search-console"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = dashboard.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow">Admin</p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight">Google Search Console</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Monitor organic search performance and choose which verified Search Console property BlogPilot should analyze.
          </p>
        </div>
        <div className="flex gap-2">
          {data?.connected ? (
            <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              <Unplug className="mr-2 size-4" aria-hidden />
              Disconnect
            </Button>
          ) : (
            <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
              <SearchCheck className="mr-2 size-4" aria-hidden />
              {connect.isPending ? "Opening Google…" : "Connect Search Console"}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh Search Console"
            onClick={() => dashboard.refetch()}
            disabled={dashboard.isFetching}
          >
            <RefreshCw className={`size-4 ${dashboard.isFetching ? "animate-spin" : ""}`} aria-hidden />
          </Button>
        </div>
      </header>

      {dashboard.isLoading ? (
        <div className="surface-panel p-6 text-sm text-muted-foreground">Loading Search Console…</div>
      ) : dashboard.error ? (
        <div className="surface-panel border-destructive/30 p-6">
          <p className="font-medium text-destructive">Search Console could not load</p>
          <p className="mt-1 text-sm text-muted-foreground">{(dashboard.error as Error).message}</p>
          <Button className="mt-4" variant="outline" onClick={() => connect.mutate()}>Reconnect Google</Button>
        </div>
      ) : !data?.connected ? (
        <div className="surface-panel space-y-3 p-6">
          <div className="flex items-start gap-3">
            <SearchCheck className="mt-0.5 size-5 text-primary" aria-hidden />
            <div>
              <h2 className="font-display font-semibold">Connect a Google account with Search Console access</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                BlogPilot requests read-only Search Console permission. It can read properties and performance data, but cannot change your Search Console settings.
              </p>
            </div>
          </div>
          <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending ? "Opening Google…" : "Connect Google Search Console"}
          </Button>
        </div>
      ) : (
        <>
          <section className="surface-panel space-y-4 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Selected property</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.sites.length} Search Console {data.sites.length === 1 ? "property" : "properties"} available
                </p>
              </div>
              <div className="w-full sm:w-96">
                <Select value={data.selectedSiteUrl ?? ""} onValueChange={(value) => selectProperty.mutate(value)}>
                  <SelectTrigger><SelectValue placeholder="Choose a Search Console property" /></SelectTrigger>
                  <SelectContent>
                    {data.sites.map((site) => (
                      <SelectItem key={site.siteUrl} value={site.siteUrl}>{site.siteUrl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {data.selectedSiteUrl ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{data.selectedPermissionLevel ?? "access"}</Badge>
                <span className="truncate">{data.selectedSiteUrl}</span>
                {!data.selectedSiteUrl.startsWith("sc-domain:") && (
                  <a href={data.selectedSiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Open site <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This Google account has no Search Console properties yet.</p>
            )}
          </section>

          {data.metrics && data.range ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Clicks" value={num(data.metrics.clicks)} />
                <MetricCard label="Impressions" value={num(data.metrics.impressions)} />
                <MetricCard label="CTR" value={pct(data.metrics.ctr)} />
                <MetricCard label="Avg. position" value={data.metrics.position.toFixed(1)} />
              </section>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BarChart3 className="size-4" aria-hidden />
                Search performance from {data.range.startDate} to {data.range.endDate}. Search Console data can be delayed.
              </div>

              <section className="grid gap-6 lg:grid-cols-2">
                <div className="surface-panel overflow-hidden">
                  <div className="border-b border-border p-5">
                    <h2 className="font-display font-semibold">Top queries</h2>
                    <p className="text-xs text-muted-foreground">Queries driving the most clicks.</p>
                  </div>
                  <div className="divide-y divide-border">
                    {data.topQueries.length ? data.topQueries.map((row, index) => (
                      <PerformanceRow key={`${row.query}-${index}`} name={row.query || "(unknown query)"} clicks={row.clicks} impressions={row.impressions} position={row.position} />
                    )) : <p className="p-5 text-sm text-muted-foreground">No query data in this period.</p>}
                  </div>
                </div>

                <div className="surface-panel overflow-hidden">
                  <div className="border-b border-border p-5">
                    <h2 className="font-display font-semibold">Top pages</h2>
                    <p className="text-xs text-muted-foreground">Pages receiving the most Google Search clicks.</p>
                  </div>
                  <div className="divide-y divide-border">
                    {data.topPages.length ? data.topPages.map((row, index) => (
                      <PerformanceRow key={`${row.page}-${index}`} name={row.page || "(unknown page)"} clicks={row.clicks} impressions={row.impressions} position={row.position} />
                    )) : <p className="p-5 text-sm text-muted-foreground">No page data in this period.</p>}
                  </div>
                </div>
              </section>
            </>
          ) : data.selectedSiteUrl ? (
            <div className="surface-panel p-6 text-sm text-muted-foreground">No Search Console performance data is available for this property yet.</div>
          ) : null}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="font-display mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function PerformanceRow({ name, clicks, impressions, position }: { name: string; clicks: number; impressions: number; position: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 text-sm">
      <p className="min-w-0 break-words font-medium">{name}</p>
      <div className="text-right text-xs text-muted-foreground">
        <p>{num(clicks)} clicks · {num(impressions)} impr.</p>
        <p>Position {position.toFixed(1)}</p>
      </div>
    </div>
  );
}
