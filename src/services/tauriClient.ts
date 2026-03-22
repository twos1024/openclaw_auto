/**
 * @compatibility-layer
 *
 * tauriClient.ts is kept as a compatibility shim for one release cycle.
 * Do NOT add new imports from this module in business code.
 * New code must import from hostClient instead.
 *
 * This module re-exports invokeCommand and getInvoke from hostClient, and
 * provides legacy-named wrappers (getRuntimeDiagnostics, isTauriRuntime,
 * createRuntimeAccessError) that map the host-agnostic HostDiagnostics back
 * to the Tauri-named RuntimeDiagnostics / RuntimeMode for backward compatibility.
 */
export { invokeCommand, getInvoke } from "./hostClient";

import type { BackendError, RuntimeDiagnostics } from "../types/api";
import { createHostAccessError, getHostDiagnostics, isHostRuntime } from "./hostClient";

function toRuntimeMode(mode: string): RuntimeDiagnostics["mode"] {
  if (mode === "host-runtime-available") return "tauri-runtime-available";
  if (mode === "host-runtime-unavailable") return "tauri-runtime-unavailable";
  return "browser-preview";
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const host = getHostDiagnostics();
  return {
    mode: toRuntimeMode(host.mode),
    hasTauriShell: host.hasTauriShell,
    hasInvokeBridge: host.hasInvokeBridge,
    bridgeSource: host.bridgeSource,
  };
}

export function isTauriRuntime(): boolean {
  return isHostRuntime();
}

export function createRuntimeAccessError(): BackendError {
  return createHostAccessError();
}
