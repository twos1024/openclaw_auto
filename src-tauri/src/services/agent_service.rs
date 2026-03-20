use crate::models::error::{AppError, ErrorCode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "modelName")]
    pub model_name: String,
    #[serde(rename = "channelType")]
    pub channel_type: String,
    #[serde(rename = "apiKeyRef")]
    pub api_key_ref: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: Option<String>,
    #[serde(rename = "totalTokensUsed")]
    pub total_tokens_used: u64,
    #[serde(rename = "totalConversations")]
    pub total_conversations: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentListData {
    pub agents: Vec<Agent>,
    pub total: usize,
    pub running: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAgentPayload {
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "modelName")]
    pub model_name: String,
    #[serde(rename = "channelType")]
    pub channel_type: String,
    #[serde(rename = "apiKeyRef")]
    pub api_key_ref: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAgentPayload {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: Option<String>,
    #[serde(rename = "modelId")]
    pub model_id: Option<String>,
    #[serde(rename = "modelName")]
    pub model_name: Option<String>,
    #[serde(rename = "channelType")]
    pub channel_type: Option<String>,
    #[serde(rename = "apiKeyRef")]
    pub api_key_ref: Option<String>,
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteAgentData {
    pub deleted: bool,
    pub id: String,
}

fn not_implemented(action: &str) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Agent {} is not yet implemented.", action),
        "This feature is planned for a future release.",
    )
}

pub async fn list_agents(_search: Option<String>) -> Result<AgentListData, AppError> {
    Err(not_implemented("listing"))
}

pub async fn create_agent(_payload: CreateAgentPayload) -> Result<Agent, AppError> {
    Err(not_implemented("creation"))
}

pub async fn update_agent(_payload: UpdateAgentPayload) -> Result<Agent, AppError> {
    Err(not_implemented("update"))
}

pub async fn start_agent(_id: String) -> Result<Agent, AppError> {
    Err(not_implemented("start"))
}

pub async fn stop_agent(_id: String) -> Result<Agent, AppError> {
    Err(not_implemented("stop"))
}

pub async fn delete_agent(_id: String) -> Result<DeleteAgentData, AppError> {
    Err(not_implemented("deletion"))
}
