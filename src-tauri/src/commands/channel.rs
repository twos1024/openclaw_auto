use crate::models::result::CommandResult;
use crate::services::channel_service::{
    self, Channel, CreateChannelPayload, DeleteChannelData, UpdateChannelPayload,
};

#[tauri::command]
pub async fn list_channels() -> CommandResult<Vec<Channel>> {
    match channel_service::list_channels().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn add_channel(payload: CreateChannelPayload) -> CommandResult<Channel> {
    match channel_service::add_channel(payload).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn update_channel(payload: UpdateChannelPayload) -> CommandResult<Channel> {
    match channel_service::update_channel(payload).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn delete_channel(id: String) -> CommandResult<DeleteChannelData> {
    match channel_service::delete_channel(id).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
