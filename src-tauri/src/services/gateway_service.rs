use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::adapters::platform;
use crate::adapters::shell::{run_command, ShellOutput};
use crate::models::error::{AppError, ErrorCode};
use crate::services::env_service;
use crate::services::log_service::{self, LogSource};

const GATEWAY_TIMEOUT_MS: u64 = 30_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatusData {
    pub state: String,
    pub running: bool,
    pub port: u16,
    pub address: String,
    pub pid: Option<u32>,
    pub last_started_at: Option<DateTime<Utc>>,
    pub status_detail: String,
    pub suggestion: String,
    pub port_conflict_port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayActionData {
    pub detail: String,
    pub address: Option<String>,
    pub pid: Option<u32>,
}

pub async fn get_gateway_status() -> Result<GatewayStatusData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "gateway".to_string(),
        "status".to_string(),
        "--json".to_string(),
    ];
    let output = run_command(&program, &args, GATEWAY_TIMEOUT_MS).await?;
    log_shell_output(
        LogSource::Startup,
        "openclaw gateway status --json",
        &output,
    )?;

    if output.exit_code.unwrap_or(1) != 0 {
        return map_gateway_error(
            ErrorCode::GatewayStartFailed,
            "Failed to query OpenClaw Gateway status.",
            "Check whether the Gateway service is installed correctly, then retry.",
            &output,
        );
    }

    Ok(parse_gateway_status_output(&output))
}

pub async fn start_gateway() -> Result<GatewayActionData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "gateway".to_string(),
        "start".to_string(),
        "--json".to_string(),
    ];
    let output = run_command(&program, &args, GATEWAY_TIMEOUT_MS).await?;
    log_shell_output(LogSource::Startup, "openclaw gateway start --json", &output)?;

    if output.exit_code.unwrap_or(1) != 0 {
        return map_gateway_error(
            detect_error_code_from_output(&output),
            "OpenClaw Gateway failed to start.",
            "Check startup logs, configuration, and port usage, then retry.",
            &output,
        );
    }

    let status = parse_gateway_status_output(&output);
    Ok(GatewayActionData {
        detail: "Gateway start command completed.".to_string(),
        address: Some(status.address),
        pid: status.pid,
    })
}

pub async fn stop_gateway() -> Result<GatewayActionData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "gateway".to_string(),
        "stop".to_string(),
        "--json".to_string(),
    ];
    let output = run_command(&program, &args, GATEWAY_TIMEOUT_MS).await?;
    log_shell_output(LogSource::Startup, "openclaw gateway stop --json", &output)?;

    if output.exit_code.unwrap_or(1) != 0 {
        return map_gateway_error(
            ErrorCode::GatewayStopFailed,
            "OpenClaw Gateway failed to stop.",
            "Check whether the Gateway is already stopped or managed externally, then retry.",
            &output,
        );
    }

    Ok(GatewayActionData {
        detail: "Gateway stopped successfully.".to_string(),
        address: Some(gateway_address(resolve_gateway_port(None))),
        pid: None,
    })
}

pub async fn restart_gateway() -> Result<GatewayActionData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "gateway".to_string(),
        "restart".to_string(),
        "--json".to_string(),
    ];
    let output = run_command(&program, &args, GATEWAY_TIMEOUT_MS).await?;
    log_shell_output(
        LogSource::Startup,
        "openclaw gateway restart --json",
        &output,
    )?;

    if output.exit_code.unwrap_or(1) != 0 {
        return map_gateway_error(
            detect_error_code_from_output(&output),
            "OpenClaw Gateway failed to restart.",
            "Check startup logs, configuration, and port usage, then retry.",
            &output,
        );
    }

    let status = parse_gateway_status_output(&output);
    Ok(GatewayActionData {
        detail: "Gateway restarted successfully.".to_string(),
        address: Some(status.address),
        pid: status.pid,
    })
}

