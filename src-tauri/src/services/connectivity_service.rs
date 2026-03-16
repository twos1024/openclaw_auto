use std::time::Instant;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::models::error::{AppError, ErrorCode};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfigInput {
    pub provider_type: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub timeout: u64,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f64>,
    pub ollama_host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestData {
    pub status: String,
    pub detail: String,
    pub suggestion: String,
    pub code: Option<String>,
    pub latency_ms: Option<u128>,
}

pub async fn test_connection(input: ConnectionConfigInput) -> Result<ConnectionTestData, AppError> {
    if input.timeout == 0 {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Timeout must be greater than 0 milliseconds.",
            "Provide a positive timeout value before testing the connection.",
        ));
    }

    let provider_type = input.provider_type.trim();
    if provider_type != "openai-compatible" && provider_type != "ollama" {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Unsupported provider type for connection test.",
            "Choose either OpenAI-compatible or Ollama mode, then retry.",
        )
        .with_details(json!({ "provider_type": provider_type })));
    }

    let client = Client::builder()
        .timeout(std::time::Duration::from_millis(input.timeout))
        .build()
        .map_err(|error| {
            AppError::new(
                ErrorCode::ConnectionTestFailed,
                "Failed to initialize the HTTP client for connection testing.",
                "Check system TLS/network settings, then retry.",
            )
            .with_details(json!({ "client_error": error.to_string() }))
        })?;

    let started_at = Instant::now();
    let (request_url, suggestion) = if provider_type == "openai-compatible" {
        (
            format!("{}/models", input.base_url.trim_end_matches('/')),
            "Check Base URL, API key, network policy, and TLS certificates.",
        )
    } else {
        (
            format!("{}/api/tags", input.ollama_host.trim_end_matches('/')),
            "Check Ollama host, local firewall, and whether `ollama serve` is running.",
        )
    };

    let mut request = client.get(&request_url);
    if provider_type == "openai-compatible" {
        request = request.bearer_auth(input.api_key);
    }

    let response = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            return Ok(ConnectionTestData {
                status: "error".to_string(),
                detail: error.to_string(),
                suggestion: suggestion.to_string(),
                code: Some("E_CONNECTION_TEST".to_string()),
                latency_ms: Some(started_at.elapsed().as_millis()),
            });
        }
    };

    let latency_ms = started_at.elapsed().as_millis();
    let status_code = response.status();
    let body = response.text().await.unwrap_or_default();

    if status_code.is_success() {
        let detail = if provider_type == "openai-compatible" {
            format!("Connected to OpenAI-compatible endpoint in {latency_ms}ms.")
        } else {
            format!("Connected to Ollama in {latency_ms}ms.")
        };

        let suggestion = if provider_type == "openai-compatible" {
            "Connection looks good. You can save this configuration."
        } else {
            "Ollama is reachable. You can save this configuration."
        };

        return Ok(ConnectionTestData {
            status: "success".to_string(),
            detail,
            suggestion: suggestion.to_string(),
            code: None,
            latency_ms: Some(latency_ms),
        });
    }

    let suggestion = if provider_type == "openai-compatible" {
        if status_code.as_u16() == 401 {
            "Check API key and token permissions."
        } else {
            "Verify Base URL and API compatibility."
        }
    } else {
        "Ensure Ollama is running and host/port are correct."
    };

    Ok(ConnectionTestData {
        status: "failure".to_string(),
        detail: format!(
            "Request failed with HTTP {}. {}",
            status_code.as_u16(),
            body.chars().take(160).collect::<String>()
        ),
        suggestion: suggestion.to_string(),
        code: Some(format!("HTTP_{}", status_code.as_u16())),
        latency_ms: Some(latency_ms),
    })
}
