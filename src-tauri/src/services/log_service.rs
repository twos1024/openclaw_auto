use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::adapters::platform;
use crate::adapters::shell::run_command;
use crate::models::error::{AppError, ErrorCode};
use crate::services::config_service;
use crate::services::env_service;
use crate::services::gateway_service;
use crate::services::settings_service;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogSource {
    Install,
    Startup,
    Gateway,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadLogsData {
    pub source: String,
    pub lines: Vec<String>,
    pub path: String,
    pub truncated: bool,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticsExportFormat {
    Text,
    Bundle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDiagnosticsData {
    pub file_path: String,
    pub format: DiagnosticsExportFormat,
    pub included_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsBundleManifest {
    generated_at: String,
    format: &'static str,
    source: String,
    included_files: Vec<String>,
}

#[derive(Debug, Clone)]
struct DiagnosticSnapshots {
    env_snapshot: String,
    settings_snapshot: String,
    gateway_snapshot: String,
    config_snapshot: String,
}

pub async fn read_logs(source: LogSource, line_limit: usize) -> Result<ReadLogsData, AppError> {
    if matches!(source, LogSource::Gateway) {
        return read_gateway_logs(line_limit).await;
    }

    let path = log_file_path(&source);
    if !path.exists() {
        return Ok(ReadLogsData {
            source: source_name(&source).to_string(),
            lines: Vec::new(),
            path: path.to_string_lossy().to_string(),
            truncated: false,
            exists: false,
        });
    }

    let raw = fs::read_to_string(&path).map_err(|error| {
        AppError::new(
            ErrorCode::LogReadFailed,
            "Failed to read the requested log file.",
            "Check whether the log file exists and whether ClawDesk has permission to read it.",
        )
        .with_details(json!({
            "path": path.to_string_lossy(),
            "os_error": error.to_string(),
        }))
    })?;

    let mut lines: Vec<String> = raw.lines().map(|line| line.to_string()).collect();
    let truncated = if line_limit > 0 && lines.len() > line_limit {
        lines = lines.split_off(lines.len() - line_limit);
        true
    } else {
        false
    };

    Ok(ReadLogsData {
        source: source_name(&source).to_string(),
        lines,
        path: path.to_string_lossy().to_string(),
        truncated,
        exists: true,
    })
}

pub async fn export_diagnostics(
    source: LogSource,
    keyword: Option<String>,
    content: String,
    archive: bool,
) -> Result<ExportDiagnosticsData, AppError> {
    let settings = settings_service::read_app_settings(None).await.ok();
    let diagnostics_dir = settings
        .as_ref()
        .map(|data| PathBuf::from(data.content.diagnostics_dir.clone()))
        .unwrap_or_else(platform::clawdesk_diagnostics_dir);
    fs::create_dir_all(&diagnostics_dir).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to create the diagnostics output directory.",
            "Check the application data directory permissions and retry.",
        )
        .with_details(json!({
            "path": diagnostics_dir.to_string_lossy(),
            "os_error": error.to_string(),
        }))
    })?;

    let keyword_suffix = keyword
        .clone()
        .unwrap_or_default()
        .trim()
        .replace(|ch: char| !ch.is_ascii_alphanumeric(), "-");
    let snapshots = collect_diagnostic_snapshots(settings.as_ref()).await;
    let bundle = build_diagnostics_bundle(&content, source.clone(), keyword.clone(), &snapshots);

    if archive {
        let file_name = output_file_name(&source, &keyword_suffix, "zip");
        let output_path = diagnostics_dir.join(file_name);
        let included_files =
            write_diagnostics_archive(&output_path, &source, &bundle, &snapshots).await?;

        return Ok(ExportDiagnosticsData {
            file_path: output_path.to_string_lossy().to_string(),
            format: DiagnosticsExportFormat::Bundle,
            included_files,
        });
    }

    let file_name = output_file_name(&source, &keyword_suffix, "txt");
    let output_path = diagnostics_dir.join(file_name);
    fs::write(&output_path, bundle).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to write the diagnostics file.",
            "Check whether the diagnostics directory is writable and retry.",
        )
        .with_details(json!({
            "path": output_path.to_string_lossy(),
            "os_error": error.to_string(),
        }))
    })?;

    Ok(ExportDiagnosticsData {
        file_path: output_path.to_string_lossy().to_string(),
        format: DiagnosticsExportFormat::Text,
        included_files: vec!["summary.txt".to_string()],
    })
}

