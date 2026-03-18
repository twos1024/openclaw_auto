use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::fs;

use crate::adapters::file_ops;
use crate::adapters::platform;
use crate::models::error::{AppError, ErrorCode};

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
    let content: Value = serde_json::from_str(&raw).map_err(|error| {
        AppError::new(
            ErrorCode::ConfigCorrupted,
            "Config content is not valid JSON.",
            "Repair the config format or restore from a backup file.",
        )
        .with_details(json!({
            "path": resolved.to_string_lossy(),
            "json_error": error.to_string()
        }))
    })?;

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

    let serialized = serde_json::to_string_pretty(&content).map_err(|error| {
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

    Ok(WriteConfigData {
        path: resolved.to_string_lossy().to_string(),
        backup_path: backup_path.map(|p| p.to_string_lossy().to_string()),
        bytes_written: serialized.as_bytes().len(),
    })
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
