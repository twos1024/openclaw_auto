import { Link } from "react-router-dom";
import type { InstallEnvironment } from "../../types/install";

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

export interface InstallEnvironmentPanelProps {
  environment: InstallEnvironment | null;
  isLoading: boolean;
  isInstalling: boolean;
  installBlockedByEnv: boolean;
  runtimeBlockMode: "preview" | "runtime-unavailable" | null;
  onRefresh: () => void;
  onInstall: () => void;
}

export function InstallEnvironmentPanel({
  environment,
  isLoading,
  isInstalling,
  installBlockedByEnv,
  runtimeBlockMode,
  onRefresh,
  onInstall,
}: InstallEnvironmentPanelProps): JSX.Element {
  const installBlockedByRuntime = runtimeBlockMode !== null;
  const installBlocked = installBlockedByEnv || installBlockedByRuntime;

  return (
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
      <div style={{ display: "grid", gap: 6 }}>
        <h3 style={{ margin: 0 }}>安装准备</h3>
        <p style={{ margin: 0, color: "#64748b" }}>
          先确认本机环境和 OpenClaw 检测状态，再启动安装流程。
        </p>
      </div>

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
          onClick={onRefresh}
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
          onClick={onInstall}
          disabled={isLoading || isInstalling || installBlocked}
          style={{
            border: "none",
            background: "#1d4ed8",
            color: "#ffffff",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            cursor: isLoading || isInstalling || installBlocked ? "not-allowed" : "pointer",
            opacity: isLoading || isInstalling || installBlocked ? 0.6 : 1,
          }}
        >
          {isInstalling
            ? "Installing..."
            : runtimeBlockMode === "preview"
              ? "Desktop Runtime Required"
              : installBlockedByRuntime
              ? "Desktop Bridge Required"
              : installBlockedByEnv
                ? "npm Required"
                : "Install OpenClaw"}
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

      {runtimeBlockMode === "preview" ? (
        <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
          当前为浏览器预览模式，安装按钮已禁用。请使用 ClawDesk 桌面应用或 `npm run tauri:dev` 再执行本机安装。
        </p>
      ) : installBlockedByRuntime ? (
        <p style={{ margin: 0, fontSize: 13, color: "#991b1b" }}>
          当前桌面命令桥不可用，安装按钮已禁用。请先修复 Tauri 运行时集成，再继续执行本机安装。
        </p>
      ) : installBlockedByEnv ? (
        <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
          当前未检测到 npm，安装按钮已禁用。请先安装 Node.js / npm，然后刷新环境检查。
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
          安装过程会先完成 CLI 安装，再尝试托管 Gateway 安装；如遇 warning，可继续在 Service 和 Logs 页面处理。
        </p>
      )}
    </section>
  );
}
