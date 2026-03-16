use crate::models::result::CommandResult;
use crate::services::env_service::{self, DetectEnvData};

#[tauri::command]
pub async fn detect_env() -> CommandResult<DetectEnvData> {
    match env_service::detect_env().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
