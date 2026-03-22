use chrono::{DateTime, Utc};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, Notify};
use tokio::time::sleep;

use crate::adapters::platform;
use crate::adapters::shell::{run_command, ShellOutput};
use crate::models::error::{AppError, ErrorCode};
use crate::services::config_service;
use crate::services::env_service;
use crate::services::log_service::{self, LogSource};

const GATEWAY_TIMEOUT_MS: u64 = 30_000;
const GATEWAY_STATUS_TIMEOUT_MS: u64 = 8_000;
const GATEWAY_STATUS_CACHE_TTL_MS: u64 = 5_000;
const DASHBOARD_PROBE_TIMEOUT_MS: u64 = 3_000;
const GATEWAY_START_VERIFY_TIMEOUT_MS: u64 = 15_000;
const GATEWAY_START_VERIFY_INTERVAL_MS: u64 = 1_000;

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
    pub service_loaded: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayActionData {
    pub detail: String,
    pub address: Option<String>,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardProbeData {
    pub address: String,
    pub reachable: bool,
    pub result: String,
    pub http_status: Option<u16>,
    pub response_time_ms: Option<u64>,
    pub detail: String,
}

fn build_http_probe_result(
    address: &str,
    status_code: u16,
    response_time_ms: u64,
) -> DashboardProbeData {
    let successful = (200..300).contains(&status_code);

    DashboardProbeData {
        address: address.to_string(),
        reachable: successful,
        result: if successful {
            "reachable".to_string()
        } else {
            "unreachable".to_string()
        },
        http_status: Some(status_code),
        response_time_ms: Some(response_time_ms),
        detail: if successful {
            "Dashboard endpoint responded successfully.".to_string()
        } else {
            format!("Dashboard endpoint returned HTTP {status_code}.")
        },
    }
}

#[derive(Debug, Clone)]
struct GatewayErrorContext {
    code: ErrorCode,
    conflict_port: Option<u16>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GatewayLogPolicy {
    Always,
    FailuresOnly,
}

#[derive(Debug, Clone)]
struct GatewayStatusCacheEntry {
    result: Result<GatewayStatusData, AppError>,
    cached_at: Instant,
}

#[derive(Debug)]
struct GatewayStatusCacheState {
    entry: Option<GatewayStatusCacheEntry>,
    in_flight: bool,
    notify: Arc<Notify>,
}

impl GatewayStatusCacheState {
    fn new() -> Self {
        Self {
            entry: None,
            in_flight: false,
            notify: Arc::new(Notify::new()),
        }
    }
}

static GATEWAY_STATUS_CACHE: OnceLock<Mutex<GatewayStatusCacheState>> = OnceLock::new();

fn gateway_status_cache() -> &'static Mutex<GatewayStatusCacheState> {
    GATEWAY_STATUS_CACHE.get_or_init(|| Mutex::new(GatewayStatusCacheState::new()))
}

fn is_status_cache_valid(entry: &GatewayStatusCacheEntry) -> bool {
    entry.cached_at.elapsed() < Duration::from_millis(GATEWAY_STATUS_CACHE_TTL_MS)
}

async fn set_gateway_status_cache(result: Result<GatewayStatusData, AppError>) {
    let mut state = gateway_status_cache().lock().await;
    state.entry = Some(GatewayStatusCacheEntry {
        result,
        cached_at: Instant::now(),
    });
}

async fn invalidate_gateway_status_cache() {
    let mut state = gateway_status_cache().lock().await;
    state.entry = None;
}

pub async fn get_gateway_status() -> Result<GatewayStatusData, AppError> {
    loop {
        let wait_for = {
            let mut state = gateway_status_cache().lock().await;

            if let Some(entry) = &state.entry {
                if is_status_cache_valid(entry) {
                    return entry.result.clone();
                }
            }

            if state.in_flight {
                Some(state.notify.clone())
            } else {
                state.in_flight = true;
                None
            }
        };

        if let Some(notify) = wait_for {
            notify.notified().await;
            continue;
        }

        let result = query_gateway_status_uncached().await;
        let notify = {
            let mut state = gateway_status_cache().lock().await;
            state.entry = Some(GatewayStatusCacheEntry {
                result: result.clone(),
                cached_at: Instant::now(),
            });
            state.in_flight = false;
            state.notify.clone()
        };
        notify.notify_waiters();
        return result;
    }
}

async fn query_gateway_status_uncached() -> Result<GatewayStatusData, AppError> {
    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "gateway".to_string(),
        "status".to_string(),
        "--json".to_string(),
    ];
    let output = run_command(&program, &args, GATEWAY_STATUS_TIMEOUT_MS).await?;
    log_shell_output_best_effort(
        GatewayLogPolicy::FailuresOnly,
        LogSource::Startup,
        "openclaw gateway status --json",
        &output,
    );

    if output.exit_code.unwrap_or(1) != 0 {
        let error_context = detect_gateway_error_context(&output, ErrorCode::GatewayStatusFailed);
        return map_gateway_error(
            error_context.code,
            "Failed to query OpenClaw Gateway status.",
            "Check whether the Gateway service is installed correctly, then retry.",
            error_context.conflict_port,
            &output,
        );
    }

    Ok(parse_gateway_status_output(&output))
}

