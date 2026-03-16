import { useState } from "react";
import { DashboardFrame } from "../components/dashboard/DashboardFrame";
import { DashboardToolbar } from "../components/dashboard/DashboardToolbar";
import { useAppSettingsSnapshot } from "../hooks/useAppSettingsSnapshot";
import { useGatewayControl } from "../hooks/useGatewayControl";
import { useShellActions } from "../hooks/useShellActions";

export function DashboardPage(): JSX.Element {
  const { settings } = useAppSettingsSnapshot();
  const { openSetupAssistant } = useShellActions();
  const {
    status,
    isRefreshing,
    loadingByAction,
    startGateway,
    restartGateway,
    openDashboard,
    refreshStatus,
  } = useGatewayControl(settings.gatewayPollMs);
  const [frameKey, setFrameKey] = useState<number>(0);

  const address = status?.address ?? null;
  const isRunning = Boolean(status?.running && address);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardToolbar
        address={address}
        statusDetail={status?.statusDetail ?? "Waiting for Gateway status..."}
        isRunning={isRunning}
        isRefreshing={isRefreshing}
        isRestarting={loadingByAction.restart}
        isOpeningExternal={loadingByAction.openDashboard}
        onRefreshStatus={() => void refreshStatus()}
        onReloadFrame={() => setFrameKey((current) => current + 1)}
        onRestart={() => void restartGateway()}
        onOpenExternal={() => void openDashboard()}
      />

      {isRunning && address ? (
        <DashboardFrame
          src={address}
          frameKey={frameKey}
          onReloadFrame={() => setFrameKey((current) => current + 1)}
          onOpenExternal={() => void openDashboard()}
          onOpenSetupAssistant={openSetupAssistant}
          onRestartGateway={() => void restartGateway()}
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
          <h3 style={{ margin: 0 }}>Dashboard Unavailable</h3>
          <p style={{ margin: 0, color: "#475569" }}>
            {status?.suggestion ??
              "Gateway 还没有进入可用状态，因此当前不能加载内嵌 Dashboard。"}
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
              {loadingByAction.start ? "Starting..." : "Start Gateway"}
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
              Open Setup Assistant
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