pub async fn open_dashboard() -> Result<GatewayActionData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let status = get_gateway_status().await?;
    if !status.running {
        return Err(AppError::new(
            ErrorCode::GatewayNotRunning,
            "Gateway is not running, so the dashboard cannot be opened yet.",
            "Start the gateway first, wait for the running state, then open the dashboard.",
        )
        .with_details(json!({
            "port": status.port,
            "address": status.address,
        })));
    }

    let args = vec!["dashboard".to_string()];
    let output = run_command(&program, &args, 15_000).await?;
    log_shell_output(LogSource::Startup, "openclaw dashboard", &output)?;

    if output.exit_code.unwrap_or(1) != 0 {
        return map_gateway_error(
            ErrorCode::DashboardOpenFailed,
            "OpenClaw failed to open the local dashboard.",
            "Check whether the local dashboard is available and whether the system browser can be launched.",
            &output,
        );
    }

    Ok(GatewayActionData {
        detail: "Dashboard opened successfully.".to_string(),
        address: Some(status.address),
        pid: status.pid,
    })
}

fn parse_gateway_status_output(output: &ShellOutput) -> GatewayStatusData {
    let parsed = serde_json::from_str::<Value>(&output.stdout).ok();
    let port = resolve_gateway_port(parsed.as_ref());
    let address = extract_string(parsed.as_ref(), &["address", "url", "dashboardUrl"])
        .unwrap_or_else(|| gateway_address(port));
    let running = extract_bool(parsed.as_ref(), &["running", "isRunning", "active"])
        .unwrap_or_else(|| output.stdout.to_lowercase().contains("\"running\":true"));
    let pid = extract_u64(parsed.as_ref(), &["pid", "processId"])
        .and_then(|value| u32::try_from(value).ok());
    let last_started_at = extract_datetime(
        parsed.as_ref(),
        &["lastStartedAt", "startedAt", "updatedAt"],
    );
    let status_detail = extract_string(parsed.as_ref(), &["statusDetail", "message", "detail"])
        .unwrap_or_else(|| {
            if running {
                "Gateway is running.".to_string()
            } else {
                "Gateway is not running.".to_string()
            }
        });
    let suggestion = extract_string(parsed.as_ref(), &["suggestion"]).unwrap_or_else(|| {
        if running {
            "You can open dashboard or restart service if needed.".to_string()
        } else {
            "Click Start Gateway to launch OpenClaw service.".to_string()
        }
    });
    let state = extract_string(parsed.as_ref(), &["state", "status"]).unwrap_or_else(|| {
        if running {
            "running".to_string()
        } else {
            "stopped".to_string()
        }
    });
    let port_conflict_port = extract_u64(parsed.as_ref(), &["portConflictPort", "conflictPort"])
        .and_then(|value| u16::try_from(value).ok());

    GatewayStatusData {
        state,
        running,
        port,
        address,
        pid,
        last_started_at,
        status_detail,
        suggestion,
        port_conflict_port,
    }
}

fn resolve_gateway_port(parsed: Option<&Value>) -> u16 {
    extract_u64(parsed, &["port", "gatewayPort"])
        .and_then(|value| u16::try_from(value).ok())
        .unwrap_or_else(platform::default_gateway_port)
}

fn gateway_address(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

fn extract_string(parsed: Option<&Value>, keys: &[&str]) -> Option<String> {
    let value = parsed?;
    for key in keys {
        if let Some(found) = find_key_recursive(value, key) {
            if let Some(text) = found.as_str() {
                if !text.trim().is_empty() {
                    return Some(text.to_string());
                }
            }
        }
    }
    None
}

fn extract_bool(parsed: Option<&Value>, keys: &[&str]) -> Option<bool> {
    let value = parsed?;
    for key in keys {
        if let Some(found) = find_key_recursive(value, key) {
            if let Some(boolean) = found.as_bool() {
                return Some(boolean);
            }
            if let Some(text) = found.as_str() {
                match text.trim().to_ascii_lowercase().as_str() {
                    "true" | "running" | "active" => return Some(true),
                    "false" | "stopped" | "inactive" => return Some(false),
                    _ => {}
                }
            }
        }
    }
    None
}

fn extract_u64(parsed: Option<&Value>, keys: &[&str]) -> Option<u64> {
    let value = parsed?;
    for key in keys {
        if let Some(found) = find_key_recursive(value, key) {
            match found {
                Value::Number(number) => {
                    if let Some(value) = number.as_u64() {
                        return Some(value);
                    }
                }
                Value::String(text) => {
                    if let Ok(value) = text.parse::<u64>() {
                        return Some(value);
                    }
                }
                _ => {}
            }
        }
    }
    None
}

fn extract_datetime(parsed: Option<&Value>, keys: &[&str]) -> Option<DateTime<Utc>> {
    let value = parsed?;
    for key in keys {
        if let Some(found) = find_key_recursive(value, key) {
            if let Some(text) = found.as_str() {
                if let Ok(dt) = DateTime::parse_from_rfc3339(text) {
                    return Some(dt.with_timezone(&Utc));
                }
            }
        }
    }
    None
}

fn find_key_recursive<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            if let Some(found) = map.get(key) {
                return Some(found);
            }

            for nested in map.values() {
                if let Some(found) = find_key_recursive(nested, key) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(|item| find_key_recursive(item, key)),
        _ => None,
    }
}

