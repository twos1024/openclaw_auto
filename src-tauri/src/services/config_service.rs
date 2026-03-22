use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::fs;

use crate::adapters::file_ops;
use crate::adapters::platform;
use crate::adapters::shell::run_command;
use crate::models::error::{AppError, ErrorCode};
use crate::services::env_service;

const VALIDATE_TIMEOUT_MS: u64 = 20_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadConfigData {
    pub path: String,
    pub content: Value,
    pub size_bytes: usize,
    pub modified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteConfigData {
    pub path: String,
    pub backup_path: Option<String>,
    pub bytes_written: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfigData {
    pub path: String,
    pub backup_path: Option<String>,
    pub skipped: bool,
}

pub async fn read_openclaw_config(path: Option<String>) -> Result<ReadConfigData, AppError> {
    let resolved = resolve_path(path)?;

    if !resolved.exists() {
        return Err(AppError::new(
            ErrorCode::PathNotFound,
            "OpenClaw config file does not exist.",
            "Install OpenClaw first or provide a valid config file path.",
        )
        .with_details(json!({ "path": resolved.to_string_lossy() })));
    }

    let raw = fs::read_to_string(&resolved)
        .await
        .map_err(|error| map_read_error(&resolved, error))?;

    let parsed = parse_json5_or_json(&raw, &resolved)?;
    let content = to_simplified_config_view(&parsed).unwrap_or(parsed);

    let modified_at = fs::metadata(&resolved)
        .await
        .ok()
        .and_then(|m| m.modified().ok())
        .map(DateTime::<Utc>::from);

    Ok(ReadConfigData {
        path: resolved.to_string_lossy().to_string(),
        content,
        size_bytes: raw.len(),
        modified_at,
    })
}

pub async fn write_openclaw_config(
    path: Option<String>,
    content: Value,
) -> Result<WriteConfigData, AppError> {
    let resolved = resolve_path(path)?;
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|error| map_write_error(parent, error, ErrorCode::ConfigWriteFailed))?;
    }

    let backup_path = if resolved.exists() {
        Some(backup_file(&resolved).await?)
    } else {
        None
    };

    // Keep backwards compatibility: if the UI submits the legacy simplified payload,
    // translate it into the official OpenClaw JSON5 config shape before writing.
    let merged = if looks_like_legacy_simplified_config(&content) {
        merge_simplified_into_official(&resolved, &content).await?
    } else {
        content
    };

    let serialized = serde_json::to_string_pretty(&merged).map_err(|error| {
        AppError::new(
            ErrorCode::InvalidInput,
            "Provided config payload cannot be serialized.",
            "Check the request payload and retry with valid JSON.",
        )
        .with_details(json!({ "serialize_error": error.to_string() }))
    })?;

    file_ops::safe_write_bytes(&resolved, serialized.as_bytes())
        .await
        .map_err(|error| map_write_error(&resolved, error, ErrorCode::ConfigWriteFailed))?;

    // Validate using the official CLI flow.
    if let Err(error) = validate_openclaw_config(&resolved).await {
        // Roll back to backup on validation failure.
        if let Some(ref backup) = backup_path {
            let _ = fs::copy(backup, &resolved).await;
        }
        return Err(error);
    }

    Ok(WriteConfigData {
        path: resolved.to_string_lossy().to_string(),
        backup_path: backup_path.map(|p| p.to_string_lossy().to_string()),
        bytes_written: serialized.as_bytes().len(),
    })
}

pub async fn ensure_local_gateway_defaults(path: Option<String>) -> Result<Vec<String>, AppError> {
    let resolved = resolve_path(path)?;
    if !resolved.exists() {
        return Err(AppError::new(
            ErrorCode::PathNotFound,
            "OpenClaw config file does not exist yet.",
            "Save the provider configuration first, then retry the local Gateway setup.",
        )
        .with_details(json!({ "path": resolved.to_string_lossy() })));
    }

    let raw = fs::read_to_string(&resolved)
        .await
        .map_err(|error| map_read_error(&resolved, error))?;
    let parsed = parse_json5_or_json(&raw, &resolved)?;
    let mut root = parsed.as_object().cloned().unwrap_or_default();
    let changes = ensure_local_gateway_settings(&mut root);
    if changes.is_empty() {
        return Ok(changes);
    }

    let backup_path = backup_file(&resolved).await?;
    let serialized = serde_json::to_string_pretty(&Value::Object(root)).map_err(|error| {
        AppError::new(
            ErrorCode::InvalidInput,
            "Provided config payload cannot be serialized.",
            "Check the request payload and retry with valid JSON.",
        )
        .with_details(json!({ "serialize_error": error.to_string() }))
    })?;

    file_ops::safe_write_bytes(&resolved, serialized.as_bytes())
        .await
        .map_err(|error| map_write_error(&resolved, error, ErrorCode::ConfigWriteFailed))?;

    if let Err(error) = validate_openclaw_config(&resolved).await {
        let _ = fs::copy(&backup_path, &resolved).await;
        return Err(error);
    }

    Ok(changes)
}

