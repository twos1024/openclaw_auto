import i18n from "@/i18n";
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

function t(key: string, options?: Record<string, string>): string {
  return i18n.t(key, { ns: "runbook", ...options });
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
    label: t("service.preview.bannerActionLabel"),
    route: "/runbook",
    description: t("service.preview.bannerActionDescription", { time: new Date(updatedAt).toLocaleString() }),
  };

  return {
    mode: "preview",
    tone: "warning",
    headline: t("service.preview.bannerHeadline"),
    summary: t("service.preview.bannerSummary"),
    primaryAction,
    meta: createBannerMeta(runtime, "preview", "Unavailable in preview"),
  };
}

function buildRuntimeUnavailableBanner(
  updatedAt: string,
  runtime: RuntimeDiagnostics,
): WorkspaceBannerModel {
  const primaryAction: WorkspaceBannerAction = {
    label: t("service.runtimeUnavailable.bannerActionLabel"),
    route: "/settings",
    description: t("service.runtimeUnavailable.bannerActionDescription", { time: new Date(updatedAt).toLocaleString() }),
  };

  return {
    mode: "runtime-unavailable",
    tone: "error",
    headline: t("service.runtimeUnavailable.bannerHeadline"),
    summary: t("service.runtimeUnavailable.bannerSummary"),
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
    title: t("service.preview.blockerTitle"),
    detail: t("service.preview.blockerDetail"),
    level: "unknown" as const,
    route: "/runbook",
    actionLabel: t("service.preview.blockerActionLabel"),
  };

  return {
    headline: t("service.preview.headline"),
    summary: t("service.preview.summary"),
    primaryRoute: currentBlocker.route,
    primaryLabel: currentBlocker.actionLabel,
    lastCheckedAt: updatedAt,
    overallLevel: "unknown",
    launchChecks: [
      { id: "install", title: t("service.common.checkInstall"), level: "unknown", detail: t("service.preview.checks.install"), route: "/install?wizard=1" },
      { id: "config", title: t("service.common.checkConfig"), level: "unknown", detail: t("service.preview.checks.config"), route: "/config" },
      { id: "service", title: t("service.common.checkService"), level: "unknown", detail: t("service.preview.checks.service"), route: "/service" },
      { id: "runtime", title: t("service.common.checkRuntime"), level: "unknown", detail: t("service.preview.checks.runtime"), route: "/settings" },
      { id: "settings", title: t("service.common.checkSettings"), level: "unknown", detail: t("service.preview.checks.settings"), route: "/settings" },
    ],
    steps: [
      { id: "install", title: t("service.common.stepInstall"), description: t("service.preview.steps.install"), route: "/install?wizard=1", actionLabel: t("service.common.goInstall"), status: "blocked" },
      { id: "config", title: t("service.common.stepConfig"), description: t("service.preview.steps.config"), route: "/config", actionLabel: t("service.common.goConfig"), status: "blocked" },
      { id: "service", title: t("service.common.stepService"), description: t("service.preview.steps.service"), route: "/service", actionLabel: t("service.common.goService"), status: "blocked" },
      { id: "dashboard", title: t("service.common.stepDashboard"), description: t("service.preview.steps.dashboard"), route: "/dashboard", actionLabel: t("service.common.goDashboard"), status: "blocked" },
    ],
    blockers: [currentBlocker],
    currentBlocker,
    supportActions: dedupeSupportActions([
      {
        id: "primary",
        label: currentBlocker.actionLabel,
        route: currentBlocker.route,
        description: t("service.preview.supportPrimary"),
      },
      {
        id: "settings",
        label: t("service.common.openSettings"),
        route: "/settings",
        description: t("service.preview.supportSettings"),
      },
    ]),
    banner: buildPreviewBanner(updatedAt, runtime),
  };
}

function buildRuntimeUnavailableRunbook(updatedAt: string, runtime: RuntimeDiagnostics): RunbookModel {
  const currentBlocker = {
    id: "runtime-bridge",
    title: t("service.runtimeUnavailable.blockerTitle"),
    detail: t("service.runtimeUnavailable.blockerDetail"),
    level: "offline" as const,
    route: "/settings",
    actionLabel: t("service.runtimeUnavailable.blockerActionLabel"),
  };

  return {
    headline: t("service.runtimeUnavailable.headline"),
    summary: t("service.runtimeUnavailable.summary"),
    primaryRoute: currentBlocker.route,
    primaryLabel: currentBlocker.actionLabel,
    lastCheckedAt: updatedAt,
    overallLevel: "offline",
    launchChecks: [
      { id: "install", title: t("service.common.checkInstall"), level: "offline", detail: t("service.runtimeUnavailable.checks.install"), route: "/install?wizard=1" },
      { id: "config", title: t("service.common.checkConfig"), level: "offline", detail: t("service.runtimeUnavailable.checks.config"), route: "/config" },
      { id: "service", title: t("service.common.checkService"), level: "offline", detail: t("service.runtimeUnavailable.checks.service"), route: "/service" },
      { id: "runtime", title: t("service.common.checkRuntime"), level: "offline", detail: currentBlocker.detail, route: "/settings" },
      { id: "settings", title: t("service.common.checkSettings"), level: "offline", detail: t("service.runtimeUnavailable.checks.settings"), route: "/settings" },
    ],
    steps: [
      { id: "install", title: t("service.common.stepInstall"), description: t("service.runtimeUnavailable.steps.install"), route: "/install?wizard=1", actionLabel: t("service.common.goInstall"), status: "blocked" },
      { id: "config", title: t("service.common.stepConfig"), description: t("service.runtimeUnavailable.steps.config"), route: "/config", actionLabel: t("service.common.goConfig"), status: "blocked" },
      { id: "service", title: t("service.common.stepService"), description: t("service.runtimeUnavailable.steps.service"), route: "/service", actionLabel: t("service.common.goService"), status: "blocked" },
      { id: "dashboard", title: t("service.common.stepDashboard"), description: t("service.runtimeUnavailable.steps.dashboard"), route: "/dashboard", actionLabel: t("service.common.goDashboard"), status: "blocked" },
    ],
    blockers: [currentBlocker],
    currentBlocker,
    supportActions: dedupeSupportActions([
      {
        id: "primary",
        label: currentBlocker.actionLabel,
        route: currentBlocker.route,
        description: t("service.runtimeUnavailable.supportPrimary"),
      },
      {
        id: "logs",
        label: t("service.common.viewLogs"),
        route: "/logs",
        description: t("service.runtimeUnavailable.supportLogs"),
      },
      {
        id: "settings",
        label: t("service.common.openSettings"),
        route: "/settings",
        description: t("service.runtimeUnavailable.supportSettings"),
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
