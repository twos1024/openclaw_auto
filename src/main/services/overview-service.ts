import { detectEnv } from "./env-service.js";
import { getGatewayStatus } from "./gateway-service.js";
import { readOpenclawConfig } from "./config-service.js";
import { readAppSettings } from "./settings-service.js";
import { AppError } from "../models/error.js";

const APP_VERSION = "3.0.0";
const HEALTHY = "healthy";
const DEGRADED = "degraded";
const OFFLINE = "offline";
const INSTALL_WIZARD_ROUTE = "/install";

export interface OverviewMeta {
  label: string;
  value: string;
}

export interface OverviewSectionData {
  id: string;
  title: string;
  route: string;
  ctaLabel: string;
  level: string;
  detail: string;
  updatedAt: string;
  meta: OverviewMeta[] | null;
}

export interface OverviewStatusData {
  appVersion: string;
  platform: string;
  dashboardUrl: string;
  mode: string;
  overall: OverviewSectionData;
  service: OverviewSectionData;
  runtime: OverviewSectionData;
  config: OverviewSectionData;
  install: OverviewSectionData;
  settings: OverviewSectionData;
  nextActions: string[];
}

export async function getOverviewStatus(): Promise<OverviewStatusData> {
  const updatedAt = new Date().toISOString();

  const [envResult, gatewayResult, configResult, settingsResult] = await Promise.allSettled([
    detectEnv(),
    getGatewayStatus(),
    readOpenclawConfig(),
    readAppSettings(),
  ]);

  const env = envResult.status === "fulfilled" ? envResult.value : null;
  const envError = envResult.status === "rejected" ? (envResult.reason as AppError) : null;
  const gateway = gatewayResult.status === "fulfilled" ? gatewayResult.value : null;
  const gatewayError = gatewayResult.status === "rejected" ? (gatewayResult.reason as AppError) : null;
  const config = configResult.status === "fulfilled" ? configResult.value : null;
  const configError = configResult.status === "rejected" ? (configResult.reason as AppError) : null;
  const settings = settingsResult.status === "fulfilled" ? settingsResult.value : null;
  const settingsError = settingsResult.status === "rejected" ? (settingsResult.reason as AppError) : null;

  const runtime = buildRuntimeSection(env, envError, updatedAt);
  const install = buildInstallSection(env, envError, updatedAt);
  const configSection = buildConfigSection(config, configError, updatedAt);
  const service = buildServiceSection(gateway, gatewayError, updatedAt);
  const settingsSection = buildSettingsSection(settings, settingsError, updatedAt);
  const overall = buildOverall(runtime, install, configSection, service, settingsSection, updatedAt);
  const nextActions = buildNextActions(install, configSection, service, settingsSection);

  return {
    appVersion: APP_VERSION,
    platform: env?.platform ?? "unknown",
    dashboardUrl: gateway?.address ?? "Unavailable",
    mode: "electron-runtime-available",
    overall,
    service,
    runtime,
    config: configSection,
    install,
    settings: settingsSection,
    nextActions,
  };
}

function buildSection(
  id: string, title: string, route: string, ctaLabel: string,
  level: string, detail: string, updatedAt: string, meta: OverviewMeta[] | null,
): OverviewSectionData {
  return { id, title, route, ctaLabel, level, detail, updatedAt, meta };
}

function buildRuntimeSection(env: ReturnType<typeof Object.assign> | null, envError: AppError | null, updatedAt: string): OverviewSectionData {
  const baseMeta: OverviewMeta[] = [
    { label: "Mode", value: "electron-runtime-available" },
    { label: "IPC Bridge", value: "detected" },
  ];

  if (envError || !env) {
    return buildSection("openclaw-runtime", "桌面 Runtime", "/service", "查看 Service", OFFLINE, envError?.message ?? "环境检测失败", updatedAt, baseMeta);
  }

  const meta = [
    ...baseMeta,
    { label: "平台", value: (env as {platform: string}).platform },
    { label: "npm", value: (env as {npmVersion?: string}).npmVersion ?? "missing" },
  ];
  const detail = (env as {npmFound: boolean}).npmFound
    ? `Electron 命令桥接正常，已检测到 npm ${(env as {npmVersion?: string}).npmVersion ?? ""}`.trim()
    : "Electron 命令桥接正常，但尚未检测到 npm。";

  return buildSection("openclaw-runtime", "桌面 Runtime", "/service", "查看 Service", HEALTHY, detail, updatedAt, meta);
}

