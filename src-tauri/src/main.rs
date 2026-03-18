#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adapters;
mod commands;
mod models;
mod services;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::env::detect_env,
            commands::install::install_openclaw,
            commands::connectivity::test_connection,
            commands::config::backup_openclaw_config,
            commands::config::read_openclaw_config,
            commands::config::write_openclaw_config,
            commands::gateway::get_gateway_status,
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::restart_gateway,
            commands::gateway::open_dashboard,
            commands::gateway::probe_dashboard_endpoint,
            commands::logs::read_logs,
            commands::logs::export_diagnostics,
            commands::settings::read_app_settings,
            commands::settings::write_app_settings,
            commands::overview::get_overview_status,
            commands::runbook::get_runbook_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClawDesk");
}
