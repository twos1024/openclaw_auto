use std::time::Duration;

use reqwest::{Client, Method};
use serde_json::{json, Value};

use crate::models::error::{AppError, ErrorCode};
use crate::services::gateway_service;

const GATEWAY_HTTP_TIMEOUT_MS: u64 = 10_000;

fn normalize_path(path: &str) -> String {
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    }
}

fn normalize_base(base: &str) -> String {
    base.trim_end_matches('/').to_string()
}

fn build_gateway_url(base: &str, path: &str) -> String {
    format!("{}{}", normalize_base(base), normalize_path(path))
}

fn build_http_client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_millis(GATEWAY_HTTP_TIMEOUT_MS))
        .build()
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                "Failed to initialize HTTP client for Gateway proxy.",
                "Retry the request. If this persists, inspect desktop runtime logs.",
            )
            .with_details(json!({
                "sourceError": error.to_string(),
            }))
        })
}

async fn resolve_gateway_base_url() -> Result<String, AppError> {
    let status = gateway_service::get_gateway_status().await?;
    if !status.running {
        return Err(AppError::new(
            ErrorCode::GatewayNotRunning,
            "Gateway is not running, API proxy request cannot be completed.",
            "Start Gateway first, then retry the API operation.",
        )
        .with_details(json!({
            "address": status.address,
            "port": status.port,
            "state": status.state,
        })));
    }

    Ok(normalize_base(&status.address))
}

fn parse_response_value(raw: &str) -> Value {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return json!({});
    }

    serde_json::from_str::<Value>(trimmed).unwrap_or_else(|_| {
        json!({
            "raw": raw,
        })
    })
}

pub async fn request_gateway_json(
    method: Method,
    paths: &[&str],
    body: Option<Value>,
) -> Result<Value, AppError> {
    if paths.is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Gateway request has no candidate paths.",
            "Provide at least one API path before sending a Gateway request.",
        ));
    }

    let base = resolve_gateway_base_url().await?;
    let client = build_http_client()?;
    let mut last_status: Option<u16> = None;
    let mut last_body: Option<String> = None;
    let mut last_url: Option<String> = None;
    let mut last_transport_error: Option<String> = None;

    for path in paths {
        let url = build_gateway_url(&base, path);
        let mut request = client.request(method.clone(), &url);
        if let Some(payload) = body.as_ref() {
            request = request.json(payload);
        }

        match request.send().await {
            Ok(response) => {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                if status.is_success() {
                    return Ok(parse_response_value(&text));
                }

                last_status = Some(status.as_u16());
                last_body = Some(text);
                last_url = Some(url);
            }
            Err(error) => {
                last_transport_error = Some(error.to_string());
                last_url = Some(url);
            }
        }
    }

    let mut details = json!({
        "method": method.as_str(),
        "paths": paths,
        "lastStatus": last_status,
        "lastResponseBody": last_body,
        "lastUrl": last_url,
        "transportError": last_transport_error,
    });

    if let Some(map) = details.as_object_mut() {
        if map.get("lastStatus").is_some_and(Value::is_null) {
            map.remove("lastStatus");
        }
        if map.get("lastResponseBody").is_some_and(Value::is_null) {
            map.remove("lastResponseBody");
        }
        if map.get("lastUrl").is_some_and(Value::is_null) {
            map.remove("lastUrl");
        }
        if map.get("transportError").is_some_and(Value::is_null) {
            map.remove("transportError");
        }
    }

    Err(AppError::new(
        ErrorCode::NetworkFailed,
        "Gateway API request failed across all fallback paths.",
        "Check Gateway route availability and network diagnostics, then retry.",
    )
    .with_details(details))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_paths_and_base_url() {
        assert_eq!(
            build_gateway_url("http://127.0.0.1:4317/", "api/channels"),
            "http://127.0.0.1:4317/api/channels"
        );
        assert_eq!(
            build_gateway_url("http://127.0.0.1:4317", "/api/channels"),
            "http://127.0.0.1:4317/api/channels"
        );
    }

    #[test]
    fn parses_empty_and_plain_text_response() {
        assert_eq!(parse_response_value("   "), json!({}));
        assert_eq!(
            parse_response_value("plain-text"),
            json!({ "raw": "plain-text" })
        );
    }
}
