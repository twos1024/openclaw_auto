import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenAIConfigForm } from "@/components/config/OpenAIConfigForm";
import { InstallIssueCard } from "@/components/install/InstallIssueCard";
import { InstallPhaseTimeline } from "@/components/install/InstallPhaseTimeline";
import { InstallProgressCard } from "@/components/install/InstallProgressCard";
import { InstallResultCard } from "@/components/install/InstallResultCard";
import { useConfigForm } from "@/hooks/useConfigForm";
import { useInstallFlow } from "@/hooks/useInstallFlow";
import { serviceService } from "@/services/serviceService";
import { inferOpenAiCompatiblePresetId } from "@/services/configPresets";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { GatewayStatus, ServiceActionResult } from "@/services/serviceService";

type SetupStep = "environment" | "install" | "config" | "gateway" | "complete";

const STEP_KEYS: SetupStep[] = ["environment", "install", "config", "gateway", "complete"];

function stepIndex(step: SetupStep): number {
  return STEP_KEYS.indexOf(step);
}

function statusClassName(status: "done" | "current" | "pending"): string {
  if (status === "done") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "current") return "border-foreground/30 bg-foreground/10 text-foreground";
  return "border-border bg-muted/30 text-muted-foreground";
}

export function SetupPage(): JSX.Element {
  const { t } = useTranslation(["setup", "install", "common"]);
  const navigate = useNavigate();

  const setupComplete = useSettingsStore((state) => state.setupComplete);
  const setSetupComplete = useSettingsStore((state) => state.setSetupComplete);

  const {
    environment,
    envError,
    installResult,
    phases,
    installProgress,
    isLoading: envLoading,
    isInstalling,
    refreshEnvironment,
    installOpenClaw,
  } = useInstallFlow();

  const {
    form,
    errors,
    isLoading: configLoading,
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
  } = useConfigForm();

  const [step, setStep] = useState<SetupStep>("environment");
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [gatewayActionResult, setGatewayActionResult] = useState<ServiceActionResult | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  useEffect(() => {
    if (form.providerType !== "openai-compatible") {
      setProviderType("openai-compatible");
    }
  }, [form.providerType, setProviderType]);

  const environmentChecked = Boolean(environment || envError);
  const installSucceeded = Boolean(installResult && (installResult.status === "success" || installResult.status === "warning"));
  const configSucceeded = saveResult?.status === "success";
  const gatewaySucceeded = Boolean(gatewayStatus?.running);

  const currentStepIndex = stepIndex(step);
  const stepStates = useMemo(() => {
    return STEP_KEYS.map((key, index) => {
      let status: "done" | "current" | "pending" = "pending";
      if (index < currentStepIndex) {
        status = "done";
      } else if (index === currentStepIndex) {
        status = "current";
      }

      if (key === "environment" && environmentChecked) {
        status = index <= currentStepIndex ? "done" : status;
      }
      if (key === "install" && installSucceeded) {
        status = index <= currentStepIndex ? "done" : status;
      }
      if (key === "config" && configSucceeded) {
        status = index <= currentStepIndex ? "done" : status;
      }
      if (key === "gateway" && gatewaySucceeded) {
        status = index <= currentStepIndex ? "done" : status;
      }
      if (key === "complete" && setupComplete) {
        status = "done";
      }

      return { key, status };
    });
  }, [configSucceeded, currentStepIndex, environmentChecked, gatewaySucceeded, installSucceeded, setupComplete]);

  const moveToNext = (nextStep: SetupStep): void => {
    setStep(nextStep);
  };

  const handleEnvironmentRefresh = async (): Promise<void> => {
    await refreshEnvironment();
  };

  const handleInstall = async (): Promise<void> => {
    const result = await installOpenClaw();
    if (result && result.status !== "failure" && result.status !== "error") {
      setStep("config");
    }
  };

  const handleConfigSave = async (): Promise<void> => {
    const result = await saveConfig();
    if (result && result.status === "success") {
      setStep("gateway");
    }
  };

  const handleGatewayStart = async (): Promise<void> => {
    setGatewayLoading(true);
    setGatewayError(null);
    setGatewayActionResult(null);
    try {
      const actionResult = await serviceService.startGateway();
      setGatewayActionResult(actionResult);

      if (actionResult.status !== "success") {
        setGatewayError(actionResult.detail || t("gateway.errors.startFailed"));
        return;
      }

      const status = await serviceService.getGatewayStatus();
      setGatewayStatus(status);
      if (status.running) {
        setStep("complete");
      } else {
        setGatewayError(status.statusDetail || t("gateway.errors.statusFailed"));
      }
    } catch (error: unknown) {
      setGatewayError(error instanceof Error ? error.message : t("gateway.errors.startFailed"));
    } finally {
      setGatewayLoading(false);
    }
  };

  const handleOpenDashboard = async (): Promise<void> => {
    try {
      await serviceService.openDashboard();
    } catch {
      // Navigation still takes the user to the embedded dashboard page.
    }
    setSetupComplete(true);
    navigate("/dashboard");
  };

  const finishSetup = (): void => {
    setSetupComplete(true);
    navigate("/dashboard");
  };

  const openAiPresetId = inferOpenAiCompatiblePresetId(form.baseUrl);

  const envRows = [
    {
      label: t("environment.labels.platform"),
      value: environment ? `${environment.platform} / ${environment.architecture}` : t("environment.values.waiting"),
    },
    {
      label: t("environment.labels.node"),
      value: environment
        ? environment.nodeFound
          ? environment.nodeVersion || t("environment.values.installed")
          : t("environment.values.missing")
        : t("environment.values.waiting"),
    },
    {
      label: t("environment.labels.npm"),
      value: environment
        ? environment.npmFound
          ? environment.npmVersion || t("environment.values.installed")
          : t("environment.values.missing")
        : t("environment.values.waiting"),
    },
    {
      label: t("environment.labels.openclaw"),
      value: environment
        ? environment.openclawFound
          ? environment.openclawVersion || t("environment.values.installed")
          : t("environment.values.missing")
        : t("environment.values.waiting"),
    },
    {
      label: t("environment.labels.configPath"),
      value: environment?.configPath || t("environment.values.waiting"),
    },
  ];

  const configBusy = configLoading || isTesting || isSaving;

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-heading">{t("page.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("page.description")}</p>
          </div>
          {setupComplete ? (
            <Badge variant="success">{t("page.badges.completed")}</Badge>
          ) : (
            <Badge variant="secondary">{t("page.badges.fresh")}</Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("page.stepIndex", { current: currentStepIndex + 1, total: STEP_KEYS.length })}</CardTitle>
            <CardDescription>{t(`steps.${step}`)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="grid gap-2">
              {STEP_KEYS.map((key) => {
                const current = key === step;
                const status = stepStates.find((item) => item.key === key)?.status ?? "pending";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (status === "done" || current) {
                        setStep(key);
                      }
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${statusClassName(status)}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-semibold">
                        {status === "done" ? <Check className="h-4 w-4" /> : STEP_KEYS.indexOf(key) + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{t(`steps.${key}`)}</p>
                        <p className="text-xs opacity-80">
                          {status === "done"
                            ? t("stepStates.done")
                            : status === "current"
                              ? t("stepStates.current")
                              : t("stepStates.pending")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            <section className="grid gap-5">
              {step === "environment" ? (
                <Card className="border-border/80 bg-muted/10">
                  <CardHeader>
                    <CardTitle>{t("environment.title")}</CardTitle>
                    <CardDescription>{t("environment.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-5">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={environment?.nodeFound ? "success" : "secondary"}>
                        {environment?.nodeFound ? t("environment.pills.nodeReady") : t("environment.pills.nodeMissing")}
                      </Badge>
                      <Badge variant={environment?.npmFound ? "success" : "secondary"}>
                        {environment?.npmFound ? t("environment.pills.npmReady") : t("environment.pills.npmMissing")}
                      </Badge>
                      <Badge variant={environment?.openclawFound ? "success" : "secondary"}>
                        {environment?.openclawFound ? t("environment.pills.openclawReady") : t("environment.pills.openclawMissing")}
                      </Badge>
                    </div>

                    <div className="grid gap-2 rounded-xl border border-border bg-background p-4">
                      {envRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
                          <span className="text-sm text-muted-foreground">{row.label}</span>
                          <span className="text-sm font-medium text-foreground">{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {envError ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <p className="font-medium">{envError.message}</p>
                        <p className="mt-1">{envError.suggestion}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => void handleEnvironmentRefresh()} disabled={envLoading || isInstalling}>
                        {envLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {t("environment.actions.refresh")}
                      </Button>
                      <Button onClick={() => moveToNext("install")} disabled={!environmentChecked || envLoading}>
                        {t("environment.actions.next")}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === "install" ? (
                <div className="grid gap-5">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("install.title")}</CardTitle>
                      <CardDescription>{t("install.description")}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">{t("install.notice.title")}</p>
                        <p className="mt-1">{t("install.notice.description")}</p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => void handleInstall()} disabled={isInstalling}>
                          {isInstalling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          {t("install.actions.install")}
                        </Button>
                        <Button variant="outline" onClick={() => setStep("config")} disabled={!installSucceeded}>
                          {t("install.actions.skipToConfig")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <InstallProgressCard progress={installProgress} />
                  <InstallPhaseTimeline phases={phases} activePhaseId={installProgress.activePhaseId} />
                  <InstallResultCard result={installResult} />
                  {installResult?.issue ? <InstallIssueCard issue={installResult.issue} /> : null}
                </div>
              ) : null}

              {step === "config" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("config.title")}</CardTitle>
                    <CardDescription>{t("config.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-5">
                    {loadIssue ? (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-medium">{loadIssue.message}</p>
                        <p className="mt-1">{loadIssue.suggestion}</p>
                        {usedDefaultValues ? <p className="mt-1 text-xs opacity-80">{t("config.defaultValues")}</p> : null}
                      </div>
                    ) : null}

                    {loadedPath ? (
                      <p className="text-xs text-muted-foreground">
                        {t("config.loadedPath")}
                        <span className="ml-1 font-mono text-foreground">{loadedPath}</span>
                      </p>
                    ) : null}

                    <OpenAIConfigForm
                      values={form}
                      errors={errors}
                      disabled={configBusy}
                      presetId={openAiPresetId}
                      onFieldChange={setField}
                      onPresetChange={applyCompatiblePreset}
                    />

                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => void testConnection()} disabled={configBusy}>
                        {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        {t("config.actions.test")}
                      </Button>
                      <Button onClick={() => void handleConfigSave()} disabled={configBusy}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {t("config.actions.save")}
                      </Button>
                    </div>

                    {testResult ? (
                      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
                        <p className="font-medium text-foreground">{testResult.detail}</p>
                        <p className="mt-1 text-muted-foreground">{testResult.suggestion}</p>
                      </div>
                    ) : null}

                    {saveResult ? (
                      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
                        <p className="font-medium text-foreground">{saveResult.detail}</p>
                        <p className="mt-1 text-muted-foreground">{saveResult.suggestion}</p>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <Button variant="outline" onClick={() => setStep("install")}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        {t("actions.previous")}
                      </Button>
                      <Button onClick={() => setStep("gateway")} disabled={!configSucceeded}>
                        {t("config.actions.next")}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === "gateway" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("gateway.title")}</CardTitle>
                    <CardDescription>{t("gateway.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-5">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={gatewayStatus?.running ? "success" : "secondary"}>
                        {gatewayStatus?.running ? t("gateway.status.running") : t("gateway.status.pending")}
                      </Badge>
                      {gatewayStatus?.port ? <Badge variant="secondary">{t("gateway.meta.port", { value: gatewayStatus.port })}</Badge> : null}
                      {gatewayStatus?.address ? <Badge variant="secondary">{gatewayStatus.address}</Badge> : null}
                    </div>

                    <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{gatewayStatus?.statusDetail ?? t("gateway.status.idle")}</p>
                      <p className="mt-1">{gatewayStatus?.suggestion ?? t("gateway.status.helper")}</p>
                    </div>

                    {gatewayActionResult ? (
                      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
                        <p className="font-medium text-foreground">{gatewayActionResult.detail}</p>
                        <p className="mt-1 text-muted-foreground">{gatewayActionResult.suggestion}</p>
                      </div>
                    ) : null}

                    {gatewayError ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {gatewayError}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => void handleGatewayStart()} disabled={gatewayLoading || !configSucceeded}>
                        {gatewayLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        {t("gateway.actions.start")}
                      </Button>
                      <Button variant="outline" onClick={() => void handleOpenDashboard()} disabled={!gatewaySucceeded}>
                        {t("gateway.actions.openDashboard")}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <Button variant="outline" onClick={() => setStep("config")}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        {t("actions.previous")}
                      </Button>
                      <Button onClick={() => setStep("complete")} disabled={!gatewaySucceeded}>
                        {t("gateway.actions.next")}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {step === "complete" ? (
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      {t("complete.title")}
                    </CardTitle>
                    <CardDescription>{t("complete.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-5">
                    <div className="grid gap-2 rounded-xl border border-green-500/20 bg-background p-4 text-sm">
                      <p className="font-medium text-foreground">{t("complete.summaryTitle")}</p>
                      <p className="text-muted-foreground">{t("complete.summary")}</p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Badge variant="success">{t("complete.badges.installReady")}</Badge>
                        <Badge variant="success">{t("complete.badges.configReady")}</Badge>
                        <Badge variant="success">{t("complete.badges.gatewayReady")}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => void handleOpenDashboard()} disabled={!gatewaySucceeded}>
                        {t("complete.actions.openDashboard")}
                      </Button>
                      <Button variant="outline" onClick={finishSetup}>
                        {t("complete.actions.enterApp")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </section>
          </CardContent>
        </Card>

        {step === "environment" ? (
          <Button variant="ghost" className="w-fit" onClick={() => setStep("install")} disabled={!environmentChecked}>
            {t("environment.actions.nextShortcut")}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
