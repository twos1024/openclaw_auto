import { Link } from "react-router-dom";
import { StatusBadge } from "../common/StatusBadge";
import { SurfaceCard } from "../common/SurfaceCard";
import type { RunbookModel } from "../../types/workspace";

export interface RunbookContextPanelProps {
  title: string;
  description: string;
  model: RunbookModel | null;
}

export function RunbookContextPanel({
  title,
  description,
  model,
}: RunbookContextPanelProps): JSX.Element | null {
  if (!model) return null;

  return (
    <SurfaceCard title={title} subtitle={description}>
      {model.currentBlocker ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            background: "#f8fafc",
            padding: 14,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <strong style={{ color: "#0f172a" }}>{model.currentBlocker.title}</strong>
            <StatusBadge variant={model.currentBlocker.level} />
          </div>
          <p style={{ margin: 0, color: "#475569" }}>{model.currentBlocker.detail}</p>
          <div>
            <Link
              to={model.currentBlocker.route}
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
              {model.currentBlocker.actionLabel}
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #86efac",
            borderRadius: 12,
            background: "#f0fdf4",
            padding: 14,
            color: "#166534",
          }}
        >
          当前没有明确 blocker，可以按当前任务直接进入相关页面继续操作。
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {model.supportActions.map((action) => (
          <Link
            key={action.id}
            to={action.route}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              background: "#ffffff",
              padding: 12,
              textDecoration: "none",
              display: "grid",
              gap: 6,
            }}
          >
            <strong style={{ color: "#0f172a" }}>{action.label}</strong>
            <span style={{ color: "#475569" }}>{action.description}</span>
          </Link>
        ))}
      </div>
    </SurfaceCard>
  );
}
