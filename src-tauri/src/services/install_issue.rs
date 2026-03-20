use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::adapters::shell::ShellOutput;
use crate::models::error::{AppError, ErrorCode};

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

pub fn install_error_from_error(stage: &str, step: &str, error: &AppError) -> AppError {
    let issue = classify_install_error(stage, step, error);
    issue_to_app_error(&issue, Some(error), None)
}

pub fn install_error_from_output(stage: &str, step: &str, output: &ShellOutput) -> AppError {
    let issue = classify_install_output(stage, step, output);
    issue_to_app_error(&issue, None, Some(output))
}

pub fn classify_install_error(stage: &str, step: &str, error: &AppError) -> InstallIssue {
    let haystack = collect_error_haystack(error);

    if looks_like_npm_git_error(&haystack) {
        return build_install_issue(
            stage,
            "npm-git-error",
            ErrorCode::InstallCommandFailed,
            "npm exited with code 128 — a git operation failed during package install.",
            "Check: (1) run `git --version` to confirm git is installed and on PATH, \
             (2) run `npm cache clean --force` to clear stale git clone directories, \
             (3) run `git config --global url.\"https://\".insteadOf git://` to force HTTPS \
             if the git:// port (9418) is blocked on your network.",
            step,
            None,
            find_sample(&haystack),
        );
    }

    if looks_like_missing_installer_prereq(&haystack) {
        return build_install_issue(
            "prerequisite",
            "missing-installer-prerequisite",
            ErrorCode::PathNotFound,
            "OpenClaw install prerequisites are missing.",
            "Ensure PowerShell (Windows) or bash/curl (macOS/Linux) are available, then retry.",
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
            "OpenClaw install failed while downloading required components.",
            "Check network access, DNS/proxy/TLS settings, then retry.",
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
            "Check PATH configuration, the OpenClaw install prefix, and whether the binary was installed successfully.",
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
            "Check whether downloads are blocked by the network or a stalled process, then retry.",
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

pub fn classify_install_output(stage: &str, step: &str, output: &ShellOutput) -> InstallIssue {
    let haystack = format!("{}\n{}", output.stderr, output.stdout).to_ascii_lowercase();
    let sample = first_meaningful_line(&output.stderr)
        .or_else(|| first_meaningful_line(&output.stdout))
        .map(|line| truncate_sample(&line));

    if looks_like_npm_git_error(&haystack) {
        return build_install_issue(
            stage,
            "npm-git-error",
            ErrorCode::InstallCommandFailed,
            "npm exited with code 128 — a git operation failed during package install.",
            "Check: (1) run `git --version` to confirm git is installed and on PATH, \
             (2) run `npm cache clean --force` to clear stale git clone directories, \
             (3) run `git config --global url.\"https://\".insteadOf git://` to force HTTPS \
             if the git:// port (9418) is blocked on your network.",
            step,
            output.exit_code,
            sample,
        );
    }

    if looks_like_permission_denied(&haystack) {
        return build_install_issue(
            stage,
            "permission-denied",
            ErrorCode::PermissionDenied,
            if stage == "install-gateway" {
                "Gateway managed install could not write the local service registration."
            } else {
                "OpenClaw installer could not write to the destination directory."
            },
            if stage == "install-gateway" {
                "Run with elevated privileges or use a service directory that ClawDesk can write to."
            } else {
                "Run the install with elevated privileges or change the install prefix to a writable location."
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
            "OpenClaw install failed while downloading required components.",
            "Check network connectivity, proxy/TLS settings, and retry the install.",
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
        "Check installer output, network access, and permissions, then retry.",
        step,
        output.exit_code,
        sample,
    )
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

fn looks_like_missing_installer_prereq(haystack: &str) -> bool {
    haystack.contains("failed to spawn command: powershell")
        || haystack.contains("spawn powershell enoent")
        || haystack.contains("failed to spawn command: bash")
        || haystack.contains("spawn bash enoent")
        || haystack.contains("curl: command not found")
        || haystack.contains("curl: not found")
        || haystack.contains("iwr : the term")
        || haystack.contains("node: command not found")
        || haystack.contains("npm: command not found")
        || haystack.contains("nodejs not found")
}

fn looks_like_permission_denied(haystack: &str) -> bool {
    haystack.contains("permission denied")
        || haystack.contains("access is denied")
        || haystack.contains("operation not permitted")
        || haystack.contains("eacces")
        || haystack.contains("eperm")
}

fn looks_like_npm_git_error(haystack: &str) -> bool {
    // npm propagates git's exit code 128 verbatim when a git operation fails
    // during install (e.g. git not on PATH, git:// protocol blocked, stale cache).
    // PowerShell wraps the resulting stderr as NativeCommandError.
    haystack.contains("npm error code 128")
        || haystack.contains("an unknown git error occurred")
        || (haystack.contains("nativecommanderror") && haystack.contains("128"))
}

fn looks_like_network_failure(haystack: &str) -> bool {
    haystack.contains("openclaw.ai")
        || haystack.contains("nodejs.org")
        || haystack.contains("github.com")
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
            program: "powershell".to_string(),
            args: vec!["-Command".to_string(), "install.ps1".to_string()],
            stdout: stdout.to_string(),
            stderr: stderr.to_string(),
            exit_code,
            duration_ms: 1200,
        }
    }

    #[test]
    fn classifies_missing_installer_prereq_issue() {
        let error = AppError::new(
            ErrorCode::ShellSpawnFailed,
            "Failed to spawn command: powershell",
            "Check whether the binary exists and is executable.",
        )
        .with_details(json!({
            "program": "powershell",
            "os_error": "spawn powershell ENOENT",
        }));

        let issue = classify_install_error("prerequisite", "powershell install.ps1", &error);

        assert_eq!(issue.stage, "prerequisite");
        assert_eq!(issue.failure_kind, "missing-installer-prerequisite");
        assert_eq!(issue.code, "E_PATH_NOT_FOUND");
    }

    #[test]
    fn classifies_permission_denied_install_output() {
        let output = shell_output("access is denied", "", Some(243));

        let issue = classify_install_output("install-cli", "powershell install.ps1", &output);

        assert_eq!(issue.failure_kind, "permission-denied");
        assert_eq!(issue.code, "E_PERMISSION_DENIED");
        assert_eq!(issue.exit_code, Some(243));
    }

    #[test]
    fn classifies_network_failure_install_output() {
        let output = shell_output("curl: (6) Could not resolve host: openclaw.ai", "", Some(1));

        let issue = classify_install_output("install-cli", "bash install-cli.sh", &output);

        assert_eq!(issue.failure_kind, "network-failure");
        assert_eq!(issue.code, "E_NETWORK_FAILED");
    }

    #[test]
    fn classifies_unknown_non_zero_install_output_as_install_command_failed() {
        let output = shell_output("something unexpected happened", "", Some(1));

        let issue = classify_install_output("install-cli", "powershell install.ps1", &output);

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
