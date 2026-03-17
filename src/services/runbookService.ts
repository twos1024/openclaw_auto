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
      title: "Install OpenClaw",
      description: status.install.detail,
      route: "/install?wizard=1",
      actionLabel: "Go to Install",
      status: stepStatus("install", activeStep, installReady),
    },
    {
      id: "config",
      title: "Save Provider Config",
      description: status.config.detail,
      route: "/config",
      actionLabel: "Go to Config",
      status: stepStatus("config", activeStep, configReady),
    },
    {
      id: "service",
      title: "Start Gateway",
      description: status.service.detail,
      route: "/service",
      actionLabel: "Go to Service",
      status: stepStatus("service", activeStep, serviceReady),
    },
    {
      id: "dashboard",
      title: "Open Embedded Dashboard",
      description: serviceReady
        ? "Gateway 已就绪，可以直接进入 ClawDesk 内嵌 Dashboard 工作台。"
        : "需要先让 Gateway 进入健康状态，才能打开内嵌 Dashboard。",
      route: "/dashboard",
      actionLabel: "Open Dashboard",
      status: stepStatus("dashboard", activeStep, false),
    },
  ];
}

function buildLaunchChecks(status: OverviewStatus): GuidedLaunchCheck[] {
  return [
    {
      id: "install",
      title: "Install Check",
      level: status.install.level,
      detail: status.install.detail,
      route: "/install?wizard=1",
    },
    {
      id: "config",
      title: "Config Check",
      level: status.config.level,
      detail: status.config.detail,
      route: "/config",
    },
    {
      id: "service",
      title: "Service Check",
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
      actionLabel: "Inspect Runtime",
    });
  }

  if (status.mode === "preview") {
    blockers.push({
      id: "preview-mode",
      title: "切换到桌面模式",
      detail: status.runtime.detail,
      level: status.runtime.level,
      route: "/runbook",
      actionLabel: "Open Runbook",
    });
  }

  if (!isHealthy(status.install.level)) {
    blockers.push({
      id: "install",
      title: status.install.title,
      detail: status.install.detail,
      level: status.install.level,
      route: "/install?wizard=1",
      actionLabel: "Resolve Install",
    });
  }

  if (!isHealthy(status.config.level)) {
    blockers.push({
      id: "config",
      title: status.config.title,
      detail: status.config.detail,
      level: status.config.level,
      route: "/config",
      actionLabel: "Open Config",
    });
  }

  if (!isHealthy(status.service.level)) {
    blockers.push({
      id: "service",
      title: status.service.title,
      detail: status.service.detail,
      level: status.service.level,
      route: "/service",
      actionLabel: "Open Service",
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
      description: "Resolve the current blocker first.",
    });
  }

  actions.push(
    {
      id: "runbook",
      label: "Open Runbook",
      route: "/runbook",
      description: "Review the full guided workflow and blocker list.",
    },
    {
      id: "logs",
      label: "Open Logs",
      route: "/logs",
      description: "Inspect install, startup, and gateway logs.",
    },
    {
      id: "settings",
      label: "Open Settings",
      route: "/settings",
      description: "Check runtime diagnostics and app preferences.",
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
    headline: currentBlocker ? "Resolve the current blocker before continuing." : "Workspace is ready for operation.",
    summary: currentBlocker
      ? "Runbook collects the current blocker, quick links, and the recommended sequence so setup and recovery work stay consistent."
      : "Install, configuration, service, runtime, and settings checks are aligned. The next step is usually Dashboard or Logs depending on what you need to do.",
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
