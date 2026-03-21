import type { InstallActionResult } from "../types/install";
import type {
  BuildInstallWizardArgs,
  InstallWizardModel,
  InstallWizardStep,
  PlatformGuidanceCard,
  PlatformKey,
} from "../types/installWizard";

function normalizePlatform(platform: string | null | undefined): PlatformKey {
  if (platform === "windows") return "windows";
  if (platform === "macos") return "macos";
  if (platform === "linux") return "linux";
  return "unknown";
}

const installWizardRoute = "/install?wizard=1";

function createStep(
  id: InstallWizardStep["id"],
  title: string,
  description: string,
  route: string,
  actionLabel: string,
  status: InstallWizardStep["status"],
): InstallWizardStep {
  return { id, title, description, route, actionLabel, status };
}

function installSucceeded(result: InstallActionResult | null): boolean {
  return Boolean(result && (result.status === "success" || result.status === "warning"));
}

export function buildInstallWizardModel({
  environment,
  installResult,
  configReady = false,
  serviceReady = false,
}: BuildInstallWizardArgs): InstallWizardModel {
  const environmentReady = Boolean(environment);
  const openclawReady = Boolean(environment?.openclawFound || installSucceeded(installResult));
  const dashboardReady = serviceReady;

  const steps: InstallWizardStep[] = [
    createStep(
      "environment",
      "检查安装环境",
      environment
        ? [
            environment.nodeFound
              ? `Node.js 已就绪${environment.nodeVersion ? ` (${environment.nodeVersion})` : ""}。`
              : "未检测到 Node.js，但官方安装脚本可以自动补齐。",
            environment.npmFound
              ? `npm 已就绪${environment.npmVersion ? ` (${environment.npmVersion})` : ""}。`
              : "未检测到 npm，但安装脚本会自动处理依赖。",
          ].join(" ")
        : "正在检测安装环境。",
      installWizardRoute,
      "留在安装页",
      environmentReady ? "complete" : "current",
    ),
    createStep(
      "install",
      "安装 OpenClaw",
      openclawReady
        ? "OpenClaw 已安装完成。"
        : "执行官方安装脚本，自动补齐依赖并安装 OpenClaw。",
      installWizardRoute,
      "立即安装",
      environmentReady ? (openclawReady ? "complete" : "current") : "current",
    ),
    createStep(
      "config",
      "填写 API Key",
      configReady
        ? "API Key 和模型配置已保存。"
        : "安装完成后，填写 API Key、接口地址和模型名称。",
      "/config",
      "去填写 API Key",
      !openclawReady ? "blocked" : configReady ? "complete" : "current",
    ),
    createStep(
      "service",
      "启动 Gateway",
      serviceReady
        ? "Gateway 已经启动。"
        : "保存配置后，前往 Service 页面启动 Gateway。",
      "/service",
      "去启动 Gateway",
      !configReady ? "blocked" : serviceReady ? "complete" : "current",
    ),
    createStep(
      "dashboard",
      "开始使用 OpenClaw",
      dashboardReady
        ? "现在可以直接打开 Dashboard 开始使用。"
        : "Gateway 启动后，就可以打开 Dashboard 正常使用。",
      "/dashboard",
      "打开 Dashboard",
      dashboardReady ? "current" : "blocked",
    ),
  ];

  const currentStep = steps.find((step) => step.status === "current") ?? steps[0];

  const headlineByStep: Record<InstallWizardStep["id"], string> = {
    environment: "先检查这台电脑的安装环境",
    install: "先把 OpenClaw 安装好",
    config: "下一步：填写 API Key",
    service: "下一步：启动 Gateway",
    dashboard: "已经可以开始使用了",
  };

  const summaryByStep: Record<InstallWizardStep["id"], string> = {
    environment: "安装器会自动补齐缺失的 Node.js / npm，再继续执行安装。",
    install: "安装完成后，马上去填写 API Key 和模型，然后启动 Gateway。",
    config: "这一步只需要把 API Key、接口地址和模型填好并保存。",
    service: "Gateway 启动成功后，就可以直接进入 Dashboard。",
    dashboard: "OpenClaw 已完成安装、配置和启动，现在直接开始使用即可。",
  };

  return {
    headline: headlineByStep[currentStep.id],
    summary: summaryByStep[currentStep.id],
    primaryRoute: currentStep.route,
    primaryLabel: currentStep.actionLabel,
    steps,
  };
}

export function buildPlatformGuidance(currentPlatform: string | null | undefined): PlatformGuidanceCard[] {
  const current = normalizePlatform(currentPlatform);
  return [
    {
      platform: "windows",
      title: "Windows",
      installSource: "官方安装脚本 + Gateway 托管安装",
      pathHint: "%AppData%\\npm\\openclaw.cmd / %UserProfile%\\.openclaw\\openclaw.json",
      troubleshooting: "优先检查 PowerShell 权限、防火墙、占用端口和安装脚本输出。",
      isCurrent: current === "windows",
    },
    {
      platform: "macos",
      title: "macOS",
      installSource: "官方安装脚本 + Gateway 托管安装",
      pathHint: "~/.npm-global/bin/openclaw 或 ~/.volta/bin/openclaw",
      troubleshooting: "优先检查 GUI 进程 PATH、Gatekeeper、本地 loopback 连通性和安装脚本输出。",
      isCurrent: current === "macos",
    },
    {
      platform: "linux",
      title: "Linux",
      installSource: "官方安装脚本 + Gateway 托管安装",
      pathHint: "~/.local/bin/openclaw / ~/.config/openclaw/openclaw.json",
      troubleshooting: "优先检查 XDG 路径、WebKit 依赖、AppImage 权限和本地端口监听。",
      isCurrent: current === "linux",
    },
  ];
}

export function currentPlatformCard(platform: string | null | undefined): PlatformGuidanceCard | null {
  return buildPlatformGuidance(platform).find((card) => card.isCurrent) ?? null;
}
