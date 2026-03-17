import { Link } from "react-router-dom";
import { buildInstallWizardModel, currentPlatformCard } from "../../services/installWizardService";
import type { InstallActionResult, InstallEnvironment } from "../../types/install";
import { ModalDialog } from "../common/ModalDialog";

export interface InstallWizardDialogProps {
  open: boolean;
  onClose: () => void;
  environment: InstallEnvironment | null;
  installResult: InstallActionResult | null;
  configReady?: boolean;
  serviceReady?: boolean;
}

function translateStepTitle(id: string): string {
  if (id === "environment") return "检查环境";
  if (id === "install") return "安装 OpenClaw";
  if (id === "config") return "配置 API Key";
  if (id === "service") return "启动 Gateway";
  if (id === "dashboard") return "打开 Dashboard";
  return id;
}

function translatePrimaryLabel(route: string, fallback: string): string {
  if (route === "/install?wizard=1") return "开始安装";
  if (route === "/config") return "去配置 API Key";
  if (route === "/service") return "启动 Gateway";
  if (route === "/dashboard") return "打开 Dashboard";
  return fallback;
}

export function InstallWizardDialog({
  open,
  onClose,
  environment,
  installResult,
  configReady = false,
  serviceReady = false,
}: InstallWizardDialogProps): JSX.Element | null {
  if (!open) return null;

  const model = buildInstallWizardModel({ environment, installResult, configReady, serviceReady });
  const platform = currentPlatformCard(environment?.platform);
  const currentStep = model.steps.find((step) => step.status === "current") ?? model.steps[0] ?? null;
  const currentIndex = currentStep ? model.steps.findIndex((step) => step.id === currentStep.id) : -1;
  const nextStep = currentIndex >= 0 ? model.steps[currentIndex + 1] ?? null : null;

  return (
    <ModalDialog
      title="OpenClaw 安装向导"
      open={open}
      onClose={onClose}
      footer={
        <>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {currentStep ? `现在先做：${translateStepTitle(currentStep.id)}` : "准备开始安装"}
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
            {translatePrimaryLabel(model.primaryRoute, model.primaryLabel)}
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
        {currentStep ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            现在只需要完成这一件事：{translateStepTitle(currentStep.id)}
          </p>
        ) : null}
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>按这个顺序走就行</h3>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            这不是诊断页，只保留新手需要的安装路径。
          </p>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {model.steps.map((step, index) => {
            const active = currentStep?.id === step.id;
            const done = step.status === "complete";
            return (
              <div
                key={step.id}
                style={{
                  border: active ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: active ? "#eff6ff" : "#f8fafc",
                  padding: 12,
                  display: "grid",
                  gap: 4,
                }}
              >
                <strong style={{ color: "#0f172a" }}>
                  {index + 1}. {translateStepTitle(step.id)}
                  {done ? " - 已完成" : active ? " - 现在做" : ""}
                </strong>
                <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0 }}>装完以后怎么继续</h3>
        <p style={{ margin: 0, color: "#475569" }}>
          1. 保存 Provider 配置，填好 API Key。2. 启动 Gateway。3. 打开 Dashboard 开始使用。
        </p>
        {nextStep ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            完成当前步骤后，下一步是：{translateStepTitle(nextStep.id)}
          </p>
        ) : null}
        {platform ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            平台提示：{platform.title} | {platform.installSource} | {platform.pathHint}
          </p>
        ) : null}
      </section>
    </ModalDialog>
  );
}
