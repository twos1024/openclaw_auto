use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::adapters::shell::{run_command, ShellOutput};
use crate::models::error::{AppError, ErrorCode};
use crate::services::env_service;

const AGENT_TIMEOUT_MS: u64 = 15_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentModelParams {
    pub temperature: f64,
    pub max_tokens: u32,
    pub top_p: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub display_name: String,
    pub system_prompt: String,
    pub model_id: String,
    pub model_name: String,
    pub model_params: AgentModelParams,
    pub channel_type: String,
    pub api_key_ref: String,
    pub base_url: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_active_at: Option<String>,
    pub total_tokens_used: u64,
    pub total_conversations: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentListData {
    pub agents: Vec<Agent>,
    pub total: usize,
    pub running: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentPayload {
    pub display_name: String,
    pub system_prompt: String,
    pub model_id: String,
    pub model_name: String,
    pub channel_type: String,
    pub api_key_ref: String,
    pub base_url: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAgentPayload {
    pub id: String,
    pub display_name: Option<String>,
    pub system_prompt: Option<String>,
    pub model_id: Option<String>,
    pub model_name: Option<String>,
    pub channel_type: Option<String>,
    pub api_key_ref: Option<String>,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAgentData {
    pub deleted: bool,
    pub id: String,
}

fn command_failure_error(operation: &str, output: &ShellOutput, reason: &str) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Agent {operation} command failed."),
        "Check Gateway logs and retry.",
    )
    .with_details(json!({
        "operation": operation,
        "reason": reason,
        "program": &output.program,
        "args": &output.args,
        "stdout": &output.stdout,
        "stderr": &output.stderr,
        "exit_code": output.exit_code,
    }))
}

fn invalid_json_error(operation: &str, output: &ShellOutput, error: serde_json::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Agent {operation} command returned invalid JSON."),
        "Check Gateway logs and retry.",
    )
    .with_details(json!({
        "operation": operation,
        "reason": "invalid-json",
        "program": &output.program,
        "args": &output.args,
        "stdout": &output.stdout,
        "stderr": &output.stderr,
        "exit_code": output.exit_code,
        "parse_error": error.to_string(),
    }))
}

fn unexpected_payload_error(operation: &str, output: &ShellOutput, detail: &str) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Agent {operation} command returned an unexpected payload."),
        "Check Gateway logs and retry.",
    )
    .with_details(json!({
        "operation": operation,
        "reason": "unexpected-payload",
        "detail": detail,
        "program": &output.program,
        "args": &output.args,
        "stdout": &output.stdout,
        "stderr": &output.stderr,
        "exit_code": output.exit_code,
    }))
}

fn parse_agent_json(operation: &str, output: &ShellOutput) -> Result<Value, AppError> {
    serde_json::from_str::<Value>(&output.stdout)
        .map_err(|error| invalid_json_error(operation, output, error))
}

fn ensure_success_exit(operation: &str, output: &ShellOutput) -> Result<(), AppError> {
    if output.exit_code == Some(0) {
        Ok(())
    } else {
        Err(command_failure_error(
            operation,
            output,
            "non-zero exit code",
        ))
    }
}

fn merge_create_payload(agent: &mut Agent, payload: &CreateAgentPayload) {
    agent.display_name = payload.display_name.clone();
    agent.system_prompt = payload.system_prompt.clone();
    agent.model_id = payload.model_id.clone();
    agent.model_name = payload.model_name.clone();
    agent.channel_type = normalize_from_cli_channel(&payload.channel_type);
    agent.api_key_ref = payload.api_key_ref.clone();
    agent.base_url = payload.base_url.clone();

    agent.model_params.temperature = payload
        .temperature
        .unwrap_or(agent.model_params.temperature);
    agent.model_params.max_tokens = payload.max_tokens.unwrap_or(agent.model_params.max_tokens);
}

