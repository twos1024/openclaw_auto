import { Link } from "react-router-dom";
import { NoticeBanner } from "../components/common/NoticeBanner";
import { PageHero } from "../components/common/PageHero";
import { SurfaceCard } from "../components/common/SurfaceCard";
import { StatusBadge } from "../components/common/StatusBadge";
import { RunbookContextPanel } from "../components/runbook/RunbookContextPanel";
import { useRunbook } from "../hooks/useRunbook";
import { useSettingsForm } from "../hooks/useSettingsForm";
import { getRuntimeDiagnostics } from "../services/tauriClient";

function FieldHint(props: { text?: string }): JSX.Element | null {
  if (!props.text) return null;
  return <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c" }}>{props.text}</p>;
}

export function SettingsPage(): JSX.Element {
  const runtime = getRuntimeDiagnostics();
  const { model: runbookModel } = useRunbook(true, 30000);
  const {
    form,
    errors,
    loadIssue,
    loadedPath,
    exists,
    modifiedAt,
    isLoading,
    isSaving,
    saveResult,
    setField,
    saveSettings,
    resetToDefault,
    reload,
  } = useSettingsForm();

  const isBusy = isLoading || isSaving;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHero
        title="Settings"
        description="Settings collects app-level preferences and runtime diagnostics. This is the primary page for distinguishing browser preview from a broken desktop bridge."
      />

      {loadIssue ? (
        <NoticeBanner title="设置加载提示" tone="warning">
          <p style={{ margin: "8px 0 0" }}>{loadIssue.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>建议：{loadIssue.suggestion}</p>
        </NoticeBanner>
      ) : null}

      <RunbookContextPanel
        title="Runtime and Recovery Context"
        description="Settings now participates directly in the recovery workflow. Use it when runtime mode is unclear, the Tauri bridge is missing, or diagnostics need to be redirected."
        model={runbookModel}
      />

      <SurfaceCard title="App Preferences" subtitle="Manage diagnostics output, log volume, and gateway polling defaults.">
        <div
          style={{
            border: "1px solid #dbeafe",
            borderRadius: 10,
            background: "#eff6ff",
            color: "#1e3a8a",
            padding: 12,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <strong>Runtime Diagnostics</strong>
            <StatusBadge variant={runtime.mode === "browser-preview" ? "warning" : runtime.hasInvokeBridge ? "success" : "error"} label={runtime.mode} />
          </div>
          <p style={{ margin: 0 }}><strong>Tauri Shell:</strong> {runtime.hasTauriShell ? "detected" : "not-detected"}</p>
          <p style={{ margin: 0 }}><strong>Invoke Bridge:</strong> {runtime.hasInvokeBridge ? "detected" : "missing"}</p>
          <p style={{ margin: 0 }}><strong>Bridge Source:</strong> {runtime.bridgeSource}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              to="/runbook"
              style={{
                borderRadius: 8,
                background: "#0f172a",
                color: "#ffffff",
                padding: "8px 12px",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Open Runbook
            </Link>
            <Link
              to="/logs"
              style={{
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                padding: "8px 12px",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Open Logs
            </Link>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Settings Path: <strong>{loadedPath ?? "(default path not resolved yet)"}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          File Exists: <strong>{exists ? "Yes" : "No (using defaults)"}</strong>
          {modifiedAt ? ` | Last Modified: ${new Date(modifiedAt).toLocaleString()}` : ""}
        </p>

        <label style={{ display: "block", maxWidth: 360 }}>
          <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
            Preferred Install Source
          </span>
          <select
            value={form.preferredInstallSource}
            onChange={(event) => setField("preferredInstallSource", event.target.value)}
            disabled={isBusy}
            style={{
              width: "100%",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              background: "#ffffff",
            }}
          >
            <option value="npm-global">npm global install</option>
          </select>
        </label>

        <label style={{ display: "block" }}>
          <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
            Diagnostics Directory
          </span>
          <input
            value={form.diagnosticsDir}
            onChange={(event) => setField("diagnosticsDir", event.target.value)}
            disabled={isBusy}
            style={{
              width: "100%",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <FieldHint text={errors.diagnosticsDir} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
              Log Line Limit
            </span>
            <input
              type="number"
              value={form.logLineLimit}
              onChange={(event) => setField("logLineLimit", Number(event.target.value))}
              disabled={isBusy}
              style={{
                width: "100%",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
            <FieldHint text={errors.logLineLimit} />
          </label>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
              Gateway Poll Interval (ms)
            </span>
            <input
              type="number"
              value={form.gatewayPollMs}
              onChange={(event) => setField("gatewayPollMs", Number(event.target.value))}
              disabled={isBusy}
              style={{
                width: "100%",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
            <FieldHint text={errors.gatewayPollMs} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={isBusy}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={isBusy}
            style={{
              border: "none",
              background: "#0f766e",
              color: "#ffffff",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>

          <button
            type="button"
            onClick={resetToDefault}
            disabled={isBusy}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            Reset
          </button>
        </div>
      </SurfaceCard>

      {saveResult ? (
        <NoticeBanner title={saveResult.status === "success" ? "设置已保存" : "设置保存失败"} tone={saveResult.status === "success" ? "success" : "error"}>
          <p style={{ margin: 0 }}>{saveResult.detail}</p>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>建议：{saveResult.suggestion}</p>
          {saveResult.savedPath ? (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Saved: {saveResult.savedPath}</p>
          ) : null}
          {saveResult.backupPath ? (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Backup: {saveResult.backupPath}</p>
          ) : null}
        </NoticeBanner>
      ) : null}
    </div>
  );
}
