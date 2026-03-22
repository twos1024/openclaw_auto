/**
 * hostClient.ts — Canonical host bridge for all business code.
 *
 * This is the single source of truth for detecting and communicating with the
 * desktop host runtime (currently Tauri). Business code must import from here,
 * not from tauriClient.
 *
 * tauriClient.ts is a compatibility shim that re-exports from this module for
 * code that has not yet been migrated.
 */
import { invoke as officialInvoke, isTauri as detectTauriShell } from "@tauri-apps/api/core";
import type { BackendError, CommandResult, HostBridgeSource, HostDiagnostics } from "../types/api";

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
): HostBridgeSource {
  if (officialBridge) return "official-api";
  if (globalBridge) return "global-fallback";
  return "none";
}

export function getHostDiagnostics(): HostDiagnostics {
  const officialBridge = getOfficialInvokeBridge();
  const globalBridge = getGlobalFallbackInvokeBridge();
  const bridgeSource = getBridgeSource(officialBridge, globalBridge);
  const hasInvokeBridge = bridgeSource !== "none";
  const hasTauriShell =
    detectTauriShell() || Boolean(window.__TAURI_INTERNALS__) || Boolean(window.__TAURI__) || window.isTauri === true;

  if (hasInvokeBridge) {
    return {
      mode: "host-runtime-available",
      hasTauriShell: true,
      hasInvokeBridge: true,
      bridgeSource,
    };
  }

  if (hasTauriShell) {
    return {
      mode: "host-runtime-unavailable",
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

function hostDiagnosticsDetails(host: HostDiagnostics): Record<string, unknown> {
  return {
    runtimeMode: host.mode,
    hasTauriShell: host.hasTauriShell,
    hasInvokeBridge: host.hasInvokeBridge,
    bridgeSource: host.bridgeSource,
  };
}

export function createHostAccessError(host: HostDiagnostics = getHostDiagnostics()): BackendError {
  if (host.mode === "browser-preview") {
    return {
      code: "E_PREVIEW_MODE",
      message: "Local commands are unavailable in browser preview mode.",
      suggestion: "Run ClawDesk inside the desktop shell or use the packaged desktop app.",
      details: hostDiagnosticsDetails(host),
    };
  }

  return {
    code: "E_HOST_UNAVAILABLE",
    message: "ClawDesk is running in a desktop shell, but the host command bridge is unavailable.",
    suggestion:
      "Relaunch or reinstall ClawDesk and verify the frontend bundles the host API bridge correctly.",
    details: hostDiagnosticsDetails(host),
  };
}

export function getInvoke(): InvokeFn | null {
  const officialBridge = getOfficialInvokeBridge();
  if (officialBridge) {
    return officialBridge;
  }

  return getGlobalFallbackInvokeBridge();
}

export function isHostRuntime(): boolean {
  return getHostDiagnostics().mode === "host-runtime-available";
}

export async function invokeCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  const invoke = getInvoke();
  if (!invoke) {
    return {
      success: false,
      error: createHostAccessError(),
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
        suggestion: "Ensure the backend command is registered and the desktop host is running normally.",
      },
    };
  }
}
