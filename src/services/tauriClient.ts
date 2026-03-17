import { invoke as officialInvoke, isTauri as detectTauriShell } from "@tauri-apps/api/core";
import type { BackendError, CommandResult, RuntimeBridgeSource, RuntimeDiagnostics } from "../types/api";

type InvokeFn = <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: InvokeFn;
      };
    };
    __TAURI_INTERNALS__?: {
      invoke?: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
    };
    isTauri?: boolean;
  }
}

function getOfficialInvokeBridge(): InvokeFn | null {
  return typeof window.__TAURI_INTERNALS__?.invoke === "function"
    ? (async <T>(command: string, payload?: Record<string, unknown>) => officialInvoke<T>(command, payload))
    : null;
}

function getGlobalFallbackInvokeBridge(): InvokeFn | null {
  return typeof window.__TAURI__?.core?.invoke === "function" ? window.__TAURI__.core.invoke : null;
}

function getBridgeSource(
  officialBridge: InvokeFn | null,
  globalBridge: InvokeFn | null,
): RuntimeBridgeSource {
  if (officialBridge) return "official-api";
  if (globalBridge) return "global-fallback";
  return "none";
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const officialBridge = getOfficialInvokeBridge();
  const globalBridge = getGlobalFallbackInvokeBridge();
  const bridgeSource = getBridgeSource(officialBridge, globalBridge);
  const hasInvokeBridge = bridgeSource !== "none";
  const hasTauriShell =
    detectTauriShell() || Boolean(window.__TAURI_INTERNALS__) || Boolean(window.__TAURI__) || window.isTauri === true;

  if (hasInvokeBridge) {
    return {
      mode: "tauri-runtime-available",
      hasTauriShell: true,
      hasInvokeBridge: true,
      bridgeSource,
    };
  }

  if (hasTauriShell) {
    return {
      mode: "tauri-runtime-unavailable",
      hasTauriShell: true,
      hasInvokeBridge: false,
      bridgeSource: "none",
    };
  }

  return {
    mode: "browser-preview",
    hasTauriShell: false,
    hasInvokeBridge: false,
    bridgeSource: "none",
  };
}

function runtimeDiagnosticsDetails(runtime: RuntimeDiagnostics): Record<string, unknown> {
  return {
    runtimeMode: runtime.mode,
    hasTauriShell: runtime.hasTauriShell,
    hasInvokeBridge: runtime.hasInvokeBridge,
    bridgeSource: runtime.bridgeSource,
  };
}

export function createRuntimeAccessError(runtime: RuntimeDiagnostics = getRuntimeDiagnostics()): BackendError {
  if (runtime.mode === "browser-preview") {
    return {
      code: "E_PREVIEW_MODE",
      message: "Local commands are unavailable in browser preview mode.",
      suggestion: "Run ClawDesk inside the Tauri desktop shell or use the packaged desktop app.",
      details: runtimeDiagnosticsDetails(runtime),
    };
  }

  return {
    code: "E_TAURI_UNAVAILABLE",
    message: "ClawDesk is running in a desktop shell, but the Tauri command bridge is unavailable.",
    suggestion:
      "Relaunch or reinstall ClawDesk and verify the frontend bundles the Tauri API bridge correctly.",
    details: runtimeDiagnosticsDetails(runtime),
  };
}

export function getInvoke(): InvokeFn | null {
  const officialBridge = getOfficialInvokeBridge();
  if (officialBridge) {
    return officialBridge;
  }

  return getGlobalFallbackInvokeBridge();
}

export function isTauriRuntime(): boolean {
  return getRuntimeDiagnostics().mode === "tauri-runtime-available";
}

export async function invokeCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  const invoke = getInvoke();
  if (!invoke) {
    return {
      success: false,
      error: createRuntimeAccessError(),
    };
  }

  try {
    return await invoke<CommandResult<T>>(command, payload);
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "E_INVOKE",
        message: error instanceof Error ? error.message : `Failed to invoke command: ${command}`,
        suggestion: "Ensure the backend command is registered and Tauri is running normally.",
      },
    };
  }
}
