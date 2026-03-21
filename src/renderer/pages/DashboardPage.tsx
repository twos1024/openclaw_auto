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
    <div style={{ display: "grid", gap: 16 }}>
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
        <section
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            background: "#ffffff",
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <h3 style={{ margin: 0 }}>{t("unavailable.title")}</h3>
          <p style={{ margin: 0, color: "#475569" }}>
            {status?.suggestion ??
              t("unavailable.description")}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void startGateway()}
              disabled={loadingByAction.start}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#0f766e",
                color: "#ffffff",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: loadingByAction.start ? "not-allowed" : "pointer",
                opacity: loadingByAction.start ? 0.7 : 1,
              }}
            >
              {loadingByAction.start ? t("unavailable.actions.starting") : t("unavailable.actions.start")}
            </button>
            <button
              type="button"
              onClick={openSetupAssistant}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#ffffff",
                color: "#0f172a",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("unavailable.actions.setupAssistant")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
