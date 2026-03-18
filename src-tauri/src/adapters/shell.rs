use std::process::Stdio;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

use crate::adapters::platform;
use crate::models::error::{AppError, ErrorCode};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellOutput {
    pub program: String,
    pub args: Vec<String>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u128,
}

pub async fn run_command(
    program: &str,
    args: &[String],
    timeout_ms: u64,
) -> Result<ShellOutput, AppError> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // On Windows, prevent spawned processes from opening visible console
    // windows.  Tauri is a GUI application, so child processes must not
    // flash terminal windows to the user.
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(path_env) = platform::normalized_path_env() {
        command.env("PATH", path_env);
    }

    let started_at = Instant::now();
    let child = command.spawn().map_err(|error| {
        AppError::new(
            ErrorCode::ShellSpawnFailed,
            format!("Failed to spawn command: {program}"),
            "Check whether the binary exists and is executable.",
        )
        .with_details(json!({
            "program": program,
            "args": args,
            "os_error": error.to_string()
        }))
    })?;

    let output = timeout(Duration::from_millis(timeout_ms), child.wait_with_output())
        .await
        .map_err(|_| {
            AppError::new(
                ErrorCode::ShellTimeout,
                format!("Command timed out after {timeout_ms}ms."),
                "Increase timeout or inspect whether the command is blocked.",
            )
            .with_details(json!({
                "program": program,
                "args": args,
                "timeout_ms": timeout_ms
            }))
        })?
        .map_err(|error| {
            AppError::new(
                ErrorCode::ShellWaitFailed,
                "Failed while waiting for command output.",
                "Retry the action and check system process limits.",
            )
            .with_details(json!({
                "program": program,
                "args": args,
                "os_error": error.to_string()
            }))
        })?;

    Ok(ShellOutput {
        program: program.to_string(),
        args: args.to_vec(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        duration_ms: started_at.elapsed().as_millis(),
    })
}
