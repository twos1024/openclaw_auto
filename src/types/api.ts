// Host-agnostic runtime types — use these in new code.
// HostRuntimeMode uses host-neutral names; RuntimeMode keeps Tauri-named values
// for the compatibility layer (tauriClient.ts) only.
export type HostRuntimeMode =
  | "browser-preview"
  | "host-runtime-available"
  | "host-runtime-unavailable";

export type HostBridgeSource = "official-api" | "global-fallback" | "none";

export interface HostDiagnostics {
  mode: HostRuntimeMode;
  hasTauriShell: boolean;
  hasInvokeBridge: boolean;
  bridgeSource: HostBridgeSource;
}

export type ErrorCode =
  | "E_INVALID_INPUT"
  | "E_PATH_NOT_FOUND"
  | "E_PERMISSION_DENIED"
  | "E_CONFIG_CORRUPTED"
  | "E_CONFIG_READ_FAILED"
  | "E_CONFIG_WRITE_FAILED"
  | "E_CONFIG_BACKUP_FAILED"
  | "E_SHELL_SPAWN_FAILED"
  | "E_SHELL_TIMEOUT"
  | "E_SHELL_WAIT_FAILED"
  | "E_INSTALL_COMMAND_FAILED"
  | "E_NETWORK_FAILED"
  | "E_PORT_CONFLICT"
  | "E_GATEWAY_INSTALL_FAILED"
  | "E_GATEWAY_START_FAILED"
  | "E_GATEWAY_STATUS_FAILED"
  | "E_GATEWAY_STOP_FAILED"
  | "E_GATEWAY_NOT_RUNNING"
  | "E_LOG_READ_FAILED"
  | "E_DIAGNOSTICS_EXPORT_FAILED"
  | "E_DASHBOARD_OPEN_FAILED"
  | "E_CONNECTION_TEST"
  | "E_INVOKE"
  | "E_HOST_UNAVAILABLE"
  | "E_TAURI_UNAVAILABLE" // legacy alias — tauriClient shim maps E_HOST_UNAVAILABLE back to this
  | "E_PREVIEW_MODE"
  | "E_UNKNOWN"
  | string;

export type RuntimeMode =
  | "browser-preview"
  | "tauri-runtime-available"
  | "tauri-runtime-unavailable";

export type RuntimeBridgeSource = "official-api" | "global-fallback" | "none";

export interface RuntimeDiagnostics {
  mode: RuntimeMode;
  hasTauriShell: boolean;
  hasInvokeBridge: boolean;
  bridgeSource: RuntimeBridgeSource;
}

export interface BackendError {
  code: ErrorCode;
  message: string;
  suggestion: string;
  details?: Record<string, unknown>;
}

export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: BackendError;
}
