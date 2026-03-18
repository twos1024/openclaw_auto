use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::error::{AppError, ErrorCode};
use crate::services::config_service::{self, ReadConfigData};
use crate::services::env_service::{self, DetectEnvData};
use crate::services::gateway_service::{self, GatewayStatusData};
use crate::services::settings_service::{self, ReadAppSettingsData};

const INSTALL_WIZARD_ROUTE: &str = "/install?wizard=1";
const HEALTHY: &str = "healthy";
const DEGRADED: &str = "degraded";
const OFFLINE: &str = "offline";
const UNKNOWN: &str = "unknown";
const MODE_LIVE: &str = "live";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewMeta {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewSectionData {
    pub id: String,
    pub title: String,
    pub route: String,
    pub cta_label: String,
    pub level: String,
    pub detail: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<Vec<OverviewMeta>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewOverallData {
    pub level: String,
    pub headline: String,
    pub summary: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewActionData {
    pub id: String,
    pub label: String,
    pub route: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewStatusData {
    pub app_version: String,
    pub platform: String,
    pub dashboard_url: String,
    pub mode: String,
    pub overall: OverviewOverallData,
    pub service: OverviewSectionData,
    pub runtime: OverviewSectionData,
    pub config: OverviewSectionData,
    pub install: OverviewSectionData,
    pub settings: OverviewSectionData,
    pub next_actions: Vec<OverviewActionData>,
}

pub async fn get_overview_status() -> Result<OverviewStatusData, AppError> {
    let updated_at = Utc::now().to_rfc3339();

    let env_result = env_service::detect_env().await;
    let gateway_result = gateway_service::get_gateway_status().await;
    let config_result = config_service::read_openclaw_config(None).await;
    let settings_result = settings_service::read_app_settings(None).await;

    let runtime = build_runtime_section(&env_result, &updated_at);
    let install = build_install_section(&env_result, &updated_at);
    let config = build_config_section(&config_result, &updated_at);
    let service = build_service_section(&gateway_result, &updated_at);
    let settings = build_settings_section(&settings_result, &updated_at);
    let overall = build_overall(
        &runtime,
        &install,
        &config,
        &service,
        &settings,
        &updated_at,
    );
    let next_actions = build_next_actions(&install, &config, &service, &settings);

    Ok(OverviewStatusData {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        platform: env_result
            .as_ref()
            .map(|data| data.platform.clone())
            .unwrap_or_else(|_| "unknown".to_string()),
        dashboard_url: gateway_result
            .as_ref()
            .map(|data| data.address.clone())
            .unwrap_or_else(|_| "Unavailable".to_string()),
        mode: MODE_LIVE.to_string(),
        overall,
        service,
        runtime,
        config,
        install,
        settings,
        next_actions,
    })
}

fn build_section(
    id: &str,
    title: &str,
    route: &str,
    cta_label: &str,
    level: &str,
    detail: String,
    updated_at: &str,
    meta: Option<Vec<OverviewMeta>>,
) -> OverviewSectionData {
    OverviewSectionData {
        id: id.to_string(),
        title: title.to_string(),
        route: route.to_string(),
        cta_label: cta_label.to_string(),
        level: level.to_string(),
        detail,
        updated_at: updated_at.to_string(),
        meta,
    }
}

fn build_runtime_section(
    env_result: &Result<DetectEnvData, AppError>,
    updated_at: &str,
) -> OverviewSectionData {
    let mut meta = vec![
        OverviewMeta {
            label: "Mode".to_string(),
            value: "tauri-runtime-available".to_string(),
        },
        OverviewMeta {
            label: "Tauri Shell".to_string(),
            value: "detected".to_string(),
        },
        OverviewMeta {
            label: "Invoke Bridge".to_string(),
            value: "detected".to_string(),
        },
        OverviewMeta {
            label: "Bridge Source".to_string(),
            value: "official API bridge".to_string(),
        },
    ];

    match env_result {
        Ok(env) => {
            meta.push(OverviewMeta {
                label: "平台".to_string(),
                value: env.platform.clone(),
            });
            meta.push(OverviewMeta {
                label: "npm".to_string(),
                value: env
                    .npm_version
                    .clone()
                    .unwrap_or_else(|| "missing".to_string()),
            });

            let detail = if env.npm_found {
                format!(
                    "Rust 命令桥接正常，已检测到 npm {}",
                    env.npm_version.clone().unwrap_or_default()
                )
                .trim()
                .to_string()
            } else {
                "Rust 命令桥接正常，但尚未检测到 npm。".to_string()
            };

            build_section(
                "openclaw-runtime",
                "桌面 Runtime",
                "/service",
                "查看 Service",
                HEALTHY,
                detail,
                updated_at,
                Some(meta),
            )
        }
        Err(error) => build_section(
            "openclaw-runtime",
            "桌面 Runtime",
            "/service",
            "查看 Service",
            OFFLINE,
            error.message.clone(),
            updated_at,
            Some(meta),
        ),
    }
}

fn build_install_section(
    env_result: &Result<DetectEnvData, AppError>,
    updated_at: &str,
) -> OverviewSectionData {
    match env_result {
        Err(error) => build_section(
            "openclaw-install",
            "OpenClaw 安装",
            INSTALL_WIZARD_ROUTE,
            "前往 Install",
            OFFLINE,
            error.message.clone(),
            updated_at,
            None,
        ),
        Ok(env) if !env.npm_found => build_section(
            "openclaw-install",
            "OpenClaw 安装",
            INSTALL_WIZARD_ROUTE,
            "先安装 Node.js / npm",
            OFFLINE,
            "未检测到 npm，当前无法执行 OpenClaw 安装流程。".to_string(),
            updated_at,
            Some(vec![OverviewMeta {
                label: "OpenClaw".to_string(),
                value: "missing".to_string(),
            }]),
        ),
        Ok(env) if !env.openclaw_found => build_section(
            "openclaw-install",
            "OpenClaw 安装",
            INSTALL_WIZARD_ROUTE,
            "开始安装",
            DEGRADED,
            "尚未检测到 OpenClaw CLI，请先完成安装。".to_string(),
            updated_at,
            Some(vec![
                OverviewMeta {
                    label: "npm".to_string(),
                    value: env
                        .npm_version
                        .clone()
                        .unwrap_or_else(|| "ready".to_string()),
                },
                OverviewMeta {
                    label: "Config Path".to_string(),
                    value: env.config_path.clone(),
                },
            ]),
        ),
        Ok(env) => build_section(
            "openclaw-install",
            "OpenClaw 安装",
            INSTALL_WIZARD_ROUTE,
            "查看 Install",
            HEALTHY,
            format!(
                "已检测到 OpenClaw {}",
                env.openclaw_version.clone().unwrap_or_default()
            )
            .trim()
            .to_string(),
            updated_at,
            Some(vec![
                OverviewMeta {
                    label: "CLI".to_string(),
                    value: env
                        .openclaw_path
                        .clone()
                        .unwrap_or_else(|| "resolved".to_string()),
                },
                OverviewMeta {
                    label: "npm".to_string(),
                    value: env
                        .npm_version
                        .clone()
                        .unwrap_or_else(|| "ready".to_string()),
                },
            ]),
        ),
    }
}

fn build_config_section(
    config_result: &Result<ReadConfigData, AppError>,
    updated_at: &str,
) -> OverviewSectionData {
    match config_result {
        Ok(data) => {
            let model = read_string_field(&data.content, &["model"]);
            let provider = read_string_field(&data.content, &["providerType"]);
            let detail = if let Some(model) = model {
                format!("API Key 配置已保存，当前模型为 {model}。下一步可以启动 Gateway。")
            } else {
                "配置已加载。下一步可以启动 Gateway。".to_string()
            };

            build_section(
                "openclaw-config",
                "OpenClaw 配置",
                "/config",
                "查看配置",
                HEALTHY,
                detail,
                updated_at,
                Some(vec![
                    OverviewMeta {
                        label: "Provider".to_string(),
                        value: provider.unwrap_or_else(|| "-".to_string()),
                    },
                    OverviewMeta {
                        label: "Path".to_string(),
                        value: data.path.clone(),
                    },
                ]),
            )
        }
        Err(error) => {
            let missing = error.code == ErrorCode::PathNotFound;
            build_section(
                "openclaw-config",
                "OpenClaw 配置",
                "/config",
                if missing {
                    "填写 API Key"
                } else {
                    "修复配置"
                },
                if missing { DEGRADED } else { OFFLINE },
                if missing {
                    "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。".to_string()
                } else {
                    error.message.clone()
                },
                updated_at,
                None,
            )
        }
    }
}

fn build_service_section(
    gateway_result: &Result<GatewayStatusData, AppError>,
    updated_at: &str,
) -> OverviewSectionData {
    match gateway_result {
        Ok(status) => {
            let running = status.running;
            let detail = if running {
                if status.status_detail.trim().is_empty() {
                    if status.address.trim().is_empty() {
                        "Gateway 当前处于运行状态。".to_string()
                    } else {
                        format!("Gateway 正在 {} 运行。", status.address)
                    }
                } else {
                    status.status_detail.clone()
                }
            } else if status.status_detail.trim().is_empty() {
                "Gateway 当前未启动。".to_string()
            } else {
                status.status_detail.clone()
            };

            build_section(
                "openclaw-service",
                "Gateway 服务",
                "/service",
                if running {
                    "查看运行状态"
                } else {
                    "启动 Gateway"
                },
                if running { HEALTHY } else { DEGRADED },
                detail,
                updated_at,
                Some(vec![
                    OverviewMeta {
                        label: "Address".to_string(),
                        value: status.address.clone(),
                    },
                    OverviewMeta {
                        label: "PID".to_string(),
                        value: status
                            .pid
                            .map(|value| value.to_string())
                            .unwrap_or_else(|| "-".to_string()),
                    },
                ]),
            )
        }
        Err(error) => build_section(
            "openclaw-service",
            "Gateway 服务",
            "/service",
            "查看 Service",
            OFFLINE,
            error.message.clone(),
            updated_at,
            None,
        ),
    }
}

fn build_settings_section(
    settings_result: &Result<ReadAppSettingsData, AppError>,
    updated_at: &str,
) -> OverviewSectionData {
    match settings_result {
        Ok(settings) => build_section(
            "clawdesk-settings",
            "ClawDesk 设置",
            "/settings",
            "查看 Settings",
            HEALTHY,
            if settings.exists {
                "ClawDesk 应用设置已加载。".to_string()
            } else {
                "当前使用默认设置，建议按需保存一份本地 Settings。".to_string()
            },
            updated_at,
            Some(vec![
                OverviewMeta {
                    label: "Diagnostics".to_string(),
                    value: settings.content.diagnostics_dir.clone(),
                },
                OverviewMeta {
                    label: "Polling".to_string(),
                    value: format!("{} ms", settings.content.gateway_poll_ms),
                },
            ]),
        ),
        Err(error) => {
            let missing = error.code == ErrorCode::PathNotFound;
            build_section(
                "clawdesk-settings",
                "ClawDesk 设置",
                "/settings",
                if missing {
                    "初始化 Settings"
                } else {
                    "查看 Settings"
                },
                if missing { DEGRADED } else { OFFLINE },
                error.message.clone(),
                updated_at,
                None,
            )
        }
    }
}

fn build_overall(
    runtime: &OverviewSectionData,
    install: &OverviewSectionData,
    config: &OverviewSectionData,
    service: &OverviewSectionData,
    settings: &OverviewSectionData,
    updated_at: &str,
) -> OverviewOverallData {
    if install.level == OFFLINE || install.level == DEGRADED {
        return OverviewOverallData {
            level: install.level.clone(),
            headline: "下一步：安装 OpenClaw".to_string(),
            summary: "这是第 1 步。安装完成后，再去填写 API Key 并启动 Gateway。".to_string(),
            updated_at: updated_at.to_string(),
        };
    }

    let level = worst_level([
        runtime.level.as_str(),
        install.level.as_str(),
        config.level.as_str(),
        service.level.as_str(),
        settings.level.as_str(),
    ]);

    if config.level != HEALTHY {
        return OverviewOverallData {
            level,
            headline: "下一步：填写 API Key".to_string(),
            summary: "这是第 2 步。把 API Key、接口地址和模型保存好，再启动 Gateway。".to_string(),
            updated_at: updated_at.to_string(),
        };
    }

    if service.level != HEALTHY {
        return OverviewOverallData {
            level,
            headline: "下一步：启动 Gateway".to_string(),
            summary: "这是第 3 步。Gateway 启动后，就可以直接打开 Dashboard 开始使用。".to_string(),
            updated_at: updated_at.to_string(),
        };
    }

    OverviewOverallData {
        level,
        headline: "可以开始使用了".to_string(),
        summary:
            "OpenClaw 已经安装完成，API Key 已保存，Gateway 也已启动。现在直接打开 Dashboard 即可。"
                .to_string(),
        updated_at: updated_at.to_string(),
    }
}

fn build_next_actions(
    install: &OverviewSectionData,
    config: &OverviewSectionData,
    service: &OverviewSectionData,
    settings: &OverviewSectionData,
) -> Vec<OverviewActionData> {
    let mut actions = Vec::new();

    if install.level == OFFLINE || install.level == DEGRADED {
        actions.push(OverviewActionData {
            id: "install-openclaw".to_string(),
            label: "开始安装 OpenClaw".to_string(),
            route: INSTALL_WIZARD_ROUTE.to_string(),
            description: "这是第 1 步。安装完成后，继续去填写 API Key。".to_string(),
            kind: None,
        });
    }

    if config.level != HEALTHY {
        actions.push(OverviewActionData {
            id: "configure-provider".to_string(),
            label: "填写 API Key".to_string(),
            route: "/config".to_string(),
            description: "这是第 2 步。填好 API Key、接口地址和模型后再启动 Gateway。".to_string(),
            kind: None,
        });
    }

    if service.level != HEALTHY {
        actions.push(OverviewActionData {
            id: "start-gateway".to_string(),
            label: "启动 Gateway".to_string(),
            route: "/service".to_string(),
            description: "这是第 3 步。Gateway 启动成功后，就可以打开 Dashboard 开始使用。"
                .to_string(),
            kind: None,
        });
    } else {
        actions.push(OverviewActionData {
            id: "open-dashboard".to_string(),
            label: "打开 Dashboard 开始使用".to_string(),
            route: "/dashboard".to_string(),
            description: "OpenClaw 已经准备好，直接进入 Dashboard 即可。".to_string(),
            kind: Some("open-dashboard".to_string()),
        });
    }

    if settings.level != HEALTHY {
        actions.push(OverviewActionData {
            id: "review-settings".to_string(),
            label: "检查 ClawDesk 设置".to_string(),
            route: "/settings".to_string(),
            description: "确认诊断目录、日志行数限制和轮询频率，避免后续排障信息不完整。"
                .to_string(),
            kind: None,
        });
    }

    actions.push(OverviewActionData {
        id: "review-logs".to_string(),
        label: "遇到问题再看日志".to_string(),
        route: "/logs".to_string(),
        description: "只有安装、配置或启动失败时，再到这里查看错误和导出诊断信息。".to_string(),
        kind: None,
    });

    actions
}

fn level_rank(level: &str) -> usize {
    match level {
        OFFLINE => 4,
        DEGRADED => 3,
        UNKNOWN => 2,
        HEALTHY => 1,
        _ => 2,
    }
}

fn worst_level<const N: usize>(levels: [&str; N]) -> String {
    levels
        .iter()
        .max_by_key(|level| level_rank(level))
        .map(|level| (*level).to_string())
        .unwrap_or_else(|| UNKNOWN.to_string())
}

fn read_string_field(content: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| find_value_recursive(content, key))
        .and_then(|value| value.as_str().map(|text| text.to_string()))
}

fn find_value_recursive<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            if let Some(found) = map.get(key) {
                return Some(found);
            }

            map.values()
                .find_map(|nested| find_value_recursive(nested, key))
        }
        Value::Array(items) => items
            .iter()
            .find_map(|nested| find_value_recursive(nested, key)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_actions_prioritize_install_when_install_unhealthy() {
        let install = build_section(
            "openclaw-install",
            "OpenClaw 安装",
            INSTALL_WIZARD_ROUTE,
            "开始安装",
            DEGRADED,
            "install missing".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );
        let config = build_section(
            "openclaw-config",
            "OpenClaw 配置",
            "/config",
            "填写 API Key",
            DEGRADED,
            "config missing".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );
        let service = build_section(
            "openclaw-service",
            "Gateway 服务",
            "/service",
            "启动 Gateway",
            OFFLINE,
            "service missing".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );
        let settings = build_section(
            "clawdesk-settings",
            "ClawDesk 设置",
            "/settings",
            "查看 Settings",
            HEALTHY,
            "ok".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );

        let actions = build_next_actions(&install, &config, &service, &settings);
        assert_eq!(actions[0].route, INSTALL_WIZARD_ROUTE);
        assert_eq!(actions[0].label, "开始安装 OpenClaw");
    }

    #[test]
    fn overall_points_to_config_after_install_ready() {
        let runtime = build_section(
            "openclaw-runtime",
            "桌面 Runtime",
            "/service",
            "查看 Service",
            HEALTHY,
            "ok".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );
        let install = build_section(
            "openclaw-install",
            "OpenClaw 安装",
            INSTALL_WIZARD_ROUTE,
            "查看 Install",
            HEALTHY,
            "ok".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );
        let config = build_section(
            "openclaw-config",
            "OpenClaw 配置",
            "/config",
            "填写 API Key",
            DEGRADED,
            "missing".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );
        let service = build_section(
            "openclaw-service",
            "Gateway 服务",
            "/service",
            "启动 Gateway",
            OFFLINE,
            "down".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );
        let settings = build_section(
            "clawdesk-settings",
            "ClawDesk 设置",
            "/settings",
            "查看 Settings",
            HEALTHY,
            "ok".to_string(),
            "2026-01-01T00:00:00Z",
            None,
        );

        let overall = build_overall(
            &runtime,
            &install,
            &config,
            &service,
            &settings,
            "2026-01-01T00:00:00Z",
        );
        assert_eq!(overall.headline, "下一步：填写 API Key");
    }
}
