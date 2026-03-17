import { Link } from "react-router-dom";
import { OpenAIConfigForm } from "../components/config/OpenAIConfigForm";
import { OllamaConfigForm } from "../components/config/OllamaConfigForm";
import { useConfigForm } from "../hooks/useConfigForm";
import { inferOpenAiCompatiblePresetId } from "../services/configPresets";
import type { ConnectionTestResult, SaveConfigResult } from "../types/config";

function ResultBanner(props: {
  title: string;
  result: ConnectionTestResult | SaveConfigResult;
  nextAction?: {
    label: string;
    route: string;
  };
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
          错误码：{props.result.code}
        </p>
      ) : null}
      {"latencyMs" in props.result && props.result.latencyMs ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          耗时：{props.result.latencyMs}ms
        </p>
      ) : null}
      {"backupPath" in props.result && props.result.backupPath ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          备份：{props.result.backupPath}
        </p>
      ) : null}
      {"savedPath" in props.result && props.result.savedPath ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          保存到：{props.result.savedPath}
        </p>
      ) : null}
      {props.nextAction ? (
        <div style={{ marginTop: 10 }}>
          <Link
            to={props.nextAction.route}
            style={{
              display: "inline-block",
              borderRadius: 8,
              background: "#0f172a",
              color: "#ffffff",
              padding: "8px 12px",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            {props.nextAction.label}
          </Link>
        </div>
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
    applyCompatiblePreset,
    testConnection,
    saveConfig,
    resetToDefault,
  } = useConfigForm();

  const isBusy = isLoading || isTesting || isSaving;
  const openAiPresetId = inferOpenAiCompatiblePresetId(form.baseUrl);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 8 }}>API Key 配置</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          这里先填 API Key，再测试连接，最后保存配置。
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
              当前表单是默认值，不代表磁盘上的真实配置。
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
            配置路径：<strong>{loadedPath}</strong>
          </p>
        ) : null}

        <label style={{ display: "block", maxWidth: 320 }}>
          <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
            提供方
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
            <option value="openai-compatible">OpenAI 兼容</option>
            <option value="ollama">Ollama</option>
          </select>
        </label>

        {form.providerType === "openai-compatible" ? (
          <OpenAIConfigForm
            values={form}
            errors={errors}
            disabled={isBusy}
            presetId={openAiPresetId}
            onFieldChange={setField}
            onPresetChange={applyCompatiblePreset}
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
            {isTesting ? "正在测试..." : "测试连接"}
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
            {isSaving ? "正在保存..." : "保存配置"}
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
            重置
          </button>
        </div>
      </section>

      {testResult ? <ResultBanner title="测试结果" result={testResult} /> : null}
      {saveResult ? (
        <ResultBanner
          title="保存结果"
          result={saveResult}
          nextAction={
            saveResult.status === "success"
              ? {
                  label: "启动 Gateway",
                  route: "/service",
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
