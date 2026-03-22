/**
 * @compatibility-layer
 *
 * tauriClient.ts is kept as a compatibility shim for one release cycle.
 * Do NOT add new imports from this module in business code.
 * New code must import from hostClient instead.
 *
 * This module provides legacy-named wrappers that map host-agnostic values back
 * to Tauri-named values for backward compatibility:
 *   - getRuntimeDiagnostics() maps HostRuntimeMode → RuntimeMode
 *   - invokeCommand()         maps E_HOST_UNAVAILABLE → E_TAURI_UNAVAILABLE
 *   - createRuntimeAccessError() maps E_HOST_UNAVAILABLE → E_TAURI_UNAVAILABLE
 */
export { getInvoke } from "./hostClient";

import type { BackendError, CommandResult, RuntimeDiagnostics } from "../types/api";
import {
  createHostAccessError,
  getHostDiagnostics,
  invokeCommand as hostInvokeCommand,
  isHostRuntime,
} from "./hostClient";

/** Map host-agnostic error codes back to legacy Tauri-named codes. */
function toLegacyErrorCode(code: string): string {
  if (code === "E_HOST_UNAVAILABLE") return "E_TAURI_UNAVAILABLE";
  return code;
}

/** Wrapped invokeCommand that preserves the legacy E_TAURI_UNAVAILABLE error code. */
export async function invokeCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  const result = await hostInvokeCommand<T>(command, payload);
  if (!result.success && result.error) {
    return {
      ...result,
      error: { ...result.error, code: toLegacyErrorCode(result.error.code) },
    };
  }
  return result;
}

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
  const err = createHostAccessError();
  return { ...err, code: toLegacyErrorCode(err.code) };
}
