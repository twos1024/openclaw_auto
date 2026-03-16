import { Link } from "react-router-dom";
import type { HealthLevel, OverviewSection } from "../../types/status";

const levelColorMap: Record<HealthLevel, string> = {
  healthy: "#16a34a",
  degraded: "#d97706",
  offline: "#dc2626",
  unknown: "#6b7280",
};

function StatusBadge({ level }: { level: HealthLevel }): JSX.Element {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        color: "#ffffff",
        background: levelColorMap[level],
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {level}
    </span>
  );
}

export interface OverviewSectionCardProps {
  section: OverviewSection;
}

export function OverviewSectionCard({ section }: OverviewSectionCardProps): JSX.Element {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "#1e293b" }}>{section.title}</h3>
        <StatusBadge level={section.level} />
      </div>

      <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{section.detail}</p>

      {section.meta?.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {section.meta.map((item) => (
            <div key={`${section.id}-${item.label}`} style={{ fontSize: 13, color: "#334155" }}>
              <strong>{item.label}:</strong> {item.value}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          Updated: {new Date(section.updatedAt).toLocaleString()}
        </span>
        <Link
          to={section.route}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1d4ed8",
            textDecoration: "none",
          }}
        >
          {section.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
