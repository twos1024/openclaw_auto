use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::adapters::openclaw;
use crate::adapters::platform;
use crate::adapters::shell::{run_command, ShellOutput};
use crate::models::error::AppError;
use crate::services::env_service;
use crate::services::install_issue::{
    classify_install_error, classify_install_output, install_error_from_error,
    install_error_from_output, InstallIssue,
};
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
    pub gateway_install_issue: Option<InstallIssue>,
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
    let install_step = "npm install -g openclaw@latest";
    let install_output = run_command(&npm_program, &install_args, INSTALL_TIMEOUT_MS)
        .await
        .map_err(|error| install_error_from_error("install-cli", install_step, &error))?;
    write_shell_output_to_install_log(install_step, &install_output)?;

    if install_output.exit_code.unwrap_or(1) != 0 {
        return Err(install_error_from_output(
            "install-cli",
            install_step,
            &install_output,
        ));
    }

    let executable_path = env_service::ensure_openclaw_available()
        .await
        .map_err(|error| {
            install_error_from_error("verify", "resolve openclaw executable path", &error)
        })?;
    let gateway_args = vec![
        "gateway".to_string(),
        "install".to_string(),
        "--json".to_string(),
    ];
    let gateway_step = "openclaw gateway install --json";
    let gateway_command =
        run_command(&executable_path, &gateway_args, GATEWAY_INSTALL_TIMEOUT_MS).await;
    let (service_install_output, gateway_install_issue) = match gateway_command {
        Ok(output) => {
            write_shell_output_to_install_log(gateway_step, &output)?;
            if output.exit_code.unwrap_or(1) == 0 {
                (Some(output), None)
            } else {
                (
                    Some(output.clone()),
                    Some(classify_install_output(
                        "install-gateway",
                        gateway_step,
                        &output,
                    )),
                )
            }
        }
        Err(error) => {
            write_install_error_to_log(gateway_step, &error)?;
            (
                None,
                Some(classify_install_error(
                    "install-gateway",
                    gateway_step,
                    &error,
                )),
            )
        }
    };

    let gateway_service_installed = gateway_install_issue.is_none();
    let mut notes = Vec::new();
    if let Some(issue) = gateway_install_issue.as_ref() {
        notes.push(issue.message.clone());
        notes.push(issue.suggestion.clone());
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
        gateway_install_issue,
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

fn write_install_error_to_log(step: &str, error: &AppError) -> Result<(), AppError> {
    log_service::append_log_line(
        LogSource::Install,
        &format!(
            "[error] step={} code={} message={}",
            step,
            serialize_error_code(&error.code),
            error.message
        ),
    )?;

    if let Some(details) = error.details.as_ref() {
        log_service::append_log_line(LogSource::Install, &format!("[error-details] {}", details))?;
    }

    Ok(())
}

fn serialize_error_code(code: &crate::models::error::ErrorCode) -> String {
    serde_json::to_string(code)
        .unwrap_or_else(|_| "\"E_INTERNAL\"".to_string())
        .trim_matches('"')
        .to_string()
}
