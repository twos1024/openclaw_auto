use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::fs;

use crate::adapters::file_ops;
use crate::adapters::platform;
use crate::models::error::{AppError, ErrorCode};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub preferred_install_source: String,
    pub diagnostics_dir: String,
    pub log_line_limit: usize,
    pub gateway_poll_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadAppSettingsData {
    pub path: String,
    pub exists: bool,
    pub content: AppSettings,
    pub modified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteAppSettingsData {
    pub path: String,
    pub backup_path: Option<String>,
    pub bytes_written: usize,
}

pub fn default_app_settings() -> AppSettings {
    AppSettings {
        preferred_install_source: "npm-global".to_string(),
        diagnostics_dir: platform::clawdesk_diagnostics_dir()
            .to_string_lossy()
            .to_string(),
        log_line_limit: 1200,
        gateway_poll_ms: 5_000,
    }
}

pub async fn read_app_settings(path: Option<String>) -> Result<ReadAppSettingsData, AppError> {
    let resolved = resolve_path(path)?;
    if !resolved.exists() {
        return Ok(ReadAppSettingsData {
            path: resolved.to_string_lossy().to_string(),
            exists: false,
            content: default_app_settings(),
            modified_at: None,
        });
    }

    let raw = fs::read_to_string(&resolved)
        .await
        .map_err(|error| map_read_error(&resolved, error))?;
    let content: AppSettings = serde_json::from_str(&raw).map_err(|error| {
        AppError::new(
            ErrorCode::ConfigCorrupted,
            "App settings content is not valid JSON.",
            "Repair the settings file format or restore from a backup file.",
        )
        .with_details(json!({
            "path": resolved.to_string_lossy(),
            "json_error": error.to_string(),
        }))
    })?;

    let modified_at = fs::metadata(&resolved)
        .await
        .ok()
        .and_then(|meta| meta.modified().ok())
        .map(DateTime::<Utc>::from);

    Ok(ReadAppSettingsData {
        path: resolved.to_string_lossy().to_string(),
        exists: true,
        content,
        modified_at,
    })
}

pub async fn write_app_settings(
    path: Option<String>,
    content: AppSettings,
) -> Result<WriteAppSettingsData, AppError> {
    validate_settings(&content)?;

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

    let serialized = serde_json::to_string_pretty(&content).map_err(|error| {
        AppError::new(
            ErrorCode::InvalidInput,
            "Provided app settings payload cannot be serialized.",
            "Check the app settings request payload and retry with valid JSON.",
        )
        .with_details(json!({ "serialize_error": error.to_string() }))
    })?;

    file_ops::safe_write_bytes(&resolved, serialized.as_bytes())
        .await
        .map_err(|error| map_write_error(&resolved, error, ErrorCode::ConfigWriteFailed))?;

    Ok(WriteAppSettingsData {
        path: resolved.to_string_lossy().to_string(),
        backup_path: backup_path.map(|item| item.to_string_lossy().to_string()),
        bytes_written: serialized.as_bytes().len(),
    })
}

pub fn settings_file_path() -> PathBuf {
    platform::clawdesk_app_dir().join("settings.json")
}

fn resolve_path(path: Option<String>) -> Result<PathBuf, AppError> {
    match path {
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Err(AppError::new(
                    ErrorCode::InvalidInput,
                    "Settings path cannot be empty.",
                    "Provide a non-empty settings path or omit it to use the default path.",
                ));
            }
            Ok(PathBuf::from(trimmed))
        }
        None => Ok(settings_file_path()),
    }
}

fn validate_settings(settings: &AppSettings) -> Result<(), AppError> {
    if settings.diagnostics_dir.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Diagnostics directory cannot be empty.",
            "Provide a writable diagnostics directory path before saving settings.",
        ));
    }

    if settings.log_line_limit == 0 || settings.log_line_limit > 20_000 {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Log line limit must be between 1 and 20000.",
            "Adjust the log line limit to a reasonable value and retry.",
        ));
    }

    if settings.gateway_poll_ms < 1_000 || settings.gateway_poll_ms > 60_000 {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Gateway polling interval must be between 1000 and 60000 milliseconds.",
            "Adjust the polling interval and retry.",
        ));
    }

    Ok(())
}

async fn backup_file(source: &Path) -> Result<PathBuf, AppError> {
    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::ConfigBackupFailed,
                "Unable to resolve settings filename for backup.",
                "Check whether the settings path points to a valid file.",
            )
            .with_details(json!({ "path": source.to_string_lossy() }))
        })?;

    let backup_name = format!("{file_name}.bak.{}", Utc::now().format("%Y%m%d%H%M%S"));
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
            "App settings file not found.",
            "Save settings once to create the file, or verify the settings path.",
        ),
        ErrorKind::PermissionDenied => AppError::new(
            ErrorCode::PermissionDenied,
            "Permission denied while reading app settings.",
            "Adjust file permissions and rerun the command.",
        ),
        _ => AppError::new(
            ErrorCode::ConfigReadFailed,
            "Failed to read app settings file.",
            "Check whether the file is locked by another process.",
        ),
    }
    .with_details(json!({
        "path": path.to_string_lossy(),
        "os_error": error.to_string(),
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
        "Failed while writing app settings.",
        "Check disk permissions and available space, then retry.",
    )
    .with_details(json!({
        "path": path.to_string_lossy(),
        "os_error": error.to_string(),
    }))
}
