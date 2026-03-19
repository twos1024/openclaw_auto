use crate::models::result::CommandResult;
use crate::services::cron_service::{
    self, CreateCronJobPayload, CronJob, DeleteCronJobData, TriggerCronJobData,
    UpdateCronJobPayload,
};

#[tauri::command]
pub async fn list_cron_jobs() -> CommandResult<Vec<CronJob>> {
    match cron_service::list_cron_jobs().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn create_cron_job(payload: CreateCronJobPayload) -> CommandResult<CronJob> {
    match cron_service::create_cron_job(payload).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn update_cron_job(payload: UpdateCronJobPayload) -> CommandResult<CronJob> {
    match cron_service::update_cron_job(payload).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn delete_cron_job(id: String) -> CommandResult<DeleteCronJobData> {
    match cron_service::delete_cron_job(id).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn trigger_cron_job(id: String) -> CommandResult<TriggerCronJobData> {
    match cron_service::trigger_cron_job(id).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
