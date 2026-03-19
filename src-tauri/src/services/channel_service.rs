use chrono::Utc;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::error::AppError;
use crate::services::gateway_api_service::request_gateway_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub status: String,
    pub connection_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    pub agent_ids: Vec<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChannelPayload {
    pub name: String,
    pub r#type: String,
    pub connection_type: String,
    pub description: Option<String>,
    pub provider_id: Option<String>,
    pub agent_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChannelPayload {
    pub id: String,
    pub name: Option<String>,
    pub r#type: Option<String>,
    pub connection_type: Option<String>,
    pub description: Option<String>,
    pub provider_id: Option<String>,
    pub agent_ids: Option<Vec<String>>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteChannelData {
    pub deleted: bool,
    pub id: String,
}

pub async fn list_channels() -> Result<Vec<Channel>, AppError> {
    let payload = request_gateway_json(Method::GET, &["/api/channels", "/channels"], None).await?;
    Ok(parse_channel_list(&payload))
}

pub async fn add_channel(payload: CreateChannelPayload) -> Result<Channel, AppError> {
    let body = serde_json::to_value(payload).unwrap_or(Value::Null);
    let response =
        request_gateway_json(Method::POST, &["/api/channels", "/channels"], Some(body)).await?;
    Ok(parse_single_channel_response(&response))
}

pub async fn update_channel(payload: UpdateChannelPayload) -> Result<Channel, AppError> {
    let id = payload.id.clone();
    let body = serde_json::to_value(payload).unwrap_or(Value::Null);
    let path_a = format!("/api/channels/{id}");
    let path_b = format!("/channels/{id}");
    let response = request_gateway_json(Method::PUT, &[&path_a, &path_b], Some(body)).await?;
    Ok(parse_single_channel_response(&response))
}

pub async fn delete_channel(id: String) -> Result<DeleteChannelData, AppError> {
    let path_a = format!("/api/channels/{id}");
    let path_b = format!("/channels/{id}");
    let response = request_gateway_json(Method::DELETE, &[&path_a, &path_b], None).await?;
    if let Some(data) = parse_delete_data(&response, &id) {
        return Ok(data);
    }
    Ok(DeleteChannelData { deleted: true, id })
}

fn parse_single_channel_response(value: &Value) -> Channel {
    if let Some(nested) = value.get("channel") {
        return parse_channel(nested);
    }
    if let Some(nested) = value.get("data") {
        if nested.is_object() {
            return parse_channel(nested);
        }
    }
    parse_channel(value)
}

fn parse_channel_list(value: &Value) -> Vec<Channel> {
    if let Some(items) = value.as_array() {
        return items.iter().map(parse_channel).collect();
    }
    if let Some(items) = value.get("channels").and_then(Value::as_array) {
        return items.iter().map(parse_channel).collect();
    }
    if let Some(items) = value.get("data").and_then(Value::as_array) {
        return items.iter().map(parse_channel).collect();
    }
    vec![]
}

fn parse_channel(value: &Value) -> Channel {
    Channel {
        id: extract_string(value, &["id"]).unwrap_or_else(|| fallback_id("channel")),
        name: extract_string(value, &["name"]).unwrap_or_else(|| "Unnamed Channel".to_string()),
        r#type: normalize_channel_type(
            extract_string(value, &["type", "channelType"]).unwrap_or_else(|| "custom".to_string()),
        ),
        status: normalize_channel_status(
            extract_string(value, &["status"]).unwrap_or_else(|| "idle".to_string()),
        ),
        connection_type: normalize_connection_type(
            extract_string(value, &["connectionType", "connection_type"])
                .unwrap_or_else(|| "none".to_string()),
        ),
        description: extract_string(value, &["description"]),
        provider_id: extract_string(value, &["providerId", "provider_id"]),
        agent_ids: extract_string_array(value, &["agentIds", "agent_ids"]),
        updated_at: extract_string(value, &["updatedAt", "updated_at"])
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    }
}

fn parse_delete_data(value: &Value, fallback_id: &str) -> Option<DeleteChannelData> {
    let deleted = value
        .get("deleted")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let id = extract_string(value, &["id"]).unwrap_or_else(|| fallback_id.to_string());
    Some(DeleteChannelData { deleted, id })
}

fn extract_string(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(found) = find_key_recursive(value, key) {
            if let Some(text) = found.as_str() {
                if !text.trim().is_empty() {
                    return Some(text.to_string());
                }
            }
        }
    }
    None
}

fn extract_string_array(value: &Value, keys: &[&str]) -> Vec<String> {
    for key in keys {
        if let Some(found) = find_key_recursive(value, key) {
            if let Some(list) = found.as_array() {
                return list
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect();
            }
        }
    }
    vec![]
}

fn find_key_recursive<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            if let Some(found) = map.get(key) {
                return Some(found);
            }
            for nested in map.values() {
                if let Some(found) = find_key_recursive(nested, key) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(|item| find_key_recursive(item, key)),
        _ => None,
    }
}

fn fallback_id(prefix: &str) -> String {
    let ts = Utc::now().timestamp_nanos_opt().unwrap_or(0);
    format!("{prefix}-{ts:x}")
}

fn normalize_channel_type(value: String) -> String {
    match value.as_str() {
        "openclaw" | "openai-compatible" | "custom" | "webhook" => value,
        _ => "custom".to_string(),
    }
}

fn normalize_channel_status(value: String) -> String {
    match value.as_str() {
        "connected" | "disconnected" | "error" | "idle" => value,
        _ => "idle".to_string(),
    }
}

fn normalize_connection_type(value: String) -> String {
    match value.as_str() {
        "api-key" | "oauth" | "none" => value,
        _ => "none".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_channel_list_from_channels_key() {
        let payload = json!({
            "channels": [
                {
                    "id": "ch-1",
                    "name": "Main",
                    "type": "openclaw",
                    "status": "connected",
                    "connectionType": "oauth",
                    "agentIds": ["a1", "a2"],
                    "updatedAt": "2026-01-01T00:00:00Z"
                }
            ]
        });

        let items = parse_channel_list(&payload);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "ch-1");
        assert_eq!(items[0].connection_type, "oauth");
        assert_eq!(items[0].agent_ids, vec!["a1", "a2"]);
    }

    #[test]
    fn normalizes_legacy_and_invalid_fields() {
        let payload = json!({
            "id": "ch-2",
            "name": "Legacy",
            "channelType": "unknown-type",
            "status": "mystery",
            "connection_type": "token",
            "agent_ids": ["one"],
        });

        let channel = parse_channel(&payload);
        assert_eq!(channel.r#type, "custom");
        assert_eq!(channel.status, "idle");
        assert_eq!(channel.connection_type, "none");
        assert_eq!(channel.agent_ids, vec!["one"]);
    }
}
