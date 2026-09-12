import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeSearchConsoleAuth } from "@/lib/search-console.functions";

type Search = { code?: string | undefined; state?: string | undefined; error?: string | undefined };

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
  const [message, setMessage] = useState("Finishing Search Console connection…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (error || !code || !state) {
      setFailed(true);
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
        toast.success(result.sites.length ? "Search Console connected" : "Connected, but no Search Console properties were found");
        void navigate({ to: "/admin/search-console" as any });
      })
      .catch((e: Error) => {
        setFailed(true);
        setMessage(e.message);
      });
  }, [code, state, error, complete, navigate]);

  return (
    <div className="surface-panel mx-auto max-w-lg space-y-4 p-8 text-center">
      <h1 className="font-display text-xl font-semibold">Google Search Console</h1>
      {!failed ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {message}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button onClick={() => navigate({ to: "/admin/search-console" as any })}>Back to Search Console</Button>
        </>
      )}
    </div>
  );
}
