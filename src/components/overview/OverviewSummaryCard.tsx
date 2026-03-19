import { useTranslation } from "react-i18next";
import type { HealthLevel, OverviewOverall } from "../../types/status";

const levelColorMap: Record<HealthLevel, string> = {
  healthy: "#16a34a",
  degraded: "#d97706",
  offline: "#dc2626",
  unknown: "#6b7280",
};

function StatusBadge({ level }: { level: HealthLevel }): JSX.Element {
  const { t } = useTranslation("overview");
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        color: "#ffffff",
        background: levelColorMap[level],
        borderRadius: 999,
        padding: "4px 10px",
      }}
    >
      {t(`level.${level}`)}
    </span>
  );
}

export interface OverviewSummaryCardProps {
  overall: OverviewOverall;
  platform: string;
  appVersion: string;
  dashboardUrl: string;
}

export function OverviewSummaryCard({
  overall,
  platform,
  appVersion,
  dashboardUrl,
}: OverviewSummaryCardProps): JSX.Element {
  const { t } = useTranslation("overview");

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 18,
        background: "#ffffff",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            {t("summary.title")}
          </p>
          <h3 style={{ margin: "6px 0 0", fontSize: 24, color: "#0f172a" }}>{overall.headline}</h3>
        </div>
        <StatusBadge level={overall.level} />
      </div>

      <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{overall.summary}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ borderRadius: 10, background: "#f8fafc", padding: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{t("summary.fields.appVersion")}</div>
          <strong style={{ color: "#0f172a" }}>{appVersion}</strong>
        </div>
        <div style={{ borderRadius: 10, background: "#f8fafc", padding: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{t("summary.fields.platform")}</div>
          <strong style={{ color: "#0f172a" }}>{platform}</strong>
        </div>
        <div style={{ borderRadius: 10, background: "#f8fafc", padding: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{t("summary.fields.dashboard")}</div>
          <strong style={{ color: "#0f172a", wordBreak: "break-all" }}>{dashboardUrl}</strong>
        </div>
      </div>
    </section>
  );
}
