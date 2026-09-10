import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Gauge, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyPlanUsage } from "@/lib/account.functions";
import { createStripeCheckout, createStripePortal } from "@/lib/billing.functions";

function formatBillingDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function PlanUsageCard() {
  const planFn = useServerFn(getMyPlanUsage);
  const checkoutFn = useServerFn(createStripeCheckout);
  const portalFn = useServerFn(createStripePortal);
  const plan = useQuery({
    queryKey: ["my-plan-usage"],
    queryFn: () => planFn(),
    retry: false,
  });

  const checkout = useMutation({
    mutationFn: () => checkoutFn({ data: { origin: window.location.origin } }),
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (error: Error) => toast.error(error.message),
  });
  const portal = useMutation({
    mutationFn: () => portalFn({ data: { origin: window.location.origin } }),
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (error: Error) => toast.error(error.message),
  });

  if (plan.isLoading) {
    return <div className="surface-panel p-5 text-sm text-muted-foreground">Loading plan & usage…</div>;
  }

  if (plan.isError || !plan.data) {
    return (
      <div className="surface-panel p-5">
        <p className="font-medium">Plan & usage</p>
        <p className="mt-1 text-sm text-muted-foreground">Usage details are temporarily unavailable.</p>
      </div>
    );
  }

  const data = plan.data;
  const pro = data.plan === "pro";
  const draftText = data.aiDraftLimit == null ? `${data.aiDrafts} drafts` : `${data.aiDrafts} / ${data.aiDraftLimit} drafts`;
  const stripeManaged = data.billingProvider === "stripe";
  const billingEndDate = formatBillingDate(data.currentPeriodEnd);

  return (
    <div className="surface-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="size-5 text-primary" aria-hidden />
            <p className="font-semibold">Current plan</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={pro ? "default" : "secondary"}>{pro ? "PRO" : "FREE"}</Badge>
            <Badge variant="outline" className="capitalize">{data.status}</Badge>
            {data.cancelAtPeriodEnd ? <Badge variant="outline">Cancellation scheduled</Badge> : null}
            {data.isAdmin ? <Badge variant="outline">ADMIN</Badge> : null}
          </div>
          {data.cancelAtPeriodEnd ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">Your Pro plan is scheduled to end{billingEndDate ? ` on ${billingEndDate}` : " at the end of the current billing period"}.</p>
              <p className="mt-1 text-xs text-muted-foreground">Pro features remain active until then. You can renew anytime from Manage billing.</p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!pro ? (
              <Button onClick={() => checkout.mutate()} disabled={checkout.isPending}>
                {checkout.isPending ? "Opening checkout…" : "Upgrade to Pro — RM49/month"}
              </Button>
            ) : stripeManaged ? (
              <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
                {portal.isPending ? "Opening billing…" : "Manage billing"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Blogs</p>
          <p className="text-lg font-bold">{data.blogCount} / {data.blogLimit}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 p-3">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <p className="mt-2 text-xs text-muted-foreground">AI drafts this month</p>
          <p className="mt-1 font-semibold">{draftText}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <Gauge className="size-4 text-primary" aria-hidden />
          <p className="mt-2 text-xs text-muted-foreground">Autopilot</p>
          <p className="mt-1 font-semibold">{data.autopilotEnabled ? "Enabled" : "Pro only"}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <p className="mt-2 text-xs text-muted-foreground">AI cover images</p>
          <p className="mt-1 font-semibold">{data.aiImagesEnabled ? `${data.aiImages} generated` : "Pro only"}</p>
        </div>
      </div>
    </div>
  );
}
