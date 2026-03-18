use crate::models::result::CommandResult;
use crate::services::install_service::{self, InstallOpenClawData, TerminalInstallData};

#[tauri::command]
pub async fn install_openclaw() -> CommandResult<InstallOpenClawData> {
    match install_service::install_openclaw().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

/// Opens a new terminal window and runs the install command inside it so the
/// user can see live output.  Returns immediately — install runs in the
/// terminal window, not in the background.
#[tauri::command]
pub async fn install_openclaw_in_terminal() -> CommandResult<TerminalInstallData> {
    match install_service::install_openclaw_with_terminal().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
