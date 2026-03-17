import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { InstallEnvironmentPanel } from "../components/install/InstallEnvironmentPanel";
import { InstallIssueCard } from "../components/install/InstallIssueCard";
import { InstallPhaseTimeline } from "../components/install/InstallPhaseTimeline";
import { InstallProgressCard } from "../components/install/InstallProgressCard";
import { InstallResultCard } from "../components/install/InstallResultCard";
import { InstallWizardDialog } from "../components/install/InstallWizardDialog";
import { PlatformGuidancePanel } from "../components/install/PlatformGuidancePanel";
import { NoticeBanner } from "../components/common/NoticeBanner";
import { PageHero } from "../components/common/PageHero";
import { RunbookContextPanel } from "../components/runbook/RunbookContextPanel";
import { useRunbook } from "../hooks/useRunbook";
import { useInstallFlow } from "../hooks/useInstallFlow";
import { buildPlatformGuidance } from "../services/installWizardService";

export function InstallPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const { model: runbookModel, status: runbookStatus } = useRunbook(true, 30000);
  const {
    environment,
    envError,
    installResult,
    phases,
    installProgress,
    isLoading,
    isInstalling,
    refreshEnvironment,
    installOpenClaw,
  } = useInstallFlow();
  const installBlockedByEnv = Boolean(environment && !environment.npmFound);
  const runtimeBlockMode =
    envError?.code === "E_PREVIEW_MODE"
      ? "preview"
      : envError?.code === "E_TAURI_UNAVAILABLE"
        ? "runtime-unavailable"
        : null;
  const visibleIssue = installResult?.issue ?? installResult?.data?.gatewayInstallIssue ?? null;
  const platformCards = buildPlatformGuidance(environment?.platform);
  const configReady = runbookStatus?.config.level === "healthy";
  const serviceReady = runbookStatus?.service.level === "healthy";
  const isWizardOpen = searchParams.get("wizard") === "1";
  const openWizard = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set("wizard", "1");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);
  const closeWizard = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("wizard");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);
  const nextStepState = runtimeBlockMode
    ? {
        title: "先修复运行环境",
        description: "当前不是可执行本机安装的桌面环境。先切到桌面运行时，再继续。",
        actionLabel: "打开设置",
        route: "/settings",
      }
    : serviceReady
      ? {
          title: "已经可以开始使用",
          description: "OpenClaw 已经安装并启动完成，现在直接打开 Dashboard 即可。",
          actionLabel: "打开 Dashboard",
          route: "/dashboard",
        }
      : configReady
        ? {
            title: "下一步：启动 Gateway",
            description: "API Key 已保存。现在去启动 Gateway，然后就可以开始使用。",
            actionLabel: "启动 Gateway",
            route: "/service",
          }
      : installResult?.status === "success" || installResult?.status === "warning"
      ? {
          title: "安装已完成",
          description: "下一步只做一件事：去配置 API Key，然后保存。",
          actionLabel: "配置 API Key",
          route: "/config",
        }
      : installBlockedByEnv
        ? {
            title: "先补齐 npm",
            description: "安装前先把 Node.js / npm 装好，然后回到这里刷新环境。",
            actionLabel: "刷新环境",
            onClick: () => void refreshEnvironment(),
          }
        : {
            title: "开始安装",
            description: "打开向导，按提示完成 OpenClaw 安装。",
            actionLabel: "打开安装向导",
            onClick: openWizard,
          };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHero
        title="安装 OpenClaw"
        description="先完成安装，再填 API Key，最后启动 Gateway。这个页面把新手需要做的事收成一条线。"
        meta={environment ? `Platform: ${environment.platform} / ${environment.architecture}` : undefined}
        action={
          <button
            type="button"
            onClick={openWizard}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            打开安装向导
          </button>
        }
      />

      <section
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <strong style={{ color: "#0f172a" }}>{nextStepState.title}</strong>
        <p style={{ margin: 0, color: "#475569" }}>{nextStepState.description}</p>
        <div>
          {"route" in nextStepState ? (
            <Link
              to={nextStepState.route}
              style={{
                display: "inline-block",
                borderRadius: 8,
                background: "#0f172a",
                color: "#ffffff",
                padding: "10px 14px",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              {nextStepState.actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={nextStepState.onClick}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#0f172a",
                color: "#ffffff",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {nextStepState.actionLabel}
            </button>
          )}
        </div>
      </section>

      {envError ? (
        <NoticeBanner title="环境探测失败" tone="error">
          <p style={{ margin: "8px 0 0" }}>{envError.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>建议：{envError.suggestion}</p>
        </NoticeBanner>
      ) : null}

      <RunbookContextPanel
        title="当前步骤"
        description="只看当前一步，别同时处理安装、配置和服务。"
        model={runbookModel}
      />

      <InstallEnvironmentPanel
        environment={environment}
        isLoading={isLoading}
        isInstalling={isInstalling}
        installBlockedByEnv={installBlockedByEnv}
        runtimeBlockMode={runtimeBlockMode}
        onRefresh={() => void refreshEnvironment()}
        onInstall={() => void installOpenClaw()}
      />

      <PlatformGuidancePanel cards={platformCards} />

      <InstallProgressCard progress={installProgress} />

      <InstallPhaseTimeline phases={phases} activePhaseId={installProgress.activePhaseId} />

      <InstallResultCard result={installResult} />

      {visibleIssue ? <InstallIssueCard issue={visibleIssue} /> : null}

      <NoticeBanner title="安装顺序" tone="info">
        <p style={{ margin: 0, color: "#475569" }}>
          先安装 OpenClaw，再去 Config 填 API Key，保存后到 Service 启动 Gateway。
        </p>
      </NoticeBanner>

      <InstallWizardDialog
        open={isWizardOpen}
        onClose={closeWizard}
        environment={environment}
        installResult={installResult}
        configReady={configReady}
        serviceReady={serviceReady}
      />
    </div>
  );
}
