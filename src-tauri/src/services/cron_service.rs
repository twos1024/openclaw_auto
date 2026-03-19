use chrono::Utc;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::error::AppError;
use crate::services::gateway_api_service::request_gateway_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CronExecution {
    pub id: String,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CronJob {
    pub id: String,
    pub name: String,
    pub schedule: String,
    pub enabled: bool,
    pub agent_id: String,
    pub channel_id: String,
    pub template: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_run_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<String>,
    pub status: String,
    pub history: Vec<CronExecution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCronJobPayload {
    pub name: String,
    pub schedule: String,
    pub agent_id: String,
    pub channel_id: String,
    pub template: String,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCronJobPayload {
    pub id: String,
    pub name: Option<String>,
    pub schedule: Option<String>,
    pub agent_id: Option<String>,
    pub channel_id: Option<String>,
    pub template: Option<String>,
    pub enabled: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCronJobData {
    pub deleted: bool,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerCronJobData {
    pub triggered: bool,
    pub id: String,
    pub detail: String,
}

pub async fn list_cron_jobs() -> Result<Vec<CronJob>, AppError> {
    let payload = request_gateway_json(Method::GET, &["/api/cron/jobs", "/api/cron"], None).await?;
    Ok(parse_cron_job_list(&payload))
}

pub async fn create_cron_job(payload: CreateCronJobPayload) -> Result<CronJob, AppError> {
    let body = serde_json::to_value(payload).unwrap_or(Value::Null);
    let response =
        request_gateway_json(Method::POST, &["/api/cron/jobs", "/api/cron"], Some(body)).await?;
    Ok(parse_single_cron_job_response(&response))
}

pub async fn update_cron_job(payload: UpdateCronJobPayload) -> Result<CronJob, AppError> {
    let id = payload.id.clone();
    let body = serde_json::to_value(payload).unwrap_or(Value::Null);
    let path_a = format!("/api/cron/jobs/{id}");
    let path_b = format!("/api/cron/{id}");
    let response = request_gateway_json(Method::PUT, &[&path_a, &path_b], Some(body)).await?;
    Ok(parse_single_cron_job_response(&response))
}

pub async fn delete_cron_job(id: String) -> Result<DeleteCronJobData, AppError> {
    let path_a = format!("/api/cron/jobs/{id}");
    let path_b = format!("/api/cron/{id}");
    let response = request_gateway_json(Method::DELETE, &[&path_a, &path_b], None).await?;
    Ok(parse_delete_data(&response, &id))
}

pub async fn trigger_cron_job(id: String) -> Result<TriggerCronJobData, AppError> {
    let path_a = format!("/api/cron/jobs/{id}/trigger");
    let path_b = format!("/api/cron/{id}/trigger");
    let response = request_gateway_json(Method::POST, &[&path_a, &path_b], None).await?;
    Ok(parse_trigger_data(&response, &id))
}

fn parse_single_cron_job_response(value: &Value) -> CronJob {
    if let Some(data) = value.get("job") {
        return parse_cron_job(data);
    }
    if let Some(data) = value.get("data") {
        if data.is_object() {
            return parse_cron_job(data);
        }
    }
    parse_cron_job(value)
}

fn parse_cron_job_list(value: &Value) -> Vec<CronJob> {
    if let Some(items) = value.as_array() {
        return items.iter().map(parse_cron_job).collect();
    }
    if let Some(items) = value.get("jobs").and_then(Value::as_array) {
        return items.iter().map(parse_cron_job).collect();
    }
    if let Some(items) = value.get("data").and_then(Value::as_array) {
        return items.iter().map(parse_cron_job).collect();
    }
    vec![]
}

fn parse_cron_job(value: &Value) -> CronJob {
    CronJob {
        id: extract_string(value, &["id"]).unwrap_or_else(|| fallback_id("cron")),
        name: extract_string(value, &["name"]).unwrap_or_else(|| "Unnamed Job".to_string()),
        schedule: extract_string(value, &["schedule"]).unwrap_or_else(|| "0 * * * *".to_string()),
        enabled: value
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        agent_id: extract_string(value, &["agentId", "agent_id"]).unwrap_or_default(),
        channel_id: extract_string(value, &["channelId", "channel_id"]).unwrap_or_default(),
        template: extract_string(value, &["template", "message"]).unwrap_or_default(),
        next_run_at: extract_string(value, &["nextRunAt", "next_run_at"]),
        last_run_at: extract_string(value, &["lastRunAt", "last_run_at"]),
        status: normalize_cron_status(
            extract_string(value, &["status"]).unwrap_or_else(|| "idle".to_string()),
        ),
        history: value
            .get("history")
            .and_then(Value::as_array)
            .map(|items| items.iter().map(parse_execution).collect())
            .unwrap_or_default(),
    }
}

fn parse_execution(value: &Value) -> CronExecution {
    CronExecution {
        id: extract_string(value, &["id"]).unwrap_or_else(|| fallback_id("exec")),
        started_at: extract_string(value, &["startedAt", "started_at"])
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        duration_ms: value
            .get("durationMs")
            .or_else(|| value.get("duration_ms"))
            .and_then(Value::as_u64),
        status: normalize_execution_status(
            extract_string(value, &["status"]).unwrap_or_else(|| "success".to_string()),
        ),
        summary: extract_string(value, &["summary", "detail"]),
    }
}

fn parse_delete_data(value: &Value, fallback_id: &str) -> DeleteCronJobData {
    DeleteCronJobData {
        deleted: value
            .get("deleted")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        id: extract_string(value, &["id"]).unwrap_or_else(|| fallback_id.to_string()),
    }
}

fn parse_trigger_data(value: &Value, fallback_id: &str) -> TriggerCronJobData {
    let triggered = value
        .get("triggered")
        .and_then(Value::as_bool)
        .or_else(|| value.get("ok").and_then(Value::as_bool))
        .or_else(|| value.get("success").and_then(Value::as_bool))
        .unwrap_or(true);
    let detail = extract_string(value, &["detail", "message"])
        .unwrap_or_else(|| "Cron job triggered.".to_string());

    TriggerCronJobData {
        triggered,
        id: extract_string(value, &["id"]).unwrap_or_else(|| fallback_id.to_string()),
        detail,
    }
}

fn extract_string(value: &Value, keys: &[&str]) -> Option<String> {
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

fn fallback_id(prefix: &str) -> String {
    let ts = Utc::now().timestamp_nanos_opt().unwrap_or(0);
    format!("{prefix}-{ts:x}")
}

fn normalize_cron_status(value: String) -> String {
    match value.as_str() {
        "idle" | "running" | "success" | "error" | "disabled" => value,
        _ => "idle".to_string(),
    }
}

fn normalize_execution_status(value: String) -> String {
    match value.as_str() {
        "running" | "success" | "error" => value,
        _ => "success".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_cron_jobs_from_jobs_key() {
        let payload = json!({
            "jobs": [
                {
                    "id": "job-1",
                    "name": "Daily",
                    "schedule": "0 9 * * *",
                    "enabled": true,
                    "agentId": "a-1",
                    "channelId": "c-1",
                    "template": "hello",
                    "status": "running",
                    "history": [
                        {
                            "id": "exec-1",
                            "startedAt": "2026-03-20T09:00:00Z",
                            "status": "success"
                        }
                    ]
                }
            ]
        });

        let jobs = parse_cron_job_list(&payload);
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].status, "running");
        assert_eq!(jobs[0].history.len(), 1);
    }

    #[test]
    fn normalizes_cron_status_and_trigger_payload() {
        let payload = json!({
            "id": "job-2",
            "name": "Unknown",
            "status": "weird",
            "history": [
                { "status": "other" }
            ]
        });

        let job = parse_cron_job(&payload);
        assert_eq!(job.status, "idle");
        assert_eq!(job.history[0].status, "success");

        let trigger = parse_trigger_data(&json!({"ok": true, "message": "queued"}), "job-2");
        assert!(trigger.triggered);
        assert_eq!(trigger.detail, "queued");
    }
}
