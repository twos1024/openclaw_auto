use crate::models::result::CommandResult;
use crate::services::instance_service::{
    self, CreateInstancePayload, DeleteInstanceData, Instance, InstanceListData,
    UpdateInstancePayload,
};

#[tauri::command]
pub async fn start_instance(id: String) -> CommandResult<Instance> {
    match instance_service::start_instance(id).await {
        Ok(instance) => CommandResult::ok(instance),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn stop_instance(id: String) -> CommandResult<Instance> {
    match instance_service::stop_instance(id).await {
        Ok(instance) => CommandResult::ok(instance),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn list_instances(search: Option<String>) -> CommandResult<InstanceListData> {
    match instance_service::list_instances(search).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn create_instance(payload: CreateInstancePayload) -> CommandResult<Instance> {
    match instance_service::create_instance(payload).await {
        Ok(instance) => CommandResult::ok(instance),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn update_instance(payload: UpdateInstancePayload) -> CommandResult<Instance> {
    match instance_service::update_instance(payload).await {
        Ok(instance) => CommandResult::ok(instance),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn delete_instance(id: String) -> CommandResult<DeleteInstanceData> {
    match instance_service::delete_instance(id).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
