import type { HealthLevel } from "../../types/status";
import type { GuidedSetupStepStatus } from "../../types/guidedSetup";
import type { WorkspaceBannerTone } from "../../types/workspace";

type BadgeVariant = HealthLevel | GuidedSetupStepStatus | WorkspaceBannerTone;

const toneMap: Record<BadgeVariant, { bg: string; border: string; text: string; label: string }> = {
  healthy: { bg: "#f0fdf4", border: "#86efac", text: "#166534", label: "Healthy" },
  degraded: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", label: "Degraded" },
  offline: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", label: "Offline" },
  unknown: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", label: "Unknown" },
  complete: { bg: "#f0fdf4", border: "#86efac", text: "#166534", label: "Complete" },
  current: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", label: "Current" },
  blocked: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", label: "Blocked" },
  ready: { bg: "#ecfeff", border: "#67e8f9", text: "#155e75", label: "Ready" },
  info: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", label: "Info" },
  warning: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", label: "Warning" },
  error: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", label: "Error" },
  success: { bg: "#f0fdf4", border: "#86efac", text: "#166534", label: "Ready" },
};

export interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps): JSX.Element {
  const style = toneMap[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label ?? style.label}
    </span>
  );
}
