import type { DashboardEmbedPhase } from "../../types/dashboard";
import type { PlatformGuidanceCard } from "../../types/installWizard";

const phaseLabels: Record<DashboardEmbedPhase, string> = {
  loading: "Loading",
  loaded: "Loaded",
  timeout: "Timeout",
  blocked: "Blocked",
};

const phaseColors: Record<DashboardEmbedPhase, { bg: string; text: string; border: string }> = {
  loading: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  loaded: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  timeout: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74" },
  blocked: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
};

export interface DashboardDiagnosticsPanelProps {
  phase: DashboardEmbedPhase;
  address: string | null;
  statusDetail: string;
  platformCard: PlatformGuidanceCard | null;
}

export function DashboardDiagnosticsPanel({
  phase,
  address,
  statusDetail,
  platformCard,
}: DashboardDiagnosticsPanelProps): JSX.Element {
  const color = phaseColors[phase];

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>Dashboard Diagnostics</h3>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          查看当前内嵌阶段、端点信息和当前平台上的排障重点。
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 700,
            background: color.bg,
            color: color.text,
            border: `1px solid ${color.border}`,
          }}
        >
          Embed Phase: {phaseLabels[phase]}
        </span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, color: "#475569" }}>
          <strong>Endpoint:</strong> {address ?? "-"}
        </p>
        <p style={{ margin: 0, color: "#475569" }}>
          <strong>Status:</strong> {statusDetail}
        </p>
        <p style={{ margin: 0, color: "#475569" }}>
          <strong>Platform:</strong> {platformCard?.title ?? "Unknown"}
        </p>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          {platformCard?.troubleshooting ??
            "若内嵌页面加载异常，优先检查 Gateway 状态、iframe 安全策略和本地端口连通性。"}
        </p>
      </div>
    </section>
  );
}
