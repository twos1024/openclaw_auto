import type { BackendError, CommandResult } from "../types/api";

// Type declaration for the API exposed by the preload script via contextBridge.
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

export function createRuntimeAccessError(): BackendError {
  if (!isElectronRuntime()) {
    return {
      code: "E_PREVIEW_MODE",
      message: "Local commands are unavailable in browser preview mode.",
      suggestion: "Run ClawDesk inside the Electron desktop shell or use the packaged desktop app.",
      details: { runtimeMode: "browser-preview" },
    };
  }
  return {
    code: "E_IPC_UNAVAILABLE",
    message: "ClawDesk is running in Electron but the IPC bridge is unavailable.",
    suggestion: "Relaunch or reinstall ClawDesk and verify the preload script is loaded correctly.",
    details: { runtimeMode: "electron-unavailable" },
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
