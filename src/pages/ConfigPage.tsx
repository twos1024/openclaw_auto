import { OpenAIConfigForm } from "../components/config/OpenAIConfigForm";
import { OllamaConfigForm } from "../components/config/OllamaConfigForm";
import { useConfigForm } from "../hooks/useConfigForm";
import type { ConnectionTestResult, SaveConfigResult } from "../types/config";

function ResultBanner(props: {
  title: string;
  result: ConnectionTestResult | SaveConfigResult;
}): JSX.Element {
  const colorMap = {
    success: {
      border: "#86efac",
      bg: "#f0fdf4",
      text: "#166534",
    },
    failure: {
      border: "#fcd34d",
      bg: "#fffbeb",
      text: "#92400e",
    },
    error: {
      border: "#fca5a5",
      bg: "#fef2f2",
      text: "#991b1b",
    },
  } as const;

  const color = colorMap[props.result.status];

  return (
    <section
      style={{
        border: `1px solid ${color.border}`,
        background: color.bg,
        color: color.text,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <strong>{props.title}</strong>
      <p style={{ margin: "8px 0 0" }}>{props.result.detail}</p>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>{props.result.suggestion}</p>
      {props.result.code ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          Error code: {props.result.code}
        </p>
      ) : null}
      {"latencyMs" in props.result && props.result.latencyMs ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          Latency: {props.result.latencyMs}ms
        </p>
      ) : null}
      {"backupPath" in props.result && props.result.backupPath ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          Backup: {props.result.backupPath}
        </p>
      ) : null}
      {"savedPath" in props.result && props.result.savedPath ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          Saved: {props.result.savedPath}
        </p>
      ) : null}
    </section>
  );
}

export function ConfigPage(): JSX.Element {
  const {
    form,
    errors,
    isLoading,
    isTesting,
    isSaving,
    loadIssue,
    loadedPath,
    usedDefaultValues,
    testResult,
    saveResult,
    setField,
    setProviderType,
    testConnection,
    saveConfig,
    resetToDefault,
  } = useConfigForm();

  const isBusy = isLoading || isTesting || isSaving;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 8 }}>ConfigPage</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          Configure OpenAI-compatible or Ollama mode, test connectivity, and save safely.
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
          <strong>配置加载提示</strong>
          <p style={{ margin: "8px 0 0" }}>{loadIssue.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>建议：{loadIssue.suggestion}</p>
          {loadIssue.code ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>错误码：{loadIssue.code}</p>
          ) : null}
          {usedDefaultValues ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
              当前表单展示的是默认值，不代表磁盘上的真实配置。
            </p>
          ) : null}
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
        {loadedPath ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Config Path: <strong>{loadedPath}</strong>
          </p>
        ) : null}

        <label style={{ display: "block", maxWidth: 320 }}>
          <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
            Provider Type
          </span>
          <select
            value={form.providerType}
            onChange={(event) =>
              setProviderType(event.target.value as "openai-compatible" | "ollama")
            }
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
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="ollama">Ollama</option>
          </select>
        </label>

        {form.providerType === "openai-compatible" ? (
          <OpenAIConfigForm
            values={form}
            errors={errors}
            disabled={isBusy}
            onFieldChange={setField}
          />
        ) : (
          <OllamaConfigForm
            values={form}
            errors={errors}
            disabled={isBusy}
            onFieldChange={setField}
          />
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={isBusy}
            style={{
              border: "none",
              background: "#1d4ed8",
              color: "#ffffff",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </button>

          <button
            type="button"
            onClick={() => void saveConfig()}
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
            {isSaving ? "Saving..." : "Save Config"}
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

      {testResult ? <ResultBanner title="Test Result" result={testResult} /> : null}
      {saveResult ? <ResultBanner title="Save Result" result={saveResult} /> : null}
    </div>
  );
}
