// Electron IPC bridge — replaces the Tauri invoke bridge.
// Exported function names are kept identical so existing service files need no changes.

import type { BackendError, CommandResult, RuntimeDiagnostics } from "../types/api";

declare global {
  interface Window {
    api?: {
      invoke: <T>(channel: string, payload?: Record<string, unknown>) => Promise<T>;
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
    electron?: {
      platform: string;
      versions: Record<string, string>;
    };
  }
}

export function isElectronRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.api?.invoke === "function";
}

/** @deprecated Use isElectronRuntime() — kept for backwards compat with existing callers. */
export function isTauriRuntime(): boolean {
  return isElectronRuntime();
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  if (isElectronRuntime()) {
    return { mode: "electron-runtime-available", hasInvokeBridge: true, bridgeSource: "electron-ipc" };
  }
  if (typeof window !== "undefined" && window.electron) {
    return { mode: "electron-runtime-unavailable", hasInvokeBridge: false, bridgeSource: "none" };
  }
  return { mode: "browser-preview", hasInvokeBridge: false, bridgeSource: "none" };
}

export function createRuntimeAccessError(runtime: RuntimeDiagnostics = getRuntimeDiagnostics()): BackendError {
  if (runtime.mode === "browser-preview") {
    return {
      code: "E_PREVIEW_MODE",
      message: "Local commands are unavailable in browser preview mode.",
      suggestion: "Run ClawDesk inside the Electron desktop shell or use the packaged desktop app.",
      details: { runtimeMode: runtime.mode },
    };
  }
  return {
    code: "E_IPC_UNAVAILABLE",
    message: "ClawDesk is running in Electron but the IPC bridge is unavailable.",
    suggestion: "Relaunch or reinstall ClawDesk and verify the preload script is loaded correctly.",
    details: { runtimeMode: runtime.mode },
  };
}

export async function invokeCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  if (!window.api?.invoke) {
    return { success: false, error: createRuntimeAccessError() };
  }
  try {
    return await window.api.invoke<CommandResult<T>>(command, payload);
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "E_INVOKE",
        message: error instanceof Error ? error.message : `Failed to invoke command: ${command}`,
        suggestion: "Ensure the Electron main process is running and the IPC handler is registered.",
      },
    };
  }
}
