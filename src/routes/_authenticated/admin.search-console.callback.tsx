import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeSearchConsoleAuth } from "@/lib/search-console.functions";

type Search = { code?: string | undefined; state?: string | undefined; error?: string | undefined };
type CallbackState = "working" | "success" | "failed";

export const Route = createFileRoute("/_authenticated/admin/search-console/callback")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    state: typeof search["state"] === "string" ? search["state"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Connecting Search Console — BlogPilot AI" }] }),
  component: SearchConsoleCallback,
});

function SearchConsoleCallback() {
  const { code, state, error } = Route.useSearch();
  const complete = useServerFn(completeSearchConsoleAuth);
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState<CallbackState>("working");
  const [message, setMessage] = useState("Finishing Search Console connection…");
  const [propertyCount, setPropertyCount] = useState(0);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (error || !code || !state) {
      setStatus("failed");
      setMessage(error ? `Google returned: ${error}` : "The Search Console connection link was incomplete.");
      return;
    }
    void complete({
      data: {
        code,
        state,
        redirectUri: `${window.location.origin}/admin/search-console/callback`,
      },
    })
      .then((result) => {
        setPropertyCount(result.sites.length);
        setSelectedSite(result.selectedSiteUrl ?? null);
        setStatus("success");
        setMessage(result.sites.length
          ? "Google Search Console connected and saved successfully."
          : "Connection saved successfully, but this Google account has no Search Console properties yet.");
      })
      .catch((e: Error) => {
        setStatus("failed");
        setMessage(e.message);
      });
  }, [code, state, error, complete]);

  return (
    <div className="surface-panel mx-auto max-w-lg space-y-4 p-8 text-center">
      <h1 className="font-display text-xl font-semibold">Google Search Console</h1>
      {status === "working" ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {message}
        </p>
      ) : status === "success" ? (
        <div className="space-y-4">
          <CheckCircle2 className="mx-auto size-9 text-primary" aria-hidden />
          <p className="text-sm">{message}</p>
          <div className="rounded-md border border-border p-3 text-left text-xs text-muted-foreground">
            <p>Database saved: Yes</p>
            <p>Properties found: {propertyCount}</p>
            <p className="break-all">Selected property: {selectedSite ?? "None"}</p>
          </div>
          <Button onClick={() => navigate({ to: "/admin/search-console" as any })}>Open Search Console dashboard</Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-destructive">{message}</p>
          <Button onClick={() => navigate({ to: "/admin/search-console" as any })}>Back to Search Console</Button>
        </>
      )}
    </div>
  );
}