pub fn append_log_line(source: LogSource, line: &str) -> Result<(), AppError> {
    fs::create_dir_all(platform::clawdesk_log_dir()).map_err(|error| {
        AppError::new(
            ErrorCode::LogReadFailed,
            "Failed to initialize the ClawDesk log directory.",
            "Check application data directory permissions and retry.",
        )
        .with_details(json!({
            "path": platform::clawdesk_log_dir().to_string_lossy(),
            "os_error": error.to_string(),
        }))
    })?;

    let path = log_file_path(&source);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| {
            AppError::new(
                ErrorCode::LogReadFailed,
                "Failed to open the ClawDesk log file for writing.",
                "Check file permissions for the application log directory and retry.",
            )
            .with_details(json!({
                "path": path.to_string_lossy(),
                "os_error": error.to_string(),
            }))
        })?;

    writeln!(file, "{line}").map_err(|error| {
        AppError::new(
            ErrorCode::LogReadFailed,
            "Failed to append data to the ClawDesk log file.",
            "Check whether the log file is writable and retry.",
        )
        .with_details(json!({
            "path": path.to_string_lossy(),
            "os_error": error.to_string(),
        }))
    })
}

async fn read_gateway_logs(line_limit: usize) -> Result<ReadLogsData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "logs".to_string(),
        "--plain".to_string(),
        "--limit".to_string(),
        line_limit.max(1).to_string(),
    ];
    let output = run_command(&program, &args, 15_000).await?;

    if output.exit_code.unwrap_or(1) != 0 {
        return Err(AppError::new(
            ErrorCode::LogReadFailed,
            "OpenClaw returned a non-zero exit code while reading Gateway logs.",
            "Check whether the Gateway is installed correctly, then retry.",
        )
        .with_details(json!({
            "program": output.program,
            "args": output.args,
            "stdout": output.stdout,
            "stderr": output.stderr,
            "exit_code": output.exit_code,
        })));
    }

    let lines: Vec<String> = output.stdout.lines().map(|line| line.to_string()).collect();

    Ok(ReadLogsData {
        source: "gateway".to_string(),
        lines,
        path: program,
        truncated: false,
        exists: true,
    })
}

async fn collect_diagnostic_snapshots(
    settings: Option<&settings_service::ReadAppSettingsData>,
) -> DiagnosticSnapshots {
    let env_snapshot = env_service::detect_env()
        .await
        .map(|value| serde_json::to_string_pretty(&value).unwrap_or_else(|_| "{}".to_string()))
        .unwrap_or_else(|error| format!("ERROR: {} | {}", error.message, error.suggestion));

    let gateway_snapshot = gateway_service::get_gateway_status()
        .await
        .map(|value| serde_json::to_string_pretty(&value).unwrap_or_else(|_| "{}".to_string()))
        .unwrap_or_else(|error| format!("ERROR: {} | {}", error.message, error.suggestion));

    let config_snapshot = config_service::read_openclaw_config(None)
        .await
        .map(|value| {
            serde_json::to_string_pretty(&sanitize_config_snapshot(value.content))
                .unwrap_or_else(|_| "{}".to_string())
        })
        .unwrap_or_else(|error| format!("ERROR: {} | {}", error.message, error.suggestion));

    let settings_snapshot = settings
        .map(|value| {
            serde_json::to_string_pretty(&value.content).unwrap_or_else(|_| "{}".to_string())
        })
        .unwrap_or_else(|| "Settings snapshot unavailable.".to_string());

    DiagnosticSnapshots {
        env_snapshot,
        settings_snapshot,
        gateway_snapshot,
        config_snapshot,
    }
}

