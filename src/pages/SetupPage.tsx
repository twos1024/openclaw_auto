import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { installService } from "@/services/installService";
import { serviceService } from "@/services/serviceService";
import { useProviderStore } from "@/store/useProviderStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { InstallEnvironment } from "@/types/install";
import type { ProviderVendor } from "@/types/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const STEP_KEYS = ["welcome", "runtime", "provider", "install", "complete"] as const;

interface ProviderDraft {
  name: string;
  vendor: ProviderVendor;
  apiKey: string;
  baseUrl: string;
}

const VENDOR_OPTIONS: ProviderVendor[] = ["openai", "anthropic", "deepseek", "ollama", "google", "qwen", "zhipu", "moonshot", "groq", "mistral", "custom"];

const buildDefaultProvider = (defaultName: string): ProviderDraft => ({
  name: defaultName,
  vendor: "openai",
  apiKey: "",
  baseUrl: "",
});

export function SetupPage(): JSX.Element {
  const { t } = useTranslation("setup");
  const { t: tp } = useTranslation("providers");
  const navigate = useNavigate();

  const setupComplete = useSettingsStore((state) => state.setupComplete);
  const setSetupComplete = useSettingsStore((state) => state.setSetupComplete);

  const providers = useProviderStore((state) => state.providers);
  const savingProvider = useProviderStore((state) => state.saving);
  const validatingId = useProviderStore((state) => state.validatingId);
  const fetchProviders = useProviderStore((state) => state.fetchProviders);
  const createProvider = useProviderStore((state) => state.createProvider);
  const validateProvider = useProviderStore((state) => state.validateProvider);

  const [step, setStep] = useState(0);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  const [envData, setEnvData] = useState<InstallEnvironment | null>(null);
  const [providerMode, setProviderMode] = useState<"existing" | "new">("existing");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(() => buildDefaultProvider(t("provider.defaults.name")));
  const [providerStepError, setProviderStepError] = useState<string | null>(null);
  const [providerValidated, setProviderValidated] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installMessage, setInstallMessage] = useState(t("install.idle"));
  const [gatewayReady, setGatewayReady] = useState(false);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    const ready = providers.find((provider) => provider.status === "ready");
    if (!ready) return;
    setProviderValidated(true);
    if (!selectedProviderId) {
      setSelectedProviderId(ready.id);
    }
  }, [providers, selectedProviderId]);

  const runtimePass = Boolean(envData?.npmFound && envData?.openclawFound);

  const canNext = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return runtimePass;
    if (step === 2) return providerValidated;
    if (step === 3) return gatewayReady;
    return true;
  }, [gatewayReady, providerValidated, runtimePass, step]);

  const runRuntimeCheck = async () => {
    setEnvLoading(true);
    setEnvError(null);
    const result = await installService.detectEnv();
    if (result.ok && result.data) {
      setEnvData(result.data);
      setEnvLoading(false);
      return;
    }
    setEnvLoading(false);
    setEnvError(result.error?.message ?? t("runtime.errors.detectFailed"));
  };

  const validateExistingProvider = async () => {
    if (!selectedProviderId) {
      setProviderStepError(t("provider.errors.selectExisting"));
      return;
    }
    setProviderStepError(null);
    const valid = await validateProvider(selectedProviderId);
    if (!valid) {
      const latest = useProviderStore.getState().error;
      setProviderStepError(latest?.message ?? t("provider.errors.validateFailed"));
      setProviderValidated(false);
      return;
    }
    setProviderValidated(true);
  };

  const createAndValidateProvider = async () => {
    if (!providerDraft.name.trim()) {
      setProviderStepError(t("provider.errors.nameRequired"));
      return;
    }
    if (!providerDraft.apiKey.trim() && providerDraft.vendor !== "ollama") {
      setProviderStepError(t("provider.errors.apiKeyRequired"));
      return;
    }

    setProviderStepError(null);
    const created = await createProvider({
      name: providerDraft.name.trim(),
      vendor: providerDraft.vendor,
      apiKey: providerDraft.apiKey.trim(),
      baseUrl: providerDraft.baseUrl.trim() || undefined,
    });
    if (!created) {
      const latest = useProviderStore.getState().error;
      setProviderStepError(latest?.message ?? t("provider.errors.createFailed"));
      return;
    }

    const latestProvider = useProviderStore.getState().providers[0];
    if (!latestProvider) {
      setProviderStepError(t("provider.errors.missingRecord"));
      return;
    }

    setSelectedProviderId(latestProvider.id);
    const valid = await validateProvider(latestProvider.id);
    if (!valid) {
      const latestError = useProviderStore.getState().error;
      setProviderStepError(latestError?.message ?? t("provider.errors.validateFailed"));
      setProviderValidated(false);
      return;
    }

    setProviderValidated(true);
    setProviderMode("existing");
  };

  const installAndStartGateway = async () => {
    setInstalling(true);
    setInstallError(null);

    const env = await installService.detectEnv();
    let envSnapshot = envData;
    if (env.ok && env.data) {
      envSnapshot = env.data;
      setEnvData(env.data);
    }

    if (!envSnapshot?.openclawFound) {
      setInstallMessage(t("install.installing"));
      const installResult = await installService.installOpenClaw();
      if (installResult.status === "failure" || installResult.status === "error") {
        setInstallError(installResult.detail);
        setInstallMessage(installResult.suggestion);
        setGatewayReady(false);
        setInstalling(false);
        return;
      }
      setInstallMessage(installResult.detail);
    } else {
      setInstallMessage(t("install.skipExisting"));
    }

    const startResult = await serviceService.startGateway();
    if (startResult.status !== "success") {
      setInstallError(startResult.detail || t("install.errors.startFailed"));
      setGatewayReady(false);
      setInstalling(false);
      return;
    }

    const statusResult = await serviceService.getGatewayStatus();
    if (statusResult.running) {
      setGatewayReady(true);
      setInstallMessage(statusResult.address ? t("install.startedWithAddress", { value: statusResult.address }) : t("install.started"));
    } else {
      setGatewayReady(false);
      setInstallError(statusResult.statusDetail || t("install.errors.statusFailed"));
    }

    setInstalling(false);
  };

  const finishSetup = () => {
    setSetupComplete(true);
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-heading">{t("page.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("page.description")}</p>
          </div>
          {setupComplete ? <Badge variant="success">{t("page.badges.completed")}</Badge> : <Badge variant="secondary">{t("page.badges.fresh")}</Badge>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("page.stepIndex", { current: step + 1, total: STEP_KEYS.length })}
            </CardTitle>
            <CardDescription>{t(`steps.${STEP_KEYS[step]}`)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-5 gap-2">
              {STEP_KEYS.map((key, index) => {
                const done = index < step;
                const current = index === step;
                return (
                  <div
                    key={key}
                    className={
                      done
                        ? "rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5 text-center text-xs font-medium text-primary"
                        : current
                          ? "rounded-lg border border-foreground/30 bg-foreground/10 px-2 py-1.5 text-center text-xs font-medium text-foreground"
                          : "rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center text-xs text-muted-foreground"
                    }
                  >
                    {done ? <Check className="mx-auto h-3.5 w-3.5" /> : index + 1}
                  </div>
                );
              })}
            </div>

            {step === 0 ? (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm leading-relaxed text-foreground">{t("welcome.body")}</p>
                <p className="text-sm text-muted-foreground">{t("welcome.hint")}</p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => void runRuntimeCheck()} disabled={envLoading}>
                    {envLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {t("runtime.actions.check")}
                  </Button>
                  <Badge variant={runtimePass ? "success" : "secondary"}>{runtimePass ? t("runtime.state.passed") : t("runtime.state.pending")}</Badge>
                </div>

                {envError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{envError}</p>
                ) : null}

                {envData ? (
                  <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 text-sm">
                    <p>{t("runtime.fields.platform", { value: `${envData.platform} / ${envData.architecture}` })}</p>
                    <p>{t("runtime.fields.npm", { value: envData.npmFound ? envData.npmVersion || t("runtime.values.installed") : t("runtime.values.missing") })}</p>
                    <p>{t("runtime.fields.openclaw", { value: envData.openclawFound ? envData.openclawVersion || t("runtime.values.installed") : t("runtime.values.missing") })}</p>
                    {!runtimePass ? <p className="text-destructive">{t("runtime.requirement")}</p> : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("runtime.idle")}</p>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{t("provider.modeLabel")}</p>
                    <Select value={providerMode} onChange={(event) => setProviderMode(event.target.value as "existing" | "new")} className="w-48">
                      <option value="existing">{t("provider.modes.existing")}</option>
                      <option value="new">{t("provider.modes.new")}</option>
                    </Select>
                  </div>

                  {providerMode === "existing" ? (
                    <>
                      <Select
                        value={selectedProviderId}
                        onChange={(event) => {
                          setSelectedProviderId(event.target.value);
                          setProviderValidated(false);
                        }}
                      >
                        <option value="">{t("provider.placeholders.selectExisting")}</option>
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name} ({tp(`dialog.options.vendor.${provider.vendor}`)})
                          </option>
                        ))}
                      </Select>
                      <Button onClick={() => void validateExistingProvider()} disabled={Boolean(validatingId) || !selectedProviderId}>
                        {validatingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        {t("provider.actions.validate")}
                      </Button>
                    </>
                  ) : (
                    <div className="grid gap-2">
                      <Input
                        value={providerDraft.name}
                        onChange={(event) => setProviderDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder={t("provider.placeholders.name")}
                      />
                      <Select
                        value={providerDraft.vendor}
                        onChange={(event) => setProviderDraft((current) => ({ ...current, vendor: event.target.value as ProviderVendor }))}
                      >
                        {VENDOR_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {tp(`dialog.options.vendor.${option}`)}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="password"
                        value={providerDraft.apiKey}
                        onChange={(event) => setProviderDraft((current) => ({ ...current, apiKey: event.target.value }))}
                        placeholder={providerDraft.vendor === "ollama" ? t("provider.placeholders.apiKeyOllama") : t("provider.placeholders.apiKey")}
                      />
                      <Input
                        value={providerDraft.baseUrl}
                        onChange={(event) => setProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                        placeholder={t("provider.placeholders.baseUrl")}
                      />
                      <Button onClick={() => void createAndValidateProvider()} disabled={savingProvider || Boolean(validatingId)}>
                        {savingProvider || validatingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        {t("provider.actions.createAndValidate")}
                      </Button>
                    </div>
                  )}
                </div>

                {providerStepError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {providerStepError}
                  </p>
                ) : null}

                <Badge variant={providerValidated ? "success" : "secondary"}>{providerValidated ? t("provider.state.validated") : t("provider.state.pending")}</Badge>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <Button onClick={() => void installAndStartGateway()} disabled={installing}>
                  {installing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {t("install.actions.install")}
                </Button>

                <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">{installMessage}</p>

                {installError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {installError}
                  </p>
                ) : null}

                <Badge variant={gatewayReady ? "success" : "secondary"}>{gatewayReady ? t("install.state.running") : t("install.state.pending")}</Badge>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("complete.title")}
                </p>
                <p className="text-sm text-muted-foreground">{t("complete.description")}</p>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t("actions.previous")}
              </Button>

              {step < STEP_KEYS.length - 1 ? (
                <Button onClick={() => setStep((current) => Math.min(STEP_KEYS.length - 1, current + 1))} disabled={!canNext}>
                  {t("actions.next")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={finishSetup}>{t("actions.finish")}</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
