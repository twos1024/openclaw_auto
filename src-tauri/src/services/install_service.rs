use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::adapters::platform;
use crate::adapters::shell::{self, run_command, ShellOutput};
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
        "Installing OpenClaw CLI via the official installer script.",
    );

    let (install_program, install_args, install_step) = build_official_install_command();
    let install_output = match run_command(&install_program, &install_args, INSTALL_TIMEOUT_MS).await {
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
    env_service::invalidate_detect_env_cache().await;

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

fn build_official_install_command() -> (String, Vec<String>, &'static str) {
    // ClawDesk is a GUI app; the install path must be non-interactive. We skip OpenClaw
    // onboarding here because ClawDesk configures the gateway separately.
    let no_onboard = std::env::var("OPENCLAW_NO_ONBOARD")
        .ok()
        .map(|v| v.trim() != "0")
        .unwrap_or(true);

    let version = std::env::var("OPENCLAW_VERSION")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "latest".to_string());

    if cfg!(windows) {
        let method = std::env::var("OPENCLAW_INSTALL_METHOD")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "npm".to_string());
        let mut flags = Vec::new();
        flags.push(format!("-Tag {}", sanitize_ps_arg(&version)));
        flags.push(format!("-InstallMethod {}", sanitize_ps_arg(&method)));
        if no_onboard {
            flags.push("-NoOnboard".to_string());
        }
        let command = format!(
            "& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) {}",
            flags.join(" ")
        );
        return (
            "powershell".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-Command".to_string(),
                command,
            ],
            "powershell install.ps1",
        );
    }

    // macOS/Linux/WSL: use the official local-prefix installer (no root required).
    // This avoids relying on system Node/npm and produces a deterministic wrapper at <prefix>/bin/openclaw.
    let mut args = vec![
        "--version".to_string(),
        version,
        "--json".to_string(),
    ];
    if no_onboard {
        args.insert(0, "--no-onboard".to_string());
    } else {
        args.push("--onboard".to_string());
    }

    let arg_str = args
        .into_iter()
        .map(|a| shell_quote_bash(&a))
        .collect::<Vec<_>>()
        .join(" ");
    let command = format!(
        "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash -s -- {}",
        arg_str
    );

    (
        "bash".to_string(),
        vec!["-lc".to_string(), command],
        "bash install-cli.sh",
    )
}

fn sanitize_ps_arg(value: &str) -> String {
    // Only allow a conservative set to avoid accidental PowerShell injection.
    // Expected values: latest/main/beta/semver, npm/git.
    let trimmed = value.trim();
    let mut out = String::new();
    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
            out.push(ch);
        }
    }
    if out.is_empty() {
        "latest".to_string()
    } else {
        out
    }
}

fn shell_quote_bash(value: &str) -> String {
    // Single-quote safe bash literal.
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

/// Result returned by the visible-terminal install path.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInstallData {
    pub launched: bool,
    pub message: String,
}

/// Opens a new, persistent terminal window that runs the official OpenClaw
/// installer script with full live output visible to the user.
/// Returns immediately after the window is opened — the install itself runs
/// asynchronously inside the terminal.
///
/// Use this when the user wants to watch real-time install progress rather than
/// relying solely on the background install log viewer.
pub async fn install_openclaw_with_terminal() -> Result<TerminalInstallData, AppError> {
    append_install_log_line(
        LogSource::Install,
        &format!(
            "[info] {} install_openclaw_with_terminal started",
            Utc::now().to_rfc3339()
        ),
    );

    let (install_program, install_args, _install_step) = build_official_install_command();
    shell::run_in_visible_terminal(&install_program, &install_args, "OpenClaw Installer").await?;

    append_install_log_line(
        LogSource::Install,
        "[info] install terminal window launched successfully",
    );

    Ok(TerminalInstallData {
        launched: true,
        message:
            "Installation terminal opened. Check the terminal window for live progress and results."
                .to_string(),
    })
}

fn serialize_error_code(code: &crate::models::error::ErrorCode) -> String {
    serde_json::to_string(code)
        .unwrap_or_else(|_| "\"E_INTERNAL\"".to_string())
        .trim_matches('"')
        .to_string()
}
