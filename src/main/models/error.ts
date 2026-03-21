export enum ErrorCode {
  InvalidInput = "E_INVALID_INPUT",
  PathNotFound = "E_PATH_NOT_FOUND",
  PermissionDenied = "E_PERMISSION_DENIED",
  ConfigCorrupted = "E_CONFIG_CORRUPTED",
  ConfigReadFailed = "E_CONFIG_READ_FAILED",
  ConfigWriteFailed = "E_CONFIG_WRITE_FAILED",
  ConfigBackupFailed = "E_CONFIG_BACKUP_FAILED",
  ShellSpawnFailed = "E_SHELL_SPAWN_FAILED",
  ShellTimeout = "E_SHELL_TIMEOUT",
  ShellWaitFailed = "E_SHELL_WAIT_FAILED",
  InstallCommandFailed = "E_INSTALL_COMMAND_FAILED",
  NetworkFailed = "E_NETWORK_FAILED",
  PortConflict = "E_PORT_CONFLICT",
  GatewayInstallFailed = "E_GATEWAY_INSTALL_FAILED",
  GatewayStartFailed = "E_GATEWAY_START_FAILED",
  GatewayStatusFailed = "E_GATEWAY_STATUS_FAILED",
  GatewayStopFailed = "E_GATEWAY_STOP_FAILED",
  GatewayNotRunning = "E_GATEWAY_NOT_RUNNING",
  LogReadFailed = "E_LOG_READ_FAILED",
  DiagnosticsExportFailed = "E_DIAGNOSTICS_EXPORT_FAILED",
  DashboardOpenFailed = "E_DASHBOARD_OPEN_FAILED",
  ConnectionTestFailed = "E_CONNECTION_TEST",
  InternalError = "E_INTERNAL",
}

export class AppError extends Error {
  code: ErrorCode;
  suggestion: string;
  details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    suggestion: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.suggestion = suggestion;
    this.details = details;
  }

  withDetails(details: unknown): AppError {
    return new AppError(this.code, this.message, this.suggestion, details);
  }

  toJSON(): object {
    return {
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}
