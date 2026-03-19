import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSetupAssistant } from "../../hooks/useSetupAssistant";
import { ModalDialog } from "../common/ModalDialog";
import { RunbookLaunchChecks } from "../runbook/RunbookLaunchChecks";

export interface SetupAssistantDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SetupAssistantDialog({ open, onClose }: SetupAssistantDialogProps): JSX.Element | null {
  const { t } = useTranslation("runbook");
  const { model, isLoading, errorText, refresh } = useSetupAssistant(open);
  const footerAction = model?.currentBlocker
    ? { route: model.currentBlocker.route, label: model.currentBlocker.actionLabel }
    : model
      ? { route: model.primaryRoute, label: model.primaryLabel }
      : null;

  return (
    <ModalDialog
      title={t("assistant.title")}
      open={open}
      onClose={onClose}
      width={920}
      footer={
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#ffffff",
              color: "#0f172a",
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("assistant.refresh")}
          </button>
          {footerAction ? (
            <Link
              to={footerAction.route}
              onClick={onClose}
              style={{
                borderRadius: 8,
                background: "#0f172a",
                color: "#ffffff",
                padding: "10px 14px",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              {footerAction.label}
            </Link>
          ) : null}
        </>
      }
    >
      {isLoading ? <p style={{ margin: 0, color: "#475569" }}>{t("assistant.loading")}</p> : null}
      {errorText ? (
        <section
          style={{
            border: "1px solid #fca5a5",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#991b1b",
            padding: 14,
          }}
        >
          {errorText}
        </section>
      ) : null}
      {model ? (
        <>
          <section
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              background: "#f8fafc",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <strong style={{ color: "#0f172a" }}>{model.headline}</strong>
            <p style={{ margin: 0, color: "#475569" }}>{model.summary}</p>
            {model.currentBlocker ? (
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                {t("assistant.currentBlocker")}
                {model.currentBlocker.title}
              </p>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              {t("assistant.checkedAt")}{new Date(model.lastCheckedAt).toLocaleString()}
            </p>
          </section>

          <RunbookLaunchChecks model={model} />

          <div style={{ display: "grid", gap: 12 }}>
            {model.steps.map((step, index) => {
              const active = step.status === "current" || step.status === "ready";
              return (
                <article
                  key={step.id}
                  style={{
                    border: active ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                    borderRadius: 12,
                    background: active ? "#eff6ff" : "#ffffff",
                    padding: 16,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong style={{ color: "#0f172a" }}>
                      {index + 1}. {step.title}
                    </strong>
                  </div>
                  <p style={{ margin: 0, color: "#475569" }}>{step.description}</p>
                  {step.status === "current" || step.status === "ready" ? (
                    <div>
                      <Link
                        to={step.route}
                        onClick={onClose}
                        style={{
                          borderRadius: 8,
                          padding: "8px 12px",
                          textDecoration: "none",
                          fontWeight: 700,
                          color: "#ffffff",
                          background: "#0f172a",
                          display: "inline-block",
                        }}
                      >
                        {step.actionLabel}
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </ModalDialog>
  );
}
