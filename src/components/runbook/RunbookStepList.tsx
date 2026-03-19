import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../common/StatusBadge";
import { SurfaceCard } from "../common/SurfaceCard";
import type { RunbookModel } from "../../types/workspace";

export interface RunbookStepListProps {
  model: RunbookModel;
}

export function RunbookStepList({ model }: RunbookStepListProps): JSX.Element {
  const { t } = useTranslation("runbook");
  return (
    <SurfaceCard
      title={t("stepList.title")}
      subtitle={t("stepList.subtitle")}
    >
      <div style={{ display: "grid", gap: 12 }}>
        {model.steps.map((step, index) => (
          <article
            key={step.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              background: "#ffffff",
              padding: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <strong style={{ color: "#0f172a" }}>
                {index + 1}. {step.title}
              </strong>
              <StatusBadge variant={step.status} />
            </div>
            <p style={{ margin: 0, color: "#475569" }}>{step.description}</p>
            <div>
              <Link
                to={step.route}
                style={{
                  borderRadius: 8,
                  padding: "8px 12px",
                  textDecoration: "none",
                  fontWeight: 700,
                  color: step.status === "blocked" ? "#475569" : "#ffffff",
                  background: step.status === "blocked" ? "#e2e8f0" : "#0f172a",
                  pointerEvents: step.status === "blocked" ? "none" : "auto",
                  display: "inline-block",
                }}
              >
                {step.actionLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SurfaceCard>
  );
}
