import type {
  BackendError,
  CommandResult,
  HostBridgeSource,
  HostDiagnostics,
  HostRuntimeMode,
} from "../types/api";

type InvokeFn = <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __OPENCLAW_HOST__?: {
      core?: {
        invoke?: InvokeFn;
      };
      invoke?: InvokeFn;
    };
    __OPENCLAW_HOST_INTERNALS__?: {
      invoke?: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
    };
    __TAURI__?: {
      core?: {
        invoke?: InvokeFn;
      };
    };
    __TAURI_INTERNALS__?: {
      invoke?: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
    };
    isOpenClawHost?: boolean;
    isTauri?: boolean;
  }
}

function getOpenClawHostInternalsInvoke(): InvokeFn | null {
  return typeof window.__OPENCLAW_HOST_INTERNALS__?.invoke === "function"
    ? window.__OPENCLAW_HOST_INTERNALS__.invoke
    : null;
}

function getOpenClawHostInvoke(): InvokeFn | null {
  if (typeof window.__OPENCLAW_HOST__?.invoke === "function") {
    return window.__OPENCLAW_HOST__.invoke;
  }

  if (typeof window.__OPENCLAW_HOST__?.core?.invoke === "function") {
    return window.__OPENCLAW_HOST__.core.invoke;
  }

  return null;
}

function getLegacyInternalsInvoke(): InvokeFn | null {
  return typeof window.__TAURI_INTERNALS__?.invoke === "function"
    ? window.__TAURI_INTERNALS__.invoke
    : null;
}

function getLegacyWindowInvoke(): InvokeFn | null {
  return typeof window.__TAURI__?.core?.invoke === "function" ? window.__TAURI__.core.invoke : null;
}

function getBridgeSource(
  openClawInternals: InvokeFn | null,
  openClawWindow: InvokeFn | null,
  legacyInternals: InvokeFn | null,
  legacyWindow: InvokeFn | null,
): HostBridgeSource {
  if (openClawInternals || legacyInternals) return "native-api";
  if (openClawWindow || legacyWindow) return "window-fallback";
  return "none";
}

export function getHostDiagnostics(): HostDiagnostics {
  const openClawInternals = getOpenClawHostInternalsInvoke();
  const openClawWindow = getOpenClawHostInvoke();
  const legacyInternals = getLegacyInternalsInvoke();
  const legacyWindow = getLegacyWindowInvoke();
  const bridgeSource = getBridgeSource(openClawInternals, openClawWindow, legacyInternals, legacyWindow);
  const hasInvokeBridge = bridgeSource !== "none";
  const hasHostShell =
    Boolean(window.__OPENCLAW_HOST_INTERNALS__) ||
    Boolean(window.__OPENCLAW_HOST__) ||
    Boolean(window.__TAURI_INTERNALS__) ||
    Boolean(window.__TAURI__) ||
    window.isOpenClawHost === true ||
    window.isTauri === true;

  if (hasInvokeBridge) {
    return {
      mode: "host-runtime-available",
      hasHostShell: true,
      hasInvokeBridge: true,
      bridgeSource,
    };
  }

  if (hasHostShell) {
    return {
      mode: "host-runtime-unavailable",
      hasHostShell: true,
      hasInvokeBridge: false,
      bridgeSource: "none",
    };
  }

  return {
    mode: "browser-preview",
    hasHostShell: false,
    hasInvokeBridge: false,
    bridgeSource: "none",
  };
}

function runtimeDiagnosticsDetails(runtime: HostDiagnostics): Record<string, unknown> {
  return {
    runtimeMode: runtime.mode,
    hasHostShell: runtime.hasHostShell,
    hasInvokeBridge: runtime.hasInvokeBridge,
    bridgeSource: runtime.bridgeSource,
  };
}

export function createHostAccessError(runtime: HostDiagnostics = getHostDiagnostics()): BackendError {
  if (runtime.mode === "browser-preview") {
    return {
      code: "E_PREVIEW_MODE",
      message: "Local commands are unavailable in browser preview mode.",
      suggestion: "Run ClawDesk inside the desktop shell or use the packaged desktop app.",
      details: runtimeDiagnosticsDetails(runtime),
    };
  }

  return {
    code: "E_HOST_UNAVAILABLE",
    message: "ClawDesk is running in a desktop shell, but the host command bridge is unavailable.",
    suggestion:
      "Relaunch or reinstall ClawDesk and verify the frontend bundles the host API bridge correctly.",
    details: runtimeDiagnosticsDetails(runtime),
  };
}

export function getHostInvoke(): InvokeFn | null {
  return getOpenClawHostInternalsInvoke() ?? getOpenClawHostInvoke() ?? getLegacyInternalsInvoke() ?? getLegacyWindowInvoke();
}

export function isHostRuntime(): boolean {
  return getHostDiagnostics().mode === "host-runtime-available";
}

export async function invokeHostCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  const invoke = getHostInvoke();
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

export const invokeCommand = invokeHostCommand;

export type { HostBridgeSource, HostDiagnostics, HostRuntimeMode };
