use tauri::AppHandle;

use crate::models::result::CommandResult;
use crate::services::admin_service::{self, AdminStatusData, RelaunchResult};

#[tauri::command]
pub async fn check_admin_status() -> CommandResult<AdminStatusData> {
    let data = admin_service::check_admin_status();
    CommandResult::ok(data)
}

#[tauri::command]
pub async fn relaunch_as_admin(app: AppHandle) -> CommandResult<RelaunchResult> {
    let result = admin_service::relaunch_as_admin();
    if result.launched {
        // Close the current (non-elevated) window so only the elevated one remains.
        app.exit(0);
    }
    CommandResult::ok(result)
}
