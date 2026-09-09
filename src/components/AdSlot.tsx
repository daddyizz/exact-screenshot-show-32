import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type AdSlotProps = {
  id: string;
  format?: "leaderboard" | "rectangle" | "inline";
  className?: string;
  label?: string;
};

type AdPlacement = {
  id?: string;
  slot_key: string;
  headline: string;
  body?: string | null;
  image_url?: string | null;
  target_url: string;
  cta_label: string;
  opens_new_tab?: boolean;
};

const sizes: Record<NonNullable<AdSlotProps["format"]>, string> = {
  leaderboard: "min-h-[90px] md:min-h-[100px]",
  rectangle: "min-h-[250px]",
  inline: "min-h-[120px]",
};

const fallbackAds: Record<string, AdPlacement> = {
  "landing-mid": {
    slot_key: "landing-mid",
    headline: "Turn your next idea into a publish-ready article",
    body: "Create your BlogPilot workspace and start planning SEO content in minutes.",
    target_url: "/auth",
    cta_label: "Start free",
    opens_new_tab: false,
  },
  "app-top": {
    slot_key: "app-top",
    headline: "Keep your publishing workflow moving",
    body: "Connect Blogger, build your queue and manage your publishing settings from one workspace.",
    target_url: "/settings",
    cta_label: "Open settings",
    opens_new_tab: false,
  },
};

export function AdSlot({ id, format = "leaderboard", className, label }: AdSlotProps) {
  const adQuery = useQuery({
    queryKey: ["ad-placement", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ad_placements")
        .select("id, slot_key, headline, body, image_url, target_url, cta_label, opens_new_tab")
        .eq("slot_key", id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return null;
      return data as AdPlacement | null;
    },
    staleTime: 60_000,
    retry: false,
  });

  const ad = adQuery.data ?? fallbackAds[id] ?? null;

  if (!ad) {
    return (
      <aside
        data-ad-slot={id}
        aria-label={label ?? "Advertisement"}
        className={cn(
          "flex w-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-4 text-center",
          sizes[format],
          className,
        )}
      >
        <span className="text-[11px] tracking-[0.18em] text-muted-foreground/70 uppercase">
          {label ?? "Ad space"}
        </span>
      </aside>
    );
  }

  const external = /^https?:\/\//i.test(ad.target_url);
  const target = ad.opens_new_tab || external ? "_blank" : undefined;
  const rel = target === "_blank" ? "noopener noreferrer sponsored" : undefined;

  return (
    <aside data-ad-slot={id} aria-label={label ?? "Advertisement"} className={className}>
      <a
        href={ad.target_url}
        target={target}
        rel={rel}
        className={cn(
          "group flex w-full items-center gap-4 overflow-hidden rounded-xl border border-border bg-card px-4 py-4 shadow-sm transition hover:border-primary/40 hover:bg-accent/30",
          sizes[format],
          format === "rectangle" && "flex-col items-stretch",
        )}
      >
        {ad.image_url ? (
          <img
            src={ad.image_url}
            alt=""
            className={cn(
              "shrink-0 rounded-lg object-cover",
              format === "rectangle" ? "h-36 w-full" : "h-16 w-24 sm:h-20 sm:w-32",
            )}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Sponsored</p>
          <p className="mt-1 font-display text-sm font-semibold sm:text-base">{ad.headline}</p>
          {ad.body ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{ad.body}</p> : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
          {ad.cta_label}
          {target === "_blank" ? <ExternalLink className="size-3" aria-hidden /> : null}
        </span>
      </a>
    </aside>
  );
}

export default AdSlot;
