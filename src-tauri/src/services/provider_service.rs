use chrono::Utc;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::error::AppError;
use crate::services::gateway_api_service::request_gateway_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub vendor: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key_masked: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    pub model_count: u32,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProviderPayload {
    pub name: String,
    pub vendor: String,
    pub api_key: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProviderPayload {
    pub id: String,
    pub name: Option<String>,
    pub vendor: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProviderData {
    pub deleted: bool,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderValidationData {
    pub valid: bool,
    pub detail: String,
}

pub async fn list_providers() -> Result<Vec<Provider>, AppError> {
    let payload =
        request_gateway_json(Method::GET, &["/api/providers", "/providers"], None).await?;
    Ok(parse_provider_list(&payload))
}

pub async fn create_provider(payload: CreateProviderPayload) -> Result<Provider, AppError> {
    let body = serde_json::to_value(payload).unwrap_or(Value::Null);
    let response =
        request_gateway_json(Method::POST, &["/api/providers", "/providers"], Some(body)).await?;
    Ok(parse_single_provider_response(&response))
}

pub async fn update_provider(payload: UpdateProviderPayload) -> Result<Provider, AppError> {
    let id = payload.id.clone();
    let body = serde_json::to_value(payload).unwrap_or(Value::Null);
    let path_a = format!("/api/providers/{id}");
    let path_b = format!("/providers/{id}");
    let response = request_gateway_json(Method::PUT, &[&path_a, &path_b], Some(body)).await?;
    Ok(parse_single_provider_response(&response))
}

pub async fn delete_provider(id: String) -> Result<DeleteProviderData, AppError> {
    let path_a = format!("/api/providers/{id}");
    let path_b = format!("/providers/{id}");
    let response = request_gateway_json(Method::DELETE, &[&path_a, &path_b], None).await?;
    Ok(parse_delete_provider_data(&response, &id))
}

pub async fn validate_provider(id: String) -> Result<ProviderValidationData, AppError> {
    let validate_path_a = format!("/api/providers/{id}/validate");
    let validate_path_b = format!("/providers/{id}/validate");
    let test_path_a = format!("/api/providers/{id}/test");
    let test_path_b = format!("/providers/{id}/test");

    let response = request_gateway_json(
        Method::POST,
        &[
            &validate_path_a,
            &validate_path_b,
            &test_path_a,
            &test_path_b,
        ],
        None,
    )
    .await?;

    Ok(parse_validation_data(&response))
}

fn parse_provider_list(value: &Value) -> Vec<Provider> {
    if let Some(items) = value.as_array() {
        return items.iter().map(parse_provider).collect();
    }
    if let Some(items) = value.get("providers").and_then(Value::as_array) {
        return items.iter().map(parse_provider).collect();
    }
    if let Some(items) = value.get("data").and_then(Value::as_array) {
        return items.iter().map(parse_provider).collect();
    }
    vec![]
}

fn parse_single_provider_response(value: &Value) -> Provider {
    if let Some(data) = value.get("provider") {
        return parse_provider(data);
    }
    if let Some(data) = value.get("data") {
        if data.is_object() {
            return parse_provider(data);
        }
    }
    parse_provider(value)
}

fn parse_provider(value: &Value) -> Provider {
    let models = value.get("models").and_then(Value::as_array);
    Provider {
        id: extract_string(value, &["id"]).unwrap_or_else(|| fallback_id("provider")),
        name: extract_string(value, &["name"]).unwrap_or_else(|| "Unnamed Provider".to_string()),
        vendor: normalize_vendor(
            extract_string(value, &["vendor"]).unwrap_or_else(|| "custom".to_string()),
        ),
        api_key_masked: extract_string(value, &["apiKeyMasked", "api_key_masked"])
            .or_else(|| extract_string(value, &["apiKey", "api_key"]).map(mask_api_key)),
        base_url: extract_string(value, &["baseUrl", "base_url"]),
        model_count: value
            .get("modelCount")
            .or_else(|| value.get("model_count"))
            .and_then(Value::as_u64)
            .map(|count| count as u32)
            .unwrap_or_else(|| models.map(|items| items.len() as u32).unwrap_or(0)),
        status: normalize_provider_status(
            extract_string(value, &["status"]).unwrap_or_else(|| "ready".to_string()),
        ),
        updated_at: extract_string(value, &["updatedAt", "updated_at"])
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    }
}

fn parse_delete_provider_data(value: &Value, fallback_id: &str) -> DeleteProviderData {
    DeleteProviderData {
        deleted: value
            .get("deleted")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        id: extract_string(value, &["id"]).unwrap_or_else(|| fallback_id.to_string()),
    }
}

fn parse_validation_data(value: &Value) -> ProviderValidationData {
    let valid = value
        .get("valid")
        .and_then(Value::as_bool)
        .or_else(|| value.get("ok").and_then(Value::as_bool))
        .or_else(|| value.get("success").and_then(Value::as_bool))
        .unwrap_or(false);

    let detail = extract_string(value, &["detail", "message"]).unwrap_or_else(|| {
        if valid {
            "Provider validation succeeded.".to_string()
        } else {
            "Provider validation failed.".to_string()
        }
    });

    ProviderValidationData { valid, detail }
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

fn mask_api_key(raw: String) -> String {
    if raw.is_empty() {
        return raw;
    }
    if raw.len() <= 3 {
        return "***".to_string();
    }
    format!("{}***", &raw[..3])
}

fn normalize_vendor(value: String) -> String {
    match value.as_str() {
        "openai" | "anthropic" | "deepseek" | "ollama" | "google" | "qwen" | "zhipu"
        | "moonshot" | "groq" | "mistral" | "custom" => value,
        _ => "custom".to_string(),
    }
}

fn normalize_provider_status(value: String) -> String {
    match value.as_str() {
        "ready" | "checking" | "error" | "disabled" => value,
        _ => "ready".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_provider_list_payload() {
        let payload = json!({
            "providers": [
                {
                    "id": "p-1",
                    "name": "Primary",
                    "vendor": "openai",
                    "apiKeyMasked": "sk-***",
                    "models": ["gpt-4o", "gpt-4o-mini"],
                    "status": "ready"
                }
            ]
        });

        let items = parse_provider_list(&payload);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].model_count, 2);
        assert_eq!(items[0].vendor, "openai");
    }

    #[test]
    fn normalizes_provider_fields_and_validation() {
        let provider_payload = json!({
            "id": "p-2",
            "name": "Fallback",
            "vendor": "unknown",
            "apiKey": "abc12345",
            "status": "mystery"
        });
        let provider = parse_provider(&provider_payload);
        assert_eq!(provider.vendor, "custom");
        assert_eq!(provider.status, "ready");
        assert_eq!(provider.api_key_masked.as_deref(), Some("abc***"));

        let validation_payload = json!({
            "success": true,
            "message": "ok"
        });
        let validation = parse_validation_data(&validation_payload);
        assert!(validation.valid);
        assert_eq!(validation.detail, "ok");
    }
}
