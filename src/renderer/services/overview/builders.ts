import type { CommandResult, RuntimeDiagnostics } from "../../types/api";
import type {
  HealthLevel,
  OverviewAction,
  OverviewOverall,
  OverviewSection,
  OverviewStatus,
} from "../../types/status";
import { settingsService } from "../settingsService";
import { APP_VERSION, type ConfigReadData, type DetectEnvData, type GatewayStatusData } from "./contracts";

const installWizardRoute = "/install?wizard=1";

function formatBridgeSource(source: RuntimeDiagnostics["bridgeSource"]): string {
  if (source === "official-api") return "official API bridge";
  if (source === "global-fallback") return "global fallback bridge";
  return "missing";
}

function levelRank(level: HealthLevel): number {
  switch (level) {
    case "offline":
      return 4;
    case "degraded":
      return 3;
    case "unknown":
      return 2;
    case "healthy":
    default:
      return 1;
  }
}

function worstLevel(levels: HealthLevel[]): HealthLevel {
  return [...levels].sort((left, right) => levelRank(right) - levelRank(left))[0] ?? "unknown";
}

function buildSection(
  id: string,
  title: string,
  route: string,
  ctaLabel: string,
  level: HealthLevel,
  detail: string,
  updatedAt: string,
  meta?: OverviewSection["meta"],
): OverviewSection {
  return {
    id,
    title,
    route,
    ctaLabel,
    level,
    detail,
    updatedAt,
    meta,
  };
}

function runtimeMeta(runtime: RuntimeDiagnostics): OverviewSection["meta"] {
  return [
    { label: "Mode", value: runtime.mode },
    { label: "Tauri Shell", value: runtime.hasTauriShell ? "detected" : "not-detected" },
    { label: "Invoke Bridge", value: runtime.hasInvokeBridge ? "detected" : "missing" },
    { label: "Bridge Source", value: formatBridgeSource(runtime.bridgeSource) },
  ];
}

export function buildPreviewOverview(updatedAt: string, runtime: RuntimeDiagnostics): OverviewStatus {
  const previewSections = {
    runtime: buildSection(
      "openclaw-runtime",
      "桌面 Runtime",
      "/service",
      "查看 Service",
      "unknown",
      "浏览器预览模式下无法访问 Rust 命令桥接。",
      updatedAt,
      runtimeMeta(runtime),
    ),
    install: buildSection(
      "openclaw-install",
      "OpenClaw 安装",
      installWizardRoute,
      "查看 Install",
      "unknown",
      "预览模式不会检测本机 OpenClaw CLI 与 npm 安装状态。",
      updatedAt,
    ),
    config: buildSection(
      "openclaw-config",
      "OpenClaw 配置",
      "/config",
      "查看 Config",
      "unknown",
      "预览模式不会读取真实 OpenClaw 配置文件。",
      updatedAt,
    ),
    service: buildSection(
      "openclaw-service",
      "Gateway 服务",
      "/service",
      "查看 Service",
      "unknown",
      "预览模式不会检测本地 Gateway 运行状态。",
      updatedAt,
    ),
    settings: buildSection(
      "clawdesk-settings",
      "ClawDesk 设置",
      "/settings",
      "查看 Settings",
      "unknown",
      "预览模式仅展示结构，不会读取本地 ClawDesk 设置。",
      updatedAt,
    ),
  };

  return {
    appVersion: APP_VERSION,
    platform: "preview",
    dashboardUrl: "Unavailable in preview",
    mode: "preview",
    overall: {
      level: "unknown",
      headline: "请先打开桌面版 ClawDesk",
      summary: "浏览器预览只能看界面，不能执行安装、写入 API Key 或启动 Gateway。",
      updatedAt,
    },
    ...previewSections,
    nextActions: [
      {
        id: "run-tauri",
        label: "打开桌面版 ClawDesk",
        route: installWizardRoute,
        description: "先进入桌面运行时，再继续安装、配置 API Key 和启动 Gateway。",
      },
    ],
  };
}

