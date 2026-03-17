import type { PlatformGuidanceCard } from "../../types/installWizard";
import type { DashboardDiagnosticsModel, DashboardEmbedPhase } from "../../types/dashboard";

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

const itemTones = {
  healthy: { bg: "#f0fdf4", text: "#166534", border: "#86efac", label: "Healthy" },
  warning: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74", label: "Warning" },
  error: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", label: "Error" },
  neutral: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", label: "Pending" },
} as const;

export interface DashboardDiagnosticsPanelProps {
  phase: DashboardEmbedPhase;
  platformCard: PlatformGuidanceCard | null;
  model: DashboardDiagnosticsModel;
}

export function DashboardDiagnosticsPanel({ phase, platformCard, model }: DashboardDiagnosticsPanelProps): JSX.Element {
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
        {model.items.map((item) => {
          const tone = itemTones[item.tone];
          return (
            <article
              key={item.id}
              style={{
                border: `1px solid ${tone.border}`,
                borderRadius: 12,
                background: "#ffffff",
                padding: 14,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <strong style={{ color: "#0f172a" }}>{item.title}</strong>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    background: tone.bg,
                    color: tone.text,
                    border: `1px solid ${tone.border}`,
                  }}
                >
                  {tone.label}
                </span>
              </div>
              <p style={{ margin: 0, color: "#475569" }}>{item.detail}</p>
              {item.meta ? (
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{item.meta}</p>
              ) : null}
            </article>
          );
        })}
        <p style={{ margin: 0, color: "#475569" }}>
          <strong>Platform:</strong> {platformCard?.title ?? "Unknown"}
        </p>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          {model.platformNote}
        </p>
      </div>
    </section>
  );
}
