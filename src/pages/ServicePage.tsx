import { EndpointCard } from "../components/service/EndpointCard";
import { ServiceControlPanel } from "../components/service/ServiceControlPanel";
import { useAppSettingsSnapshot } from "../hooks/useAppSettingsSnapshot";
import { useGatewayControl } from "../hooks/useGatewayControl";

function PortConflictBanner({ port }: { port: number | null }): JSX.Element {
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
      <strong>端口被占用</strong>
      <p style={{ margin: "8px 0 0" }}>
        Gateway
        {port ? (
          <>
            {" "}
            port <strong>{port}</strong>
          </>
        ) : (
          " target port"
        )}{" "}
        已被其他进程占用。
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        先释放这个端口，或者换一个空闲端口，再重新启动 Gateway。
      </p>
    </section>
  );
}

function NextStepHint({ running, suggestion }: { running: boolean; suggestion: string }): JSX.Element | null {
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
      <strong>下一步</strong>
      <p style={{ margin: "8px 0 0" }}>{suggestion}</p>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        先启动 Gateway，确认运行后再打开 Dashboard。
      </p>
    </section>
  );
}

export function ServicePage(): JSX.Element {
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
        <h2 style={{ marginBottom: 8 }}>Gateway 服务</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          先启动 Gateway，再打开 Dashboard。
        </p>
        <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 13 }}>
          轮询：{isPolling ? `开启 (${Math.round(settings.gatewayPollMs / 1000)}s)` : "关闭"}{" "}
          {isInitializing ? " | 正在初始化..." : ""}
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
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Runtime Snapshot</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}>
            <strong>Running:</strong> {status?.running ? "Yes" : "No"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>PID:</strong> {status?.pid ?? "-"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Last Started:</strong>{" "}
            {status?.lastStartedAt ? new Date(status.lastStartedAt).toLocaleString() : "-"}
          </p>
        </div>
      </section>
    </div>
  );
}