export function buildRuntimeUnavailableOverview(
  updatedAt: string,
  runtime: RuntimeDiagnostics,
): OverviewStatus {
  const unavailableSections = {
    runtime: buildSection(
      "openclaw-runtime",
      "桌面 Runtime",
      "/settings",
      "查看 Settings",
      "offline",
      "已检测到桌面 shell，但 Tauri 命令桥不可用，因此当前无法访问本地 Rust 命令层。",
      updatedAt,
      runtimeMeta(runtime),
    ),
    install: buildSection(
      "openclaw-install",
      "OpenClaw 安装",
      installWizardRoute,
      "查看 Install",
      "offline",
      "在桌面命令桥恢复前，无法执行本机安装、CLI 探测和 Gateway 托管安装。",
      updatedAt,
    ),
    config: buildSection(
      "openclaw-config",
      "OpenClaw 配置",
      "/config",
      "查看 Config",
      "offline",
      "在桌面命令桥恢复前，无法读取或写入本地 OpenClaw 配置。",
      updatedAt,
    ),
    service: buildSection(
      "openclaw-service",
      "Gateway 服务",
      "/service",
      "查看 Service",
      "offline",
      "在桌面命令桥恢复前，无法查询或控制 Gateway 服务。",
      updatedAt,
    ),
    settings: buildSection(
      "clawdesk-settings",
      "ClawDesk 设置",
      "/settings",
      "查看 Settings",
      "offline",
      "在桌面命令桥恢复前，无法读取本地 ClawDesk 设置文件。",
      updatedAt,
    ),
  };

  return {
    appVersion: APP_VERSION,
    platform: "desktop-shell",
    dashboardUrl: "Unavailable",
    mode: "runtime-unavailable",
    overall: {
      level: "offline",
      headline: "桌面运行时异常",
      summary: "当前虽然已经打开桌面窗口，但本地命令桥没连上，所以安装、配置和启动都无法继续。",
      updatedAt,
    },
    ...unavailableSections,
    nextActions: [
      {
        id: "review-runtime-diagnostics",
        label: "先修复桌面运行时",
        route: "/settings",
        description: "先让桌面命令桥恢复正常，再继续安装、配置 API Key 和启动 Gateway。",
      },
      {
        id: "review-logs",
        label: "查看错误日志",
        route: "/logs",
        description: "如果修复桌面运行时时遇到问题，再来这里查看错误日志。",
      },
    ],
  };
}

export function buildBackendUnavailableOverview(
  updatedAt: string,
  runtime: RuntimeDiagnostics,
  message: string,
): OverviewStatus {
  const unavailableSections = {
    runtime: buildSection(
      "openclaw-runtime",
      "桌面 Runtime",
      "/settings",
      "查看 Settings",
      "healthy",
      "桌面命令桥可用，但后端聚合命令执行失败。",
      updatedAt,
      runtimeMeta(runtime),
    ),
    install: buildSection(
      "openclaw-install",
      "OpenClaw 安装",
      installWizardRoute,
      "查看 Install",
      "unknown",
      "后端聚合状态不可用，暂时无法确认安装状态。",
      updatedAt,
    ),
    config: buildSection(
      "openclaw-config",
      "OpenClaw 配置",
      "/config",
      "查看 Config",
      "unknown",
      "后端聚合状态不可用，暂时无法确认配置状态。",
      updatedAt,
    ),
    service: buildSection(
      "openclaw-service",
      "Gateway 服务",
      "/service",
      "查看 Service",
      "unknown",
      "后端聚合状态不可用，暂时无法确认 Gateway 状态。",
      updatedAt,
    ),
    settings: buildSection(
      "clawdesk-settings",
      "ClawDesk 设置",
      "/settings",
      "查看 Settings",
      "unknown",
      "后端聚合状态不可用，暂时无法确认本地设置状态。",
      updatedAt,
    ),
  };

  return {
    appVersion: APP_VERSION,
    platform: "desktop-runtime",
    dashboardUrl: "Unavailable",
    mode: "live",
    overall: {
      level: "offline",
      headline: "后端聚合异常",
      summary: "桌面命令桥已连接，但后端状态聚合失败。先看错误日志，再决定是否需要修复配置或服务。",
      updatedAt,
    },
    ...unavailableSections,
    nextActions: [
      {
        id: "review-logs",
        label: "查看错误日志",
        route: "/logs",
        description: message,
      },
      {
        id: "review-settings",
        label: "打开 Settings",
        route: "/settings",
        description: "确认本地诊断目录和运行时信息，然后再继续排查后端命令失败原因。",
      },
    ],
  };
}

export function buildRuntimeSection(
  envResult: CommandResult<DetectEnvData>,
  updatedAt: string,
  runtime: RuntimeDiagnostics,
): OverviewSection {
  if (!envResult.success || !envResult.data) {
    return buildSection(
      "openclaw-runtime",
      "桌面 Runtime",
      "/service",
      "查看 Service",
      "offline",
      envResult.error?.message ?? "Rust 命令桥接当前不可用。",
      updatedAt,
      runtimeMeta(runtime),
    );
  }

  return buildSection(
    "openclaw-runtime",
    "桌面 Runtime",
    "/service",
    "查看 Service",
    "healthy",
    envResult.data.npm_found
      ? `Rust 命令桥接正常，已检测到 npm ${envResult.data.npm_version ?? ""}`.trim()
      : "Rust 命令桥接正常，但尚未检测到 npm。",
    updatedAt,
    [
      { label: "Mode", value: runtime.mode },
      { label: "Tauri Shell", value: runtime.hasTauriShell ? "detected" : "not-detected" },
      { label: "Invoke Bridge", value: runtime.hasInvokeBridge ? "detected" : "missing" },
      { label: "Bridge Source", value: formatBridgeSource(runtime.bridgeSource) },
      { label: "平台", value: envResult.data.platform ?? "unknown" },
      { label: "npm", value: envResult.data.npm_version ?? "missing" },
    ],
  );
}

