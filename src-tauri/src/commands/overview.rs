use crate::models::result::CommandResult;
use crate::services::overview_service::{self, OverviewStatusData};

#[tauri::command]
pub async fn get_overview_status() -> CommandResult<OverviewStatusData> {
    match overview_service::get_overview_status().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
