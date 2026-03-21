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
  | "E_TAURI_UNAVAILABLE"
  | "E_IPC_UNAVAILABLE"
  | "E_PREVIEW_MODE"
  | "E_UNKNOWN"
  | string;

export type RuntimeMode =
  | "browser-preview"
  | "electron-runtime-available"
  | "electron-runtime-unavailable"
  | "tauri-runtime-available"
  | "tauri-runtime-unavailable";

export type RuntimeBridgeSource = "electron-ipc" | "official-api" | "global-fallback" | "none";

export interface RuntimeDiagnostics {
  mode: RuntimeMode;
  hasInvokeBridge: boolean;
  bridgeSource: RuntimeBridgeSource;
  hasTauriShell?: boolean;
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