pub async fn backup_openclaw_config(path: Option<String>) -> Result<BackupConfigData, AppError> {
    let resolved = resolve_path(path)?;
    if !resolved.exists() {
        return Ok(BackupConfigData {
            path: resolved.to_string_lossy().to_string(),
            backup_path: None,
            skipped: true,
        });
    }

    let backup_path = backup_file(&resolved).await?;
    Ok(BackupConfigData {
        path: resolved.to_string_lossy().to_string(),
        backup_path: Some(backup_path.to_string_lossy().to_string()),
        skipped: false,
    })
}

fn resolve_path(path: Option<String>) -> Result<PathBuf, AppError> {
    match path {
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Err(AppError::new(
                    ErrorCode::InvalidInput,
                    "Config path cannot be empty.",
                    "Provide a non-empty config path or omit it to use default path.",
                ));
            }
            Ok(PathBuf::from(trimmed))
        }
        None => Ok(platform::default_openclaw_config_path()),
    }
}

async fn backup_file(source: &Path) -> Result<PathBuf, AppError> {
    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::ConfigBackupFailed,
                "Unable to resolve config filename for backup.",
                "Check whether the config path points to a valid file.",
            )
            .with_details(json!({ "path": source.to_string_lossy() }))
        })?;

    // Include milliseconds to prevent collision when multiple backups are
    // created within the same second (e.g. rapid successive writes).
    let backup_name = format!("{file_name}.bak.{}", Utc::now().format("%Y%m%d%H%M%S%.3f"));
    let backup_path = source.with_file_name(backup_name);

    fs::copy(source, &backup_path)
        .await
        .map_err(|error| map_write_error(&backup_path, error, ErrorCode::ConfigBackupFailed))?;

    Ok(backup_path)
}

fn map_read_error(path: &Path, error: std::io::Error) -> AppError {
    match error.kind() {
        ErrorKind::NotFound => AppError::new(
            ErrorCode::PathNotFound,
            "Config file not found.",
            "Verify the config path and ensure the file exists.",
        ),
        ErrorKind::PermissionDenied => AppError::new(
            ErrorCode::PermissionDenied,
            "Permission denied while reading config file.",
            "Adjust file permissions and rerun the command.",
        ),
        _ => AppError::new(
            ErrorCode::ConfigReadFailed,
            "Failed to read config file.",
            "Check whether the file is locked by another process.",
        ),
    }
    .with_details(json!({
        "path": path.to_string_lossy(),
        "os_error": error.to_string()
    }))
}

fn map_write_error(path: &Path, error: std::io::Error, code: ErrorCode) -> AppError {
    let normalized_code = if error.kind() == ErrorKind::PermissionDenied {
        ErrorCode::PermissionDenied
    } else if error.kind() == ErrorKind::NotFound {
        ErrorCode::PathNotFound
    } else {
        code
    };

    AppError::new(
        normalized_code,
        "Failed while writing config data.",
        "Check disk permissions and free space, then retry.",
    )
    .with_details(json!({
        "path": path.to_string_lossy(),
        "os_error": error.to_string()
    }))
}

fn parse_json5_or_json(raw: &str, path: &Path) -> Result<Value, AppError> {
    // OpenClaw config is JSON5. JSON is a valid subset of JSON5, so we parse JSON5 first.
    match json5::from_str::<Value>(raw) {
        Ok(value) => Ok(value),
        Err(json5_error) => serde_json::from_str::<Value>(raw).map_err(|json_error| {
            AppError::new(
                ErrorCode::ConfigCorrupted,
                "Config content is not valid JSON5/JSON.",
                "Repair the config format or restore from a backup file.",
            )
            .with_details(json!({
                "path": path.to_string_lossy(),
                "json5_error": json5_error.to_string(),
                "json_error": json_error.to_string(),
            }))
        }),
    }
}

