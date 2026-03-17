import type { GuidedLaunchCheck, GuidedSetupStep } from "../types/guidedSetup";
import type { OverviewStatus } from "../types/status";
import type {
  RunbookBlocker,
  RunbookModel,
  RunbookSupportAction,
  WorkspaceBannerAction,
  WorkspaceBannerModel,
  WorkspaceBannerTone,
} from "../types/workspace";

function resolveBannerTone(status: OverviewStatus): WorkspaceBannerTone {
  if (status.mode === "runtime-unavailable") return "error";
  if (status.mode === "preview") return "warning";
  if (status.overall.level === "healthy") return "success";
  if (status.overall.level === "degraded") return "warning";
  if (status.overall.level === "offline") return "error";
  return "info";
}

function resolveBannerHeadline(status: OverviewStatus): string {
  if (status.mode === "preview") return "Browser Preview Mode";
  if (status.mode === "runtime-unavailable") return "Desktop Runtime Bridge Unavailable";
  return status.overall.headline;
}

function resolveBannerSummary(status: OverviewStatus): string {
  if (status.mode === "preview") {
    return "当前仅展示只读预览界面。需要在 Tauri 原生桌面壳中运行，才能使用安装、日志、配置和服务控制。";
  }

  if (status.mode === "runtime-unavailable") {
    return "当前已进入桌面窗口，但前端未连上 Tauri 命令桥。这个问题应优先修复，否则本地命令和文件操作都不可用。";
  }

  return status.overall.summary;
}

function resolvePrimaryAction(status: OverviewStatus): WorkspaceBannerAction | null {
  const action = status.nextActions[0];
  if (!action) return null;
  return {
    label: action.label,
    route: action.route,
    description: action.description,
  };
}

export function buildWorkspaceBanner(status: OverviewStatus): WorkspaceBannerModel {
  return {
    mode: status.mode === "live" ? "live" : status.mode,
    tone: resolveBannerTone(status),
    headline: resolveBannerHeadline(status),
    summary: resolveBannerSummary(status),
    primaryAction: resolvePrimaryAction(status),
    meta: [
      { label: "App Version", value: status.appVersion },
      { label: "Platform", value: status.platform },
      { label: "Dashboard", value: status.dashboardUrl },
    ],
  };
}

function isHealthy(level: OverviewStatus["overall"]["level"]): boolean {
  return level === "healthy";
}

function stepStatus(
  current: GuidedSetupStep["id"],
  active: GuidedSetupStep["id"],
  complete: boolean,
): GuidedSetupStep["status"] {
  if (complete) return "complete";
  if (current === active) return current === "dashboard" ? "ready" : "current";
  return "blocked";
}

function buildSteps(status: OverviewStatus): GuidedSetupStep[] {
  const installReady = isHealthy(status.install.level);
  const configReady = installReady && isHealthy(status.config.level);
  const serviceReady = configReady && isHealthy(status.service.level);

  const activeStep: GuidedSetupStep["id"] = !installReady
    ? "install"
    : !configReady
      ? "config"
      : !serviceReady
        ? "service"
        : "dashboard";

  return [
    {
      id: "install",
      title: "安装 OpenClaw",
      description: status.install.detail,
      route: "/install?wizard=1",
      actionLabel: "去安装",
      status: stepStatus("install", activeStep, installReady),
    },
    {
      id: "config",
      title: "填写 API Key",
      description: status.config.detail,
      route: "/config",
      actionLabel: "去填写 API Key",
      status: stepStatus("config", activeStep, configReady),
    },
    {
      id: "service",
      title: "启动 Gateway",
      description: status.service.detail,
      route: "/service",
      actionLabel: "去启动 Gateway",
      status: stepStatus("service", activeStep, serviceReady),
    },
    {
      id: "dashboard",
      title: "开始使用 OpenClaw",
      description: serviceReady
        ? "Gateway 已就绪，现在可以直接打开 Dashboard 开始使用。"
        : "需要先启动 Gateway，才能打开 Dashboard 正常使用。",
      route: "/dashboard",
      actionLabel: "打开 Dashboard",
      status: stepStatus("dashboard", activeStep, false),
    },
  ];
}

