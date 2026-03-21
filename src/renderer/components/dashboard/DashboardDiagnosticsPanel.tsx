import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PlatformGuidanceCard } from "../../types/installWizard";
import type { DashboardDiagnosticsModel, DashboardEmbedPhase } from "../../types/dashboard";

type DashboardDiagnosticsPhase = DashboardEmbedPhase | "unavailable";

const phaseKeys: Record<DashboardDiagnosticsPhase, string> = {
  loading: "phase.loading",
  loaded: "phase.loaded",
  timeout: "phase.timeout",
  blocked: "phase.blocked",
  unavailable: "phase.unavailable",
};

const phaseColors: Record<DashboardDiagnosticsPhase, { bg: string; text: string; border: string }> = {
  loading: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  loaded: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  timeout: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74" },
  blocked: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
  unavailable: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1" },
};

const itemToneKeys = {
  healthy: { bg: "#f0fdf4", text: "#166534", border: "#86efac", label: "tone.healthy" },
  warning: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74", label: "tone.warning" },
  error: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", label: "tone.error" },
  neutral: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", label: "tone.neutral" },
} as const;

export interface DashboardDiagnosticsPanelProps {
  phase: DashboardDiagnosticsPhase;
  platformCard: PlatformGuidanceCard | null;
  model: DashboardDiagnosticsModel;
}

export function DashboardDiagnosticsPanel({ phase, platformCard, model }: DashboardDiagnosticsPanelProps): JSX.Element {
  const { t } = useTranslation("dashboard");
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
        <h3 style={{ margin: 0 }}>{t("title")}</h3>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          {t("description")}
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
          {t("embedPhase", { value: t(phaseKeys[phase]) })}
        </span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {model.items.map((item) => {
          const tone = itemToneKeys[item.tone];
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
                  {t(tone.label)}
                </span>
              </div>
              <p style={{ margin: 0, color: "#475569" }}>{item.detail}</p>
              {item.meta ? (
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{item.meta}</p>
              ) : null}
            </article>
          );
        })}
        {model.recommendedAction ? (
          <article
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              background: "#f8fafc",
              padding: 14,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <strong style={{ color: "#0f172a" }}>{t("recommendedAction.title")}</strong>
              <span
                style={{
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #93c5fd",
                }}
              >
                {t("recommendedAction.next")}
              </span>
            </div>
            <p style={{ margin: 0, color: "#475569" }}>{model.recommendedAction.detail}</p>
            <div>
              <Link
                to={model.recommendedAction.route}
                style={{
                  borderRadius: 8,
                  background: "#0f172a",
                  color: "#ffffff",
                  padding: "8px 12px",
                  textDecoration: "none",
                  fontWeight: 700,
                  display: "inline-block",
                }}
              >
                {model.recommendedAction.label}
              </Link>
            </div>
          </article>
        ) : null}
        <p style={{ margin: 0, color: "#475569" }}>
          <strong>{t("platform.label")}:</strong> {platformCard?.title ?? t("platform.unknown")}
        </p>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          {model.platformNote}
        </p>
      </div>
    </section>
  );
}