fn looks_like_legacy_simplified_config(content: &Value) -> bool {
    content
        .as_object()
        .map(|m| {
            m.contains_key("providerType") || m.contains_key("baseUrl") || m.contains_key("apiKey")
        })
        .unwrap_or(false)
}

fn to_simplified_config_view(parsed: &Value) -> Option<Value> {
    // If the file already uses the legacy simplified format, return it unchanged.
    if looks_like_legacy_simplified_config(parsed) {
        let mut out = parsed.clone();
        if let Some(map) = out.as_object_mut() {
            map.entry("_format".to_string())
                .or_insert_with(|| Value::String("legacy-simplified".to_string()));
        }
        return Some(out);
    }

    // Otherwise, attempt to extract the minimal view expected by ClawDesk UI from the official schema.
    let primary = read_string_path(parsed, &["agents", "defaults", "model", "primary"])?;
    let (provider_id, model_id) = split_model_ref(&primary);

    let provider_type = if provider_id.eq_ignore_ascii_case("ollama") {
        "ollama"
    } else {
        "openai-compatible"
    };
    let gateway_mode = read_string_path(parsed, &["gateway", "mode"]).unwrap_or_default();
    let gateway_bind = read_string_path(parsed, &["gateway", "bind"]).unwrap_or_default();
    let gateway_auth_mode =
        read_string_path(parsed, &["gateway", "auth", "mode"]).unwrap_or_default();
    let gateway_has_token = read_string_path(parsed, &["gateway", "auth", "token"])
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let gateway_has_password = read_string_path(parsed, &["gateway", "auth", "password"])
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);

    let base_url = read_string_path(parsed, &["models", "providers", provider_id, "baseUrl"])
        .unwrap_or_else(|| "".to_string());
    let api_key = read_string_path(parsed, &["models", "providers", provider_id, "apiKey"])
        .unwrap_or_else(|| "".to_string());

    let temperature = parsed
        .get("agents")
        .and_then(|v| v.get("defaults"))
        .and_then(|v| v.get("models"))
        .and_then(|v| v.get(primary.as_str()))
        .and_then(|v| v.get("params"))
        .and_then(|v| v.get("temperature"))
        .and_then(|v| v.as_f64())
        .and_then(|f| serde_json::Number::from_f64(f));
    let max_tokens = parsed
        .get("agents")
        .and_then(|v| v.get("defaults"))
        .and_then(|v| v.get("models"))
        .and_then(|v| v.get(primary.as_str()))
        .and_then(|v| v.get("params"))
        .and_then(|v| v.get("maxTokens"))
        .and_then(|v| v.as_u64())
        .map(serde_json::Number::from);

    let mut out = serde_json::Map::new();
    out.insert(
        "providerType".to_string(),
        Value::String(provider_type.to_string()),
    );
    out.insert("baseUrl".to_string(), Value::String(base_url.clone()));
    out.insert("apiKey".to_string(), Value::String(api_key));
    out.insert("model".to_string(), Value::String(model_id.to_string()));
    if let Some(v) = temperature {
        out.insert("temperature".to_string(), Value::Number(v));
    }
    if let Some(v) = max_tokens {
        out.insert("maxTokens".to_string(), Value::Number(v));
    }
    if provider_type == "ollama" {
        out.insert("ollamaHost".to_string(), Value::String(base_url));
    }
    out.insert(
        "_format".to_string(),
        Value::String("official-json5".to_string()),
    );
    out.insert(
        "_providerId".to_string(),
        Value::String(provider_id.to_string()),
    );
    out.insert("_modelRef".to_string(), Value::String(primary.to_string()));
    out.insert("_gatewayMode".to_string(), Value::String(gateway_mode));
    out.insert("_gatewayBind".to_string(), Value::String(gateway_bind));
    out.insert(
        "_gatewayAuthMode".to_string(),
        Value::String(gateway_auth_mode),
    );
    out.insert(
        "_gatewayHasToken".to_string(),
        Value::Bool(gateway_has_token),
    );
    out.insert(
        "_gatewayHasPassword".to_string(),
        Value::Bool(gateway_has_password),
    );

    Some(Value::Object(out))
}

