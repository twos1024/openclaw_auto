import { Link } from "react-router-dom";
import { InstallIssueCard } from "../components/install/InstallIssueCard";
import { InstallPhaseTimeline } from "../components/install/InstallPhaseTimeline";
import { useInstallFlow } from "../hooks/useInstallFlow";

function EnvRow(props: { label: string; value: string | null | undefined }): JSX.Element {
  return (
    <p style={{ margin: 0, color: "#334155" }}>
      <strong>{props.label}:</strong> {props.value && props.value.trim() ? props.value : "-"}
    </p>
  );
}

function StatusPill(props: { label: string; ok: boolean }): JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        color: props.ok ? "#166534" : "#991b1b",
        background: props.ok ? "#dcfce7" : "#fee2e2",
      }}
    >
      {props.label}
    </span>
  );
}

export function InstallPage(): JSX.Element {
  const {
    environment,
    envError,
    installResult,
    phases,
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
          Install the OpenClaw CLI, attempt managed Gateway service installation, and verify local prerequisites.
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

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatusPill label={environment?.npmFound ? "npm Ready" : "npm Missing"} ok={Boolean(environment?.npmFound)} />
          <StatusPill
            label={environment?.openclawFound ? "OpenClaw Installed" : "OpenClaw Missing"}
            ok={Boolean(environment?.openclawFound)}
          />
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <EnvRow label="Platform" value={environment ? `${environment.platform} / ${environment.architecture}` : null} />
          <EnvRow label="Home Dir" value={environment?.homeDir} />
          <EnvRow label="Config Path" value={environment?.configPath} />
          <EnvRow label="npm Version" value={environment?.npmVersion} />
          <EnvRow label="OpenClaw Path" value={environment?.openclawPath} />
          <EnvRow label="OpenClaw Version" value={environment?.openclawVersion} />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void refreshEnvironment()}
            disabled={isLoading || isInstalling}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: isLoading || isInstalling ? "not-allowed" : "pointer",
              opacity: isLoading || isInstalling ? 0.6 : 1,
            }}
          >
            {isLoading ? "Refreshing..." : "Refresh Environment"}
          </button>

          <button
            type="button"
            onClick={() => void installOpenClaw()}
            disabled={isLoading || isInstalling || installBlockedByEnv}
            style={{
              border: "none",
              background: "#1d4ed8",
              color: "#ffffff",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: isLoading || isInstalling || installBlockedByEnv ? "not-allowed" : "pointer",
              opacity: isLoading || isInstalling || installBlockedByEnv ? 0.6 : 1,
            }}
          >
            {isInstalling ? "Installing..." : installBlockedByEnv ? "npm Required" : "Install OpenClaw"}
          </button>

          <Link
            to="/logs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              color: "#0f172a",
              textDecoration: "none",
              background: "#ffffff",
            }}
          >
            Open Logs
          </Link>
        </div>

        {installBlockedByEnv ? (
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            当前未检测到 npm，安装按钮已禁用。请先安装 Node.js / npm，然后刷新环境检查。
          </p>
        ) : null}
      </section>

      <InstallPhaseTimeline phases={phases} />

      {installResult ? (
        <section
          style={{
            border: `1px solid ${
              installResult.status === "success"
                ? "#86efac"
                : installResult.status === "warning"
                  ? "#fcd34d"
                  : "#fca5a5"
            }`,
            borderRadius: 12,
            background:
              installResult.status === "success"
                ? "#f0fdf4"
                : installResult.status === "warning"
                  ? "#fffbeb"
                  : "#fef2f2",
            padding: 16,
            display: "grid",
            gap: 8,
          }}
        >
          <strong>
            {installResult.status === "success"
              ? "安装完成"
              : installResult.status === "warning"
                ? "安装部分完成"
                : "安装失败"}
          </strong>
          <p style={{ margin: 0 }}>{installResult.detail}</p>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>建议：{installResult.suggestion}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>当前阶段：{installResult.stage}</p>
          {installResult.code ? (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>错误码：{installResult.code}</p>
          ) : null}
          {installResult.data?.executablePath ? (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              Executable: {installResult.data.executablePath}
            </p>
          ) : null}
          {installResult.data?.notes?.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {installResult.data.notes.map((note, index) => (
                <p key={`${index}-${note}`} style={{ margin: 0, fontSize: 12, color: "#475569" }}>
                  - {note}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

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
        <p style={{ margin: 0, color: "#475569" }}>1. Refresh environment to confirm npm availability.</p>
        <p style={{ margin: 0, color: "#475569" }}>2. Install OpenClaw and watch the phase timeline for warnings or failures.</p>
        <p style={{ margin: 0, color: "#475569" }}>3. Continue to Config to write provider settings, then start Gateway from Service.</p>
      </section>
    </div>
  );
}
