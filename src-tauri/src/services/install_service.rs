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
    append_install_log_line(
        LogSource::Install,
        &format!(
            "[info] {} install_openclaw started",
            Utc::now().to_rfc3339()
        ),
    );
    write_phase_event_to_install_log(
        "install-cli",
        "running",
        "Installing OpenClaw CLI via npm global install.",
    );

    let npm_program = openclaw::npm_program().to_string();
    let install_args = vec![
        "install".to_string(),
        "-g".to_string(),
        "openclaw@latest".to_string(),
    ];
    let install_step = "npm install -g openclaw@latest";
    let install_output = match run_command(&npm_program, &install_args, INSTALL_TIMEOUT_MS).await {
        Ok(output) => output,
        Err(error) => {
            write_install_error_to_log(install_step, &error);
            write_phase_event_to_install_log(
                "install-cli",
                "failure",
                "OpenClaw CLI install command could not be started successfully.",
            );
            return Err(install_error_from_error(
                "install-cli",
                install_step,
                &error,
            ));
        }
    };
    write_shell_output_to_install_log(install_step, &install_output);

    if install_output.exit_code.unwrap_or(1) != 0 {
        write_phase_event_to_install_log(
            "install-cli",
            "failure",
            "OpenClaw CLI install command returned a non-zero exit code.",
        );
        return Err(install_error_from_output(
            "install-cli",
            install_step,
            &install_output,
        ));
    }
    write_phase_event_to_install_log("install-cli", "success", "OpenClaw CLI install finished.");

    let executable_path = env_service::ensure_openclaw_available()
        .await
        .map_err(|error| {
            write_install_error_to_log("resolve openclaw executable path", &error);
            write_phase_event_to_install_log(
                "verify",
                "failure",
                "OpenClaw executable path could not be resolved after installation.",
            );
            install_error_from_error("verify", "resolve openclaw executable path", &error)
        })?;
    write_phase_event_to_install_log(
        "install-gateway",
        "running",
        "Installing Gateway managed service.",
    );
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
            write_shell_output_to_install_log(gateway_step, &output);
            if output.exit_code.unwrap_or(1) == 0 {
                write_phase_event_to_install_log(
                    "install-gateway",
                    "success",
                    "Gateway managed install finished.",
                );
                (Some(output), None)
            } else {
                write_phase_event_to_install_log(
                    "install-gateway",
                    "failure",
                    "Gateway managed install returned a non-zero exit code.",
                );
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
            write_install_error_to_log(gateway_step, &error);
            write_phase_event_to_install_log(
                "install-gateway",
                "failure",
                "Gateway managed install command failed before completion.",
            );
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
    } else {
        write_phase_event_to_install_log("verify", "running", "Validating final install result.");
    }

    append_install_log_line(
        LogSource::Install,
        &format!(
            "[info] {} install_openclaw completed cliInstalled=true gatewayServiceInstalled={}",
            Utc::now().to_rfc3339(),
            gateway_service_installed
        ),
    );
    if gateway_service_installed {
        write_phase_event_to_install_log("verify", "success", "Install flow completed.");
    }

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

fn write_shell_output_to_install_log(step: &str, output: &ShellOutput) {
    append_install_log_line(
        LogSource::Install,
        &format!(
            "[info] step={} exitCode={:?} durationMs={}",
            step, output.exit_code, output.duration_ms
        ),
    );

    for line in output.stdout.lines() {
        append_install_log_line(LogSource::Install, &format!("[stdout] {line}"));
    }

    for line in output.stderr.lines() {
        append_install_log_line(LogSource::Install, &format!("[stderr] {line}"));
    }
}

fn write_install_error_to_log(step: &str, error: &AppError) {
    append_install_log_line(
        LogSource::Install,
        &format!(
            "[error] step={} code={} message={}",
            step,
            serialize_error_code(&error.code),
            error.message
        ),
    );

    if let Some(details) = error.details.as_ref() {
        append_install_log_line(LogSource::Install, &format!("[error-details] {}", details));
    }
}

fn write_phase_event_to_install_log(stage: &str, state: &str, detail: &str) {
    append_install_log_line(
        LogSource::Install,
        &format!("[phase] stage={} state={} detail={}", stage, state, detail),
    )
}

fn append_install_log_line(source: LogSource, line: &str) {
    if let Err(error) = log_service::append_log_line(source, line) {
        eprintln!("install log append failed: {}", error.message);
    }
}

fn serialize_error_code(code: &crate::models::error::ErrorCode) -> String {
    serde_json::to_string(code)
        .unwrap_or_else(|_| "\"E_INTERNAL\"".to_string())
        .trim_matches('"')
        .to_string()
}