fn merge_update_payload(agent: &mut Agent, payload: &UpdateAgentPayload) {
    if let Some(display_name) = &payload.display_name {
        agent.display_name = display_name.clone();
    }
    if let Some(system_prompt) = &payload.system_prompt {
        agent.system_prompt = system_prompt.clone();
    }
    if let Some(model_id) = &payload.model_id {
        agent.model_id = model_id.clone();
    }
    if let Some(model_name) = &payload.model_name {
        agent.model_name = model_name.clone();
    }
    if let Some(channel_type) = &payload.channel_type {
        agent.channel_type = normalize_from_cli_channel(channel_type);
    }
    if let Some(api_key_ref) = &payload.api_key_ref {
        agent.api_key_ref = api_key_ref.clone();
    }
    if let Some(base_url) = &payload.base_url {
        agent.base_url = base_url.clone();
    }
}

fn apply_agent_wrappers<'a>(value: &'a Value) -> &'a Value {
    if let Some(agent) = value.get("agent") {
        if agent.is_object() {
            return agent;
        }
    }

    if let Some(instance) = value.get("instance") {
        if instance.is_object() {
            return instance;
        }
    }

    if let Some(data) = value.get("data") {
        if data.is_object() {
            return data;
        }
    }

    value
}

fn parse_model_params(value: &Value) -> AgentModelParams {
    let defaults = default_model_params();
    let params = value
        .get("modelParams")
        .or_else(|| value.get("model_params"))
        .or_else(|| value.get("params"));

    let temperature = params
        .and_then(|v| v.get("temperature"))
        .or_else(|| value.get("temperature"))
        .and_then(Value::as_f64)
        .unwrap_or(defaults.temperature);
    let max_tokens = params
        .and_then(|v| v.get("maxTokens").or_else(|| v.get("max_tokens")))
        .or_else(|| value.get("maxTokens").or_else(|| value.get("max_tokens")))
        .and_then(Value::as_u64)
        .unwrap_or(defaults.max_tokens as u64) as u32;
    let top_p = params
        .and_then(|v| v.get("topP").or_else(|| v.get("top_p")))
        .or_else(|| value.get("topP").or_else(|| value.get("top_p")))
        .and_then(Value::as_f64)
        .unwrap_or(defaults.top_p);

    AgentModelParams {
        temperature,
        max_tokens,
        top_p,
    }
}

pub async fn list_agents(search: Option<String>) -> Result<AgentListData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let mut args = vec![
        "instance".to_string(),
        "list".to_string(),
        "--json".to_string(),
    ];
    if let Some(query) = &search {
        args.push("--search".to_string());
        args.push(query.clone());
    }

    let output = run_command(&program, &args, AGENT_TIMEOUT_MS).await;

    match output {
        Ok(out) => {
            ensure_success_exit("list", &out)?;
            let parsed = parse_agent_json("list", &out)?;
            parse_agent_list(&parsed)
                .ok_or_else(|| unexpected_payload_error("list", &out, "missing agents array"))
        }
        Err(error) => Err(error),
    }
}

pub async fn create_agent(payload: CreateAgentPayload) -> Result<Agent, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let now = Utc::now().to_rfc3339();
    let id = generate_id();

    let args = build_create_args(&id, &payload);
    let output = run_command(&program, &args, AGENT_TIMEOUT_MS).await;

    match output {
        Ok(out) => {
            ensure_success_exit("create", &out)?;
            let parsed = parse_agent_json("create", &out)?;
            let mut agent = parse_single_agent(&parsed)
                .ok_or_else(|| unexpected_payload_error("create", &out, "missing agent fields"))?;
            merge_create_payload(&mut agent, &payload);
            if agent.created_at.is_empty() {
                agent.created_at = now.clone();
            }
            if agent.updated_at.is_empty() {
                agent.updated_at = now;
            }
            agent.id = if agent.id.trim().is_empty() {
                id
            } else {
                agent.id
            };
            Ok(agent)
        }
        Err(error) => Err(error),
    }
}

