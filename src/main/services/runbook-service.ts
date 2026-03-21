import { getOverviewStatus, type OverviewStatusData, type OverviewMeta } from "./overview-service.js";

export interface WorkspaceBannerActionData {
  label: string;
  route: string;
  description: string;
}

export interface WorkspaceBannerData {
  mode: string;
  tone: string;
  headline: string;
  summary: string;
  primaryAction?: WorkspaceBannerActionData;
  meta: OverviewMeta[];
}

export interface GuidedSetupStepData {
  id: string;
  title: string;
  description: string;
  route: string;
  actionLabel: string;
  status: string;
}

export interface GuidedLaunchCheckData {
  id: string;
  title: string;
  level: string;
  detail: string;
  route: string;
}

export interface RunbookBlockerData {
  id: string;
  title: string;
  detail: string;
  level: string;
  route: string;
  actionLabel: string;
}

export interface RunbookSupportActionData {
  id: string;
  label: string;
  route: string;
  description: string;
}

export interface RunbookModelData {
  headline: string;
  summary: string;
  primaryRoute: string;
  primaryLabel: string;
  lastCheckedAt: string;
  overallLevel: string;
  launchChecks: GuidedLaunchCheckData[];
  steps: GuidedSetupStepData[];
  blockers: RunbookBlockerData[];
  currentBlocker?: RunbookBlockerData;
  supportActions: RunbookSupportActionData[];
  banner: WorkspaceBannerData;
}

export async function getRunbookModel(): Promise<RunbookModelData> {
  const overview = await getOverviewStatus();
  return buildRunbookModel(overview);
}

export function buildRunbookModel(status: OverviewStatusData): RunbookModelData {
  const steps = buildSteps(status);
  const launchChecks = buildLaunchChecks(status);
  const blockers = buildBlockers(status);
  const currentBlocker = blockers[0];

  const primaryStep = steps.find((s) => s.status === "current" || s.status === "ready") ?? steps[0]!;
  const primaryRoute = currentBlocker?.route ?? primaryStep.route;
  const primaryLabel = currentBlocker?.actionLabel ?? primaryStep.actionLabel;

  return {
    headline: currentBlocker ? `下一步：${currentBlocker.title}` : "已经可以开始使用了",
    summary: currentBlocker
      ? "一次只做一件事。完成当前步骤后，再继续下一步。"
      : "安装、API Key 配置和 Gateway 都已经就绪，现在可以直接打开 Dashboard。",
    primaryRoute,
    primaryLabel,
    lastCheckedAt: status.overall.updatedAt,
    overallLevel: status.overall.level,
    launchChecks,
    steps,
    blockers,
    currentBlocker,
    supportActions: buildSupportActions(),
    banner: buildWorkspaceBanner(status),
  };
}

function buildSteps(status: OverviewStatusData): GuidedSetupStepData[] {
  const installDone = status.install.level === "healthy";
  const configDone = status.config.level === "healthy";
  const serviceDone = status.service.level === "healthy";

  return [
    {
      id: "install",
      title: "安装 OpenClaw CLI",
      description: "通过 npm 安装 OpenClaw 命令行工具",
      route: "/install",
      actionLabel: installDone ? "已安装" : "开始安装",
      status: installDone ? "done" : "current",
    },
    {
      id: "config",
      title: "配置 API Key",
      description: "设置 LLM Provider 和 API Key",
      route: "/config",
      actionLabel: configDone ? "已配置" : "去配置",
      status: !installDone ? "blocked" : configDone ? "done" : "current",
    },
    {
      id: "service",
      title: "启动 Gateway 服务",
      description: "启动本地 OpenClaw Gateway 服务",
      route: "/service",
      actionLabel: serviceDone ? "已运行" : "启动 Gateway",
      status: !installDone || !configDone ? "blocked" : serviceDone ? "done" : "current",
    },
    {
      id: "dashboard",
      title: "打开 Dashboard",
      description: "使用 OpenClaw Dashboard 管理 Agents",
      route: "/dashboard",
      actionLabel: "打开 Dashboard",
      status: !installDone || !configDone || !serviceDone ? "blocked" : "ready",
    },
  ];
}

function buildLaunchChecks(status: OverviewStatusData): GuidedLaunchCheckData[] {
  return [
    { id: "runtime", title: "桌面 Runtime", level: status.runtime.level, detail: status.runtime.detail, route: "/service" },
    { id: "install", title: "OpenClaw CLI", level: status.install.level, detail: status.install.detail, route: "/install" },
    { id: "config", title: "配置文件", level: status.config.level, detail: status.config.detail, route: "/config" },
    { id: "service", title: "Gateway 服务", level: status.service.level, detail: status.service.detail, route: "/service" },
  ];
}

function buildBlockers(status: OverviewStatusData): RunbookBlockerData[] {
  const blockers: RunbookBlockerData[] = [];
  const sections = [
    { data: status.install, id: "install", title: "安装 OpenClaw CLI", route: "/install", actionLabel: "前往安装" },
    { data: status.config, id: "config", title: "配置 API Key", route: "/config", actionLabel: "前往配置" },
    { data: status.service, id: "service", title: "启动 Gateway 服务", route: "/service", actionLabel: "启动 Gateway" },
  ];
  for (const s of sections) {
    if (s.data.level !== "healthy") {
      blockers.push({ id: s.id, title: s.title, detail: s.data.detail, level: s.data.level, route: s.route, actionLabel: s.actionLabel });
    }
  }
  return blockers;
}

function buildSupportActions(): RunbookSupportActionData[] {
  return [
    { id: "logs", label: "查看日志", route: "/logs", description: "检查安装和运行日志" },
    { id: "settings", label: "应用设置", route: "/settings", description: "调整应用配置" },
    { id: "diagnostics", label: "导出诊断", route: "/logs", description: "导出诊断包以获取帮助" },
  ];
}

function buildWorkspaceBanner(status: OverviewStatusData): WorkspaceBannerData {
  const isHealthy = status.overall.level === "healthy";
  const tone = isHealthy ? "success" : status.overall.level === "offline" ? "error" : "warning";

  const meta: OverviewMeta[] = [
    { label: "Mode", value: "electron-runtime-available" },
    { label: "IPC Bridge", value: "detected" },
    { label: "Version", value: "3.0.0" },
  ];

  return {
    mode: "electron-runtime-available",
    tone,
    headline: isHealthy ? "ClawDesk 已就绪" : "需要完成设置",
    summary: status.overall.detail,
    primaryAction: !isHealthy
      ? { label: "查看状态", route: "/overview", description: "查看系统状态总览" }
      : undefined,
    meta,
  };
}
