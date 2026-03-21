import { useTranslation } from "react-i18next";
import type { InstallPhase, InstallPhaseStatus } from "../../types/install";

const statusStyles: Record<InstallPhaseStatus, { bg: string; color: string; border: string }> = {
  success: { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
  warning: { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  failure: { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
  pending: { bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
  running: { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
};

function StatusBadge({ status }: { status: InstallPhaseStatus }): JSX.Element {
  const { t } = useTranslation(["install"]);
  const style = statusStyles[status];
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {t(`install:phase.status.${status}`)}
    </span>
  );
}

export interface InstallPhaseTimelineProps {
  phases: InstallPhase[];
  activePhaseId?: InstallPhase["id"] | null;
}

export function InstallPhaseTimeline({ phases, activePhaseId = null }: InstallPhaseTimelineProps): JSX.Element {
  const { t } = useTranslation(["install"]);
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
        <h3 style={{ margin: 0 }}>{t("install:phase.title")}</h3>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {phases.map((phase, index) => {
          const isActive = phase.id === activePhaseId || phase.status === "running";
          return (
            <article
              key={phase.id}
              style={{
                border: isActive ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 12,
                display: "grid",
                gap: 6,
                background: isActive ? "#f8fbff" : "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <strong style={{ color: "#0f172a" }}>{index + 1}. {phase.title}</strong>
                <StatusBadge status={phase.status} />
              </div>
              <p style={{ margin: 0, color: "#334155" }}>{phase.detail}</p>
              {phase.status === "failure" || phase.status === "warning" ? (
                <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{phase.suggestion}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
