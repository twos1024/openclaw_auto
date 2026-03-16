use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorCode {
    #[serde(rename = "E_INVALID_INPUT")]
    InvalidInput,
    #[serde(rename = "E_PATH_NOT_FOUND")]
    PathNotFound,
    #[serde(rename = "E_PERMISSION_DENIED")]
    PermissionDenied,
    #[serde(rename = "E_CONFIG_CORRUPTED")]
    ConfigCorrupted,
    #[serde(rename = "E_CONFIG_READ_FAILED")]
    ConfigReadFailed,
    #[serde(rename = "E_CONFIG_WRITE_FAILED")]
    ConfigWriteFailed,
    #[serde(rename = "E_CONFIG_BACKUP_FAILED")]
    ConfigBackupFailed,
    #[serde(rename = "E_SHELL_SPAWN_FAILED")]
    ShellSpawnFailed,
    #[serde(rename = "E_SHELL_TIMEOUT")]
    ShellTimeout,
    #[serde(rename = "E_SHELL_WAIT_FAILED")]
    ShellWaitFailed,
    #[serde(rename = "E_INSTALL_COMMAND_FAILED")]
    InstallCommandFailed,
    #[serde(rename = "E_NETWORK_FAILED")]
    NetworkFailed,
    #[serde(rename = "E_PORT_CONFLICT")]
    PortConflict,
    #[serde(rename = "E_GATEWAY_INSTALL_FAILED")]
    GatewayInstallFailed,
    #[serde(rename = "E_GATEWAY_START_FAILED")]
    GatewayStartFailed,
    #[serde(rename = "E_GATEWAY_STOP_FAILED")]
    GatewayStopFailed,
    #[serde(rename = "E_GATEWAY_NOT_RUNNING")]
    GatewayNotRunning,
    #[serde(rename = "E_LOG_READ_FAILED")]
    LogReadFailed,
    #[serde(rename = "E_DIAGNOSTICS_EXPORT_FAILED")]
    DiagnosticsExportFailed,
    #[serde(rename = "E_DASHBOARD_OPEN_FAILED")]
    DashboardOpenFailed,
    #[serde(rename = "E_CONNECTION_TEST")]
    ConnectionTestFailed,
    #[serde(rename = "E_INTERNAL")]
    InternalError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub suggestion: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>, suggestion: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            suggestion: suggestion.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}
