use crate::models::result::CommandResult;
use crate::services::agent_service::{
    self, Agent, AgentListData, CreateAgentPayload, DeleteAgentData, UpdateAgentPayload,
};

#[tauri::command]
pub async fn start_agent(id: String) -> CommandResult<Agent> {
    match agent_service::start_agent(id).await {
        Ok(agent) => CommandResult::ok(agent),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn stop_agent(id: String) -> CommandResult<Agent> {
    match agent_service::stop_agent(id).await {
        Ok(agent) => CommandResult::ok(agent),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn list_agents(search: Option<String>) -> CommandResult<AgentListData> {
    match agent_service::list_agents(search).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn create_agent(payload: CreateAgentPayload) -> CommandResult<Agent> {
    match agent_service::create_agent(payload).await {
        Ok(agent) => CommandResult::ok(agent),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn update_agent(payload: UpdateAgentPayload) -> CommandResult<Agent> {
    match agent_service::update_agent(payload).await {
        Ok(agent) => CommandResult::ok(agent),
        Err(error) => CommandResult::err(error),
    }
}

#[tauri::command]
pub async fn delete_agent(id: String) -> CommandResult<DeleteAgentData> {
    match agent_service::delete_agent(id).await {
        Ok(data) => CommandResult::ok(data),
        Err(error) => CommandResult::err(error),
    }
}
