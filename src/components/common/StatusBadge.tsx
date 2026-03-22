import { cn } from "@/lib/utils";
import type { HealthLevel } from "../../types/status";
import type { GuidedSetupStepStatus } from "../../types/guidedSetup";
import type { WorkspaceBannerTone } from "../../types/workspace";

type BadgeVariant = HealthLevel | GuidedSetupStepStatus | WorkspaceBannerTone;

const variantStyles: Record<BadgeVariant, { className: string; label: string }> = {
  healthy:  { className: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400", label: "Healthy" },
  degraded: { className: "border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-300", label: "Degraded" },
  offline:  { className: "border-destructive/30 bg-destructive/10 text-destructive", label: "Offline" },
  unknown:  { className: "border-border bg-muted/30 text-muted-foreground", label: "Unknown" },
  complete: { className: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400", label: "Complete" },
  current:  { className: "border-primary/30 bg-primary/10 text-primary", label: "Current" },
  blocked:  { className: "border-border bg-muted/30 text-muted-foreground", label: "Blocked" },
  ready:    { className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-400", label: "Ready" },
  info:     { className: "border-primary/30 bg-primary/10 text-primary", label: "Info" },
  warning:  { className: "border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-300", label: "Warning" },
  error:    { className: "border-destructive/30 bg-destructive/10 text-destructive", label: "Error" },
  success:  { className: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400", label: "Ready" },
};

export interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps): JSX.Element {
  const style = variantStyles[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold",
        style.className,
      )}
    >
      {label ?? style.label}
    </span>
  );
}
