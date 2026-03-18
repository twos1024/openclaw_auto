import type { RuntimeDiagnostics } from "../types/api";
import type { ServiceResult } from "../types/status";
import type {
  RunbookModel,
  RunbookSupportAction,
  WorkspaceBannerAction,
  WorkspaceBannerModel,
} from "../types/workspace";
import { getRuntimeDiagnostics, invokeCommand } from "./tauriClient";

function nowIso(): string {
  return new Date().toISOString();
}

function createBannerMeta(
  runtime: RuntimeDiagnostics,
  platform: string,
  dashboard: string,
): WorkspaceBannerModel["meta"] {
  return [
    {
      label: "Runtime Mode",
      value:
        runtime.mode === "browser-preview"
          ? "Browser Preview"
          : runtime.mode === "tauri-runtime-unavailable"
            ? "Desktop Runtime Unavailable"
            : "Live",
    },
    { label: "Tauri Shell", value: runtime.hasTauriShell ? "detected" : "not-detected" },
    { label: "Invoke Bridge", value: runtime.hasInvokeBridge ? "detected" : "missing" },
    {
      label: "Bridge Source",
      value:
        runtime.bridgeSource === "official-api"
          ? "official API bridge"
          : runtime.bridgeSource === "global-fallback"
            ? "global fallback bridge"
            : "missing",
    },
    { label: "Platform", value: platform },
    { label: "Dashboard", value: dashboard },
  ];
}

function buildPreviewBanner(updatedAt: string, runtime: RuntimeDiagnostics): WorkspaceBannerModel {
  const primaryAction: WorkspaceBannerAction = {
    label: "查看桌面说明",
    route: "/runbook",
    description: `当前是浏览器预览模式，时间 ${new Date(updatedAt).toLocaleString()}。需要切回桌面壳才能继续本机安装和服务控制。`,
  };

  return {
    mode: "preview",
    tone: "warning",
    headline: "Browser Preview Mode",
    summary: "当前仅展示只读预览界面。需要在 Tauri 原生桌面壳中运行，才能使用安装、日志、配置和服务控制。",
    primaryAction,
    meta: createBannerMeta(runtime, "preview", "Unavailable in preview"),
  };
}

function buildRuntimeUnavailableBanner(
  updatedAt: string,
  runtime: RuntimeDiagnostics,
): WorkspaceBannerModel {
  const primaryAction: WorkspaceBannerAction = {
    label: "修复运行时",
    route: "/settings",
    description: `桌面窗口已打开，但命令桥不可用。检查时间 ${new Date(updatedAt).toLocaleString()}。`,
  };

  return {
    mode: "runtime-unavailable",
    tone: "error",
    headline: "Desktop Runtime Bridge Unavailable",
    summary: "当前已进入桌面窗口，但前端未连上 Tauri 命令桥。这个问题应优先修复，否则本地命令和文件操作都不可用。",
    primaryAction,
    meta: createBannerMeta(runtime, "desktop-shell", "Unavailable"),
  };
}

function dedupeSupportActions(actions: RunbookSupportAction[]): RunbookSupportAction[] {
  return actions.filter(
    (action, index, list) => list.findIndex((candidate) => candidate.route === action.route) === index,
  );
}

function buildPreviewRunbook(updatedAt: string, runtime: RuntimeDiagnostics): RunbookModel {
  const currentBlocker = {
    id: "preview-mode",
    title: "切换到桌面模式",
    detail: "浏览器预览只能看界面，不能执行安装、写入 API Key 或启动 Gateway。",
    level: "unknown" as const,
    route: "/runbook",
    actionLabel: "查看说明",
  };

  return {
    headline: "下一步：切换到桌面模式",
    summary: "当前不是可执行本机命令的桌面环境。先进入桌面版 ClawDesk，再继续安装、配置和启动。",
    primaryRoute: currentBlocker.route,
    primaryLabel: currentBlocker.actionLabel,
    lastCheckedAt: updatedAt,
    overallLevel: "unknown",
    launchChecks: [
      { id: "install", title: "安装检查", level: "unknown", detail: "预览模式不会检测本机 OpenClaw CLI 与 npm 安装状态。", route: "/install?wizard=1" },
      { id: "config", title: "配置检查", level: "unknown", detail: "预览模式不会读取真实 OpenClaw 配置文件。", route: "/config" },
      { id: "service", title: "服务检查", level: "unknown", detail: "预览模式不会检测本地 Gateway 运行状态。", route: "/service" },
      { id: "runtime", title: "运行时检查", level: "unknown", detail: "浏览器预览模式下无法访问 Rust 命令桥接。", route: "/settings" },
      { id: "settings", title: "设置检查", level: "unknown", detail: "预览模式仅展示结构，不会读取本地 ClawDesk 设置。", route: "/settings" },
    ],
    steps: [
      { id: "install", title: "安装 OpenClaw", description: "先切换到桌面模式，安装步骤才可执行。", route: "/install?wizard=1", actionLabel: "去安装", status: "blocked" },
      { id: "config", title: "填写 API Key", description: "先切换到桌面模式，配置文件才可读写。", route: "/config", actionLabel: "去填写 API Key", status: "blocked" },
      { id: "service", title: "启动 Gateway", description: "先切换到桌面模式，服务状态才可控制。", route: "/service", actionLabel: "去启动 Gateway", status: "blocked" },
      { id: "dashboard", title: "开始使用 OpenClaw", description: "当前只能预览界面，不能打开可用的本地 Dashboard。", route: "/dashboard", actionLabel: "打开 Dashboard", status: "blocked" },
    ],
    blockers: [currentBlocker],
    currentBlocker,
    supportActions: dedupeSupportActions([
      {
        id: "primary",
        label: currentBlocker.actionLabel,
        route: currentBlocker.route,
        description: "先确认如何进入桌面运行时，再继续后面的步骤。",
      },
      {
        id: "settings",
        label: "打开设置",
        route: "/settings",
        description: "需要确认当前运行环境时，再来这里看诊断信息。",
      },
    ]),
    banner: buildPreviewBanner(updatedAt, runtime),
  };
}