export function buildInstallSection(
  envResult: CommandResult<DetectEnvData>,
  updatedAt: string,
): OverviewSection {
  if (!envResult.success || !envResult.data) {
    return buildSection(
      "openclaw-install",
      "OpenClaw 安装",
      installWizardRoute,
      "前往 Install",
      "offline",
      envResult.error?.message ?? "尚未完成 OpenClaw 环境探测。",
      updatedAt,
    );
  }

  if (!envResult.data.npm_found) {
    return buildSection(
      "openclaw-install",
      "OpenClaw 安装",
      installWizardRoute,
      "先安装 Node.js / npm",
      "offline",
      "未检测到 npm，当前无法执行 OpenClaw 安装流程。",
      updatedAt,
      [{ label: "OpenClaw", value: "missing" }],
    );
  }

  if (!envResult.data.openclaw_found) {
    return buildSection(
      "openclaw-install",
      "OpenClaw 安装",
      installWizardRoute,
      "开始安装",
      "degraded",
      "尚未检测到 OpenClaw CLI，请先完成安装。",
      updatedAt,
      [
        { label: "npm", value: envResult.data.npm_version ?? "ready" },
        { label: "Config Path", value: envResult.data.config_path ?? "-" },
      ],
    );
  }

  return buildSection(
    "openclaw-install",
    "OpenClaw 安装",
    installWizardRoute,
    "查看 Install",
    "healthy",
    `已检测到 OpenClaw ${envResult.data.openclaw_version ?? ""}`.trim(),
    updatedAt,
    [
      { label: "CLI", value: envResult.data.openclaw_path ?? "resolved" },
      { label: "npm", value: envResult.data.npm_version ?? "ready" },
    ],
  );
}

export function buildConfigSection(
  configResult: CommandResult<ConfigReadData>,
  updatedAt: string,
): OverviewSection {
  if (configResult.success && configResult.data) {
    const model = typeof configResult.data.content?.model === "string" ? configResult.data.content.model : null;
    const provider =
      typeof configResult.data.content?.providerType === "string"
        ? configResult.data.content.providerType
        : null;

    return buildSection(
      "openclaw-config",
      "OpenClaw 配置",
      "/config",
      "查看配置",
      "healthy",
      model ? `API Key 配置已保存，当前模型为 ${model}。下一步可以启动 Gateway。` : "配置已加载。下一步可以启动 Gateway。",
      updatedAt,
      [
        { label: "Provider", value: provider ?? "-" },
        { label: "Path", value: configResult.data.path ?? "-" },
      ],
    );
  }

  const missing = configResult.error?.code === "E_PATH_NOT_FOUND";
  return buildSection(
      "openclaw-config",
      "OpenClaw 配置",
      "/config",
      configResult.error?.code === "E_PATH_NOT_FOUND" ? "填写 API Key" : "修复配置",
      missing ? "degraded" : "offline",
      missing
      ? "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。"
      : configResult.error?.message ?? "OpenClaw 配置读取失败。",
    updatedAt,
  );
}

export function buildServiceSection(
  gatewayResult: CommandResult<GatewayStatusData>,
  updatedAt: string,
): OverviewSection {
  if (gatewayResult.success && gatewayResult.data) {
    const running = Boolean(gatewayResult.data.running);
    return buildSection(
      "openclaw-service",
      "Gateway 服务",
      "/service",
      running ? "查看运行状态" : "启动 Gateway",
      running ? "healthy" : "degraded",
      running
        ? gatewayResult.data.statusDetail ??
            gatewayResult.data.status_detail ??
            (gatewayResult.data.address
              ? `Gateway 正在 ${gatewayResult.data.address} 运行。`
              : "Gateway 当前处于运行状态。")
        : gatewayResult.data.statusDetail ??
            gatewayResult.data.status_detail ??
            "Gateway 当前未启动。",
      updatedAt,
      [
        { label: "Address", value: gatewayResult.data.address ?? "-" },
        { label: "PID", value: gatewayResult.data.pid ? String(gatewayResult.data.pid) : "-" },
      ],
    );
  }

  return buildSection(
    "openclaw-service",
    "Gateway 服务",
    "/service",
    "查看 Service",
    "offline",
    gatewayResult.error?.message ?? "Gateway 状态读取失败。",
    updatedAt,
  );
}

