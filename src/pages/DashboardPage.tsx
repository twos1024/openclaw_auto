import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardDiagnosticsPanel } from "../components/dashboard/DashboardDiagnosticsPanel";
import { DashboardFrame } from "../components/dashboard/DashboardFrame";
import { DashboardToolbar } from "../components/dashboard/DashboardToolbar";
import { useEnvironmentSnapshot } from "../hooks/useEnvironmentSnapshot";
import { useAppSettingsSnapshot } from "../hooks/useAppSettingsSnapshot";
import { useGatewayControl } from "../hooks/useGatewayControl";
import { useShellActions } from "../hooks/useShellActions";
import { buildDashboardDiagnosticsModel } from "../services/dashboardDiagnosticsService";
import { currentPlatformCard } from "../services/installWizardService";
import { serviceService, type ServiceActionResult } from "../services/serviceService";
import type { DashboardEmbedPhase, DashboardProbeResult } from "../types/dashboard";

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation("dashboard");
  const { settings } = useAppSettingsSnapshot();
  const { environment } = useEnvironmentSnapshot();
  const { openSetupAssistant } = useShellActions();
  const {
    status,
    refreshCycle,
    isRefreshing,
    loadingByAction,
    startGateway,
    restartGateway,
    openDashboard,
    refreshStatus,
  } = useGatewayControl(settings.gatewayPollMs);
  const [frameKey, setFrameKey] = useState<number>(0);
  const [embedPhase, setEmbedPhase] = useState<DashboardEmbedPhase>("loading");
  const [probe, setProbe] = useState<DashboardProbeResult | null>(null);
  const [lastExternalOpenResult, setLastExternalOpenResult] = useState<ServiceActionResult | null>(null);

  const address = status?.address ?? null;
  const isRunning = Boolean(status?.running && address);
  const platformCard = currentPlatformCard(environment?.platform);
  const platformNote =
    platformCard?.troubleshooting ??
    t("diagnostics.platformNoteFallback");

  useEffect(() => {
    let cancelled = false;

    if (!isRunning || !address) {
      setProbe(null);
      return;
    }

    setProbe({
      address,
      reachable: false,
      result: "probing",
      httpStatus: null,
      responseTimeMs: null,
      detail: t("diagnostics.probing"),
    });

    void serviceService.probeDashboardEndpoint(address).then((result) => {
      if (!cancelled) {
        setProbe(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address, frameKey, isRunning, refreshCycle, status?.lastStartedAt, status?.state, t]);

  useEffect(() => {
    setLastExternalOpenResult(null);
  }, [address, isRunning, status?.lastStartedAt, status?.state]);

  const diagnosticsModel = useMemo(
    () =>
      buildDashboardDiagnosticsModel({
        phase: isRunning ? embedPhase : "unavailable",
        gatewayState: status?.state ?? null,
        gatewayRunning: Boolean(status?.running),
        address,
        statusDetail: status?.statusDetail ?? t("toolbar.statusWaiting"),
        platformNote,
        probe,
        externalOpenResult: lastExternalOpenResult,
      }),
    [
      address,
      embedPhase,
      isRunning,
      lastExternalOpenResult,
      platformNote,
      probe,
      t,
      status?.running,
      status?.state,
      status?.statusDetail,
    ],
  );

  const handleOpenExternal = async (): Promise<void> => {
    const result = await openDashboard();
    if (result) {
      setLastExternalOpenResult(result);
    }
  };

  return (
    <div className="grid gap-4">
      <DashboardToolbar
        address={address}
        statusDetail={status?.statusDetail ?? t("toolbar.statusWaiting")}
        isRunning={isRunning}
        isRefreshing={isRefreshing}
        isRestarting={loadingByAction.restart}
        isOpeningExternal={loadingByAction.openDashboard}
        onRefreshStatus={() => void refreshStatus()}
        onReloadFrame={() => setFrameKey((current) => current + 1)}
        onRestart={() => void restartGateway()}
        onOpenExternal={() => void handleOpenExternal()}
      />

      <DashboardDiagnosticsPanel
        phase={isRunning ? embedPhase : "unavailable"}
        platformCard={platformCard}
        model={diagnosticsModel}
      />

      {isRunning && address ? (
        <DashboardFrame
          src={address}
          frameKey={frameKey}
          onReloadFrame={() => setFrameKey((current) => current + 1)}
          onOpenExternal={() => void handleOpenExternal()}
          onOpenSetupAssistant={openSetupAssistant}
          onRestartGateway={() => void restartGateway()}
          onPhaseChange={setEmbedPhase}
        />
      ) : (
        <section className="grid gap-3.5 rounded-2xl border border-border bg-card p-5">
          <h3 className="m-0 text-base font-semibold">{t("unavailable.title")}</h3>
          <p className="m-0 text-sm text-muted-foreground">
            {status?.suggestion ?? t("unavailable.description")}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => void startGateway()}
              disabled={loadingByAction.start}
              className="rounded-lg bg-teal-700 px-3.5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingByAction.start ? t("unavailable.actions.starting") : t("unavailable.actions.start")}
            </button>
            <button
              type="button"
              onClick={openSetupAssistant}
              className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-bold text-foreground"
            >
              {t("unavailable.actions.setupAssistant")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
