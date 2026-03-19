use serde::{Deserialize, Serialize};

use crate::models::error::AppError;
use crate::services::overview_service::{self, OverviewMeta, OverviewStatusData};

const HEALTHY: &str = "healthy";
const MODE_PREVIEW: &str = "preview";
const MODE_RUNTIME_UNAVAILABLE: &str = "runtime-unavailable";
const TONE_INFO: &str = "info";
const TONE_WARNING: &str = "warning";
const TONE_ERROR: &str = "error";
const TONE_SUCCESS: &str = "success";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceBannerActionData {
    pub label: String,
    pub route: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceBannerData {
    pub mode: String,
    pub tone: String,
    pub headline: String,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_action: Option<WorkspaceBannerActionData>,
    pub meta: Vec<OverviewMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuidedSetupStepData {
    pub id: String,
    pub title: String,
    pub description: String,
    pub route: String,
    pub action_label: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuidedLaunchCheckData {
    pub id: String,
    pub title: String,
    pub level: String,
    pub detail: String,
    pub route: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunbookBlockerData {
    pub id: String,
    pub title: String,
    pub detail: String,
    pub level: String,
    pub route: String,
    pub action_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunbookSupportActionData {
    pub id: String,
    pub label: String,
    pub route: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunbookModelData {
    pub headline: String,
    pub summary: String,
    pub primary_route: String,
    pub primary_label: String,
    pub last_checked_at: String,
    pub overall_level: String,
    pub launch_checks: Vec<GuidedLaunchCheckData>,
    pub steps: Vec<GuidedSetupStepData>,
    pub blockers: Vec<RunbookBlockerData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_blocker: Option<RunbookBlockerData>,
    pub support_actions: Vec<RunbookSupportActionData>,
    pub banner: WorkspaceBannerData,
}

pub async fn get_runbook_model() -> Result<RunbookModelData, AppError> {
    let overview = overview_service::get_overview_status().await?;
    Ok(build_runbook_model(&overview))
}

pub(crate) fn build_runbook_model(status: &OverviewStatusData) -> RunbookModelData {
    let steps = build_steps(status);
    let launch_checks = build_launch_checks(status);
    let blockers = build_blockers(status);
    let current_blocker = blockers.first().cloned();
    let primary_step = steps
        .iter()
        .find(|step| step.status == "current" || step.status == "ready")
        .cloned()
        .unwrap_or_else(|| steps[0].clone());
    let primary_route = current_blocker
        .as_ref()
        .map(|blocker| blocker.route.clone())
        .unwrap_or_else(|| primary_step.route.clone());
    let primary_label = current_blocker
        .as_ref()
        .map(|blocker| blocker.action_label.clone())
        .unwrap_or_else(|| primary_step.action_label.clone());

    RunbookModelData {
        headline: current_blocker
            .as_ref()
            .map(|blocker| format!("下一步：{}", blocker.title))
            .unwrap_or_else(|| "已经可以开始使用了".to_string()),
        summary: if current_blocker.is_some() {
            "一次只做一件事。完成当前步骤后，再继续下一步。".to_string()
        } else {
            "安装、API Key 配置和 Gateway 都已经就绪，现在可以直接打开 Dashboard。".to_string()
        },
        primary_route,
        primary_label,
        last_checked_at: status.overall.updated_at.clone(),
        overall_level: status.overall.level.clone(),
        launch_checks,
        steps,
        blockers,
        current_blocker: current_blocker.clone(),
        support_actions: build_support_actions(current_blocker.as_ref()),
        banner: build_workspace_banner(status),
    }
}

fn build_workspace_banner(status: &OverviewStatusData) -> WorkspaceBannerData {
    let runtime_mode = resolve_runtime_mode_label(&status.mode);
    let tauri_shell = runtime_meta_value(status, "Tauri Shell").unwrap_or_else(|| {
        if status.mode == MODE_PREVIEW {
            "not-detected".to_string()
        } else {
            "detected".to_string()
        }
    });
    let invoke_bridge = runtime_meta_value(status, "Invoke Bridge").unwrap_or_else(|| {
        if status.mode == "live" {
            "detected".to_string()
        } else {
            "missing".to_string()
        }
    });
    let bridge_source =
        resolve_bridge_source_label(runtime_meta_value(status, "Bridge Source").as_deref().or(
            if status.mode == "live" {
                Some("official-api")
            } else {
                None
            },
        ));

    WorkspaceBannerData {
        mode: status.mode.clone(),
        tone: resolve_banner_tone(status).to_string(),
        headline: resolve_banner_headline(status),
        summary: resolve_banner_summary(status),
        primary_action: status
            .next_actions
            .first()
            .map(|action| WorkspaceBannerActionData {
                label: action.label.clone(),
                route: action.route.clone(),
                description: action.description.clone(),
            }),
        meta: vec![
            OverviewMeta {
                label: "Runtime Mode".to_string(),
                value: runtime_mode,
            },
            OverviewMeta {
                label: "Tauri Shell".to_string(),
                value: tauri_shell,
            },
            OverviewMeta {
                label: "Invoke Bridge".to_string(),
                value: invoke_bridge,
            },
            OverviewMeta {
                label: "Bridge Source".to_string(),
                value: bridge_source,
            },
            OverviewMeta {
                label: "App Version".to_string(),
                value: status.app_version.clone(),
            },
            OverviewMeta {
                label: "Platform".to_string(),
                value: status.platform.clone(),
            },
            OverviewMeta {
                label: "Dashboard".to_string(),
                value: status.dashboard_url.clone(),
            },
        ],
    }
}

fn resolve_runtime_mode_label(mode: &str) -> String {
    match mode {
        MODE_PREVIEW => "Browser Preview".to_string(),
        MODE_RUNTIME_UNAVAILABLE => "Desktop Runtime Unavailable".to_string(),
        _ => "Live".to_string(),
    }
}

fn resolve_bridge_source_label(source: Option<&str>) -> String {
    match source {
        Some("official-api") => "official API bridge".to_string(),
        Some("global-fallback") => "global fallback bridge".to_string(),
        Some("official API bridge") => "official API bridge".to_string(),
        Some("global fallback bridge") => "global fallback bridge".to_string(),
        Some("missing") | Some("none") | None => "missing".to_string(),
        Some(value) => value.to_string(),
    }
}

fn resolve_banner_tone(status: &OverviewStatusData) -> &'static str {
    if status.mode == MODE_RUNTIME_UNAVAILABLE {
        return TONE_ERROR;
    }
    if status.mode == MODE_PREVIEW {
        return TONE_WARNING;
    }
    match status.overall.level.as_str() {
        "healthy" => TONE_SUCCESS,
        "degraded" => TONE_WARNING,
        "offline" => TONE_ERROR,
        _ => TONE_INFO,
    }
}

fn resolve_banner_headline(status: &OverviewStatusData) -> String {
    if status.mode == MODE_PREVIEW {
        return "Browser Preview Mode".to_string();
    }
    if status.mode == MODE_RUNTIME_UNAVAILABLE {
        return "Desktop Runtime Bridge Unavailable".to_string();
    }
    status.overall.headline.clone()
}

fn resolve_banner_summary(status: &OverviewStatusData) -> String {
    if status.mode == MODE_PREVIEW {
        return "当前仅展示只读预览界面。需要在 Tauri 原生桌面壳中运行，才能使用安装、日志、配置和服务控制。"
            .to_string();
    }
    if status.mode == MODE_RUNTIME_UNAVAILABLE {
        return "当前已进入桌面窗口，但前端未连上 Tauri 命令桥。这个问题应优先修复，否则本地命令和文件操作都不可用。"
            .to_string();
    }
    status.overall.summary.clone()
}

fn runtime_meta_value(status: &OverviewStatusData, label: &str) -> Option<String> {
    status
        .runtime
        .meta
        .as_ref()
        .and_then(|items| items.iter().find(|entry| entry.label == label))
        .map(|entry| entry.value.clone())
}

fn is_healthy(level: &str) -> bool {
    level == HEALTHY
}

fn step_status(current: &str, active: &str, complete: bool) -> String {
    if complete {
        return "complete".to_string();
    }
    if current == active {
        return if current == "dashboard" {
            "ready".to_string()
        } else {
            "current".to_string()
        };
    }
    "blocked".to_string()
}

fn build_steps(status: &OverviewStatusData) -> Vec<GuidedSetupStepData> {
    let install_ready = is_healthy(&status.install.level);
    let config_ready = install_ready && is_healthy(&status.config.level);
    let service_ready = config_ready && is_healthy(&status.service.level);
    let active_step = if !install_ready {
        "install"
    } else if !config_ready {
        "config"
    } else if !service_ready {
        "service"
    } else {
        "dashboard"
    };

    vec![
        GuidedSetupStepData {
            id: "install".to_string(),
            title: "安装 OpenClaw".to_string(),
            description: status.install.detail.clone(),
            route: status.install.route.clone(),
            action_label: "去安装".to_string(),
            status: step_status("install", active_step, install_ready),
        },
        GuidedSetupStepData {
            id: "config".to_string(),
            title: "填写 API Key".to_string(),
            description: status.config.detail.clone(),
            route: status.config.route.clone(),
            action_label: "去填写 API Key".to_string(),
            status: step_status("config", active_step, config_ready),
        },
        GuidedSetupStepData {
            id: "service".to_string(),
            title: "启动 Gateway".to_string(),
            description: status.service.detail.clone(),
            route: status.service.route.clone(),
            action_label: "去启动 Gateway".to_string(),
            status: step_status("service", active_step, service_ready),
        },
        GuidedSetupStepData {
            id: "dashboard".to_string(),
            title: "开始使用 OpenClaw".to_string(),
            description: if service_ready {
                "Gateway 已就绪，现在可以直接打开 Dashboard 开始使用。".to_string()
            } else {
                "需要先启动 Gateway，才能打开 Dashboard 正常使用。".to_string()
            },
            route: "/dashboard".to_string(),
            action_label: "打开 Dashboard".to_string(),
            status: step_status("dashboard", active_step, false),
        },
    ]
}

fn build_launch_checks(status: &OverviewStatusData) -> Vec<GuidedLaunchCheckData> {
    vec![
        GuidedLaunchCheckData {
            id: "install".to_string(),
            title: "安装检查".to_string(),
            level: status.install.level.clone(),
            detail: status.install.detail.clone(),
            route: status.install.route.clone(),
        },
        GuidedLaunchCheckData {
            id: "config".to_string(),
            title: "配置检查".to_string(),
            level: status.config.level.clone(),
            detail: status.config.detail.clone(),
            route: status.config.route.clone(),
        },
        GuidedLaunchCheckData {
            id: "service".to_string(),
            title: "服务检查".to_string(),
            level: status.service.level.clone(),
            detail: status.service.detail.clone(),
            route: status.service.route.clone(),
        },
        GuidedLaunchCheckData {
            id: "runtime".to_string(),
            title: "运行时检查".to_string(),
            level: status.runtime.level.clone(),
            detail: status.runtime.detail.clone(),
            route: "/settings".to_string(),
        },
        GuidedLaunchCheckData {
            id: "settings".to_string(),
            title: "设置检查".to_string(),
            level: status.settings.level.clone(),
            detail: status.settings.detail.clone(),
            route: status.settings.route.clone(),
        },
    ]
}

fn build_blockers(status: &OverviewStatusData) -> Vec<RunbookBlockerData> {
    let mut blockers = Vec::new();

    if status.mode == MODE_RUNTIME_UNAVAILABLE {
        blockers.push(RunbookBlockerData {
            id: "runtime-bridge".to_string(),
            title: "修复桌面运行时桥接".to_string(),
            detail: status.runtime.detail.clone(),
            level: status.runtime.level.clone(),
            route: "/settings".to_string(),
            action_label: "修复运行时".to_string(),
        });
    }

    if status.mode == MODE_PREVIEW {
        blockers.push(RunbookBlockerData {
            id: "preview-mode".to_string(),
            title: "切换到桌面模式".to_string(),
            detail: status.runtime.detail.clone(),
            level: status.runtime.level.clone(),
            route: "/runbook".to_string(),
            action_label: "查看说明".to_string(),
        });
    }

    if !is_healthy(&status.install.level) {
        blockers.push(RunbookBlockerData {
            id: "install".to_string(),
            title: status.install.title.clone(),
            detail: status.install.detail.clone(),
            level: status.install.level.clone(),
            route: status.install.route.clone(),
            action_label: "去安装".to_string(),
        });
    }

    if !is_healthy(&status.config.level) {
        blockers.push(RunbookBlockerData {
            id: "config".to_string(),
            title: status.config.title.clone(),
            detail: status.config.detail.clone(),
            level: status.config.level.clone(),
            route: status.config.route.clone(),
            action_label: "去填写 API Key".to_string(),
        });
    }

    if !is_healthy(&status.service.level) {
        blockers.push(RunbookBlockerData {
            id: "service".to_string(),
            title: status.service.title.clone(),
            detail: status.service.detail.clone(),
            level: status.service.level.clone(),
            route: status.service.route.clone(),
            action_label: "去启动 Gateway".to_string(),
        });
    }

    blockers
}

fn build_support_actions(
    current_blocker: Option<&RunbookBlockerData>,
) -> Vec<RunbookSupportActionData> {
    let mut actions = Vec::new();

    if let Some(blocker) = current_blocker {
        actions.push(RunbookSupportActionData {
            id: "primary".to_string(),
            label: blocker.action_label.clone(),
            route: blocker.route.clone(),
            description: "先完成当前这一步，再继续下面的流程。".to_string(),
        });
    }

    actions.extend([
        RunbookSupportActionData {
            id: "runbook".to_string(),
            label: "查看完整步骤".to_string(),
            route: "/runbook".to_string(),
            description: "如果你想看完整流程顺序，再打开这里。".to_string(),
        },
        RunbookSupportActionData {
            id: "logs".to_string(),
            label: "查看日志".to_string(),
            route: "/logs".to_string(),
            description: "只有安装或启动失败时，再来这里看错误日志。".to_string(),
        },
        RunbookSupportActionData {
            id: "settings".to_string(),
            label: "打开设置".to_string(),
            route: "/settings".to_string(),
            description: "当桌面运行时有问题时，再来这里检查设置和环境。".to_string(),
        },
    ]);

    let mut deduped = Vec::new();
    for action in actions {
        if deduped
            .iter()
            .all(|candidate: &RunbookSupportActionData| candidate.route != action.route)
        {
            deduped.push(action);
        }
    }

    deduped
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::overview_service::{
        OverviewActionData, OverviewOverallData, OverviewSectionData, OverviewStatusData,
    };

    fn section(
        id: &str,
        title: &str,
        route: &str,
        level: &str,
        detail: &str,
    ) -> OverviewSectionData {
        OverviewSectionData {
            id: id.to_string(),
            title: title.to_string(),
            route: route.to_string(),
            cta_label: "Open".to_string(),
            level: level.to_string(),
            detail: detail.to_string(),
            updated_at: "2026-03-19T10:00:00.000Z".to_string(),
            meta: None,
        }
    }

    fn status(
        mode: &str,
        install_level: &str,
        config_level: &str,
        service_level: &str,
    ) -> OverviewStatusData {
        OverviewStatusData {
            app_version: "2.0.4".to_string(),
            platform: "windows".to_string(),
            dashboard_url: if service_level == HEALTHY {
                "http://127.0.0.1:18789".to_string()
            } else {
                "Unavailable".to_string()
            },
            mode: mode.to_string(),
            overall: OverviewOverallData {
                level: if service_level == HEALTHY {
                    HEALTHY.to_string()
                } else {
                    "degraded".to_string()
                },
                headline: "下一步：安装 OpenClaw".to_string(),
                summary: "这是第 1 步。安装完成后，再去填写 API Key 并启动 Gateway。".to_string(),
                updated_at: "2026-03-19T10:00:00.000Z".to_string(),
            },
            runtime: OverviewSectionData {
                meta: Some(vec![
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
                ]),
                ..section(
                    "openclaw-runtime",
                    "桌面 Runtime",
                    "/service",
                    HEALTHY,
                    "Rust 命令桥接正常，已检测到 npm 10.9.0",
                )
            },
            install: section(
                "openclaw-install",
                "OpenClaw 安装",
                "/install?wizard=1",
                install_level,
                "尚未检测到 OpenClaw CLI，请先完成安装。",
            ),
            config: section(
                "openclaw-config",
                "OpenClaw 配置",
                "/config",
                config_level,
                "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。",
            ),
            service: section(
                "openclaw-service",
                "Gateway 服务",
                "/service",
                service_level,
                "Gateway 当前未启动。",
            ),
            settings: section(
                "clawdesk-settings",
                "ClawDesk 设置",
                "/settings",
                HEALTHY,
                "ClawDesk 应用设置已加载。",
            ),
            next_actions: vec![OverviewActionData {
                id: "install-openclaw".to_string(),
                label: "开始安装 OpenClaw".to_string(),
                route: "/install?wizard=1".to_string(),
                description: "这是第 1 步。安装完成后，继续去填写 API Key。".to_string(),
                kind: None,
            }],
        }
    }

    #[test]
    fn runbook_prioritizes_install_when_install_is_not_ready() {
        let model = build_runbook_model(&status("live", "degraded", "offline", "offline"));

        assert_eq!(
            model
                .current_blocker
                .as_ref()
                .map(|blocker| blocker.id.as_str()),
            Some("install")
        );
        assert_eq!(model.primary_route, "/install?wizard=1");
        assert_eq!(model.primary_label, "去安装");
        assert_eq!(model.steps[0].status, "current");
        assert_eq!(model.steps[1].status, "blocked");
    }

    #[test]
    fn runbook_marks_dashboard_ready_when_everything_is_healthy() {
        let mut ready_status = status("live", HEALTHY, HEALTHY, HEALTHY);
        ready_status.overall = OverviewOverallData {
            level: HEALTHY.to_string(),
            headline: "可以开始使用了".to_string(),
            summary: "OpenClaw 已经安装完成，API Key 已保存，Gateway 也已启动。现在直接打开 Dashboard 即可。"
                .to_string(),
            updated_at: "2026-03-19T10:00:00.000Z".to_string(),
        };
        ready_status.next_actions = vec![OverviewActionData {
            id: "open-dashboard".to_string(),
            label: "打开 Dashboard 开始使用".to_string(),
            route: "/dashboard".to_string(),
            description: "OpenClaw 已经准备好，直接进入 Dashboard 即可。".to_string(),
            kind: Some("open-dashboard".to_string()),
        }];

        let model = build_runbook_model(&ready_status);

        assert!(model.current_blocker.is_none());
        assert_eq!(model.primary_route, "/dashboard");
        assert_eq!(model.steps[3].status, "ready");
        assert_eq!(
            model
                .banner
                .primary_action
                .as_ref()
                .map(|action| action.route.as_str()),
            Some("/dashboard")
        );
        assert_eq!(model.launch_checks[3].title, "运行时检查");
        assert_eq!(model.launch_checks[4].title, "设置检查");
    }

    #[test]
    fn runbook_deduplicates_settings_support_action_for_runtime_blocker() {
        let mut runtime_broken = status(MODE_RUNTIME_UNAVAILABLE, "offline", "offline", "offline");
        runtime_broken.runtime.level = "offline".to_string();
        runtime_broken.runtime.detail =
            "Frontend is not connected to the invoke bridge.".to_string();

        let model = build_runbook_model(&runtime_broken);
        let settings_actions = model
            .support_actions
            .iter()
            .filter(|action| action.route == "/settings")
            .count();

        assert_eq!(
            model
                .current_blocker
                .as_ref()
                .map(|blocker| blocker.id.as_str()),
            Some("runtime-bridge")
        );
        assert_eq!(settings_actions, 1);
        assert_eq!(model.support_actions[0].label, "修复运行时");
    }
}
