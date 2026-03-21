import type { BackendError } from "../types/api";
import {
  defaultAppSettings,
  type AppSettings,
  type ReadAppSettingsData,
  type SaveSettingsResult,
  type SettingsLoadResult,
  type WriteAppSettingsData,
} from "../types/settings";
import { getRuntimeDiagnostics, invokeCommand } from "./tauriClient";

function normalizeSettings(raw: ReadAppSettingsData["content"] | undefined): AppSettings {
  const preferredInstallSource =
    raw?.preferredInstallSource === "npm-global"
      ? raw.preferredInstallSource
      : defaultAppSettings.preferredInstallSource;

  return {
    preferredInstallSource,
    diagnosticsDir: raw?.diagnosticsDir ?? defaultAppSettings.diagnosticsDir,
    logLineLimit: Number.isFinite(raw?.logLineLimit) ? Number(raw?.logLineLimit) : defaultAppSettings.logLineLimit,
    gatewayPollMs: Number.isFinite(raw?.gatewayPollMs) ? Number(raw?.gatewayPollMs) : defaultAppSettings.gatewayPollMs,
  };
}

function buildSettingsPayload(values: AppSettings): Record<string, unknown> {
  return {
    preferredInstallSource: values.preferredInstallSource,
    diagnosticsDir: values.diagnosticsDir,
    logLineLimit: values.logLineLimit,
    gatewayPollMs: values.gatewayPollMs,
  };
}

function toSaveError(error: BackendError | undefined, fallbackSuggestion: string): SaveSettingsResult {
  if (!error) {
    return {
      status: "error",
      detail: "Unknown settings save error.",
      suggestion: fallbackSuggestion,
      code: "E_UNKNOWN",
    };
  }

  return {
    status: "error",
    detail: error.message,
    suggestion: error.suggestion || fallbackSuggestion,
    code: error.code,
  };
}

export const settingsService = {
  async readSettings(): Promise<SettingsLoadResult> {
    const result = await invokeCommand<ReadAppSettingsData>("read_app_settings", {
      path: null,
    });

    if (result.success && result.data) {
      return {
        values: normalizeSettings(result.data.content),
        path: result.data.path,
        exists: result.data.exists,
        modifiedAt: result.data.modifiedAt,
      };
    }

    if (result.error?.code === "E_PREVIEW_MODE") {
      return {
        values: defaultAppSettings,
        exists: false,
        issue: {
          code: "E_PREVIEW_MODE",
          message: "当前运行在浏览器预览模式，尚未读取本地 ClawDesk 设置文件。",
          suggestion: "请使用 ClawDesk 桌面应用或 `npm run tauri:dev` 后再读取和保存真实设置。",
        },
      };
    }

    if (result.error?.code === "E_TAURI_UNAVAILABLE" || result.error?.code === "E_IPC_UNAVAILABLE") {
      const runtime = getRuntimeDiagnostics();
      return {
        values: defaultAppSettings,
        exists: false,
        issue: {
          code: result.error.code,
          message: "当前已进入桌面窗口，但 IPC 命令桥不可用，尚未读取本地 ClawDesk 设置。",
          suggestion: "请重启或重新安装 ClawDesk；若问题持续，请检查前端是否正确集成 Electron API。",
          details: {
            runtimeMode: runtime.mode,
            bridgeSource: runtime.bridgeSource,
          },
        },
      };
    }

    return {
      values: defaultAppSettings,
      exists: false,
      path: typeof result.error?.details?.path === "string" ? result.error.details.path : undefined,
      issue: result.error,
    };
  },

  async saveSettings(values: AppSettings): Promise<SaveSettingsResult> {
    const result = await invokeCommand<WriteAppSettingsData>("write_app_settings", {
      path: null,
      content: buildSettingsPayload(values),
    });

    if (!result.success || !result.data) {
      return toSaveError(result.error, "Check the settings path and filesystem permissions, then retry.");
    }

    return {
      status: "success",
      detail: "ClawDesk settings saved successfully.",
      suggestion: "Logs and Service pages will use the new values on next refresh.",
      savedPath: result.data.path,
      backupPath: result.data.backupPath ?? undefined,
    };
  },
};