pub async fn update_agent(payload: UpdateAgentPayload) -> Result<Agent, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let mut args = vec![
        "instance".to_string(),
        "update".to_string(),
        "--json".to_string(),
        "--id".to_string(),
        payload.id.clone(),
    ];
    if let Some(name) = &payload.display_name {
        args.extend(["--name".to_string(), name.clone()]);
    }
    if let Some(prompt) = &payload.system_prompt {
        args.extend(["--prompt".to_string(), prompt.clone()]);
    }
    if let Some(model) = &payload.model_id {
        args.extend(["--model".to_string(), model.clone()]);
    }

    let output = run_command(&program, &args, AGENT_TIMEOUT_MS).await;

    match output {
        Ok(out) => {
            ensure_success_exit("update", &out)?;
            let parsed = parse_agent_json("update", &out)?;
            let mut agent = parse_single_agent(&parsed)
                .ok_or_else(|| unexpected_payload_error("update", &out, "missing agent fields"))?;
            merge_update_payload(&mut agent, &payload);
            if agent.id.trim().is_empty() {
                agent.id = payload.id;
            }
            Ok(agent)
        }
        Err(error) => Err(error),
    }
}

pub async fn start_agent(id: String) -> Result<Agent, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "instance".to_string(),
        "start".to_string(),
        "--json".to_string(),
        "--id".to_string(),
        id.clone(),
    ];

    let output = run_command(&program, &args, AGENT_TIMEOUT_MS).await;

    match output {
        Ok(out) => {
            ensure_success_exit("start", &out)?;
            let parsed = parse_agent_json("start", &out)?;
            parse_single_agent(&parsed)
                .ok_or_else(|| unexpected_payload_error("start", &out, "missing agent fields"))
        }
        Err(error) => Err(error),
    }
}

pub async fn stop_agent(id: String) -> Result<Agent, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "instance".to_string(),
        "stop".to_string(),
        "--json".to_string(),
        "--id".to_string(),
        id.clone(),
    ];

    let output = run_command(&program, &args, AGENT_TIMEOUT_MS).await;

    match output {
        Ok(out) => {
            ensure_success_exit("stop", &out)?;
            let parsed = parse_agent_json("stop", &out)?;
            parse_single_agent(&parsed)
                .ok_or_else(|| unexpected_payload_error("stop", &out, "missing agent fields"))
        }
        Err(error) => Err(error),
    }
}

pub async fn delete_agent(id: String) -> Result<DeleteAgentData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "instance".to_string(),
        "delete".to_string(),
        "--json".to_string(),
        "--id".to_string(),
        id.clone(),
    ];

    let output = run_command(&program, &args, AGENT_TIMEOUT_MS).await;

    match output {
        Ok(out) => {
            ensure_success_exit("delete", &out)?;
            Ok(DeleteAgentData { deleted: true, id })
        }
        Err(error) => Err(error),
    }
}

fn build_create_args(id: &str, payload: &CreateAgentPayload) -> Vec<String> {
    vec![
        "instance".to_string(),
        "create".to_string(),
        "--json".to_string(),
        "--id".to_string(),
        id.to_string(),
        "--name".to_string(),
        payload.display_name.clone(),
        "--prompt".to_string(),
        payload.system_prompt.clone(),
        "--model".to_string(),
        payload.model_id.clone(),
        "--channel".to_string(),
        normalize_for_cli_channel(&payload.channel_type),
    ]
}

fn parse_agent_list(value: &Value) -> Option<AgentListData> {
    let value = apply_agent_wrappers(value);
    let items = if let Some(items) = value.as_array() {
        Some(items)
    } else {
        value
            .get("agents")
            .or_else(|| value.get("instances"))
            .or_else(|| value.get("data"))
            .and_then(|v| v.as_array())
    }?;

    let agents = items
        .iter()
        .map(parse_single_agent)
        .collect::<Option<Vec<_>>>()?;
    let running = agents
        .iter()
        .filter(|agent| agent.status == "active")
        .count();
    let total = agents.len();

    Some(AgentListData {
        agents,
        total,
        running,
    })
}