fn split_model_ref(model_ref: &str) -> (&str, &str) {
    let trimmed = model_ref.trim();
    if let Some((provider, model)) = trimmed.split_once('/') {
        let provider = provider.trim();
        let model = model.trim();
        if !provider.is_empty() && !model.is_empty() {
            return (provider, model);
        }
    }
    ("custom-proxy", trimmed)
}

fn read_string_path(value: &Value, path: &[&str]) -> Option<String> {
    let mut cur = value;
    for key in path {
        cur = cur.get(*key)?;
    }
    cur.as_str().map(|s| s.to_string())
}

async fn merge_simplified_into_official(
    resolved: &Path,
    simplified: &Value,
) -> Result<Value, AppError> {
    let existing = if resolved.exists() {
        let raw = fs::read_to_string(resolved)
            .await
            .map_err(|error| map_read_error(resolved, error))?;
        parse_json5_or_json(&raw, resolved).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    let provider_type = simplified
        .get("providerType")
        .and_then(|v| v.as_str())
        .unwrap_or("openai-compatible");

    let model = simplified
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    let model_id = if model.is_empty() { "default" } else { model };

    let temperature = simplified.get("temperature").and_then(|v| v.as_f64());
    let max_tokens = simplified.get("maxTokens").and_then(|v| v.as_u64());

    let (provider_id, base_url, api_key, model_ref) = if provider_type == "ollama" {
        let host = simplified
            .get("ollamaHost")
            .or_else(|| simplified.get("baseUrl"))
            .and_then(|v| v.as_str())
            .unwrap_or("http://127.0.0.1:11434")
            .trim();
        let normalized = normalize_ollama_base_url(host);
        let model_ref = format!("ollama/{model_id}");
        ("ollama".to_string(), normalized, None, model_ref)
    } else {
        let url = simplified
            .get("baseUrl")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .trim_end_matches('/')
            .to_string();
        let key = simplified
            .get("apiKey")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .filter(|s| !s.trim().is_empty());
        let provider_id = "custom-proxy".to_string();
        let model_ref = format!("{provider_id}/{model_id}");
        (provider_id, url, key, model_ref)
    };

    let mut root = existing.as_object().cloned().unwrap_or_default();

    // Ensure models.providers structure.
    let models = root
        .entry("models".to_string())
        .or_insert_with(|| json!({}));
    if !models.is_object() {
        *models = json!({});
    }
    let models_obj = models.as_object_mut().unwrap();
    models_obj
        .entry("mode".to_string())
        .or_insert_with(|| Value::String("merge".to_string()));

    let providers = models_obj
        .entry("providers".to_string())
        .or_insert_with(|| json!({}));
    if !providers.is_object() {
        *providers = json!({});
    }
    let providers_obj = providers.as_object_mut().unwrap();

    let mut provider_cfg = serde_json::Map::new();
    provider_cfg.insert("baseUrl".to_string(), Value::String(base_url));
    provider_cfg.insert(
        "api".to_string(),
        Value::String("openai-completions".to_string()),
    );
    if let Some(key) = api_key {
        provider_cfg.insert("apiKey".to_string(), Value::String(key));
    }
    if provider_id == "ollama" {
        provider_cfg.insert("injectNumCtxForOpenAICompat".to_string(), Value::Bool(true));
    }
    provider_cfg.insert(
        "models".to_string(),
        Value::Array(vec![json!({ "id": model_id, "name": model_id })]),
    );
    providers_obj.insert(provider_id.clone(), Value::Object(provider_cfg));

    // Ensure agents.defaults.model + agents.defaults.models.
    let agents = root
        .entry("agents".to_string())
        .or_insert_with(|| json!({}));
    if !agents.is_object() {
        *agents = json!({});
    }
    let agents_obj = agents.as_object_mut().unwrap();
    let defaults = agents_obj
        .entry("defaults".to_string())
        .or_insert_with(|| json!({}));
    if !defaults.is_object() {
        *defaults = json!({});
    }
    let defaults_obj = defaults.as_object_mut().unwrap();

    let model_sel = defaults_obj
        .entry("model".to_string())
        .or_insert_with(|| json!({}));
    if !model_sel.is_object() {
        *model_sel = json!({});
    }
    let model_sel_obj = model_sel.as_object_mut().unwrap();
    model_sel_obj.insert("primary".to_string(), Value::String(model_ref.clone()));

    let models_map = defaults_obj
        .entry("models".to_string())
        .or_insert_with(|| json!({}));
    if !models_map.is_object() {
        *models_map = json!({});
    }
    let models_map_obj = models_map.as_object_mut().unwrap();

    let mut model_entry = serde_json::Map::new();
    let mut params = serde_json::Map::new();
    if let Some(temp) = temperature {
        if let Some(num) = serde_json::Number::from_f64(temp) {
            params.insert("temperature".to_string(), Value::Number(num));
        }
    }
    if let Some(max) = max_tokens {
        params.insert("maxTokens".to_string(), Value::Number(max.into()));
    }
    if !params.is_empty() {
        model_entry.insert("params".to_string(), Value::Object(params));
    }
    models_map_obj.insert(model_ref, Value::Object(model_entry));
    let _ = ensure_local_gateway_settings(&mut root);

    Ok(Value::Object(root))
}

fn ensure_local_gateway_settings(root: &mut serde_json::Map<String, Value>) -> Vec<String> {
    let mut changes = Vec::new();
    let gateway = root
        .entry("gateway".to_string())
        .or_insert_with(|| json!({}));
    if !gateway.is_object() {
        *gateway = json!({});
        changes.push("Reset gateway config to an object.".to_string());
    }
    let gateway_obj = gateway.as_object_mut().expect("gateway object");
    ensure_default_string_field(
        gateway_obj,
        "mode",
        "local",
        &mut changes,
        "Set gateway.mode to local.",
    );
    ensure_default_string_field(
        gateway_obj,
        "bind",
        "loopback",
        &mut changes,
        "Set gateway.bind to loopback.",
    );
    changes
}

fn ensure_default_string_field(
    target: &mut serde_json::Map<String, Value>,
    key: &str,
    default_value: &str,
    changes: &mut Vec<String>,
    change_label: &str,
) {
    match target.get(key) {
        Some(Value::String(value)) if !value.trim().is_empty() => {}
        _ => {
            target.insert(key.to_string(), Value::String(default_value.to_string()));
            changes.push(change_label.to_string());
        }
    }
}

fn normalize_ollama_base_url(host: &str) -> String {
    let trimmed = host.trim().trim_end_matches('/');
    if trimmed.ends_with("/v1") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/v1")
    }
}