function buildLaunchChecks(status: OverviewStatus): GuidedLaunchCheck[] {
  return [
    {
      id: "install",
      title: "安装检查",
      level: status.install.level,
      detail: status.install.detail,
      route: "/install?wizard=1",
    },
    {
      id: "config",
      title: "配置检查",
      level: status.config.level,
      detail: status.config.detail,
      route: "/config",
    },
    {
      id: "service",
      title: "服务检查",
      level: status.service.level,
      detail: status.service.detail,
      route: "/service",
    },
  ];
}

function buildBlockers(status: OverviewStatus): RunbookBlocker[] {
  const blockers: RunbookBlocker[] = [];

  if (status.mode === "runtime-unavailable") {
    blockers.push({
      id: "runtime-bridge",
      title: "修复桌面运行时桥接",
      detail: status.runtime.detail,
      level: status.runtime.level,
      route: "/settings",
      actionLabel: "修复运行时",
    });
  }

  if (status.mode === "preview") {
    blockers.push({
      id: "preview-mode",
      title: "切换到桌面模式",
      detail: status.runtime.detail,
      level: status.runtime.level,
      route: "/runbook",
      actionLabel: "查看说明",
    });
  }

  if (!isHealthy(status.install.level)) {
    blockers.push({
      id: "install",
      title: status.install.title,
      detail: status.install.detail,
      level: status.install.level,
      route: "/install?wizard=1",
      actionLabel: "去安装",
    });
  }

  if (!isHealthy(status.config.level)) {
    blockers.push({
      id: "config",
      title: status.config.title,
      detail: status.config.detail,
      level: status.config.level,
      route: "/config",
      actionLabel: "去填写 API Key",
    });
  }

  if (!isHealthy(status.service.level)) {
    blockers.push({
      id: "service",
      title: status.service.title,
      detail: status.service.detail,
      level: status.service.level,
      route: "/service",
      actionLabel: "去启动 Gateway",
    });
  }

  return blockers;
}

function buildSupportActions(currentBlocker: RunbookBlocker | null): RunbookSupportAction[] {
  const actions: RunbookSupportAction[] = [];
  if (currentBlocker) {
    actions.push({
      id: "primary",
      label: currentBlocker.actionLabel,
      route: currentBlocker.route,
      description: "先完成当前这一步，再继续下面的流程。",
    });
  }

  actions.push(
    {
      id: "runbook",
      label: "查看完整步骤",
      route: "/runbook",
      description: "如果你想看完整流程顺序，再打开这里。",
    },
    {
      id: "logs",
      label: "查看日志",
      route: "/logs",
      description: "只有安装或启动失败时，再来这里看错误日志。",
    },
    {
      id: "settings",
      label: "打开设置",
      route: "/settings",
      description: "当桌面运行时有问题时，再来这里检查设置和环境。",
    },
  );

  return actions.filter(
    (action, index, list) => list.findIndex((candidate) => candidate.route === action.route) === index,
  );
}

export function buildRunbookModel(status: OverviewStatus): RunbookModel {
  const steps = buildSteps(status);
  const launchChecks = buildLaunchChecks(status);
  const blockers = buildBlockers(status);
  const currentBlocker = blockers[0] ?? null;
  const primaryStep = steps.find((step) => step.status === "current" || step.status === "ready") ?? steps[0];

  return {
    headline: currentBlocker ? `下一步：${currentBlocker.title}` : "已经可以开始使用了",
    summary: currentBlocker
      ? "一次只做一件事。完成当前步骤后，再继续下一步。"
      : "安装、API Key 配置和 Gateway 都已经就绪，现在可以直接打开 Dashboard。",
    primaryRoute: primaryStep.route,
    primaryLabel: primaryStep.actionLabel,
    lastCheckedAt: status.overall.updatedAt,
    overallLevel: status.overall.level,
    launchChecks,
    steps,
    blockers,
    currentBlocker,
    supportActions: buildSupportActions(currentBlocker),
    banner: buildWorkspaceBanner(status),
  };
}
