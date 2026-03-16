use crate::models::result::CommandResult;
use crate::services::log_service::{self, ExportDiagnosticsData, LogSource, ReadLogsData};

#[tauri::command]
pub async fn read_logs(source: LogSource, lines: Option<usize>) -> CommandResult<ReadLogsData> {
    match log_service::read_logs(source, lines.unwrap_or(1200)).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn export_diagnostics(
    source: LogSource,
    keyword: Option<String>,
    content: String,
    archive: Option<bool>,
) -> CommandResult<ExportDiagnosticsData> {
    match log_service::export_diagnostics(source, keyword, content, archive.unwrap_or(false)).await
    {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
