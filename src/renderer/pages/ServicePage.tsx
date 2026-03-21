import { useTranslation } from "react-i18next";
import { EndpointCard } from "../components/service/EndpointCard";
import { ServiceControlPanel } from "../components/service/ServiceControlPanel";
import { useAppSettingsSnapshot } from "../hooks/useAppSettingsSnapshot";
import { useGatewayControl } from "../hooks/useGatewayControl";

function PortConflictBanner({ port }: { port: number | null }): JSX.Element {
  const { t } = useTranslation(["service"]);
  return (
    <section
      style={{
        border: "1px solid #fca5a5",
        borderRadius: 10,
        background: "#fef2f2",
        color: "#991b1b",
        padding: 12,
      }}
    >
      <strong>{t("service:status.portConflict.title")}</strong>
      <p style={{ margin: "8px 0 0" }}>
        {port
          ? t("service:status.portConflict.withPort", { port })
          : t("service:status.portConflict.withoutPort")}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        {t("service:status.portConflict.suggestion")}
      </p>
    </section>
  );
}

function NextStepHint({ running, suggestion }: { running: boolean; suggestion: string }): JSX.Element | null {
  const { t } = useTranslation(["service"]);
  if (running) return null;
  return (
    <section
      style={{
        border: "1px solid #bfdbfe",
        borderRadius: 10,
        background: "#eff6ff",
        color: "#1e3a8a",
        padding: 12,
      }}
    >
      <strong>{t("service:nextStep.title")}</strong>
      <p style={{ margin: "8px 0 0" }}>{suggestion}</p>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        {t("service:nextStep.description")}
      </p>
    </section>
  );
}

export function ServicePage(): JSX.Element {
  const { t } = useTranslation(["service"]);
  const { settings } = useAppSettingsSnapshot();
  const {
    status,
    lastActionResult,
    isInitializing,
    isRefreshing,
    isPolling,
    loadingByAction,
    refreshStatus,
    startGateway,
    stopGateway,
    restartGateway,
    openDashboard,
  } = useGatewayControl(settings.gatewayPollMs);
  const actionConflict =
    lastActionResult?.code?.includes("PORT") || lastActionResult?.code?.includes("CONFLICT");
  const portConflictPort = status?.portConflictPort ?? lastActionResult?.conflictPort ?? null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 8 }}>{t("service:page.title")}</h2>
        <p style={{ margin: 0, color: "#64748b" }}>{t("service:page.description")}</p>
        <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 13 }}>
          {t("service:page.polling", { state: isPolling ? t("service:page.pollingOn", { seconds: Math.round(settings.gatewayPollMs / 1000) }) : t("service:page.pollingOff") })}
          {isInitializing ? ` ${t("service:page.initializing")}` : ""}
        </p>
      </header>

      {portConflictPort || actionConflict ? <PortConflictBanner port={portConflictPort} /> : null}
      {status ? <NextStepHint running={status.running} suggestion={status.suggestion} /> : null}

      <ServiceControlPanel
        status={status}
        lastActionResult={lastActionResult}
        isRefreshing={isRefreshing}
        loadingByAction={loadingByAction}
        onRefresh={() => void refreshStatus()}
        onStart={() => void startGateway()}
        onStop={() => void stopGateway()}
        onRestart={() => void restartGateway()}
        onOpenDashboard={() => void openDashboard()}
      />

      <EndpointCard status={status} />

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 16,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>{t("service:snapshot.title")}</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}>
            <strong>{t("service:snapshot.running")}</strong> {status?.running ? t("service:snapshot.yes") : t("service:snapshot.no")}
          </p>
          <p style={{ margin: 0 }}>
            <strong>{t("service:snapshot.pid")}</strong> {status?.pid ?? "-"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>{t("service:snapshot.lastStarted")}</strong>{" "}
            {status?.lastStartedAt ? new Date(status.lastStartedAt).toLocaleString() : "-"}
          </p>
        </div>
      </section>
    </div>
  );
}
