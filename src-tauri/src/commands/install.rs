use crate::models::result::CommandResult;
use crate::services::install_service::{self, InstallOpenClawData};

#[tauri::command]
pub async fn install_openclaw() -> CommandResult<InstallOpenClawData> {
    match install_service::install_openclaw().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
