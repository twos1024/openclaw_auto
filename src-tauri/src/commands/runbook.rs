use crate::models::result::CommandResult;
use crate::services::runbook_service::{self, RunbookModelData};

#[tauri::command]
pub async fn get_runbook_model() -> CommandResult<RunbookModelData> {
    match runbook_service::get_runbook_model().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