fn parse_single_agent(value: &Value) -> Option<Agent> {
    let value = apply_agent_wrappers(value);
    let id = value.get("id")?.as_str()?.to_string();
    let display_name = value
        .get("displayName")
        .or_else(|| value.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or(&id)
        .to_string();
    let model_id = value
        .get("modelId")
        .or_else(|| value.get("model"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let status = value
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("created")
        .to_string();
    let now = Utc::now().to_rfc3339();

    Some(Agent {
        id,
        display_name,
        system_prompt: value
            .get("systemPrompt")
            .or_else(|| value.get("prompt"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        model_id: model_id.clone(),
        model_name: value
            .get("modelName")
            .and_then(|v| v.as_str())
            .unwrap_or(&model_id)
            .to_string(),
        model_params: parse_model_params(value),
        channel_type: value
            .get("channelType")
            .or_else(|| value.get("channel"))
            .and_then(|v| v.as_str())
            .map(normalize_from_cli_channel)
            .unwrap_or_else(default_channel_type),
        api_key_ref: value
            .get("apiKeyRef")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        base_url: value
            .get("baseUrl")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        status,
        created_at: value
            .get("createdAt")
            .and_then(|v| v.as_str())
            .unwrap_or(&now)
            .to_string(),
        updated_at: value
            .get("updatedAt")
            .and_then(|v| v.as_str())
            .unwrap_or(&now)
            .to_string(),
        last_active_at: value
            .get("lastActiveAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        total_tokens_used: value
            .get("totalTokensUsed")
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
        total_conversations: value
            .get("totalConversations")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32,
    })
}

fn default_model_params() -> AgentModelParams {
    AgentModelParams {
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 1.0,
    }
}

fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

fn default_channel_type() -> String {
    "openclaw".to_string()
}

fn normalize_for_cli_channel(channel_type: &str) -> String {
    channel_type.to_string()
}

fn normalize_from_cli_channel(channel_type: &str) -> String {
    if channel_type.trim().is_empty() {
        default_channel_type()
    } else {
        channel_type.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_agent_json_model_params_and_provider_fields() {
        let value = json!({
            "id": "agent-123",
            "displayName": "Primary Agent",
            "systemPrompt": "Be helpful.",
            "modelId": "gpt-4o",
            "modelName": "GPT-4o",
            "modelParams": {
                "temperature": 0.25,
                "maxTokens": 1536,
                "topP": 0.93
            },
            "channelType": "openai-compatible",
            "apiKeyRef": "api-key-ref-1",
            "baseUrl": "https://api.example.com/v1",
            "status": "active",
            "createdAt": "2026-03-20T00:00:00Z",
            "updatedAt": "2026-03-20T01:00:00Z",
            "lastActiveAt": "2026-03-20T01:30:00Z",
            "totalTokensUsed": 42,
            "totalConversations": 3
        });

        let agent = parse_single_agent(&value).expect("agent should parse");

        assert_eq!(agent.id, "agent-123");
        assert_eq!(agent.display_name, "Primary Agent");
        assert_eq!(agent.system_prompt, "Be helpful.");
        assert_eq!(agent.model_id, "gpt-4o");
        assert_eq!(agent.model_name, "GPT-4o");
        assert_eq!(agent.model_params.temperature, 0.25);
        assert_eq!(agent.model_params.max_tokens, 1536);
        assert_eq!(agent.model_params.top_p, 0.93);
        assert_eq!(agent.channel_type, "openai-compatible");
        assert_eq!(agent.api_key_ref, "api-key-ref-1");
        assert_eq!(agent.base_url, "https://api.example.com/v1");
        assert_eq!(agent.status, "active");
        assert_eq!(agent.created_at, "2026-03-20T00:00:00Z");
        assert_eq!(agent.updated_at, "2026-03-20T01:00:00Z");
        assert_eq!(
            agent.last_active_at.as_deref(),
            Some("2026-03-20T01:30:00Z")
        );
        assert_eq!(agent.total_tokens_used, 42);
        assert_eq!(agent.total_conversations, 3);
    }

    #[test]
    fn merge_create_payload_preserves_payload_specific_fields() {
        let mut agent = Agent {
            id: "cli-id".to_string(),
            display_name: "CLI Name".to_string(),
            system_prompt: "CLI prompt".to_string(),
            model_id: "cli-model".to_string(),
            model_name: "CLI model".to_string(),
            model_params: AgentModelParams {
                temperature: 0.1,
                max_tokens: 128,
                top_p: 0.5,
            },
            channel_type: "openclaw".to_string(),
            api_key_ref: "cli-ref".to_string(),
            base_url: "https://cli.example".to_string(),
            status: "created".to_string(),
            created_at: "2026-03-20T00:00:00Z".to_string(),
            updated_at: "2026-03-20T01:00:00Z".to_string(),
            last_active_at: None,
            total_tokens_used: 7,
            total_conversations: 2,
        };
        let payload = CreateAgentPayload {
            display_name: "Wizard Name".to_string(),
            system_prompt: "Wizard prompt".to_string(),
            model_id: "wizard-model".to_string(),
            model_name: "Wizard model".to_string(),
            channel_type: "openai-compatible".to_string(),
            api_key_ref: "wizard-ref".to_string(),
            base_url: "https://wizard.example/v1".to_string(),
            temperature: Some(0.9),
            max_tokens: Some(2048),
        };

        merge_create_payload(&mut agent, &payload);

        assert_eq!(agent.display_name, "Wizard Name");
        assert_eq!(agent.system_prompt, "Wizard prompt");
        assert_eq!(agent.model_id, "wizard-model");
        assert_eq!(agent.model_name, "Wizard model");
        assert_eq!(agent.model_params.temperature, 0.9);
        assert_eq!(agent.model_params.max_tokens, 2048);
        assert_eq!(agent.model_params.top_p, 0.5);
        assert_eq!(agent.channel_type, "openai-compatible");
        assert_eq!(agent.api_key_ref, "wizard-ref");
        assert_eq!(agent.base_url, "https://wizard.example/v1");
        assert_eq!(agent.status, "created");
        assert_eq!(agent.created_at, "2026-03-20T00:00:00Z");
        assert_eq!(agent.updated_at, "2026-03-20T01:00:00Z");
        assert_eq!(agent.total_tokens_used, 7);
        assert_eq!(agent.total_conversations, 2);
    }

    #[test]
    fn merge_update_payload_overlays_only_provided_fields() {
        let mut agent = Agent {
            id: "cli-id".to_string(),
            display_name: "Current Name".to_string(),
            system_prompt: "Current prompt".to_string(),
            model_id: "current-model".to_string(),
            model_name: "Current model".to_string(),
            model_params: AgentModelParams {
                temperature: 0.2,
                max_tokens: 512,
                top_p: 0.8,
            },
            channel_type: "openclaw".to_string(),
            api_key_ref: "current-ref".to_string(),
            base_url: "https://current.example".to_string(),
            status: "created".to_string(),
            created_at: "2026-03-20T00:00:00Z".to_string(),
            updated_at: "2026-03-20T01:00:00Z".to_string(),
            last_active_at: None,
            total_tokens_used: 7,
            total_conversations: 2,
        };
        let payload = UpdateAgentPayload {
            id: "cli-id".to_string(),
            display_name: Some("Updated Name".to_string()),
            system_prompt: None,
            model_id: Some("updated-model".to_string()),
            model_name: None,
            channel_type: Some("openai-compatible".to_string()),
            api_key_ref: Some("updated-ref".to_string()),
            base_url: None,
        };

        merge_update_payload(&mut agent, &payload);

        assert_eq!(agent.display_name, "Updated Name");
        assert_eq!(agent.system_prompt, "Current prompt");
        assert_eq!(agent.model_id, "updated-model");
        assert_eq!(agent.model_name, "Current model");
        assert_eq!(agent.model_params.temperature, 0.2);
        assert_eq!(agent.model_params.max_tokens, 512);
        assert_eq!(agent.model_params.top_p, 0.8);
        assert_eq!(agent.channel_type, "openai-compatible");
        assert_eq!(agent.api_key_ref, "updated-ref");
        assert_eq!(agent.base_url, "https://current.example");
        assert_eq!(agent.status, "created");
        assert_eq!(agent.total_tokens_used, 7);
        assert_eq!(agent.total_conversations, 2);
    }

    #[test]
    fn generate_id_produces_uuid_v4() {
        let id = generate_id();
        let parsed = Uuid::parse_str(&id).expect("generated id should be a UUID");

        assert_eq!(Some(uuid::Version::Random), parsed.get_version());
        assert_eq!(4, parsed.get_version_num());
    }
}
