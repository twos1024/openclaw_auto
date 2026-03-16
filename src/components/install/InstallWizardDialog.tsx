import { Link } from "react-router-dom";
import { buildInstallWizardModel, buildPlatformGuidance } from "../../services/installWizardService";
import type { InstallActionResult, InstallEnvironment } from "../../types/install";
import { ModalDialog } from "../common/ModalDialog";
import { PlatformGuidancePanel } from "./PlatformGuidancePanel";

const stepStyles = {
  complete: { bg: "#f0fdf4", text: "#166534", border: "#86efac", label: "Complete" },
  current: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd", label: "Current" },
  blocked: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", label: "Blocked" },
} as const;

export interface InstallWizardDialogProps {
  open: boolean;
  onClose: () => void;
  environment: InstallEnvironment | null;
  installResult: InstallActionResult | null;
}

export function InstallWizardDialog({
  open,
  onClose,
  environment,
  installResult,
}: InstallWizardDialogProps): JSX.Element | null {
  if (!open) return null;

  const model = buildInstallWizardModel({ environment, installResult });
  const cards = buildPlatformGuidance(environment?.platform);

  return (
    <ModalDialog
      title="Install Wizard"
      open={open}
      onClose={onClose}
      footer={
        <>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            当前平台：{environment ? `${environment.platform} / ${environment.architecture}` : "unknown"}
          </span>
          <Link
            to={model.primaryRoute}
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
            {model.primaryLabel}
          </Link>
        </>
      }
    >
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
      </section>

      <PlatformGuidancePanel cards={cards} />

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
          <h3 style={{ margin: 0 }}>Wizard Steps</h3>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            向导按依赖顺序推进。前置条件未完成时，后续步骤会被阻塞。
          </p>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {model.steps.map((step, index) => {
            const style = stepStyles[step.status];
            return (
              <article
                key={step.id}
                style={{
                  border: `1px solid ${style.border}`,
                  borderRadius: 12,
                  background: "#ffffff",
                  padding: 14,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <strong>
                    {index + 1}. {step.title}
                  </strong>
                  <span
                    style={{
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      background: style.bg,
                      color: style.text,
                      border: `1px solid ${style.border}`,
                    }}
                  >
                    {style.label}
                  </span>
                </div>
                <p style={{ margin: 0, color: "#475569" }}>{step.description}</p>
                <div>
                  <Link
                    to={step.route}
                    onClick={onClose}
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
            );
          })}
        </div>
      </section>
    </ModalDialog>
  );
}
