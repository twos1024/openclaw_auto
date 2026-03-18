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
    /// The output of the `where`/`which` locator command.  `None` when the
    /// locator itself could not be spawned (e.g. `where.exe` crash on Windows).
    pub locator_output: Option<ShellOutput>,
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

    // Primary resolution: scan well-known directories for the binary.
    // This does not spawn any child process, so it never triggers a
    // `where.exe` crash or visible console window.
    let mut openclaw_path =
        openclaw::resolve_binary_path().map(|path| path.to_string_lossy().to_string());

    // Secondary resolution: try the `where`/`which` locator command.
    // If the locator itself fails (e.g. `where.exe` crashes with
    // 0xc0000142), treat this as a soft failure — not a fatal error.
    let locator_output = {
        let (locator_program, locator_args) = platform::locator_command("openclaw");
        run_command(&locator_program, &locator_args, 5_000)
            .await
            .ok()
    };
    if openclaw_path.is_none() {
        openclaw_path = locator_output
            .as_ref()
            .and_then(|output| path_from_locator_output(output));
    }

    let openclaw_found = openclaw_path.is_some();

    let version_output = if openclaw_found {
        let args = vec!["--version".to_string()];
        let program = openclaw_path
            .clone()
            .unwrap_or_else(|| "openclaw".to_string());
        run_command(&program, &args, 5_000).await.ok()
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
    // Primary: filesystem scan — fast, no child process, no console popup.
    if let Some(path) = ensure_openclaw_available_sync() {
        return Ok(path);
    }

    // Fallback: try `where`/`which`.  If the locator itself crashes,
    // return a clear error instead of propagating the spawn failure.
    let (locator_program, locator_args) = platform::locator_command("openclaw");
    let locator_result = run_command(&locator_program, &locator_args, 5_000).await;
    if let Ok(output) = &locator_result {
        if let Some(path) = path_from_locator_output(output) {
            return Ok(path);
        }
    }

    Err(AppError::new(
        ErrorCode::PathNotFound,
        "OpenClaw CLI is not installed or not available in PATH.",
        "Run the install flow first, or add the OpenClaw executable directory to PATH.",
    )
    .with_details(json!({
        "locator_result": locator_result
            .as_ref()
            .map(|o| json!({"stdout": o.stdout, "stderr": o.stderr, "exit_code": o.exit_code}))
            .unwrap_or_else(|e| json!({"error": e.message})),
        "scanned_candidates": openclaw::binary_candidates()
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>(),
    })))
}

pub fn ensure_openclaw_available_sync() -> Option<String> {
    openclaw::resolve_binary_path().map(|path| path.to_string_lossy().to_string())
}

fn path_from_locator_output(output: &ShellOutput) -> Option<String> {
    let lines: Vec<&str> = output
        .stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();

    if lines.is_empty() {
        return None;
    }

    // On Windows, `where` may return multiple hits.  Prefer paths ending with
    // .cmd or .exe because the bare "openclaw" file is a Unix shell script
    // that cannot be executed directly on Windows (OS error 193).
    if cfg!(windows) {
        if let Some(cmd_path) = lines.iter().find(|line| {
            let lower = line.to_lowercase();
            lower.ends_with(".cmd") || lower.ends_with(".exe")
        }) {
            return Some(cmd_path.to_string());
        }
    }

    Some(lines[0].to_owned())
}
