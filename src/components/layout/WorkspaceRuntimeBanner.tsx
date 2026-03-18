import { Link } from "react-router-dom";
import { StatusBadge } from "../common/StatusBadge";
import { SurfaceCard } from "../common/SurfaceCard";
import type { WorkspaceBannerModel } from "../../types/workspace";

export interface WorkspaceRuntimeBannerProps {
  model: WorkspaceBannerModel | null;
  isLoading: boolean;
  errorText: string | null;
}

function formatRuntimeModeLabel(mode: WorkspaceBannerModel["mode"]): string {
  if (mode === "preview") return "Browser Preview";
  if (mode === "runtime-unavailable") return "Desktop Runtime Unavailable";
  return "Live";
}

export function WorkspaceRuntimeBanner({
  model,
  isLoading,
  errorText,
}: WorkspaceRuntimeBannerProps): JSX.Element | null {
  if (isLoading && !model) {
    return (
      <SurfaceCard title="Workspace Runtime" subtitle="Loading current runtime and workflow summary...">
        {null}
      </SurfaceCard>
    );
  }

  if (errorText) {
    return (
      <SurfaceCard title="Workspace Runtime" subtitle={errorText}>
        {null}
      </SurfaceCard>
    );
  }

  if (!model) return null;

  return (
    <SurfaceCard
      title={model.headline}
      subtitle={model.summary}
      action={<StatusBadge variant={model.tone} label={formatRuntimeModeLabel(model.mode)} />}
      style={{
        background:
          model.tone === "error"
            ? "#fff7f7"
            : model.tone === "warning"
              ? "#fffdf4"
              : "#ffffff",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {model.meta.map((item) => (
          <div
            key={item.label}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#f8fafc",
              padding: 12,
              display: "grid",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 12, color: "#64748b" }}>{item.label}</span>
            <strong style={{ color: "#0f172a", overflowWrap: "anywhere" }}>{item.value}</strong>
          </div>
        ))}
      </div>

      {model.primaryAction ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ color: "#0f172a" }}>Primary Recommendation</strong>
            <span style={{ color: "#475569" }}>{model.primaryAction.description}</span>
          </div>
          <Link
            to={model.primaryAction.route}
            style={{
              borderRadius: 8,
              background: "#0f172a",
              color: "#ffffff",
              padding: "10px 14px",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            {model.primaryAction.label}
          </Link>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
