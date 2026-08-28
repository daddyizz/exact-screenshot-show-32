import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Button for paid / not-yet-enabled capabilities. It renders like a real
 * control but intentionally does nothing when pressed.
 */
export function ComingSoonButton({
  children,
  className,
  variant = "secondary",
  size,
}: {
  children: ReactNode;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-disabled="true"
      title="Coming soon"
      onClick={(event) => event.preventDefault()}
      className={cn("relative", className)}
    >
      <Lock aria-hidden />
      {children}
      <span className="text-eyebrow ml-1 hidden sm:inline">soon</span>
    </Button>
  );
}

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-primary/40 text-primary", className)}>
      Coming soon
    </Badge>
  );
}
