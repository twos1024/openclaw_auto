use serde_json::Value;

use crate::models::result::CommandResult;
use crate::services::config_service::{self, BackupConfigData, ReadConfigData, WriteConfigData};

#[tauri::command]
pub async fn read_openclaw_config(path: Option<String>) -> CommandResult<ReadConfigData> {
    match config_service::read_openclaw_config(path).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn write_openclaw_config(
    path: Option<String>,
    content: Value,
) -> CommandResult<WriteConfigData> {
    match config_service::write_openclaw_config(path, content).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn backup_openclaw_config(path: Option<String>) -> CommandResult<BackupConfigData> {
    match config_service::backup_openclaw_config(path).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