function buildInstallSection(env: unknown, envError: AppError | null, updatedAt: string): OverviewSectionData {
  if (envError || !env) {
    return buildSection("openclaw-install", "OpenClaw 安装", INSTALL_WIZARD_ROUTE, "前往 Install", OFFLINE, (envError as AppError)?.message ?? "环境检测失败", updatedAt, null);
  }
  const e = env as {npmFound: boolean; openclawFound: boolean; openclawVersion?: string; npmVersion?: string; configPath: string};
  if (!e.npmFound) {
    return buildSection("openclaw-install", "OpenClaw 安装", INSTALL_WIZARD_ROUTE, "先安装 Node.js / npm", OFFLINE, "未检测到 npm，当前无法执行 OpenClaw 安装流程。", updatedAt, [{ label: "OpenClaw", value: "missing" }]);
  }
  if (!e.openclawFound) {
    return buildSection("openclaw-install", "OpenClaw 安装", INSTALL_WIZARD_ROUTE, "开始安装", DEGRADED, "尚未检测到 OpenClaw CLI，请先完成安装。", updatedAt, [
      { label: "npm", value: e.npmVersion ?? "ready" },
      { label: "Config Path", value: e.configPath },
    ]);
  }
  return buildSection("openclaw-install", "OpenClaw 安装", INSTALL_WIZARD_ROUTE, "查看 Install", HEALTHY, `已检测到 OpenClaw ${e.openclawVersion ?? ""}`.trim(), updatedAt, [
    { label: "CLI", value: e.openclawVersion ?? "installed" },
    { label: "npm", value: e.npmVersion ?? "ready" },
  ]);
}

function buildConfigSection(config: unknown, configError: AppError | null, updatedAt: string): OverviewSectionData {
  if (configError) {
    const isNotFound = configError.code === "E_PATH_NOT_FOUND";
    return buildSection("openclaw-config", "配置文件", "/config", isNotFound ? "去配置" : "查看配置", isNotFound ? DEGRADED : OFFLINE, isNotFound ? "尚未找到 OpenClaw 配置文件，请先创建配置。" : configError.message, updatedAt, null);
  }
  const c = config as {path: string} | null;
  return buildSection("openclaw-config", "配置文件", "/config", "查看配置", HEALTHY, `已找到配置文件${c ? ": " + c.path : ""}`, updatedAt, c ? [{ label: "Path", value: c.path }] : null);
}

function buildServiceSection(gateway: unknown, gatewayError: AppError | null, updatedAt: string): OverviewSectionData {
  if (gatewayError) {
    return buildSection("openclaw-service", "Gateway 服务", "/service", "查看 Service", OFFLINE, gatewayError.message, updatedAt, null);
  }
  const g = gateway as {running: boolean; address: string; state: string; pid?: number | null} | null;
  const running = g?.running ?? false;
  return buildSection("openclaw-service", "Gateway 服务", "/service", running ? "查看 Service" : "启动 Gateway", running ? HEALTHY : DEGRADED, running ? `Gateway 正在运行 (${g?.address})` : "Gateway 未运行，点击启动。", updatedAt, g ? [
    { label: "State", value: g.state },
    { label: "Address", value: g.address },
    ...(g.pid ? [{ label: "PID", value: String(g.pid) }] : []),
  ] : null);
}

function buildSettingsSection(settings: unknown, settingsError: AppError | null, updatedAt: string): OverviewSectionData {
  if (settingsError) {
    return buildSection("openclaw-settings", "应用设置", "/settings", "查看设置", DEGRADED, settingsError.message, updatedAt, null);
  }
  return buildSection("openclaw-settings", "应用设置", "/settings", "查看设置", HEALTHY, "应用设置已加载。", updatedAt, null);
}

function buildOverall(
  runtime: OverviewSectionData, install: OverviewSectionData,
  config: OverviewSectionData, service: OverviewSectionData,
  settings: OverviewSectionData, updatedAt: string,
): OverviewSectionData {
  const sections = [runtime, install, config, service, settings];
  const hasOffline = sections.some((s) => s.level === OFFLINE);
  const hasDegraded = sections.some((s) => s.level === DEGRADED);
  const level = hasOffline ? OFFLINE : hasDegraded ? DEGRADED : HEALTHY;
  const detail = level === HEALTHY ? "所有核心组件运行正常" : level === DEGRADED ? "部分组件需要操作" : "存在离线组件，请检查";
  return buildSection("overview", "系统总览", "/overview", "查看详情", level, detail, updatedAt, null);
}

function buildNextActions(install: OverviewSectionData, config: OverviewSectionData, service: OverviewSectionData, settings: OverviewSectionData): string[] {
  const actions: string[] = [];
  if (install.level !== HEALTHY) actions.push("安装 OpenClaw CLI");
  if (config.level !== HEALTHY) actions.push("配置 OpenClaw");
  if (service.level !== HEALTHY) actions.push("启动 Gateway 服务");
  if (settings.level !== HEALTHY) actions.push("检查应用设置");
  return actions;
}
