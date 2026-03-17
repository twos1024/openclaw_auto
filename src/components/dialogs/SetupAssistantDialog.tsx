import { Link } from "react-router-dom";
import { useSetupAssistant } from "../../hooks/useSetupAssistant";
import type { GuidedSetupStepStatus } from "../../types/guidedSetup";
import { ModalDialog } from "../common/ModalDialog";
import { StatusBadge } from "../common/StatusBadge";

const statusStyles: Record<GuidedSetupStepStatus, { bg: string; text: string; border: string; label: string }> = {
  complete: { bg: "#f0fdf4", text: "#166534", border: "#86efac", label: "Complete" },
  current: { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd", label: "Current" },
  blocked: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", label: "Blocked" },
  ready: { bg: "#ecfeff", text: "#155e75", border: "#67e8f9", label: "Ready" },
};

const launchCheckStyles = {
  healthy: { bg: "#f0fdf4", text: "#166534", border: "#86efac", label: "Healthy" },
  degraded: { bg: "#fffbeb", text: "#92400e", border: "#fcd34d", label: "Degraded" },
  offline: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", label: "Offline" },
  unknown: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", label: "Unknown" },
} as const;

export interface SetupAssistantDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SetupAssistantDialog({ open, onClose }: SetupAssistantDialogProps): JSX.Element | null {
  const { model, isLoading, errorText, refresh } = useSetupAssistant(open);

  return (
    <ModalDialog
      title="Setup Assistant"
      open={open}
      onClose={onClose}
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
            Run Launch Check
          </button>
          {model ? (
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
              Continue Setup
            </Link>
          ) : null}
        </>
      }
    >
      {isLoading ? <p style={{ margin: 0, color: "#475569" }}>Loading setup guidance...</p> : null}
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
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              Last checked: {new Date(model.lastCheckedAt).toLocaleString()}
            </p>
          </section>

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
              <h3 style={{ margin: 0 }}>Launch Check</h3>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                这里显示当前 install / config / service 的即时检查结果，用于决定下一步动作。
              </p>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {model.launchChecks.map((check) => {
                const style = launchCheckStyles[check.level];
                return (
                  <article
                    key={check.id}
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
                      <strong style={{ color: "#0f172a" }}>{check.title}</strong>
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
                    <p style={{ margin: 0, color: "#475569" }}>{check.detail}</p>
                    <div>
                      <Link
                        to={check.route}
                        onClick={onClose}
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
                );
              })}
            </div>
          </section>

          {model.currentBlocker ? (
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Current Blocker</h3>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    优先处理当前 blocker，再进入下一步。
                  </p>
                </div>
                <StatusBadge variant={model.currentBlocker.level} />
              </div>
              <strong style={{ color: "#0f172a" }}>{model.currentBlocker.title}</strong>
              <p style={{ margin: 0, color: "#475569" }}>{model.currentBlocker.detail}</p>
              <div>
                <Link
                  to={model.currentBlocker.route}
                  onClick={onClose}
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
            </section>
          ) : null}

          <div style={{ display: "grid", gap: 12 }}>
            {model.steps.map((step, index) => {
              const style = statusStyles[step.status];
              return (
                <article
                  key={step.id}
                  style={{
                    border: `1px solid ${style.border}`,
                    borderRadius: 12,
                    background: "#ffffff",
                    padding: 16,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong style={{ color: "#0f172a" }}>
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
              <h3 style={{ margin: 0 }}>Support Links</h3>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                当你不确定 fault 在哪里时，优先看 Runbook、Logs 和 Settings。
              </p>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {model.supportActions.map((action) => (
                <Link
                  key={action.id}
                  to={action.route}
                  onClick={onClose}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
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
          </section>
        </>
      ) : null}
    </ModalDialog>
  );
}
