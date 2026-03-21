// IPC channel name constants — used in both main process handlers and renderer invocations.
// Keeping them in one place eliminates typos and enables IDE jump-to-definition.

export const IPC = {
  // Agent
  LIST_AGENTS: "list_agents",
  CREATE_AGENT: "create_agent",
  UPDATE_AGENT: "update_agent",
  DELETE_AGENT: "delete_agent",
  START_AGENT: "start_agent",
  STOP_AGENT: "stop_agent",

  // Channel
  LIST_CHANNELS: "list_channels",
  ADD_CHANNEL: "add_channel",
  UPDATE_CHANNEL: "update_channel",
  DELETE_CHANNEL: "delete_channel",

  // Provider
  LIST_PROVIDERS: "list_providers",
  CREATE_PROVIDER: "create_provider",
  UPDATE_PROVIDER: "update_provider",
  DELETE_PROVIDER: "delete_provider",
  VALIDATE_PROVIDER: "validate_provider",

  // Cron
  LIST_CRON_JOBS: "list_cron_jobs",
  CREATE_CRON_JOB: "create_cron_job",
  UPDATE_CRON_JOB: "update_cron_job",
  DELETE_CRON_JOB: "delete_cron_job",
  TRIGGER_CRON_JOB: "trigger_cron_job",

  // Admin
  CHECK_ADMIN_STATUS: "check_admin_status",
  RELAUNCH_AS_ADMIN: "relaunch_as_admin",

  // Environment & Install
  DETECT_ENV: "detect_env",
  INSTALL_OPENCLAW: "install_openclaw",
  INSTALL_OPENCLAW_IN_TERMINAL: "install_openclaw_in_terminal",

  // Connectivity
  TEST_CONNECTION: "test_connection",

  // Config
  BACKUP_OPENCLAW_CONFIG: "backup_openclaw_config",
  READ_OPENCLAW_CONFIG: "read_openclaw_config",
  WRITE_OPENCLAW_CONFIG: "write_openclaw_config",

  // Gateway
  GET_GATEWAY_STATUS: "get_gateway_status",
  START_GATEWAY: "start_gateway",
  STOP_GATEWAY: "stop_gateway",
  RESTART_GATEWAY: "restart_gateway",
  OPEN_DASHBOARD: "open_dashboard",
  PROBE_DASHBOARD_ENDPOINT: "probe_dashboard_endpoint",

  // Logs
  READ_LOGS: "read_logs",
  EXPORT_DIAGNOSTICS: "export_diagnostics",

  // Settings
  READ_APP_SETTINGS: "read_app_settings",
  WRITE_APP_SETTINGS: "write_app_settings",

  // Overview & Runbook
  GET_OVERVIEW_STATUS: "get_overview_status",
  GET_RUNBOOK_MODEL: "get_runbook_model",
} as const;
