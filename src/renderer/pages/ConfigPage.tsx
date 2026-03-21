import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["config"]);
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
          {t("config:result.code")}{props.result.code}
        </p>
      ) : null}
      {"latencyMs" in props.result && props.result.latencyMs ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          {t("config:result.latency")}{props.result.latencyMs}ms
        </p>
      ) : null}
      {"backupPath" in props.result && props.result.backupPath ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          {t("config:result.backup")}{props.result.backupPath}
        </p>
      ) : null}
      {"savedPath" in props.result && props.result.savedPath ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
          {t("config:result.savedTo")}{props.result.savedPath}
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
  const { t } = useTranslation(["config"]);
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
        <h2 style={{ marginBottom: 8 }}>{t("config:page.title")}</h2>
        <p style={{ margin: 0, color: "#64748b" }}>{t("config:page.description")}</p>
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
          <strong>{t("config:page.loadIssueTitle")}</strong>
          <p style={{ margin: "8px 0 0" }}>{loadIssue.message}</p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>{t("config:page.suggestionPrefix")}{loadIssue.suggestion}</p>
          {loadIssue.code ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>{t("config:result.code")}{loadIssue.code}</p>
          ) : null}
          {usedDefaultValues ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.9 }}>
              {t("config:page.defaultValues")}
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
            {t("config:page.loadedPath")}<strong>{loadedPath}</strong>
          </p>
        ) : null}

        <label style={{ display: "block", maxWidth: 320 }}>
          <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
            {t("config:form.provider.label")}
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
            <option value="openai-compatible">{t("config:form.provider.options.openaiCompatible")}</option>
            <option value="ollama">{t("config:form.provider.options.ollama")}</option>
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
            {isTesting ? t("config:actions.testing") : t("config:actions.testConnection")}
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
            {isSaving ? t("config:actions.saving") : t("config:actions.save")}
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
            {t("config:actions.reset")}
          </button>
        </div>
      </section>

      {testResult ? <ResultBanner title={t("config:result.testTitle")} result={testResult} /> : null}
      {saveResult ? (
        <ResultBanner
          title={t("config:result.saveTitle")}
          result={saveResult}
          nextAction={
            saveResult.status === "success"
              ? {
                  label: t("config:actions.startGateway"),
                  route: "/service",
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