async fn validate_openclaw_config(path: &Path) -> Result<(), AppError> {
    let openclaw = env_service::ensure_openclaw_available()
        .await
        .map_err(|error| {
            AppError::new(
                error.code.clone(),
                "OpenClaw CLI is required to validate the config after writing.",
                "Install OpenClaw first, then retry saving the configuration.",
            )
            .with_details(error.details.unwrap_or_else(|| json!({})))
        })?;

    let config_path = path.to_string_lossy().to_string();
    let validate_args = vec![
        "config".to_string(),
        "validate".to_string(),
        "--json".to_string(),
    ];

    // The official CLI reads OPENCLAW_CONFIG_PATH; set it via the shell wrapper so we can validate
    // non-default paths without modifying adapter APIs.
    let (program, args, step) = if cfg!(windows) {
        let command = format!(
            "$env:OPENCLAW_CONFIG_PATH={}; & {} {}",
            shell_quote_powershell(&config_path),
            shell_quote_powershell(&openclaw),
            validate_args.join(" ")
        );
        (
            "powershell".to_string(),
            vec!["-NoProfile".to_string(), "-Command".to_string(), command],
            "openclaw config validate --json (powershell wrapper)",
        )
    } else {
        let command = format!(
            "OPENCLAW_CONFIG_PATH={} {} {}",
            shell_quote_bash(&config_path),
            shell_quote_bash(&openclaw),
            validate_args.join(" ")
        );
        (
            "bash".to_string(),
            vec!["-lc".to_string(), command],
            "openclaw config validate --json (bash wrapper)",
        )
    };

    let output = run_command(&program, &args, VALIDATE_TIMEOUT_MS).await?;
    if output.exit_code.unwrap_or(1) == 0 {
        return Ok(());
    }

    Err(AppError::new(
        ErrorCode::InvalidInput,
        "OpenClaw config validation failed after writing.",
        "Fix the provider URL/API key/model settings and retry.",
    )
    .with_details(json!({
        "step": step,
        "program": output.program,
        "args": output.args,
        "stdout": output.stdout,
        "stderr": output.stderr,
        "exit_code": output.exit_code,
    })))
}

