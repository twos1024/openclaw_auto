use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
    pub gateway_install_issue: Option<InstallIssue>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallIssue {
    pub stage: String,
    pub failure_kind: String,
    pub code: String,
    pub message: String,
    pub suggestion: String,
    pub step: String,
    pub exit_code: Option<i32>,
    pub sample: Option<String>,
    #[serde(skip)]
    pub error_code: Option<ErrorCode>,
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

fn install_error_from_error(stage: &str, step: &str, error: &AppError) -> AppError {
    let issue = classify_install_error(stage, step, error);
    issue_to_app_error(&issue, Some(error), None)
}

fn install_error_from_output(stage: &str, step: &str, output: &ShellOutput) -> AppError {
    let issue = classify_install_output(stage, step, output);
    issue_to_app_error(&issue, None, Some(output))
}

fn issue_to_app_error(
    issue: &InstallIssue,
    source_error: Option<&AppError>,
    output: Option<&ShellOutput>,
) -> AppError {
    let mut details = json!({
        "stage": issue.stage,
        "failureKind": issue.failure_kind,
        "step": issue.step,
        "exitCode": issue.exit_code,
        "sample": issue.sample,
    });

    if let Some(output) = output {
        details["program"] = json!(output.program);
        details["args"] = json!(output.args);
        details["stdout"] = json!(output.stdout);
        details["stderr"] = json!(output.stderr);
    }

    if let Some(source_error) = source_error {
        details["sourceError"] = serde_json::to_value(source_error).unwrap_or_else(|_| json!({}));
    }

    AppError::new(
        issue.error_code.clone().unwrap_or(ErrorCode::InternalError),
        issue.message.clone(),
        issue.suggestion.clone(),
    )
    .with_details(details)
}

fn classify_install_error(stage: &str, step: &str, error: &AppError) -> InstallIssue {
    let haystack = collect_error_haystack(error);

    if looks_like_missing_npm(&haystack) {
        return build_install_issue(
            "prerequisite",
            "missing-npm",
            ErrorCode::PathNotFound,
            "OpenClaw install prerequisites are missing.",
            "Install Node.js and npm first, then refresh the environment and retry.",
            step,
            None,
            find_sample(&haystack),
        );
    }

    if looks_like_permission_denied(&haystack) {
        return build_install_issue(
            stage,
            "permission-denied",
            ErrorCode::PermissionDenied,
            "OpenClaw install could not access the required directory or command target.",
            "Run ClawDesk with elevated privileges, or change the target directory to a writable location.",
            step,
            None,
            find_sample(&haystack),
        );
    }

    if looks_like_network_failure(&haystack) {
        return build_install_issue(
            stage,
            "network-failure",
            ErrorCode::NetworkFailed,
            "OpenClaw install failed while downloading dependencies from npm.",
            "Check network access, npm registry settings, and proxy configuration, then retry.",
            step,
            None,
            find_sample(&haystack),
        );
    }

    if stage == "verify" && error.code == ErrorCode::PathNotFound {
        return build_install_issue(
            stage,
            "binary-not-found",
            ErrorCode::PathNotFound,
            "OpenClaw CLI appears installed, but its executable path could not be resolved.",
            "Check the npm global bin directory, PATH configuration, and whether the OpenClaw binary is available after install.",
            step,
            None,
            find_sample(&haystack),
        );
    }

    if error.code == ErrorCode::ShellTimeout || looks_like_timeout(&haystack) {
        return build_install_issue(
            stage,
            "command-timeout",
            ErrorCode::ShellTimeout,
            "The install command timed out before finishing.",
            "Check whether npm or OpenClaw is blocked by the network or a stalled process, then retry.",
            step,
            None,
            find_sample(&haystack),
        );
    }

    if stage == "install-gateway" {
        return build_install_issue(
            stage,
            "gateway-install-failed",
            ErrorCode::GatewayInstallFailed,
            "Gateway managed install did not complete successfully.",
            "Open the Service and Logs pages to inspect the managed install output and finish setup manually if needed.",
            step,
            None,
            find_sample(&haystack),
        );
    }

    build_install_issue(
        stage,
        "unknown",
        error.code.clone(),
        error.message.clone(),
        error.suggestion.clone(),
        step,
        None,
        find_sample(&haystack),
    )
}

fn classify_install_output(stage: &str, step: &str, output: &ShellOutput) -> InstallIssue {
    let haystack = format!("{}\n{}", output.stderr, output.stdout).to_ascii_lowercase();
    let sample = first_meaningful_line(&output.stderr)
        .or_else(|| first_meaningful_line(&output.stdout))
        .map(|line| truncate_sample(&line));

    if looks_like_permission_denied(&haystack) {
        return build_install_issue(
            stage,
            "permission-denied",
            ErrorCode::PermissionDenied,
            if stage == "install-gateway" {
                "Gateway managed install could not write the local service registration."
            } else {
                "OpenClaw CLI installation could not write to the global npm directory."
            },
            if stage == "install-gateway" {
                "Run with elevated privileges or use a service directory that ClawDesk can write to."
            } else {
                "Run the install with elevated privileges or change the npm global directory to a writable location."
            },
            step,
            output.exit_code,
            sample,
        );
    }

    if looks_like_network_failure(&haystack) {
        return build_install_issue(
            stage,
            "network-failure",
            ErrorCode::NetworkFailed,
            "OpenClaw install failed while downloading packages from npm.",
            "Check npm registry connectivity, proxy settings, and retry the install.",
            step,
            output.exit_code,
            sample,
        );
    }

    if looks_like_timeout(&haystack) {
        return build_install_issue(
            stage,
            "command-timeout",
            ErrorCode::ShellTimeout,
            "The install command did not finish before the timeout.",
            "Retry after checking network speed and any blocked child processes.",
            step,
            output.exit_code,
            sample,
        );
    }

    if stage == "install-gateway" {
        return build_install_issue(
            stage,
            "gateway-install-failed",
            ErrorCode::GatewayInstallFailed,
            "Gateway managed install could not register the local service.",
            "Open Service and Logs to inspect the managed install output and continue setup manually if needed.",
            step,
            output.exit_code,
            sample,
        );
    }

    build_install_issue(
        stage,
        "unknown",
        ErrorCode::InstallCommandFailed,
        "OpenClaw installation command returned a non-zero exit code.",
        "Check npm output, network access, and package manager permissions, then retry.",
        step,
        output.exit_code,
        sample,
    )
}

fn build_install_issue(
    stage: &str,
    failure_kind: &str,
    error_code: ErrorCode,
    message: impl Into<String>,
    suggestion: impl Into<String>,
    step: impl Into<String>,
    exit_code: Option<i32>,
    sample: Option<String>,
) -> InstallIssue {
    InstallIssue {
        stage: stage.to_string(),
        failure_kind: failure_kind.to_string(),
        code: serialize_error_code(&error_code),
        message: message.into(),
        suggestion: suggestion.into(),
        step: step.into(),
        exit_code,
        sample,
        error_code: Some(error_code),
    }
}

fn collect_error_haystack(error: &AppError) -> String {
    let mut parts = vec![
        error.message.to_ascii_lowercase(),
        error.suggestion.to_ascii_lowercase(),
    ];
    if let Some(details) = error.details.as_ref() {
        collect_json_strings(details, &mut parts);
    }
    parts.join("\n")
}

fn collect_json_strings(value: &Value, parts: &mut Vec<String>) {
    match value {
        Value::String(text) => parts.push(text.to_ascii_lowercase()),
        Value::Array(items) => {
            for item in items {
                collect_json_strings(item, parts);
            }
        }
        Value::Object(map) => {
            for value in map.values() {
                collect_json_strings(value, parts);
            }
        }
        _ => {}
    }
}

fn looks_like_missing_npm(haystack: &str) -> bool {
    haystack.contains("spawn npm enoent")
        || haystack.contains("failed to spawn command: npm")
        || haystack.contains("npm not found")
}

fn looks_like_permission_denied(haystack: &str) -> bool {
    haystack.contains("permission denied")
        || haystack.contains("access is denied")
        || haystack.contains("operation not permitted")
        || haystack.contains("eacces")
        || haystack.contains("eperm")
}

fn looks_like_network_failure(haystack: &str) -> bool {
    haystack.contains("registry.npmjs.org")
        || haystack.contains("enotfound")
        || haystack.contains("econnreset")
        || haystack.contains("socket hang up")
        || haystack.contains("network request failed")
        || haystack.contains("getaddrinfo")
        || haystack.contains("proxy")
        || haystack.contains("self signed certificate")
        || haystack.contains("certificate")
}

fn looks_like_timeout(haystack: &str) -> bool {
    haystack.contains("timed out")
        || haystack.contains("timeout")
        || haystack.contains("deadline exceeded")
}

fn find_sample(haystack: &str) -> Option<String> {
    first_meaningful_line(haystack).map(|line| truncate_sample(&line))
}

fn first_meaningful_line(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.to_string())
}

