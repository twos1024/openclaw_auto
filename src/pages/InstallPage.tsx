import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
  const { model: runbookModel } = useRunbook(true, 30000);
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHero
        title="Install OpenClaw"
        description="Install page now combines environment preflight, staged install progress, result handling, and direct next-step guidance into a single workflow."
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
            Open Install Wizard
          </button>
        }
      />

      {envError ? (
        <NoticeBanner title="环境探测失败" tone="error">
          <p style={{ margin: "8px 0 0" }}>{envError.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>建议：{envError.suggestion}</p>
        </NoticeBanner>
      ) : null}

      <RunbookContextPanel
        title="Install Workflow Context"
        description="The install page is responsible for the first blocker in most cold-start scenarios. Use the current blocker and quick links below to decide whether to stay here or jump to logs/settings."
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

      <NoticeBanner title="Recommended Flow" tone="info">
        <p style={{ margin: 0, color: "#475569" }}>1. Refresh environment to confirm npm availability and current OpenClaw detection.</p>
        <p style={{ margin: "8px 0 0", color: "#475569" }}>2. Start install and watch the progress card for the active phase and estimated completion state.</p>
        <p style={{ margin: "8px 0 0", color: "#475569" }}>3. After success or warning, continue to Config to save provider settings, then start Gateway from Service.</p>
      </NoticeBanner>

      <InstallWizardDialog
        open={isWizardOpen}
        onClose={closeWizard}
        environment={environment}
        installResult={installResult}
      />
    </div>
  );
}
