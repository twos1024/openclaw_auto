import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Save, RotateCcw, Loader2 } from "lucide-react";
import { OpenAIConfigForm } from "../components/config/OpenAIConfigForm";
import { OllamaConfigForm } from "../components/config/OllamaConfigForm";
import { useConfigForm } from "../hooks/useConfigForm";
import { inferOpenAiCompatiblePresetId } from "../services/configPresets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ConnectionTestResult, SaveConfigResult } from "../types/config";

// ─── Result banner ────────────────────────────────────────────────────────────

function ResultBanner(props: {
  title: string;
  result: ConnectionTestResult | SaveConfigResult;
  nextAction?: { label: string; route: string };
}): JSX.Element {
  const { t } = useTranslation("config");
  const { result } = props;

  const variantClass = {
    success: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    failure: "border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-300",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  }[result.status];

  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", variantClass)}>
      <p className="font-semibold">{props.title}</p>
      <p className="mt-1">{result.detail}</p>
      {result.suggestion ? <p className="mt-1 opacity-80">{result.suggestion}</p> : null}
      {result.code ? (
        <p className="mt-1 text-xs opacity-70">
          {t("result.code")}
          {result.code}
        </p>
      ) : null}
      {"latencyMs" in result && result.latencyMs ? (
        <p className="mt-1 text-xs opacity-70">
          {t("result.latency")}
          {result.latencyMs}ms
        </p>
      ) : null}
      {"backupPath" in result && result.backupPath ? (
        <p className="mt-1 text-xs opacity-70">
          {t("result.backup")}
          {result.backupPath}
        </p>
      ) : null}
      {"savedPath" in result && result.savedPath ? (
        <p className="mt-1 text-xs opacity-70">
          {t("result.savedTo")}
          {result.savedPath}
        </p>
      ) : null}
      {props.nextAction ? (
        <div className="mt-3">
          <Link to={props.nextAction.route}>
            <Button size="sm">{props.nextAction.label}</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ConfigPage(): JSX.Element {
  const { t } = useTranslation("config");
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
    <div className="grid gap-5">
      <header>
        <h2 className="page-heading">{t("page.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("page.description")}</p>
      </header>

      {loadIssue ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold">{t("page.loadIssueTitle")}</p>
          <p className="mt-1">
            {t("page.suggestionPrefix")}
            {loadIssue.suggestion}
          </p>
          {loadIssue.code ? (
            <p className="mt-1 text-xs opacity-80">
              {t("result.code")}
              {loadIssue.code}
            </p>
          ) : null}
          {usedDefaultValues ? (
            <p className="mt-1 text-xs opacity-80">{t("page.defaultValues")}</p>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("page.title")}</CardTitle>
          {loadedPath ? (
            <CardDescription>
              {t("page.loadedPath")}
              <span className="ml-1 font-mono text-foreground">{loadedPath}</span>
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="max-w-xs">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-foreground">
                {t("form.provider.label")}
              </span>
              <Select
                value={form.providerType}
                disabled={isBusy}
                onChange={(event) =>
                  setProviderType(event.target.value as "openai-compatible" | "ollama")
                }
              >
                <option value="openai-compatible">
                  {t("form.provider.options.openaiCompatible")}
                </option>
                <option value="ollama">{t("form.provider.options.ollama")}</option>
              </Select>
            </label>
          </div>

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

          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button onClick={() => void testConnection()} disabled={isBusy} variant="outline">
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {isTesting ? t("actions.testing") : t("actions.testConnection")}
            </Button>

            <Button onClick={() => void saveConfig()} disabled={isBusy}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? t("actions.saving") : t("actions.save")}
            </Button>

            <Button variant="ghost" onClick={resetToDefault} disabled={isBusy}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("actions.reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResult ? (
        <ResultBanner title={t("result.testTitle")} result={testResult} />
      ) : null}

      {saveResult ? (
        <ResultBanner
          title={t("result.saveTitle")}
          result={saveResult}
          nextAction={
            saveResult.status === "success"
              ? { label: t("actions.startGateway"), route: "/service" }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