fn shell_quote_bash(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }
    if !value.contains('\'') {
        return format!("'{}'", value);
    }
    let parts = value.split('\'').collect::<Vec<_>>();
    let mut out = String::new();
    for (idx, part) in parts.iter().enumerate() {
        if idx > 0 {
            out.push_str("'\\''");
        }
        out.push_str(&format!("'{}'", part));
    }
    out
}

fn shell_quote_powershell(value: &str) -> String {
    // Single-quoted PowerShell string literal.
    let escaped = value.replace('\'', "''");
    format!("'{}'", escaped)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_simplified_view_from_official_minimal_shape() {
        let official = json!({
          "models": { "providers": { "custom-proxy": { "baseUrl": "https://api.example.com/v1", "apiKey": "sk-test" } } },
          "agents": {
            "defaults": {
              "model": { "primary": "custom-proxy/gpt-test" },
              "models": { "custom-proxy/gpt-test": { "params": { "temperature": 0.2, "maxTokens": 1024 } } }
            }
          }
        });

        let simplified = to_simplified_config_view(&official).expect("simplified view");
        assert_eq!(simplified["providerType"], "openai-compatible");
        assert_eq!(simplified["baseUrl"], "https://api.example.com/v1");
        assert_eq!(simplified["apiKey"], "sk-test");
        assert_eq!(simplified["model"], "gpt-test");
        assert_eq!(simplified["temperature"].as_f64().unwrap(), 0.2);
        assert_eq!(simplified["maxTokens"].as_u64().unwrap(), 1024);
        assert_eq!(simplified["_format"], "official-json5");
    }

    #[test]
    fn normalizes_ollama_base_url_to_v1() {
        assert_eq!(
            &normalize_ollama_base_url("http://127.0.0.1:11434"),
            "http://127.0.0.1:11434/v1"
        );
        assert_eq!(
            &normalize_ollama_base_url("http://127.0.0.1:11434/v1"),
            "http://127.0.0.1:11434/v1"
        );
        assert_eq!(
            &normalize_ollama_base_url("http://127.0.0.1:11434/v1/"),
            "http://127.0.0.1:11434/v1"
        );
    }

    #[test]
    fn simplified_view_exposes_gateway_metadata() {
        let official = json!({
          "models": { "providers": { "custom-proxy": { "baseUrl": "https://api.example.com/v1", "apiKey": "sk-test" } } },
          "agents": {
            "defaults": {
              "model": { "primary": "custom-proxy/gpt-test" },
              "models": { "custom-proxy/gpt-test": { "params": { "temperature": 0.2, "maxTokens": 1024 } } }
            }
          },
          "gateway": {
            "mode": "local",
            "bind": "loopback",
            "auth": { "mode": "token", "token": "tok-test" }
          }
        });

        let simplified = to_simplified_config_view(&official).expect("simplified view");
        assert_eq!(simplified["_gatewayMode"], "local");
        assert_eq!(simplified["_gatewayBind"], "loopback");
        assert_eq!(simplified["_gatewayAuthMode"], "token");
        assert_eq!(simplified["_gatewayHasToken"], true);
    }

    #[test]
    fn ensures_local_gateway_defaults_without_overwriting_existing_values() {
        let mut root = serde_json::Map::new();
        let changes = ensure_local_gateway_settings(&mut root);

        assert_eq!(
            root.get("gateway")
                .and_then(|value| value.get("mode"))
                .and_then(|value| value.as_str()),
            Some("local")
        );
        assert_eq!(
            root.get("gateway")
                .and_then(|value| value.get("bind"))
                .and_then(|value| value.as_str()),
            Some("loopback")
        );
        assert!(!changes.is_empty());

        let mut existing = serde_json::Map::new();
        existing.insert(
            "gateway".to_string(),
            json!({ "mode": "remote", "bind": "0.0.0.0" }),
        );
        let second_changes = ensure_local_gateway_settings(&mut existing);
        assert!(second_changes.is_empty());
        assert_eq!(
            existing
                .get("gateway")
                .and_then(|value| value.get("mode"))
                .and_then(|value| value.as_str()),
            Some("remote")
        );
    }
}
