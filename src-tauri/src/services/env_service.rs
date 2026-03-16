use std::env;

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::adapters::openclaw;
use crate::adapters::platform;
use crate::adapters::shell::{run_command, ShellOutput};
use crate::models::error::{AppError, ErrorCode};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectEnvData {
    pub platform: String,
    pub architecture: String,
    pub home_dir: Option<String>,
    pub config_path: String,
    pub npm_found: bool,
    pub npm_version: Option<String>,
    pub npm_output: Option<ShellOutput>,
    pub openclaw_found: bool,
    pub openclaw_path: Option<String>,
    pub openclaw_version: Option<String>,
    pub locator_output: ShellOutput,
    pub version_output: Option<ShellOutput>,
}

pub async fn detect_env() -> Result<DetectEnvData, AppError> {
    let npm_args = vec!["--version".to_string()];
    let npm_output = run_command(openclaw::npm_program(), &npm_args, 5_000)
        .await
        .ok();
    let npm_version = npm_output.as_ref().and_then(|out| {
        if out.exit_code == Some(0) {
            out.stdout
                .lines()
                .next()
                .map(|line| line.trim().to_string())
        } else {
            None
        }
    });
    let npm_found = npm_version.is_some();

    let (locator_program, locator_args) = platform::locator_command("openclaw");
    let locator_output = run_command(&locator_program, &locator_args, 5_000).await?;

    let openclaw_path = locator_output
        .stdout
        .lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| openclaw::resolve_binary_path().map(|path| path.to_string_lossy().to_string()));

    let openclaw_found = openclaw_path.is_some();

    let version_output = if openclaw_found {
        let args = vec!["--version".to_string()];
        let program = openclaw_path
            .clone()
            .unwrap_or_else(|| "openclaw".to_string());
        Some(run_command(&program, &args, 5_000).await?)
    } else {
        None
    };

    let openclaw_version = version_output.as_ref().and_then(|out| {
        if out.exit_code == Some(0) {
            out.stdout
                .lines()
                .next()
                .map(|line| line.trim().to_string())
        } else {
            None
        }
    });

    let home_dir = env::var("HOME")
        .ok()
        .or_else(|| env::var("USERPROFILE").ok())
        .filter(|value| !value.is_empty());

    Ok(DetectEnvData {
        platform: platform::display_platform().to_string(),
        architecture: env::consts::ARCH.to_string(),
        home_dir,
        config_path: platform::default_openclaw_config_path()
            .to_string_lossy()
            .to_string(),
        npm_found,
        npm_version,
        npm_output,
        openclaw_found,
        openclaw_path,
        openclaw_version,
        locator_output,
        version_output,
    })
}

pub async fn ensure_openclaw_available() -> Result<String, AppError> {
    if let Some(path) = ensure_openclaw_available_sync() {
        return Ok(path);
    }

    let (locator_program, locator_args) = platform::locator_command("openclaw");
    let output = run_command(&locator_program, &locator_args, 5_000).await?;
    path_from_locator_output(&output).ok_or_else(|| {
        AppError::new(
            ErrorCode::PathNotFound,
            "OpenClaw CLI is not installed or not available in PATH.",
            "Run the install flow first, or add the OpenClaw executable directory to PATH.",
        )
        .with_details(json!({ "locator_output": output }))
    })
}

pub fn ensure_openclaw_available_sync() -> Option<String> {
    openclaw::resolve_binary_path().map(|path| path.to_string_lossy().to_string())
}

fn path_from_locator_output(output: &ShellOutput) -> Option<String> {
    output
        .stdout
        .lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
}
