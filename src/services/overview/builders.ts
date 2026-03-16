import type { CommandResult } from "../../types/api";
import type {
  HealthLevel,
  OverviewAction,
  OverviewOverall,
  OverviewSection,
  OverviewStatus,
} from "../../types/status";
import { settingsService } from "../settingsService";
import { APP_VERSION, type ConfigReadData, type DetectEnvData, type GatewayStatusData } from "./contracts";

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

export function buildPreviewOverview(updatedAt: string): OverviewStatus {
  const previewSections = {
    runtime: buildSection(
      "openclaw-runtime",
      "桌面 Runtime",
      "/service",
      "查看 Service",
      "unknown",
      "浏览器预览模式下无法访问 Rust 命令桥接。",
      updatedAt,
    ),
    install: buildSection(
      "openclaw-install",
      "OpenClaw 安装",
      "/install",
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
    dashboardUrl: "http://127.0.0.1:18789",
    mode: "preview",
    overall: {
      level: "unknown",
      headline: "当前为浏览器预览模式",
      summary: "请使用 `npm run tauri:dev` 启动桌面模式，以获取真实环境、配置和服务健康状态。",
      updatedAt,
    },
    ...previewSections,
    nextActions: [
      {
        id: "run-tauri",
        label: "启动桌面模式",
        route: "/install",
        description: "先在 Tauri 模式下运行 ClawDesk，再继续本机安装与服务控制。",
      },
    ],
  };
}

export function buildRuntimeSection(
  envResult: CommandResult<DetectEnvData>,
  updatedAt: string,
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
      "/install",
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
      "/install",
      "安装 npm",
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
      "/install",
      "安装 OpenClaw",
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
    "/install",
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

function ctaLabelForConfig(configResult: CommandResult<ConfigReadData>): string {
  return configResult.error?.code === "E_PATH_NOT_FOUND" ? "创建 Config" : "修复 Config";
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
      "查看 Config",
      "healthy",
      model ? `配置已加载，当前模型为 ${model}。` : "配置已加载。可以继续启动 Gateway。",
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
    ctaLabelForConfig(configResult),
    missing ? "degraded" : "offline",
    missing
      ? "尚未检测到 OpenClaw 配置文件，请先保存模型配置。"
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
      running ? "打开 Service" : "启动 Gateway",
      running ? "healthy" : "degraded",
      running
        ? gatewayResult.data.statusDetail ??
            gatewayResult.data.status_detail ??
            `Gateway 正在 ${gatewayResult.data.address ?? "http://127.0.0.1:18789"} 运行。`
        : gatewayResult.data.statusDetail ??
            gatewayResult.data.status_detail ??
            "Gateway 当前未启动。",
      updatedAt,
      [
        { label: "Address", value: gatewayResult.data.address ?? "http://127.0.0.1:18789" },
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
      headline: "先完成 OpenClaw 安装",
      summary: "当前还没有形成完整运行闭环。请先确认 npm / OpenClaw CLI 安装状态，再继续配置和启动 Gateway。",
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
      headline: "先修复 OpenClaw 配置",
      summary: "安装链路已具备，但配置仍未完成。建议先保存 provider、model 与连接信息。",
      updatedAt,
    };
  }

  if (sections.service.level !== "healthy") {
    return {
      level,
      headline: "Gateway 尚未运行",
      summary: "配置已经就绪，但 Gateway 还没进入健康状态。下一步建议前往 Service 页面启动并验证 Dashboard。",
      updatedAt,
    };
  }

  return {
    level,
    headline: "系统已就绪",
    summary: "OpenClaw CLI、配置、Gateway 与 ClawDesk 设置都处于可用状态，可以继续打开 Dashboard 或导出诊断信息。",
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
      label: "安装 OpenClaw",
      route: "/install",
      description: "先确认 npm 与 OpenClaw CLI 已安装，这是后续配置与 Gateway 控制的前提。",
    });
  }

  if (sections.config.level !== "healthy") {
    actions.push({
      id: "configure-provider",
      label: "保存 Provider 配置",
      route: "/config",
      description: "补齐模型、地址与鉴权配置，避免 Gateway 启动后仍无法连通上游模型服务。",
    });
  }

  if (sections.service.level !== "healthy") {
    actions.push({
      id: "start-gateway",
      label: "启动 Gateway",
      route: "/service",
      description: "安装和配置完成后，前往 Service 页面启动 Gateway 并检查端口与 Dashboard。",
    });
  } else {
    actions.push({
      id: "open-dashboard",
      label: "打开 Dashboard",
      route: "/service",
      description: "Gateway 已运行，可以直接打开本地 Dashboard 验证整体工作流。",
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
    label: "查看日志与诊断",
    route: "/logs",
    description: "若任何一步出现异常，可在 Logs 页面查看摘要并导出诊断信息。",
  });

  return actions;
}
