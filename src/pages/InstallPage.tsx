import { InstallEnvironmentPanel } from "../components/install/InstallEnvironmentPanel";
import { InstallIssueCard } from "../components/install/InstallIssueCard";
import { InstallPhaseTimeline } from "../components/install/InstallPhaseTimeline";
import { InstallProgressCard } from "../components/install/InstallProgressCard";
import { InstallResultCard } from "../components/install/InstallResultCard";
import { useInstallFlow } from "../hooks/useInstallFlow";

export function InstallPage(): JSX.Element {
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
  const visibleIssue = installResult?.issue ?? installResult?.data?.gatewayInstallIssue ?? null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 8 }}>Install OpenClaw</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          安装 OpenClaw CLI，尝试托管 Gateway 安装，并在同一页面里查看当前阶段、结果和下一步建议。
        </p>
      </header>

      {envError ? (
        <section
          style={{
            border: "1px solid #fca5a5",
            borderRadius: 10,
            background: "#fef2f2",
            color: "#991b1b",
            padding: 12,
          }}
        >
          <strong>环境探测失败</strong>
          <p style={{ margin: "8px 0 0" }}>{envError.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>建议：{envError.suggestion}</p>
        </section>
      ) : null}

      <InstallEnvironmentPanel
        environment={environment}
        isLoading={isLoading}
        isInstalling={isInstalling}
        installBlockedByEnv={installBlockedByEnv}
        onRefresh={() => void refreshEnvironment()}
        onInstall={() => void installOpenClaw()}
      />

      <InstallProgressCard progress={installProgress} />

      <InstallPhaseTimeline phases={phases} activePhaseId={installProgress.activePhaseId} />

      <InstallResultCard result={installResult} />

      {visibleIssue ? <InstallIssueCard issue={visibleIssue} /> : null}

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
        <h3 style={{ margin: 0 }}>Recommended Flow</h3>
        <p style={{ margin: 0, color: "#475569" }}>1. Refresh environment to confirm npm availability and current OpenClaw detection.</p>
        <p style={{ margin: 0, color: "#475569" }}>2. Start install and watch the progress card for the active phase and estimated completion state.</p>
        <p style={{ margin: 0, color: "#475569" }}>3. After success or warning, continue to Config to save provider settings, then start Gateway from Service.</p>
      </section>
    </div>
  );
}
