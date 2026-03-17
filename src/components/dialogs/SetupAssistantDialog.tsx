import { Link } from "react-router-dom";
import { useSetupAssistant } from "../../hooks/useSetupAssistant";
import { ModalDialog } from "../common/ModalDialog";

export interface SetupAssistantDialogProps {
  open: boolean;
  onClose: () => void;
}

function translateStepTitle(id: string): string {
  if (id === "install") return "安装 OpenClaw";
  if (id === "config") return "配置 API Key";
  if (id === "service") return "启动 Gateway";
  if (id === "dashboard") return "打开 Dashboard";
  return id;
}

function translateStepAction(route: string): string {
  if (route === "/install?wizard=1") return "开始安装";
  if (route === "/config") return "去配置 API Key";
  if (route === "/service") return "去启动 Gateway";
  if (route === "/dashboard") return "去打开 Dashboard";
  return "继续";
}

export function SetupAssistantDialog({ open, onClose }: SetupAssistantDialogProps): JSX.Element | null {
  const { model, isLoading, errorText, refresh } = useSetupAssistant(open);
  const footerAction = model?.currentBlocker
    ? { route: model.currentBlocker.route, label: model.currentBlocker.actionLabel }
    : model
      ? { route: model.primaryRoute, label: model.primaryLabel }
      : null;

  return (
    <ModalDialog
      title="OpenClaw 设置助手"
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
            重新检查
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
      {isLoading ? <p style={{ margin: 0, color: "#475569" }}>正在读取当前步骤...</p> : null}
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
                当前先处理：{model.currentBlocker.title}
              </p>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              检查时间：{new Date(model.lastCheckedAt).toLocaleString()}
            </p>
          </section>

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
                      {index + 1}. {translateStepTitle(step.id)}
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
                        {translateStepAction(step.route)}
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
