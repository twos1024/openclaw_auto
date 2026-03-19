use crate::models::result::CommandResult;
use crate::services::provider_service::{
    self, CreateProviderPayload, DeleteProviderData, Provider, ProviderValidationData,
    UpdateProviderPayload,
};

#[tauri::command]
pub async fn list_providers() -> CommandResult<Vec<Provider>> {
    match provider_service::list_providers().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn create_provider(payload: CreateProviderPayload) -> CommandResult<Provider> {
    match provider_service::create_provider(payload).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn update_provider(payload: UpdateProviderPayload) -> CommandResult<Provider> {
    match provider_service::update_provider(payload).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn delete_provider(id: String) -> CommandResult<DeleteProviderData> {
    match provider_service::delete_provider(id).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn validate_provider(id: String) -> CommandResult<ProviderValidationData> {
    match provider_service::validate_provider(id).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