function buildRuntimeUnavailableRunbook(updatedAt: string, runtime: RuntimeDiagnostics): RunbookModel {
  const currentBlocker = {
    id: "runtime-bridge",
    title: "修复桌面运行时桥接",
    detail: "已检测到桌面 shell，但 Tauri 命令桥不可用，因此当前无法访问本地 Rust 命令层。",
    level: "offline" as const,
    route: "/settings",
    actionLabel: "修复运行时",
  };

  return {
    headline: "下一步：修复桌面运行时桥接",
    summary: "当前虽然已经打开桌面窗口，但本地命令桥没连上，所以安装、配置和启动都无法继续。",
    primaryRoute: currentBlocker.route,
    primaryLabel: currentBlocker.actionLabel,
    lastCheckedAt: updatedAt,
    overallLevel: "offline",
    launchChecks: [
      { id: "install", title: "安装检查", level: "offline", detail: "在桌面命令桥恢复前，无法执行本机安装、CLI 探测和 Gateway 托管安装。", route: "/install?wizard=1" },
      { id: "config", title: "配置检查", level: "offline", detail: "在桌面命令桥恢复前，无法读取或写入本地 OpenClaw 配置。", route: "/config" },
      { id: "service", title: "服务检查", level: "offline", detail: "在桌面命令桥恢复前，无法查询或控制 Gateway 服务。", route: "/service" },
      { id: "runtime", title: "运行时检查", level: "offline", detail: currentBlocker.detail, route: "/settings" },
      { id: "settings", title: "设置检查", level: "offline", detail: "在桌面命令桥恢复前，无法读取本地 ClawDesk 设置文件。", route: "/settings" },
    ],
    steps: [
      { id: "install", title: "安装 OpenClaw", description: "先修复运行时桥接，安装步骤才可执行。", route: "/install?wizard=1", actionLabel: "去安装", status: "blocked" },
      { id: "config", title: "填写 API Key", description: "先修复运行时桥接，配置文件才可读写。", route: "/config", actionLabel: "去填写 API Key", status: "blocked" },
      { id: "service", title: "启动 Gateway", description: "先修复运行时桥接，服务状态才可控制。", route: "/service", actionLabel: "去启动 Gateway", status: "blocked" },
      { id: "dashboard", title: "开始使用 OpenClaw", description: "先修复运行时桥接，之后才能正常打开 Dashboard。", route: "/dashboard", actionLabel: "打开 Dashboard", status: "blocked" },
    ],
    blockers: [currentBlocker],
    currentBlocker,
    supportActions: dedupeSupportActions([
      {
        id: "primary",
        label: currentBlocker.actionLabel,
        route: currentBlocker.route,
        description: "先让桌面命令桥恢复正常，再继续下面的流程。",
      },
      {
        id: "logs",
        label: "查看日志",
        route: "/logs",
        description: "如果修复桌面运行时时遇到问题，再来这里查看错误日志。",
      },
      {
        id: "settings",
        label: "打开设置",
        route: "/settings",
        description: "检查运行时诊断、桥接状态和本地路径信息。",
      },
    ]),
    banner: buildRuntimeUnavailableBanner(updatedAt, runtime),
  };
}

export const runbookService = {
  async getRunbookModel(): Promise<ServiceResult<RunbookModel>> {
    const runtime = getRuntimeDiagnostics();
    const updatedAt = nowIso();

    if (runtime.mode === "browser-preview") {
      return {
        ok: true,
        data: buildPreviewRunbook(updatedAt, runtime),
      };
    }

    if (runtime.mode === "tauri-runtime-unavailable") {
      return {
        ok: true,
        data: buildRuntimeUnavailableRunbook(updatedAt, runtime),
      };
    }

    const result = await invokeCommand<RunbookModel>("get_runbook_model");
    if (result.success && result.data) {
      return {
        ok: true,
        data: result.data,
      };
    }

    return {
      ok: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to load runbook model.",
        suggestion: "Check backend logs and retry.",
      },
    };
  },
};
