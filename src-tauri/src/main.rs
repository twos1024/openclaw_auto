#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adapters;
mod commands;
mod models;
mod services;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Agent management
            commands::agent::list_agents,
            commands::agent::create_agent,
            commands::agent::update_agent,
            commands::agent::delete_agent,
            commands::agent::start_agent,
            commands::agent::stop_agent,
            // Channel management
            commands::channel::list_channels,
            commands::channel::add_channel,
            commands::channel::update_channel,
            commands::channel::delete_channel,
            // Provider management
            commands::provider::list_providers,
            commands::provider::create_provider,
            commands::provider::update_provider,
            commands::provider::delete_provider,
            commands::provider::validate_provider,
            // Cron management
            commands::cron::list_cron_jobs,
            commands::cron::create_cron_job,
            commands::cron::update_cron_job,
            commands::cron::delete_cron_job,
            commands::cron::trigger_cron_job,
            // Admin / elevation
            commands::admin::check_admin_status,
            commands::admin::relaunch_as_admin,
            // Environment & install
            commands::env::detect_env,
            commands::install::install_openclaw,
            commands::install::install_openclaw_in_terminal,
            // Legacy instance management
            commands::instance::list_instances,
            commands::instance::create_instance,
            commands::instance::update_instance,
            commands::instance::delete_instance,
            commands::instance::start_instance,
            commands::instance::stop_instance,
            // Connectivity
            commands::connectivity::test_connection,
            // Config
            commands::config::backup_openclaw_config,
            commands::config::read_openclaw_config,
            commands::config::write_openclaw_config,
            // Gateway
            commands::gateway::get_gateway_status,
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::restart_gateway,
            commands::gateway::open_dashboard,
            commands::gateway::probe_dashboard_endpoint,
            // Logs
            commands::logs::read_logs,
            commands::logs::export_diagnostics,
            // Settings
            commands::settings::read_app_settings,
            commands::settings::write_app_settings,
            // Overview & runbook
            commands::overview::get_overview_status,
            commands::runbook::get_runbook_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClawDesk");
}
