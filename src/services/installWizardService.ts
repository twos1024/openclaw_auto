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
}: BuildInstallWizardArgs): InstallWizardModel {
  const npmReady = Boolean(environment?.npmFound);
  const openclawReady = Boolean(environment?.openclawFound || installSucceeded(installResult));

  const steps: InstallWizardStep[] = [
    createStep(
      "environment",
      "Check Environment",
      npmReady
        ? `npm 已就绪${environment?.npmVersion ? ` (${environment.npmVersion})` : ""}。`
        : "需要先确认 Node.js / npm 已安装，才能继续执行 OpenClaw 安装。",
      "/install",
      "Stay on Install",
      npmReady ? "complete" : "current",
    ),
    createStep(
      "install",
      "Install OpenClaw CLI",
      openclawReady
        ? "OpenClaw CLI 已安装或刚完成安装。"
        : "执行 OpenClaw CLI 安装，并等待 Gateway 托管安装步骤完成。",
      "/install",
      "Run Install",
      !npmReady ? "blocked" : openclawReady ? "complete" : "current",
    ),
    createStep(
      "config",
      "Save Provider Config",
      "完成安装后，继续保存 Provider、模型和连接参数。",
      "/config",
      "Go to Config",
      openclawReady ? "current" : "blocked",
    ),
    createStep(
      "service",
      "Start Gateway",
      "配置完成后，前往 Service 页面启动并验证 Gateway。",
      "/service",
      "Go to Service",
      "blocked",
    ),
    createStep(
      "dashboard",
      "Open Embedded Dashboard",
      "当 Gateway 运行后，可以进入内嵌 Dashboard 工作台。",
      "/dashboard",
      "Open Dashboard",
      "blocked",
    ),
  ];

  const currentStep = steps.find((step) => step.status === "current") ?? steps[0];

  return {
    headline: openclawReady ? "安装已完成，继续后续配置" : "按顺序完成本机安装向导",
    summary: openclawReady
      ? "OpenClaw CLI 已准备好。下一步建议保存 Provider 配置，然后启动 Gateway。"
      : "向导会先检查环境，再执行安装，最后引导你进入配置和服务启动。",
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
      installSource: "npm global install + NSIS/MSI desktop bundle",
      pathHint: "%AppData%\\npm\\openclaw.cmd / %UserProfile%\\.openclaw\\openclaw.json",
      troubleshooting: "优先检查 PATH、PowerShell 权限、防火墙和占用端口。",
      isCurrent: current === "windows",
    },
    {
      platform: "macos",
      title: "macOS",
      installSource: "npm global install + DMG desktop bundle",
      pathHint: "~/.npm-global/bin/openclaw 或 ~/.volta/bin/openclaw",
      troubleshooting: "优先检查 GUI 进程 PATH、Gatekeeper、iframe 安全策略和本地 loopback 连通性。",
      isCurrent: current === "macos",
    },
    {
      platform: "linux",
      title: "Linux",
      installSource: "npm global install + DEB/AppImage desktop bundle",
      pathHint: "~/.local/bin/openclaw / ~/.config/openclaw/openclaw.json",
      troubleshooting: "优先检查 XDG 路径、WebKit 依赖、AppImage 权限和本地端口监听。",
      isCurrent: current === "linux",
    },
  ];
}

export function currentPlatformCard(platform: string | null | undefined): PlatformGuidanceCard | null {
  return buildPlatformGuidance(platform).find((card) => card.isCurrent) ?? null;
}
