import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Gauge, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getMyPlanUsage } from "@/lib/account.functions";

export function PlanUsageCard() {
  const planFn = useServerFn(getMyPlanUsage);
  const plan = useQuery({
    queryKey: ["my-plan-usage"],
    queryFn: () => planFn(),
    retry: false,
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
            {data.isAdmin ? <Badge variant="outline">ADMIN</Badge> : null}
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