fn build_diagnostics_bundle(
    frontend_summary: &str,
    source: LogSource,
    keyword: Option<String>,
    snapshots: &DiagnosticSnapshots,
) -> String {
    [
        frontend_summary.to_string(),
        String::new(),
        "---- ClawDesk Backend Snapshot ----".to_string(),
        format!("Generated At: {}", Utc::now().to_rfc3339()),
        format!("Requested Log Source: {}", source_name(&source)),
        format!("Keyword: {}", keyword.unwrap_or_default()),
        String::new(),
        "[Environment]".to_string(),
        snapshots.env_snapshot.clone(),
        String::new(),
        "[App Settings]".to_string(),
        snapshots.settings_snapshot.clone(),
        String::new(),
        "[Gateway Status]".to_string(),
        snapshots.gateway_snapshot.clone(),
        String::new(),
        "[OpenClaw Config Summary]".to_string(),
        snapshots.config_snapshot.clone(),
    ]
    .join("\n")
}

async fn write_diagnostics_archive(
    output_path: &PathBuf,
    source: &LogSource,
    summary_text: &str,
    snapshots: &DiagnosticSnapshots,
) -> Result<Vec<String>, AppError> {
    let file = File::create(output_path).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to create the diagnostics ZIP file.",
            "Check whether the diagnostics directory is writable and retry.",
        )
        .with_details(json!({
            "path": output_path.to_string_lossy(),
            "os_error": error.to_string(),
        }))
    })?;

    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let mut zip = ZipWriter::new(file);
    let mut included_files = Vec::new();

    add_text_entry(
        &mut zip,
        options,
        "summary.txt",
        summary_text,
        &mut included_files,
    )?;
    add_text_entry(
        &mut zip,
        options,
        "snapshots/environment.json",
        &snapshots.env_snapshot,
        &mut included_files,
    )?;
    add_text_entry(
        &mut zip,
        options,
        "snapshots/settings.json",
        &snapshots.settings_snapshot,
        &mut included_files,
    )?;
    add_text_entry(
        &mut zip,
        options,
        "snapshots/gateway-status.json",
        &snapshots.gateway_snapshot,
        &mut included_files,
    )?;
    add_text_entry(
        &mut zip,
        options,
        "snapshots/openclaw-config.json",
        &snapshots.config_snapshot,
        &mut included_files,
    )?;

    add_log_file_entry(
        &mut zip,
        options,
        log_file_path(&LogSource::Install),
        "logs/install.log",
        &mut included_files,
    )?;
    add_log_file_entry(
        &mut zip,
        options,
        log_file_path(&LogSource::Startup),
        "logs/startup.log",
        &mut included_files,
    )?;

    let gateway_log_snapshot = read_gateway_logs(1200)
        .await
        .map(|data| data.lines.join("\n"))
        .unwrap_or_else(|error| format!("ERROR: {} | {}", error.message, error.suggestion));
    add_text_entry(
        &mut zip,
        options,
        "logs/gateway.log",
        &gateway_log_snapshot,
        &mut included_files,
    )?;

    let manifest_files = {
        let mut items = included_files.clone();
        items.push("manifest.json".to_string());
        items
    };
    let manifest = build_bundle_manifest_json(source, &manifest_files)?;
    add_text_entry(
        &mut zip,
        options,
        "manifest.json",
        &manifest,
        &mut included_files,
    )?;

    zip.finish().map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to finalize the diagnostics ZIP file.",
            "Retry the export, and check whether the destination file is locked by another process.",
        )
        .with_details(json!({
            "path": output_path.to_string_lossy(),
            "zip_error": error.to_string(),
        }))
    })?;

    Ok(included_files)
}

