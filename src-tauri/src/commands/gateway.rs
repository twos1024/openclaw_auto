use crate::models::result::CommandResult;
use crate::services::gateway_service::{
    self, DashboardProbeData, GatewayActionData, GatewayStatusData,
};

#[tauri::command]
pub async fn get_gateway_status() -> CommandResult<GatewayStatusData> {
    match gateway_service::get_gateway_status().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn start_gateway() -> CommandResult<GatewayActionData> {
    match gateway_service::start_gateway().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn stop_gateway() -> CommandResult<GatewayActionData> {
    match gateway_service::stop_gateway().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn restart_gateway() -> CommandResult<GatewayActionData> {
    match gateway_service::restart_gateway().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn open_dashboard() -> CommandResult<GatewayActionData> {
    match gateway_service::open_dashboard().await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn probe_dashboard_endpoint(address: String) -> CommandResult<DashboardProbeData> {
    match gateway_service::probe_dashboard_endpoint(address).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