fn truncate_sample(sample: &str) -> String {
    const MAX_LEN: usize = 180;
    if sample.chars().count() <= MAX_LEN {
        return sample.to_string();
    }

    let mut truncated = sample.chars().take(MAX_LEN).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn serialize_error_code(code: &ErrorCode) -> String {
    serde_json::to_string(code)
        .unwrap_or_else(|_| "\"E_INTERNAL\"".to_string())
        .trim_matches('"')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shell_output(stderr: &str, stdout: &str, exit_code: Option<i32>) -> ShellOutput {
        ShellOutput {
            program: "npm".to_string(),
            args: vec![
                "install".to_string(),
                "-g".to_string(),
                "openclaw@latest".to_string(),
            ],
            stdout: stdout.to_string(),
            stderr: stderr.to_string(),
            exit_code,
            duration_ms: 1200,
        }
    }

    #[test]
    fn classifies_missing_npm_issue() {
        let error = AppError::new(
            ErrorCode::ShellSpawnFailed,
            "Failed to spawn command: npm",
            "Check whether the binary exists and is executable.",
        )
        .with_details(json!({
            "program": "npm",
            "os_error": "spawn npm ENOENT",
        }));

        let issue =
            classify_install_error("prerequisite", "npm install -g openclaw@latest", &error);

        assert_eq!(issue.stage, "prerequisite");
        assert_eq!(issue.failure_kind, "missing-npm");
        assert_eq!(issue.code, "E_PATH_NOT_FOUND");
    }

    #[test]
    fn classifies_permission_denied_install_output() {
        let output = shell_output("npm ERR! code EACCES\npermission denied", "", Some(243));

        let issue =
            classify_install_output("install-cli", "npm install -g openclaw@latest", &output);

        assert_eq!(issue.failure_kind, "permission-denied");
        assert_eq!(issue.code, "E_PERMISSION_DENIED");
        assert_eq!(issue.exit_code, Some(243));
    }

    #[test]
    fn classifies_network_failure_install_output() {
        let output = shell_output(
            "npm ERR! request to https://registry.npmjs.org/openclaw failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org",
            "",
            Some(1),
        );

        let issue =
            classify_install_output("install-cli", "npm install -g openclaw@latest", &output);

        assert_eq!(issue.failure_kind, "network-failure");
        assert_eq!(issue.code, "E_NETWORK_FAILED");
    }

    #[test]
    fn classifies_unknown_non_zero_install_output_as_install_command_failed() {
        let output = shell_output("npm ERR! something unexpected happened", "", Some(1));

        let issue =
            classify_install_output("install-cli", "npm install -g openclaw@latest", &output);

        assert_eq!(issue.failure_kind, "unknown");
        assert_eq!(issue.code, "E_INSTALL_COMMAND_FAILED");
    }

    #[test]
    fn classifies_post_install_binary_resolution_error_as_verify_stage() {
        let error = AppError::new(
            ErrorCode::PathNotFound,
            "Unable to resolve the OpenClaw executable after installation.",
            "Check the npm global bin directory.",
        )
        .with_details(json!({
            "program": "where",
            "stderr": "INFO: Could not find files for the given pattern(s).",
        }));

        let issue = classify_install_error("verify", "resolve openclaw executable path", &error);

        assert_eq!(issue.stage, "verify");
        assert_eq!(issue.failure_kind, "binary-not-found");
        assert_eq!(issue.code, "E_PATH_NOT_FOUND");
    }
}
