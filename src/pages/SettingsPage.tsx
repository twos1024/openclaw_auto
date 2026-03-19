import { useEffect, useState } from "react";
import { RefreshCw, Play, Square, RotateCcw, CheckCircle2, AlertCircle, Server, Globe, Shield, Info } from "lucide-react";
import { invokeCommand } from "@/services/tauriClient";
import { clearGatewayUrlCache } from "@/lib/gateway-client";
import { APP_DISPLAY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GatewayStatus {
  state: "running" | "stopped" | "starting" | "stopping" | "error" | "unknown";
  running: boolean;
  port: number;
  address: string;
  pid: number | null;
  statusDetail: string;
}

interface AppSettings {
  gatewayPollMs: number;
  logLineLimit: number;
  diagnosticsDir: string;
  preferredInstallSource: string;
}

// ─── Gateway status card ──────────────────────────────────────────────────────

function GatewayCard() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState<"start" | "stop" | "restart" | null>(null);
  const [polling, setPolling] = useState(false);

  const refresh = async () => {
    setPolling(true);
    const result = await invokeCommand<GatewayStatus>("get_gateway_status");
    if (result.success && result.data) setStatus(result.data);
    setPolling(false);
  };

  const start = async () => {
    setLoading("start");
    clearGatewayUrlCache();
    await invokeCommand("start_gateway");
    await refresh();
    setLoading(null);
  };

  const stop = async () => {
    setLoading("stop");
    clearGatewayUrlCache();
    await invokeCommand("stop_gateway");
    await refresh();
    setLoading(null);
  };

  const restart = async () => {
    setLoading("restart");
    clearGatewayUrlCache();
    await invokeCommand("restart_gateway");
    await refresh();
    setLoading(null);
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Gateway 服务</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refresh()} disabled={polling} className="h-7 w-7">
            <RefreshCw className={cn("h-3.5 w-3.5", polling && "animate-spin")} />
          </Button>
        </div>
        <CardDescription>管理 OpenClaw 网关进程的启停状态</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", isRunning ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/40")} />
            <span className={cn("text-sm font-medium", stateColor)}>
              {status ? {
                running: "运行中",
                stopped: "已停止",
                starting: "启动中...",
                stopping: "停止中...",
                error: "错误",
                unknown: "未知",
              }[state] : "查询中..."}
            </span>
          </div>
          {status && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {status.port > 0 && <span>端口 {status.port}</span>}
              {status.pid && <span>PID {status.pid}</span>}
            </div>
          )}
        </div>

        {status?.statusDetail && (
          <p className="text-xs text-muted-foreground px-1">{status.statusDetail}</p>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={() => void start()} disabled={loading !== null} className="flex-1">
              {loading === "start" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" fill="currentColor" />}
              启动 Gateway
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => void restart()} disabled={loading !== null} className="flex-1">
                {loading === "restart" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                重启
              </Button>
              <Button variant="outline" onClick={() => void stop()} disabled={loading !== null} className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/40 flex-1">
                {loading === "stop" ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" fill="currentColor" />}
                停止
              </Button>
            </>
          )}
        </div>

        {isRunning && status?.address && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span>服务地址: <code className="font-mono">{status.address}</code></span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── App settings card ────────────────────────────────────────────────────────

function AppSettingsCard() {
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
      return "Gateway 轮询间隔须在 1000–60000 ms 之间";
    if (form.logLineLimit < 50 || form.logLineLimit > 5000)
      return "日志行数须在 50–5000 之间";
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
      setSaveError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <CardTitle>应用设置</CardTitle>
        </div>
        <CardDescription>轮询间隔、日志、诊断目录等配置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Gateway 轮询间隔 (ms)</span>
            <Input
              type="number"
              min={1000}
              max={60000}
              value={form.gatewayPollMs}
              onChange={(e) => setForm((f) => ({ ...f, gatewayPollMs: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">日志行数限制</span>
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
          <span className="text-sm font-medium">诊断目录</span>
          <Input
            value={form.diagnosticsDir}
            onChange={(e) => setForm((f) => ({ ...f, diagnosticsDir: e.target.value }))}
            placeholder="留空使用默认目录"
          />
        </label>
        {saveError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{saveError}
          </p>
        )}
        <Button onClick={() => void save()} disabled={saving} className={cn(saved && "bg-green-500 hover:bg-green-600")}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : saved ? <CheckCircle2 className="h-4 w-4 mr-2" /> : null}
          {saving ? "保存中..." : saved ? "已保存" : "保存设置"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Environment card ─────────────────────────────────────────────────────────

function EnvironmentCard() {
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
      <span className="text-xs text-muted-foreground font-mono">{value ?? (ok ? "✓" : "未找到")}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <CardTitle>运行环境</CardTitle>
        </div>
        <CardDescription>Node.js、npm、OpenClaw CLI 检测结果</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <RefreshCw className="h-4 w-4 animate-spin" />检测环境中...
          </div>
        ) : env ? (
          <div className="space-y-0">
            <EnvRow label="平台" ok={true} value={env.platform} />
            <EnvRow label="npm" ok={env.npmFound} value={env.npmVersion ?? undefined} />
            <EnvRow
              label="OpenClaw CLI"
              ok={env.openclawFound}
              value={env.openclawVersion ?? env.openclawPath ?? undefined}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">环境检测失败</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1
          className="page-heading"
        >
          设置
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gateway 管理、运行环境、应用偏好配置
        </p>
      </div>

      <GatewayCard />
      <EnvironmentCard />
      <AppSettingsCard />

      {/* Version info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
        <span>{APP_DISPLAY}</span>
        <span>·</span>
        <span>Powered by APIMart</span>
      </div>
    </div>
  );
}
