use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::adapters::openclaw;
use crate::adapters::platform;
use crate::adapters::shell::{run_command, ShellOutput};
use crate::models::error::{AppError, ErrorCode};
use crate::services::env_service;
use crate::services::log_service::{self, LogSource};

const INSTALL_TIMEOUT_MS: u64 = 10 * 60 * 1000;
const GATEWAY_INSTALL_TIMEOUT_MS: u64 = 60 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOpenClawData {
    pub cli_installed: bool,
    pub gateway_service_installed: bool,
    pub executable_path: Option<String>,
    pub config_path: String,
    pub install_output: ShellOutput,
    pub service_install_output: Option<ShellOutput>,
    pub notes: Vec<String>,
}

pub async fn install_openclaw() -> Result<InstallOpenClawData, AppError> {
    log_service::append_log_line(
        LogSource::Install,
        &format!(
            "[info] {} install_openclaw started",
            Utc::now().to_rfc3339()
        ),
    )?;

    let npm_program = openclaw::npm_program().to_string();
    let install_args = vec![
        "install".to_string(),
        "-g".to_string(),
        "openclaw@latest".to_string(),
    ];
    let install_output = run_command(&npm_program, &install_args, INSTALL_TIMEOUT_MS)
        .await
        .map_err(|error| {
            let message = error.message.clone();
            AppError::new(
                ErrorCode::ShellSpawnFailed,
                message,
                "Install Node.js and npm first, then retry the OpenClaw install flow.",
            )
            .with_details(json!({ "source_error": error }))
        })?;
    write_shell_output_to_install_log("npm install -g openclaw@latest", &install_output)?;

    if install_output.exit_code.unwrap_or(1) != 0 {
        return Err(AppError::new(
            ErrorCode::ShellSpawnFailed,
            "OpenClaw installation command returned a non-zero exit code.",
            "Check npm output, network access, and package manager permissions, then retry.",
        )
        .with_details(json!({
            "program": install_output.program,
            "args": install_output.args,
            "stdout": install_output.stdout,
            "stderr": install_output.stderr,
            "exit_code": install_output.exit_code,
        })));
    }

    let executable_path = env_service::ensure_openclaw_available().await?;
    let gateway_args = vec![
        "gateway".to_string(),
        "install".to_string(),
        "--json".to_string(),
    ];
    let service_install_output =
        run_command(&executable_path, &gateway_args, GATEWAY_INSTALL_TIMEOUT_MS)
            .await
            .ok();

    if let Some(output) = service_install_output.as_ref() {
        write_shell_output_to_install_log("openclaw gateway install --json", output)?;
    }

    let gateway_service_installed = service_install_output
        .as_ref()
        .and_then(|output| output.exit_code)
        .unwrap_or(1)
        == 0;

    let mut notes = Vec::new();
    if !gateway_service_installed {
        notes.push(
            "CLI has been installed, but the managed Gateway service could not be installed automatically."
                .to_string(),
        );
        notes.push(
            "You can still continue in Config / Service pages to finish setup and inspect logs."
                .to_string(),
        );
    }

    log_service::append_log_line(
        LogSource::Install,
        &format!(
            "[info] {} install_openclaw completed cliInstalled=true gatewayServiceInstalled={}",
            Utc::now().to_rfc3339(),
            gateway_service_installed
        ),
    )?;

    Ok(InstallOpenClawData {
        cli_installed: true,
        gateway_service_installed,
        executable_path: Some(executable_path),
        config_path: platform::default_openclaw_config_path()
            .to_string_lossy()
            .to_string(),
        install_output,
        service_install_output,
        notes,
    })
}

fn write_shell_output_to_install_log(step: &str, output: &ShellOutput) -> Result<(), AppError> {
    log_service::append_log_line(
        LogSource::Install,
        &format!(
            "[info] step={} exitCode={:?} durationMs={}",
            step, output.exit_code, output.duration_ms
        ),
    )?;

    for line in output.stdout.lines() {
        log_service::append_log_line(LogSource::Install, &format!("[stdout] {line}"))?;
    }

    for line in output.stderr.lines() {
        log_service::append_log_line(LogSource::Install, &format!("[stderr] {line}"))?;
    }

    Ok(())
}