fn build_bundle_manifest_json(
    source: &LogSource,
    included_files: &[String],
) -> Result<String, AppError> {
    serde_json::to_string_pretty(&DiagnosticsBundleManifest {
        generated_at: Utc::now().to_rfc3339(),
        format: "bundle",
        source: source_name(source).to_string(),
        included_files: included_files.to_vec(),
    })
    .map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to serialize diagnostics bundle manifest.",
            "Retry the export and inspect the manifest payload fields.",
        )
        .with_details(json!({
            "serialize_error": error.to_string(),
            "source": source_name(source),
        }))
    })
}

fn add_text_entry(
    zip: &mut ZipWriter<File>,
    options: SimpleFileOptions,
    archive_path: &str,
    content: &str,
    included_files: &mut Vec<String>,
) -> Result<(), AppError> {
    zip.start_file(archive_path, options).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to add a text entry to diagnostics ZIP.",
            "Retry the export and check whether the diagnostics archive path is valid.",
        )
        .with_details(json!({
            "archive_path": archive_path,
            "zip_error": error.to_string(),
        }))
    })?;
    zip.write_all(content.as_bytes()).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to write a text entry into diagnostics ZIP.",
            "Retry the export and ensure sufficient disk space is available.",
        )
        .with_details(json!({
            "archive_path": archive_path,
            "zip_error": error.to_string(),
        }))
    })?;
    included_files.push(archive_path.to_string());
    Ok(())
}

fn add_log_file_entry(
    zip: &mut ZipWriter<File>,
    options: SimpleFileOptions,
    path: PathBuf,
    archive_path: &str,
    included_files: &mut Vec<String>,
) -> Result<(), AppError> {
    if !path.exists() {
        return Ok(());
    }

    let bytes = fs::read(&path).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to read a local log file for diagnostics export.",
            "Check whether the log file is readable and retry the export.",
        )
        .with_details(json!({
            "path": path.to_string_lossy(),
            "os_error": error.to_string(),
        }))
    })?;

    zip.start_file(archive_path, options).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to create a log entry in diagnostics ZIP.",
            "Retry the export and check whether the ZIP file is locked.",
        )
        .with_details(json!({
            "archive_path": archive_path,
            "zip_error": error.to_string(),
        }))
    })?;
    zip.write_all(&bytes).map_err(|error| {
        AppError::new(
            ErrorCode::DiagnosticsExportFailed,
            "Failed to write log data into diagnostics ZIP.",
            "Retry the export and ensure sufficient disk space is available.",
        )
        .with_details(json!({
            "archive_path": archive_path,
            "zip_error": error.to_string(),
        }))
    })?;

    included_files.push(archive_path.to_string());
    Ok(())
}

fn sanitize_config_snapshot(content: Value) -> Value {
    let mut snapshot = serde_json::Map::new();

    if let Some(provider) = read_string_field(&content, &["providerType"]) {
        snapshot.insert("providerType".to_string(), Value::String(provider));
    }
    if let Some(base_url) = read_string_field(&content, &["baseUrl"]) {
        snapshot.insert("baseUrl".to_string(), Value::String(base_url));
    }
    if let Some(model) = read_string_field(&content, &["model"]) {
        snapshot.insert("model".to_string(), Value::String(model));
    }
    if let Some(timeout) = read_number_field(&content, &["timeout"]) {
        snapshot.insert("timeout".to_string(), Value::Number(timeout.into()));
    }
    if let Some(max_tokens) = read_number_field(&content, &["maxTokens"]) {
        snapshot.insert("maxTokens".to_string(), Value::Number(max_tokens.into()));
    }
    if let Some(temperature) =
        find_value_recursive(&content, "temperature").and_then(|value| value.as_f64())
    {
        snapshot.insert(
            "temperature".to_string(),
            serde_json::Number::from_f64(temperature)
                .map(Value::Number)
                .unwrap_or(Value::String(temperature.to_string())),
        );
    }
    if let Some(ollama_host) = read_string_field(&content, &["ollamaHost"]) {
        snapshot.insert("ollamaHost".to_string(), Value::String(ollama_host));
    }
    snapshot.insert(
        "hasApiKey".to_string(),
        Value::Bool(
            read_string_field(&content, &["apiKey"])
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false),
        ),
    );

    Value::Object(snapshot)
}

