use crate::models::result::CommandResult;
use crate::services::connectivity_service::{self, ConnectionConfigInput, ConnectionTestData};

#[tauri::command]
pub async fn test_connection(content: ConnectionConfigInput) -> CommandResult<ConnectionTestData> {
    match connectivity_service::test_connection(content).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
