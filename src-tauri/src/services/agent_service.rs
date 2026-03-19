use crate::models::error::AppError;
use crate::services::instance_service;

pub type Agent = instance_service::Instance;
pub type AgentListData = instance_service::InstanceListData;
pub type CreateAgentPayload = instance_service::CreateInstancePayload;
pub type UpdateAgentPayload = instance_service::UpdateInstancePayload;
pub type DeleteAgentData = instance_service::DeleteInstanceData;

pub async fn list_agents(search: Option<String>) -> Result<AgentListData, AppError> {
    instance_service::list_instances(search).await
}

pub async fn create_agent(payload: CreateAgentPayload) -> Result<Agent, AppError> {
    instance_service::create_instance(payload).await
}

pub async fn update_agent(payload: UpdateAgentPayload) -> Result<Agent, AppError> {
    instance_service::update_instance(payload).await
}

pub async fn start_agent(id: String) -> Result<Agent, AppError> {
    instance_service::start_instance(id).await
}

pub async fn stop_agent(id: String) -> Result<Agent, AppError> {
    instance_service::stop_instance(id).await
}

pub async fn delete_agent(id: String) -> Result<DeleteAgentData, AppError> {
    instance_service::delete_instance(id).await
}
