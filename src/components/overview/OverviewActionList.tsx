import { Link } from "react-router-dom";
import type { OverviewAction } from "../../types/status";

export interface OverviewActionListProps {
  actions: OverviewAction[];
  actionLoadingId?: string | null;
  onAction?: (action: OverviewAction) => void;
}

export function OverviewActionList({
  actions,
  actionLoadingId,
  onAction,
}: OverviewActionListProps): JSX.Element {
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
        <h3 style={{ margin: 0, color: "#0f172a" }}>Recommended Next Actions</h3>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          按当前健康状态排序。先处理靠前动作，通常能最快恢复可用链路。
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {actions.map((action, index) => (
          <article
            key={action.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#0f172a" }}>
                {index + 1}. {action.label}
              </strong>
              <span style={{ color: "#475569", fontSize: 14 }}>{action.description}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {action.kind === "open-dashboard" ? (
                <button
                  type="button"
                  onClick={() => onAction?.(action)}
                  disabled={actionLoadingId === action.id}
                  style={{
                    whiteSpace: "nowrap",
                    borderRadius: 8,
                    border: "none",
                    background: "#0f172a",
                    color: "#ffffff",
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: actionLoadingId === action.id ? "not-allowed" : "pointer",
                    opacity: actionLoadingId === action.id ? 0.7 : 1,
                  }}
                >
                  {actionLoadingId === action.id ? "处理中..." : action.label}
                </button>
              ) : (
                <Link
                  to={action.route}
                  style={{
                    whiteSpace: "nowrap",
                    borderRadius: 8,
                    background: "#0f172a",
                    color: "#ffffff",
                    padding: "8px 12px",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Go
                </Link>
              )}

              {action.kind === "open-dashboard" ? (
                <Link
                  to={action.route}
                  style={{
                    whiteSpace: "nowrap",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    color: "#0f172a",
                    padding: "8px 12px",
                    textDecoration: "none",
                    fontWeight: 600,
                    background: "#ffffff",
                  }}
                >
                  Service
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
