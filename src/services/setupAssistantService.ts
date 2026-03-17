import type {
  GuidedLaunchCheck,
  GuidedSetupModel,
  GuidedSetupStep,
  GuidedSetupStepStatus,
} from "../types/guidedSetup";
import type { HealthLevel, OverviewStatus } from "../types/status";

function isHealthy(level: HealthLevel): boolean {
  return level === "healthy";
}

const installWizardRoute = "/install?wizard=1";

function stepStatus(current: GuidedSetupStep["id"], active: GuidedSetupStep["id"], complete: boolean): GuidedSetupStepStatus {
  if (complete) return "complete";
  if (current === active) return current === "dashboard" ? "ready" : "current";
  return "blocked";
}

export function buildSetupAssistantModel(status: OverviewStatus): GuidedSetupModel {
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

  const steps: GuidedSetupStep[] = [
    {
      id: "install",
      title: "Install OpenClaw",
      description: status.install.detail,
      route: installWizardRoute,
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

  const primaryStep = steps.find((step) => step.status === "current" || step.status === "ready") ?? steps[0];
  const launchChecks: GuidedLaunchCheck[] = [
    {
      id: "install",
      title: "Install Check",
      level: status.install.level,
      detail: status.install.detail,
      route: installWizardRoute,
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

  return {
    headline: serviceReady ? "系统已就绪，可以进入 Dashboard" : "按照推荐顺序完成首次配置",
    summary: serviceReady
      ? "安装、配置和服务状态均已达标。下一步建议进入内嵌 Dashboard 验证实际工作流。"
      : "Setup Assistant 会按安装、配置、启动服务、进入 Dashboard 的顺序给出当前建议动作。",
    primaryRoute: primaryStep.route,
    primaryLabel: primaryStep.actionLabel,
    lastCheckedAt: status.overall.updatedAt,
    launchChecks,
    steps,
  };
}
