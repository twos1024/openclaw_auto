import type { BackendError, CommandResult } from "./api";

export type ProviderType = "openai-compatible" | "ollama";

export interface ConfigFormValues {
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
  ollamaHost: string;
}

export type ConfigFormErrors = Partial<Record<keyof ConfigFormValues, string>>;

export interface ReadConfigData {
  path: string;
  content: Record<string, unknown>;
  size_bytes: number;
  modified_at?: string | null;
}

export interface WriteConfigData {
  path: string;
  backup_path?: string | null;
  bytes_written: number;
}

export interface BackupConfigData {
  path: string;
  backup_path?: string | null;
  skipped?: boolean;
}

export interface ConnectionTestData {
  status: "success" | "failure" | "error";
  detail: string;
  suggestion: string;
  code?: string;
  latency_ms?: number;
}

export interface ConnectionTestResult {
  status: "success" | "failure" | "error";
  detail: string;
  suggestion: string;
  code?: string;
  latencyMs?: number;
}

export interface SaveConfigResult {
  status: "success" | "failure" | "error";
  detail: string;
  suggestion: string;
  code?: string;
  savedPath?: string;
  backupPath?: string;
}

export interface ConfigLoadResult {
  values: ConfigFormValues;
  path?: string;
  issue?: BackendError;
  usedDefaultValues: boolean;
}

export type { BackendError, CommandResult };

export const defaultConfigValues: ConfigFormValues = {
  providerType: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  timeout: 15000,
  maxTokens: 2048,
  temperature: 0.7,
  ollamaHost: "http://127.0.0.1:11434",
};