pub async fn start_gateway() -> Result<GatewayActionData, AppError> {
    invalidate_gateway_status_cache().await;

    let program = env_service::ensure_openclaw_available().await?;
    let config_changes = config_service::ensure_local_gateway_defaults(None).await?;
    let mut repaired_service = ensure_gateway_service_loaded(&program).await?;
    let mut output = run_gateway_action_command(&program, "start").await?;
    log_shell_output_best_effort(
        GatewayLogPolicy::Always,
        LogSource::Startup,
        "openclaw gateway start --json",
        &output,
    );

    if output.exit_code.unwrap_or(1) != 0 {
        if !repaired_service && output_requires_gateway_service_installation(&output) {
            install_gateway_service(&program).await?;
            repaired_service = true;
            output = run_gateway_action_command(&program, "start").await?;
            log_shell_output_best_effort(
                GatewayLogPolicy::Always,
                LogSource::Startup,
                "openclaw gateway start --json",
                &output,
            );
        }
    }

    if output.exit_code.unwrap_or(1) != 0 {
        let error_context = detect_gateway_error_context(&output, ErrorCode::GatewayStartFailed);
        return map_gateway_error(
            error_context.code,
            "OpenClaw Gateway failed to start.",
            "Check startup logs, configuration, and port usage, then retry.",
            error_context.conflict_port,
            &output,
        );
    }

    let status = wait_for_gateway_running().await?;
    set_gateway_status_cache(Ok(status.clone())).await;
    Ok(GatewayActionData {
        detail: build_gateway_launch_detail("start", repaired_service, !config_changes.is_empty()),
        address: Some(status.address),
        pid: status.pid,
    })
}

