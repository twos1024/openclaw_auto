import { useSettingsForm } from "../hooks/useSettingsForm";

function FieldHint(props: { text?: string }): JSX.Element | null {
  if (!props.text) return null;
  return <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c" }}>{props.text}</p>;
}

export function SettingsPage(): JSX.Element {
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
      <header>
        <h2 style={{ marginBottom: 8 }}>Settings</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          Manage ClawDesk app-level preferences such as diagnostics output, log volume, and Gateway polling.
        </p>
      </header>

      {loadIssue ? (
        <section
          style={{
            border: "1px solid #fcd34d",
            borderRadius: 10,
            background: "#fffbeb",
            color: "#92400e",
            padding: 12,
          }}
        >
          <strong>设置加载提示</strong>
          <p style={{ margin: "8px 0 0" }}>{loadIssue.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>建议：{loadIssue.suggestion}</p>
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
      </section>

      {saveResult ? (
        <section
          style={{
            border: `1px solid ${saveResult.status === "success" ? "#86efac" : "#fca5a5"}`,
            borderRadius: 12,
            background: saveResult.status === "success" ? "#f0fdf4" : "#fef2f2",
            padding: 16,
            display: "grid",
            gap: 8,
          }}
        >
          <strong>{saveResult.status === "success" ? "设置已保存" : "设置保存失败"}</strong>
          <p style={{ margin: 0 }}>{saveResult.detail}</p>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>建议：{saveResult.suggestion}</p>
          {saveResult.savedPath ? (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Saved: {saveResult.savedPath}</p>
          ) : null}
          {saveResult.backupPath ? (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Backup: {saveResult.backupPath}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