fn read_string_field(content: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| find_value_recursive(content, key))
        .and_then(|value| value.as_str().map(|item| item.to_string()))
}

fn read_number_field(content: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| {
        find_value_recursive(content, key).and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_str().and_then(|item| item.parse::<u64>().ok()))
        })
    })
}

fn find_value_recursive<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            if let Some(found) = map.get(key) {
                return Some(found);
            }

            map.values()
                .find_map(|nested| find_value_recursive(nested, key))
        }
        Value::Array(items) => items
            .iter()
            .find_map(|item| find_value_recursive(item, key)),
        _ => None,
    }
}

fn output_file_name(source: &LogSource, keyword_suffix: &str, extension: &str) -> String {
    if keyword_suffix.is_empty() {
        format!(
            "clawdesk-diagnostics-{}-{}.{}",
            source_name(source),
            Utc::now().format("%Y%m%d%H%M%S"),
            extension
        )
    } else {
        format!(
            "clawdesk-diagnostics-{}-{}-{}.{}",
            source_name(source),
            keyword_suffix,
            Utc::now().format("%Y%m%d%H%M%S"),
            extension
        )
    }
}

fn log_file_path(source: &LogSource) -> PathBuf {
    let file_name = match source {
        LogSource::Install => "install.log",
        LogSource::Startup => "startup.log",
        LogSource::Gateway => "gateway.log",
    };

    platform::clawdesk_log_dir().join(file_name)
}

fn source_name(source: &LogSource) -> &'static str {
    match source {
        LogSource::Install => "install",
        LogSource::Startup => "startup",
        LogSource::Gateway => "gateway",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_config_snapshot_masks_api_key() {
        let source = json!({
            "providerType": "openai-compatible",
            "baseUrl": "https://example.com/v1",
            "apiKey": "sk-live-secret",
            "model": "gpt-4o-mini",
            "timeout": 30000,
            "temperature": 0.3,
            "nested": {
                "maxTokens": 2048
            }
        });

        let sanitized = sanitize_config_snapshot(source);

        assert_eq!(
            sanitized.get("providerType").and_then(Value::as_str),
            Some("openai-compatible")
        );
        assert_eq!(
            sanitized.get("model").and_then(Value::as_str),
            Some("gpt-4o-mini")
        );
        assert_eq!(
            sanitized.get("hasApiKey").and_then(Value::as_bool),
            Some(true)
        );
        assert!(sanitized.get("apiKey").is_none());
    }

    #[test]
    fn bundle_manifest_lists_source_and_entries() {
        let manifest = build_bundle_manifest_json(
            &LogSource::Gateway,
            &[
                "summary.txt".to_string(),
                "logs/install.log".to_string(),
                "manifest.json".to_string(),
            ],
        )
        .expect("manifest should serialize");

        let value: Value = serde_json::from_str(&manifest).expect("manifest should be valid json");
        assert_eq!(value.get("format").and_then(Value::as_str), Some("bundle"));
        assert_eq!(value.get("source").and_then(Value::as_str), Some("gateway"));
        let included = value
            .get("includedFiles")
            .and_then(Value::as_array)
            .expect("includedFiles should be array");
        assert!(included
            .iter()
            .any(|item| item.as_str() == Some("summary.txt")));
        assert!(included
            .iter()
            .any(|item| item.as_str() == Some("manifest.json")));
    }
}