export function buildSettingsSection(
  settingsResult: Awaited<ReturnType<typeof settingsService.readSettings>>,
  updatedAt: string,
): OverviewSection {
  if (settingsResult.issue?.code === "E_PREVIEW_MODE") {
    return buildSection(
      "clawdesk-settings",
      "ClawDesk 设置",
      "/settings",
      "查看 Settings",
      "unknown",
      settingsResult.issue.message,
      updatedAt,
    );
  }

  if (settingsResult.issue?.code === "E_TAURI_UNAVAILABLE" || settingsResult.issue?.code === "E_IPC_UNAVAILABLE") {
    return buildSection(
      "clawdesk-settings",
      "ClawDesk 设置",
      "/settings",
      "查看 Settings",
      "offline",
      settingsResult.issue.message,
      updatedAt,
    );
  }

  if (settingsResult.issue && settingsResult.exists === false) {
    return buildSection(
      "clawdesk-settings",
      "ClawDesk 设置",
      "/settings",
      "初始化 Settings",
      "degraded",
      settingsResult.issue.message,
      updatedAt,
    );
  }

  return buildSection(
    "clawdesk-settings",
    "ClawDesk 设置",
    "/settings",
    "查看 Settings",
    "healthy",
    settingsResult.exists
      ? "ClawDesk 应用设置已加载。"
      : "当前使用默认设置，建议按需保存一份本地 Settings。",
    updatedAt,
    [
      { label: "Diagnostics", value: settingsResult.values.diagnosticsDir || "-" },
      { label: "Polling", value: `${settingsResult.values.gatewayPollMs} ms` },
    ],
  );
}

export function buildOverall(
  sections: Pick<OverviewStatus, "runtime" | "install" | "config" | "service" | "settings">,
  updatedAt: string,
): OverviewOverall {
  if (sections.install.level === "offline" || sections.install.level === "degraded") {
    return {
      level: sections.install.level,
      headline: "下一步：安装 OpenClaw",
      summary: "这是第 1 步。安装完成后，再去填写 API Key 并启动 Gateway。",
      updatedAt,
    };
  }

  const level = worstLevel([
    sections.runtime.level,
    sections.install.level,
    sections.config.level,
    sections.service.level,
    sections.settings.level,
  ]);

  if (sections.config.level !== "healthy") {
    return {
      level,
      headline: "下一步：填写 API Key",
      summary: "这是第 2 步。把 API Key、接口地址和模型保存好，再启动 Gateway。",
      updatedAt,
    };
  }

  if (sections.service.level !== "healthy") {
    return {
      level,
      headline: "下一步：启动 Gateway",
      summary: "这是第 3 步。Gateway 启动后，就可以直接打开 Dashboard 开始使用。",
      updatedAt,
    };
  }

  return {
    level,
    headline: "可以开始使用了",
    summary: "OpenClaw 已经安装完成，API Key 已保存，Gateway 也已启动。现在直接打开 Dashboard 即可。",
    updatedAt,
  };
}

export function buildNextActions(
  sections: Pick<OverviewStatus, "install" | "config" | "service" | "settings">,
): OverviewAction[] {
  const actions: OverviewAction[] = [];

  if (sections.install.level === "offline" || sections.install.level === "degraded") {
    actions.push({
      id: "install-openclaw",
      label: "开始安装 OpenClaw",
      route: installWizardRoute,
      description: "这是第 1 步。安装完成后，继续去填写 API Key。",
    });
  }

  if (sections.config.level !== "healthy") {
    actions.push({
      id: "configure-provider",
      label: "填写 API Key",
      route: "/config",
      description: "这是第 2 步。填好 API Key、接口地址和模型后再启动 Gateway。",
    });
  }

  if (sections.service.level !== "healthy") {
    actions.push({
      id: "start-gateway",
      label: "启动 Gateway",
      route: "/service",
      description: "这是第 3 步。Gateway 启动成功后，就可以打开 Dashboard 开始使用。",
    });
  } else {
    actions.push({
      id: "open-dashboard",
      label: "打开 Dashboard 开始使用",
      route: "/dashboard",
      description: "OpenClaw 已经准备好，直接进入 Dashboard 即可。",
      kind: "open-dashboard",
    });
  }

  if (sections.settings.level !== "healthy") {
    actions.push({
      id: "review-settings",
      label: "检查 ClawDesk 设置",
      route: "/settings",
      description: "确认诊断目录、日志行数限制和轮询频率，避免后续排障信息不完整。",
    });
  }

  actions.push({
    id: "review-logs",
    label: "遇到问题再看日志",
    route: "/logs",
    description: "只有安装、配置或启动失败时，再到这里查看错误和导出诊断信息。",
  });

  return actions;
}
