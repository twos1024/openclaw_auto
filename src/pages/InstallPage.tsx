import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

type NextStepState =
  | {
      title: string;
      description: string;
      actionLabel: string;
      route: string;
    }
  | {
      title: string;
      description: string;
      actionLabel: string;
      onClick: () => void;
    };

export function InstallPage(): JSX.Element {
  const { t } = useTranslation(["common", "install"]);
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
  const runtimeBlockMode =
    envError?.code === "E_PREVIEW_MODE"
      ? "preview"
      : envError?.code === "E_TAURI_UNAVAILABLE"
        ? "runtime-unavailable"
        : null;
  const visibleIssue = installResult?.issue ?? installResult?.data?.gatewayInstallIssue ?? null;
  const platformCards = buildPlatformGuidance(environment?.platform);
  const configReady = runbookModel?.launchChecks.find((check) => check.id === "config")?.level === "healthy";
  const serviceReady = runbookModel?.launchChecks.find((check) => check.id === "service")?.level === "healthy";
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
  const nextStepState: NextStepState = runtimeBlockMode
    ? {
        title: t("install:page.nextStep.fixRuntime.title"),
        description: t("install:page.nextStep.fixRuntime.description"),
        actionLabel: t("install:page.nextStep.fixRuntime.actionLabel"),
        route: "/settings",
      }
    : serviceReady
      ? {
          title: t("install:page.nextStep.ready.title"),
          description: t("install:page.nextStep.ready.description"),
          actionLabel: t("install:page.nextStep.ready.actionLabel"),
          route: "/dashboard",
        }
      : configReady
        ? {
            title: t("install:page.nextStep.service.title"),
            description: t("install:page.nextStep.service.description"),
            actionLabel: t("install:page.nextStep.service.actionLabel"),
            route: "/service",
          }
      : installResult?.status === "success" || installResult?.status === "warning"
      ? {
          title: t("install:page.nextStep.config.title"),
          description: t("install:page.nextStep.config.description"),
          actionLabel: t("install:page.nextStep.config.actionLabel"),
          route: "/config",
        }
      : {
          title: t("install:page.nextStep.start.title"),
          description: t("install:page.nextStep.start.description"),
          actionLabel: t("install:page.nextStep.start.actionLabel"),
          onClick: openWizard,
        };
  const nextStepRoute = "route" in nextStepState ? nextStepState.route : null;
  const nextStepAction = "onClick" in nextStepState ? nextStepState.onClick : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHero
        title={t("install:page.hero.title")}
        description={t("install:page.hero.description")}
        meta={environment ? t("install:page.hero.meta", { platform: environment.platform, architecture: environment.architecture }) : undefined}
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
            {t("install:page.hero.action")}
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
          {nextStepRoute ? (
            <Link
              to={nextStepRoute}
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
              onClick={nextStepAction ?? undefined}
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
        <NoticeBanner title={t("install:page.banners.envError.title")} tone="error">
          <p style={{ margin: "8px 0 0" }}>{envError.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>{t("install:page.banners.envError.suggestionPrefix")}{envError.suggestion}</p>
        </NoticeBanner>
      ) : null}

      <RunbookContextPanel
        title={t("install:page.runbook.title")}
        description={t("install:page.runbook.description")}
        model={runbookModel}
      />

      <InstallEnvironmentPanel
        environment={environment}
        isLoading={isLoading}
        isInstalling={isInstalling}
        runtimeBlockMode={runtimeBlockMode}
        onRefresh={() => void refreshEnvironment()}
        onInstall={() => void installOpenClaw()}
      />

      <PlatformGuidancePanel cards={platformCards} />

      <InstallProgressCard progress={installProgress} />

      <InstallPhaseTimeline phases={phases} activePhaseId={installProgress.activePhaseId} />

      <InstallResultCard result={installResult} />

      {visibleIssue ? <InstallIssueCard issue={visibleIssue} /> : null}

      <NoticeBanner title={t("install:page.banners.order.title")} tone="info">
        <p style={{ margin: 0, color: "#475569" }}>
          {t("install:page.banners.order.description")}
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
