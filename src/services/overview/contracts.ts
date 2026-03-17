export type DetectEnvData = {
  platform?: string;
  npm_found?: boolean;
  npm_version?: string | null;
  openclaw_found?: boolean;
  openclaw_version?: string | null;
  openclaw_path?: string | null;
  config_path?: string | null;
};

export type GatewayStatusData = {
  running?: boolean;
  address?: string | null;
  statusDetail?: string;
  status_detail?: string;
  suggestion?: string;
  port?: number | null;
  pid?: number | null;
  lastStartedAt?: string | null;
};

export type ConfigReadData = {
  path?: string;
  exists?: boolean;
  content?: Record<string, unknown>;
};

export const APP_VERSION = "0.1.3";