pub async fn stop_gateway() -> Result<GatewayActionData, AppError> {
    invalidate_gateway_status_cache().await;

    let program = env_service::ensure_openclaw_available().await?;
    let args = vec![
        "gateway".to_string(),
        "stop".to_string(),
        "--json".to_string(),
    ];
    let output = run_command(&program, &args, GATEWAY_TIMEOUT_MS).await?;
    log_shell_output_best_effort(
        GatewayLogPolicy::Always,
        LogSource::Startup,
        "openclaw gateway stop --json",
        &output,
    );

    if output.exit_code.unwrap_or(1) != 0 {
        return map_gateway_error(
            ErrorCode::GatewayStopFailed,
            "OpenClaw Gateway failed to stop.",
            "Check whether the Gateway is already stopped or managed externally, then retry.",
            None,
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
    invalidate_gateway_status_cache().await;

    let program = env_service::ensure_openclaw_available().await?;
    let output = run_gateway_action_command(&program, "restart").await?;
    log_shell_output_best_effort(
        GatewayLogPolicy::Always,
        LogSource::Startup,
        "openclaw gateway restart --json",
        &output,
    );

    if output.exit_code.unwrap_or(1) != 0 {
        let error_context = detect_gateway_error_context(&output, ErrorCode::GatewayStartFailed);
        return map_gateway_error(
            error_context.code,
            "OpenClaw Gateway failed to restart.",
            "Check startup logs, configuration, and port usage, then retry.",
            error_context.conflict_port,
            &output,
        );
    }

    let status = wait_for_gateway_running().await?;
    set_gateway_status_cache(Ok(status.clone())).await;
    Ok(GatewayActionData {
        detail: build_gateway_launch_detail("restart", false, false),
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
    log_shell_output_best_effort(
        GatewayLogPolicy::Always,
        LogSource::Startup,
        "openclaw dashboard",
        &output,
    );

    if output.exit_code.unwrap_or(1) != 0 {
        return map_gateway_error(
            ErrorCode::DashboardOpenFailed,
            "OpenClaw failed to open the local dashboard.",
            "Check whether the local dashboard is available and whether the system browser can be launched.",
            None,
            &output,
        );
    }

    Ok(GatewayActionData {
        detail: "Dashboard opened successfully.".to_string(),
        address: Some(status.address),
        pid: status.pid,
    })
}

pub async fn probe_dashboard_endpoint(address: String) -> Result<DashboardProbeData, AppError> {
    let parsed = Url::parse(&address).map_err(|_| {
        AppError::new(
            ErrorCode::InvalidInput,
            "Dashboard address is invalid and cannot be probed.",
            "Refresh gateway status and retry the dashboard diagnostics probe.",
        )
        .with_details(json!({
            "address": address,
        }))
    })?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(DASHBOARD_PROBE_TIMEOUT_MS))
        .build()
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                "Failed to initialize the dashboard probe client.",
                "Retry the diagnostics action. If it keeps failing, inspect the desktop runtime logs.",
            )
            .with_details(json!({
                "address": parsed.to_string(),
                "sourceError": error.to_string(),
            }))
        })?;

    let started_at = Instant::now();
    match client.get(parsed.clone()).send().await {
        Ok(response) => Ok(build_http_probe_result(
            parsed.as_ref(),
            response.status().as_u16(),
            started_at.elapsed().as_millis() as u64,
        )),
        Err(error) if error.is_timeout() => Ok(DashboardProbeData {
            address: parsed.to_string(),
            reachable: false,
            result: "timeout".to_string(),
            http_status: None,
            response_time_ms: None,
            detail: format!(
                "Dashboard endpoint timed out after {}ms.",
                DASHBOARD_PROBE_TIMEOUT_MS
            ),
        }),
        Err(error) if error.is_connect() => Ok(DashboardProbeData {
            address: parsed.to_string(),
            reachable: false,
            result: "unreachable".to_string(),
            http_status: None,
            response_time_ms: None,
            detail: format!("Dashboard endpoint is not reachable: {}", error),
        }),
        Err(error) => Ok(DashboardProbeData {
            address: parsed.to_string(),
            reachable: false,
            result: "unreachable".to_string(),
            http_status: None,
            response_time_ms: None,
            detail: format!("Dashboard endpoint probe failed: {}", error),
        }),
    }
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
    let service_loaded = extract_bool(parsed.as_ref(), &["loaded", "serviceLoaded"]);
    let status_detail = extract_string(parsed.as_ref(), &["statusDetail", "message", "detail"])
        .unwrap_or_else(|| {
            if service_loaded == Some(false) {
                "Gateway managed service is not installed yet.".to_string()
            } else if running {
                "Gateway is running.".to_string()
            } else {
                "Gateway is not running.".to_string()
            }
        });
    let suggestion = extract_string(parsed.as_ref(), &["suggestion"]).unwrap_or_else(|| {
        if running {
            "You can open dashboard or restart service if needed.".to_string()
        } else if service_loaded == Some(false) {
            "Install or repair the local Gateway managed service, then start Gateway again."
                .to_string()
        } else {
            "Confirm the saved API configuration, then start the local Gateway.".to_string()
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
        service_loaded,
    }
}

async fn ensure_gateway_service_loaded(program: &str) -> Result<bool, AppError> {
    match query_gateway_status_uncached().await {
        Ok(status) if status.service_loaded == Some(false) => {
            install_gateway_service(program).await?;
            Ok(true)
        }
        Ok(_) => Ok(false),
        Err(_) => Ok(false),
    }
}

async fn install_gateway_service(program: &str) -> Result<(), AppError> {
    invalidate_gateway_status_cache().await;
    let output = run_gateway_action_command(program, "install").await?;
    log_shell_output_best_effort(
        GatewayLogPolicy::Always,
        LogSource::Startup,
        "openclaw gateway install --json",
        &output,
    );

    if output.exit_code.unwrap_or(1) != 0 {
        let error_context = detect_gateway_error_context(&output, ErrorCode::GatewayInstallFailed);
        return map_gateway_error(
            error_context.code,
            "OpenClaw Gateway managed service could not be installed.",
            "Check local service registration permissions, startup items, and logs, then retry.",
            error_context.conflict_port,
            &output,
        );
    }

    Ok(())
}

async fn wait_for_gateway_running() -> Result<GatewayStatusData, AppError> {
    let deadline = Instant::now() + Duration::from_millis(GATEWAY_START_VERIFY_TIMEOUT_MS);
    let mut last_status: Option<GatewayStatusData> = None;
    let mut last_error: Option<AppError> = None;

    loop {
        match query_gateway_status_uncached().await {
            Ok(status) => {
                if status.running {
                    return Ok(status);
                }
                last_status = Some(status);
            }
            Err(error) => {
                last_error = Some(error);
            }
        }

        if Instant::now() >= deadline {
            break;
        }

        sleep(Duration::from_millis(GATEWAY_START_VERIFY_INTERVAL_MS)).await;
    }

    if let Some(status) = last_status {
        return Err(AppError::new(
            ErrorCode::GatewayStartFailed,
            if status.status_detail.trim().is_empty() {
                "OpenClaw Gateway failed to start."
            } else {
                &status.status_detail
            },
            if status.suggestion.trim().is_empty() {
                "Check startup logs, configuration, and port usage, then retry."
            } else {
                &status.suggestion
            },
        )
        .with_details(json!({
            "port": status.port,
            "address": status.address,
            "pid": status.pid,
            "lastStartedAt": status.last_started_at,
            "statusDetail": status.status_detail,
            "serviceLoaded": status.service_loaded,
        })));
    }

    if let Some(error) = last_error {
        return Err(error);
    }

    Err(AppError::new(
        ErrorCode::GatewayStartFailed,
        "OpenClaw Gateway failed to start.",
        "Check startup logs, configuration, and port usage, then retry.",
    ))
}

async fn run_gateway_action_command(program: &str, action: &str) -> Result<ShellOutput, AppError> {
    let args = vec![
        "gateway".to_string(),
        action.to_string(),
        "--json".to_string(),
    ];
    run_command(program, &args, GATEWAY_TIMEOUT_MS).await
}

fn build_gateway_launch_detail(
    action: &str,
    repaired_service: bool,
    refreshed_config: bool,
) -> String {
    match (action, repaired_service, refreshed_config) {
        ("restart", true, true) => {
            "Gateway service was repaired, local defaults were refreshed, and the Gateway restarted successfully."
                .to_string()
        }
        ("restart", true, false) => {
            "Gateway service was repaired and the Gateway restarted successfully.".to_string()
        }
        ("restart", false, true) => {
            "Gateway restarted successfully after refreshing local Gateway defaults.".to_string()
        }
        ("restart", false, false) => "Gateway restarted successfully.".to_string(),
        ("start", true, true) => {
            "Gateway service was repaired, local defaults were refreshed, and the Gateway started successfully."
                .to_string()
        }
        ("start", true, false) => {
            "Gateway service was repaired and the Gateway started successfully.".to_string()
        }
        ("start", false, true) => {
            "Gateway started successfully after refreshing local Gateway defaults.".to_string()
        }
        _ => "Gateway started successfully.".to_string(),
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

fn detect_gateway_error_context(
    output: &ShellOutput,
    default_code: ErrorCode,
) -> GatewayErrorContext {
    let haystack = format!("{}\n{}", output.stdout, output.stderr).to_ascii_lowercase();
    if haystack.contains("address already in use")
        || haystack.contains("eaddrinuse")
        || haystack.contains("port conflict")
    {
        return GatewayErrorContext {
            code: ErrorCode::PortConflict,
            conflict_port: extract_port_conflict_port(&haystack),
        };
    }

    GatewayErrorContext {
        code: default_code,
        conflict_port: None,
    }
}

fn output_requires_gateway_service_installation(output: &ShellOutput) -> bool {
    let haystack = format!("{}\n{}", output.stdout, output.stderr).to_ascii_lowercase();
    haystack.contains("\"loaded\":false")
        || haystack.contains("service not installed")
        || haystack.contains("service is not installed")
        || haystack.contains("install the local gateway service")
        || haystack.contains("install-daemon")
}

fn extract_port_conflict_port(text: &str) -> Option<u16> {
    find_port_after_pattern(text, "port ").or_else(|| find_port_after_colon(text))
}

fn find_port_after_pattern(text: &str, pattern: &str) -> Option<u16> {
    let start = text.find(pattern)? + pattern.len();
    let digits = text[start..]
        .chars()
        .skip_while(|char| !char.is_ascii_digit())
        .take_while(|char| char.is_ascii_digit())
        .collect::<String>();

    digits.parse::<u16>().ok()
}

fn find_port_after_colon(text: &str) -> Option<u16> {
    let start = text.rfind(':')? + 1;
    let digits = text[start..]
        .chars()
        .take_while(|char| char.is_ascii_digit())
        .collect::<String>();

    digits.parse::<u16>().ok()
}

fn map_gateway_error<T>(
    code: ErrorCode,
    message: &str,
    suggestion: &str,
    conflict_port: Option<u16>,
    output: &ShellOutput,
) -> Result<T, AppError> {
    Err(
        AppError::new(code, message, suggestion).with_details(json!({
            "program": output.program,
            "args": output.args,
            "stdout": output.stdout,
            "stderr": output.stderr,
            "exit_code": output.exit_code,
            "portConflictPort": conflict_port,
            "port": conflict_port,
        })),
    )
}

fn should_persist_shell_output(policy: GatewayLogPolicy, output: &ShellOutput) -> bool {
    match policy {
        GatewayLogPolicy::Always => true,
        GatewayLogPolicy::FailuresOnly => output.exit_code.unwrap_or(1) != 0,
    }
}

fn log_shell_output_best_effort(
    policy: GatewayLogPolicy,
    source: LogSource,
    step: &str,
    output: &ShellOutput,
) {
    log_shell_output_best_effort_with(policy, source, step, output, log_shell_output);
}

fn log_shell_output_best_effort_with<F>(
    policy: GatewayLogPolicy,
    source: LogSource,
    step: &str,
    output: &ShellOutput,
    logger: F,
) where
    F: FnOnce(LogSource, &str, &ShellOutput) -> Result<(), AppError>,
{
    if !should_persist_shell_output(policy, output) {
        return;
    }

    if let Err(error) = logger(source, step, output) {
        eprintln!(
            "clawdesk gateway log write skipped: {} | {}",
            error.message, error.suggestion
        );
    }
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
    fn derives_service_install_hint_from_status_payload() {
        let output = shell_output(
            r#"{
              "service": {
                "loaded": false,
                "detail": "Gateway managed service is not installed yet."
              },
              "gateway": {
                "running": false,
                "port": 18789
              }
            }"#,
            "",
        );

        let status = parse_gateway_status_output(&output);

        assert_eq!(status.service_loaded, Some(false));
        assert_eq!(
            status.status_detail,
            "Gateway managed service is not installed yet."
        );
        assert!(status.suggestion.contains("Install or repair"));
    }

    #[test]
    fn detects_port_conflict_from_cli_output() {
        let output = shell_output(
            "",
            "Error: listen EADDRINUSE: address already in use 127.0.0.1:3000",
        );

        let context = detect_gateway_error_context(&output, ErrorCode::GatewayStartFailed);

        assert!(matches!(context.code, ErrorCode::PortConflict));
        assert_eq!(context.conflict_port, Some(3000));
    }

    #[test]
    fn keeps_status_failures_distinct_from_start_failures() {
        let output = shell_output("", "service unavailable");

        let context = detect_gateway_error_context(&output, ErrorCode::GatewayStatusFailed);

        assert!(matches!(context.code, ErrorCode::GatewayStatusFailed));
        assert_eq!(context.conflict_port, None);
    }

    #[test]
    fn status_probe_logging_only_persists_failures() {
        let success = shell_output(r#"{"running":true}"#, "");
        let failure = ShellOutput {
            exit_code: Some(1),
            ..shell_output("", "status command failed")
        };

        assert!(!should_persist_shell_output(
            GatewayLogPolicy::FailuresOnly,
            &success
        ));
        assert!(should_persist_shell_output(
            GatewayLogPolicy::FailuresOnly,
            &failure
        ));
    }

    #[test]
    fn best_effort_logging_swallow_errors_for_gateway_commands() {
        let output = shell_output(r#"{"running":true}"#, "");

        log_shell_output_best_effort_with(
            GatewayLogPolicy::Always,
            LogSource::Startup,
            "openclaw gateway start --json",
            &output,
            |_source, _step, _output| {
                Err(AppError::new(
                    ErrorCode::LogReadFailed,
                    "Failed to open the ClawDesk log file for writing.",
                    "Check file permissions for the application log directory and retry.",
                ))
            },
        );
    }

    #[tokio::test]
    async fn rejects_invalid_dashboard_probe_address() {
        let error = probe_dashboard_endpoint("not-a-url".to_string())
            .await
            .expect_err("invalid address should fail");

        assert!(matches!(error.code, ErrorCode::InvalidInput));
        assert_eq!(
            error.message,
            "Dashboard address is invalid and cannot be probed."
        );
    }

    #[test]
    fn http_probe_result_marks_non_success_status_as_unreachable() {
        let result = build_http_probe_result("http://127.0.0.1:18789", 500, 42);

        assert!(!result.reachable);
        assert_eq!(result.result, "unreachable");
        assert_eq!(result.http_status, Some(500));
        assert_eq!(result.detail, "Dashboard endpoint returned HTTP 500.");
    }
}
