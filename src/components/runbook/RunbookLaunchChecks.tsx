import { Link } from "react-router-dom";
import { StatusBadge } from "../common/StatusBadge";
import { SurfaceCard } from "../common/SurfaceCard";
import type { RunbookModel } from "../../types/workspace";

export interface RunbookLaunchChecksProps {
  model: RunbookModel;
}

export function RunbookLaunchChecks({ model }: RunbookLaunchChecksProps): JSX.Element {
  return (
    <SurfaceCard
      title="Launch Checks"
      subtitle="These checks decide whether setup can continue cleanly from install to dashboard."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {model.launchChecks.map((check) => (
          <article
            key={check.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              background: "#ffffff",
              padding: 14,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <strong style={{ color: "#0f172a" }}>{check.title}</strong>
              <StatusBadge variant={check.level} />
            </div>
            <p style={{ margin: 0, color: "#475569" }}>{check.detail}</p>
            <div>
              <Link
                to={check.route}
                style={{
                  borderRadius: 8,
                  padding: "8px 12px",
                  textDecoration: "none",
                  fontWeight: 700,
                  color: "#0f172a",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  display: "inline-block",
                }}
              >
                Open
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SurfaceCard>
  );
}
