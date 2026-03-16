import type { BackendError } from "./api";

export interface AppSettings {
  preferredInstallSource: "npm-global";
  diagnosticsDir: string;
  logLineLimit: number;
  gatewayPollMs: number;
}

export interface ReadAppSettingsData {
  path: string;
  exists: boolean;
  content: {
    preferredInstallSource: string;
    diagnosticsDir: string;
    logLineLimit: number;
    gatewayPollMs: number;
  };
  modifiedAt?: string | null;
}

export interface WriteAppSettingsData {
  path: string;
  backupPath?: string | null;
  bytesWritten: number;
}

export interface SettingsLoadResult {
  values: AppSettings;
  path?: string;
  exists: boolean;
  modifiedAt?: string | null;
  issue?: BackendError;
}

export interface SaveSettingsResult {
  status: "success" | "failure" | "error";
  detail: string;
  suggestion: string;
  code?: string;
  savedPath?: string;
  backupPath?: string;
}

export type SettingsFormErrors = Partial<Record<keyof AppSettings, string>>;

export const defaultAppSettings: AppSettings = {
  preferredInstallSource: "npm-global",
  diagnosticsDir: "",
  logLineLimit: 1200,
  gatewayPollMs: 5000,
};
