import { useEffect, useState } from "react";
import { RefreshCw, Play, Square, RotateCcw, CheckCircle2, AlertCircle, Server, Globe, Shield, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { invokeCommand } from "@/services/tauriClient";
import { clearGatewayUrlCache } from "@/lib/gateway-client";
import { APP_DISPLAY } from "@/lib/constants";
import type { AppLanguage, ThemePreference } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useGatewayControl } from "@/hooks/useGatewayControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AppSettings {
  gatewayPollMs: number;
  logLineLimit: number;
  diagnosticsDir: string;
  preferredInstallSource: string;
}

// ─── Gateway status card ──────────────────────────────────────────────────────

function GatewayCard() {
  const { t } = useTranslation(["common", "settings"]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Re-use the shared gateway control hook instead of an independent
  // polling timer.  This avoids spawning duplicate status-check processes
  // (critical for Windows memory usage).
  const {
    status,
    isRefreshing: polling,
    loadingByAction,
    refreshStatus,
    startGateway: hookStart,
    stopGateway: hookStop,
    restartGateway: hookRestart,
  } = useGatewayControl(5000);

  const loading = loadingByAction.start ? "start" : loadingByAction.stop ? "stop" : loadingByAction.restart ? "restart" : null;

  const start = async () => {
    setActionError(null);
    clearGatewayUrlCache();
    const result = await hookStart();
    if (result && result.status !== "success") {
      setActionError(result.detail);
    }
  };

  const stop = async () => {
    setActionError(null);
    clearGatewayUrlCache();
    const result = await hookStop();
    if (result && result.status !== "success") {
      setActionError(result.detail);
    }
  };

  const restart = async () => {
    setActionError(null);
    clearGatewayUrlCache();
    const result = await hookRestart();
    if (result && result.status !== "success") {
      setActionError(result.detail);
    }
  };

  const isRunning = status?.running ?? false;
  const state = status?.state ?? "unknown";

  const stateColor = {
    running: "text-green-600 dark:text-green-400",
    stopped: "text-muted-foreground",
    starting: "text-amber-600",
    stopping: "text-amber-600",
    error: "text-destructive",
    unknown: "text-muted-foreground",
  }[state] ?? "text-muted-foreground";
  const stateLabel = status
    ? {
        running: t("settings:gateway.status.running"),
        stopped: t("settings:gateway.status.stopped"),
        starting: t("settings:gateway.status.starting"),
        stopping: t("settings:gateway.status.stopping"),
        error: t("settings:gateway.status.error"),
        unknown: t("settings:gateway.status.unknown"),
      }[state]
    : t("settings:gateway.status.checking");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle>{t("settings:gateway.title")}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refreshStatus()} disabled={polling} className="h-7 w-7">
            <RefreshCw className={cn("h-3.5 w-3.5", polling && "animate-spin")} />
          </Button>
        </div>
        <CardDescription>{t("settings:gateway.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", isRunning ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/40")} />
            <span className={cn("text-sm font-medium", stateColor)}>{stateLabel}</span>
          </div>
          {status && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {(status.port ?? 0) > 0 && <span>{t("settings:gateway.labels.port")} {status.port}</span>}
              {status.pid && <span>{t("settings:gateway.labels.pid")} {status.pid}</span>}
            </div>
          )}
        </div>

        {status?.statusDetail && (
          <p className="text-xs text-muted-foreground px-1">{status.statusDetail}</p>
        )}
        {actionError ? (
          <p className="text-xs text-destructive px-1">{actionError}</p>
        ) : null}

        {/* Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={() => void start()} disabled={loading !== null} className="flex-1">
              {loading === "start" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" fill="currentColor" />}
              {t("settings:gateway.actions.start")}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => void restart()} disabled={loading !== null} className="flex-1">
                {loading === "restart" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                {t("settings:gateway.actions.restart")}
              </Button>
              <Button variant="outline" onClick={() => void stop()} disabled={loading !== null} className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/40 flex-1">
                {loading === "stop" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" fill="currentColor" />}
                {t("settings:gateway.actions.stop")}
              </Button>
            </>
          )}
        </div>

        {isRunning && status?.address && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span>{t("settings:gateway.labels.address")}: <code className="font-mono">{status.address}</code></span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── App settings card ────────────────────────────────────────────────────────

function AppSettingsCard() {
  const { t } = useTranslation(["common", "settings"]);
  const [form, setForm] = useState<AppSettings>({
    gatewayPollMs: 5000,
    logLineLimit: 500,
    diagnosticsDir: "",
    preferredInstallSource: "npm-global",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await invokeCommand<AppSettings>("read_app_settings");
      if (result.success && result.data) setForm(result.data);
    };
    void load();
  }, []);

  const validate = (): string | null => {
    if (form.gatewayPollMs < 1000 || form.gatewayPollMs > 60000)
      return t("settings:app.validation.gatewayPollMsRange");
    if (form.logLineLimit < 50 || form.logLineLimit > 5000)
      return t("settings:app.validation.logLineLimitRange");
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { setSaveError(err); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await invokeCommand("write_app_settings", { settings: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(t("settings:app.validation.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <CardTitle>{t("settings:app.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings:app.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("settings:app.fields.gatewayPollMs")}</span>
            <Input
              type="number"
              min={1000}
              max={60000}
              value={form.gatewayPollMs}
              onChange={(e) => setForm((f) => ({ ...f, gatewayPollMs: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("settings:app.fields.logLineLimit")}</span>
            <Input
              type="number"
              min={50}
              max={5000}
              value={form.logLineLimit}
              onChange={(e) => setForm((f) => ({ ...f, logLineLimit: Number(e.target.value) }))}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("settings:app.fields.diagnosticsDir")}</span>
          <Input
            value={form.diagnosticsDir}
            onChange={(e) => setForm((f) => ({ ...f, diagnosticsDir: e.target.value }))}
            placeholder={t("settings:app.fields.diagnosticsDirHint")}
          />
        </label>
        {saveError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{saveError}
          </p>
        )}
        <Button onClick={() => void save()} disabled={saving} className={cn(saved && "bg-green-500 hover:bg-green-600")}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : saved ? <CheckCircle2 className="h-4 w-4 mr-2" /> : null}
          {saving ? t("settings:app.actions.saving") : saved ? t("settings:app.actions.saved") : t("settings:app.actions.save")}
        </Button>
      </CardContent>
    </Card>
  );
}

function PreferencesCard() {
  const { t } = useTranslation(["common", "settings"]);
  const theme = useSettingsStore((state) => state.theme);
  const language = useSettingsStore((state) => state.language);
  const setupComplete = useSettingsStore((state) => state.setupComplete);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const setSetupComplete = useSettingsStore((state) => state.setSetupComplete);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <CardTitle>{t("settings:preferencesTitle")}</CardTitle>
          <Badge variant={setupComplete ? "success" : "secondary"}>{setupComplete ? t("settings:preferences.setupBadge.complete") : t("settings:preferences.setupBadge.incomplete")}</Badge>
        </div>
        <CardDescription>{t("settings:preferencesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("common:theme")}</span>
            <Select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
              <option value="light">{t("settings:themeLight")}</option>
              <option value="dark">{t("settings:themeDark")}</option>
              <option value="system">{t("settings:themeSystem")}</option>
            </Select>
            <span className="text-xs text-muted-foreground">{t("settings:themeDescription")}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("common:language")}</span>
            <Select value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)}>
              <option value="zh">{t("settings:languageZh")}</option>
              <option value="en">{t("settings:languageEn")}</option>
              <option value="ja">{t("settings:languageJa")}</option>
            </Select>
            <span className="text-xs text-muted-foreground">{t("settings:languageDescription")}</span>
          </label>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings:preferences.wizard.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("settings:preferences.wizard.description")}</p>
          </div>
          <Switch checked={setupComplete} onCheckedChange={setSetupComplete} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Environment card ─────────────────────────────────────────────────────────

function EnvironmentCard() {
  const { t } = useTranslation(["common", "settings"]);
  const [env, setEnv] = useState<{
    platform: string;
    npmFound: boolean;
    npmVersion: string | null;
    openclawFound: boolean;
    openclawVersion: string | null;
    openclawPath: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const result = await invokeCommand<typeof env>("detect_env");
      if (result.success && result.data) setEnv(result.data);
      setLoading(false);
    };
    void load();
  }, []);

  const EnvRow = ({ label, ok, value }: { label: string; ok: boolean; value?: string | null }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
          : <AlertCircle className="h-4 w-4 text-destructive" />}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground font-mono">{value ?? (ok ? "✓" : t("settings:environment.status.notFound"))}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <CardTitle>{t("settings:environment.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings:environment.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <RefreshCw className="h-4 w-4 animate-spin" />{t("settings:environment.status.checking")}
          </div>
        ) : env ? (
          <div className="space-y-0">
            <EnvRow label={t("settings:environment.labels.platform")} ok={true} value={env.platform} />
            <EnvRow label={t("settings:environment.labels.npm")} ok={env.npmFound} value={env.npmVersion ?? undefined} />
            <EnvRow
              label={t("settings:environment.labels.openclawCli")}
              ok={env.openclawFound}
              value={env.openclawVersion ?? env.openclawPath ?? undefined}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("settings:environment.status.failed")}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage(): JSX.Element {
  const { t } = useTranslation(["common", "settings"]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1
          className="page-heading"
        >
          {t("settings:title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("settings:description")}
        </p>
      </div>

      <GatewayCard />
      <PreferencesCard />
      <EnvironmentCard />
      <AppSettingsCard />

      {/* Version info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
        <span>{APP_DISPLAY}</span>
        <span>·</span>
        <span>{t("common:poweredBy")}</span>
      </div>
    </div>
  );
}
