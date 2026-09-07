import { cn } from "@/lib/utils";

type AdSlotProps = {
  /** Stable identifier, e.g. "landing-hero" — used later when wiring a real ad network. */
  id: string;
  /** Visual footprint of the placeholder. */
  format?: "leaderboard" | "rectangle" | "inline";
  className?: string;
  label?: string;
};

const sizes: Record<NonNullable<AdSlotProps["format"]>, string> = {
  leaderboard: "min-h-[90px] md:min-h-[100px]",
  rectangle: "min-h-[250px]",
  inline: "min-h-[120px]",
};

/**
 * Empty, reserved advertising slot (AdSense or any other network).
 * Render the network script/ins tag inside this container when ads go live.
 */
export function AdSlot({ id, format = "leaderboard", className, label }: AdSlotProps) {
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

export default AdSlot;
