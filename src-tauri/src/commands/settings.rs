use crate::models::result::CommandResult;
use crate::services::settings_service::{
    self, AppSettings, ReadAppSettingsData, WriteAppSettingsData,
};

#[tauri::command]
pub async fn read_app_settings(path: Option<String>) -> CommandResult<ReadAppSettingsData> {
    match settings_service::read_app_settings(path).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn write_app_settings(
    path: Option<String>,
    content: AppSettings,
) -> CommandResult<WriteAppSettingsData> {
    match settings_service::write_app_settings(path, content).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