fn detect_error_code_from_output(output: &ShellOutput) -> ErrorCode {
    let haystack = format!("{}\n{}", output.stdout, output.stderr).to_ascii_lowercase();
    if haystack.contains("address already in use")
        || haystack.contains("eaddrinuse")
        || haystack.contains("port conflict")
    {
        return ErrorCode::PortConflict;
    }

    ErrorCode::GatewayStartFailed
}

fn map_gateway_error<T>(
    code: ErrorCode,
    message: &str,
    suggestion: &str,
    output: &ShellOutput,
) -> Result<T, AppError> {
    Err(
        AppError::new(code, message, suggestion).with_details(json!({
            "program": output.program,
            "args": output.args,
            "stdout": output.stdout,
            "stderr": output.stderr,
            "exit_code": output.exit_code,
        })),
    )
}

fn log_shell_output(source: LogSource, step: &str, output: &ShellOutput) -> Result<(), AppError> {
    log_service::append_log_line(
        source.clone(),
        &format!(
            "[info] step={} exitCode={:?} durationMs={}",
            step, output.exit_code, output.duration_ms
        ),
    )?;

    for line in output.stdout.lines() {
        log_service::append_log_line(source.clone(), &format!("[stdout] {line}"))?;
    }

    for line in output.stderr.lines() {
        log_service::append_log_line(source.clone(), &format!("[stderr] {line}"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shell_output(stdout: &str, stderr: &str) -> ShellOutput {
        ShellOutput {
            program: "openclaw".to_string(),
            args: vec![
                "gateway".to_string(),
                "status".to_string(),
                "--json".to_string(),
            ],
            stdout: stdout.to_string(),
            stderr: stderr.to_string(),
            exit_code: Some(0),
            duration_ms: 250,
        }
    }

    #[test]
    fn parses_nested_gateway_status_payload() {
        let output = shell_output(
            r#"{
              "gateway": {
                "active": true,
                "gatewayPort": "4317",
                "dashboardUrl": "http://127.0.0.1:4317",
                "processId": 9981,
                "startedAt": "2026-03-16T10:00:00Z",
                "message": "Gateway ready"
              }
            }"#,
            "",
        );

        let status = parse_gateway_status_output(&output);

        assert!(status.running);
        assert_eq!(status.port, 4317);
        assert_eq!(status.address, "http://127.0.0.1:4317");
        assert_eq!(status.pid, Some(9981));
        assert_eq!(status.status_detail, "Gateway ready");
    }

    #[test]
    fn parses_stopped_gateway_payload_with_string_state() {
        let output = shell_output(
            r#"{
              "service": {
                "status": "inactive",
                "port": "3000",
                "detail": "Gateway is stopped"
              }
            }"#,
            "",
        );

        let status = parse_gateway_status_output(&output);

        assert!(!status.running);
        assert_eq!(status.state, "inactive");
        assert_eq!(status.port, 3000);
        assert_eq!(status.status_detail, "Gateway is stopped");
    }

    #[test]
    fn detects_port_conflict_from_cli_output() {
        let output = shell_output(
            "",
            "Error: listen EADDRINUSE: address already in use 127.0.0.1:3000",
        );

        assert!(matches!(
            detect_error_code_from_output(&output),
            ErrorCode::PortConflict
        ));
    }
}
