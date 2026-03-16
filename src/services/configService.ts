import {
  defaultConfigValues,
  type BackupConfigData,
  type ConfigLoadResult,
  type ConfigFormValues,
  type ConnectionTestData,
  type ConnectionTestResult,
  type SaveConfigResult,
  type ReadConfigData,
  type WriteConfigData,
} from "../types/config";
import { invokeCommand, isTauriRuntime } from "./tauriClient";
import type { BackendError } from "../types/api";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toConfigPayload(values: ConfigFormValues): Record<string, unknown> {
  return {
    providerType: values.providerType,
    baseUrl: values.baseUrl,
    apiKey: values.apiKey,
    model: values.model,
    timeout: values.timeout,
    maxTokens: values.maxTokens,
    temperature: values.temperature,
    ollamaHost: values.ollamaHost,
  };
}

function fromUnknownConfig(content: Record<string, unknown>): ConfigFormValues {
  const provider =
    content.providerType === "ollama"
      ? "ollama"
      : content.providerType === "openai-compatible"
        ? "openai-compatible"
        : defaultConfigValues.providerType;

  return {
    providerType: provider,
    baseUrl: String(content.baseUrl ?? defaultConfigValues.baseUrl),
    apiKey: String(content.apiKey ?? defaultConfigValues.apiKey),
    model: String(content.model ?? defaultConfigValues.model),
    timeout: toFiniteNumber(content.timeout, defaultConfigValues.timeout),
    maxTokens: toFiniteNumber(content.maxTokens, defaultConfigValues.maxTokens),
    temperature: toFiniteNumber(content.temperature, defaultConfigValues.temperature),
    ollamaHost: String(content.ollamaHost ?? defaultConfigValues.ollamaHost),
  };
}

function buildUnexpectedErrorResult(
  error: unknown,
  fallbackSuggestion: string,
): SaveConfigResult | ConnectionTestResult {
  return {
    status: "error",
    detail: error instanceof Error ? error.message : "Unknown error",
    suggestion: fallbackSuggestion,
    code: "E_UNKNOWN",
  };
}

function toActionErrorResult(
  error: BackendError | undefined,
  fallbackSuggestion: string,
): SaveConfigResult | ConnectionTestResult {
  if (!error) {
    return {
      status: "error",
      detail: "Unknown runtime error.",
      suggestion: fallbackSuggestion,
      code: "E_UNKNOWN",
    };
  }

  return {
    status: "error",
    detail: error.message,
    suggestion: error.suggestion || fallbackSuggestion,
    code: error.code,
  };
}

function toConnectionTestResult(data: ConnectionTestData): ConnectionTestResult {
  return {
    status: data.status,
    detail: data.detail,
    suggestion: data.suggestion,
    code: data.code,
    latencyMs: data.latency_ms,
  };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export const configService = {
  async readConfig(): Promise<ConfigLoadResult> {
    const result = await invokeCommand<ReadConfigData>("read_openclaw_config", {
      path: null,
    });

    if (result.success && result.data) {
      return {
        values: fromUnknownConfig(result.data.content),
        path: result.data.path,
        usedDefaultValues: false,
      };
    }

    if (result.error?.code === "E_TAURI_UNAVAILABLE") {
      return {
        values: defaultConfigValues,
        usedDefaultValues: true,
        issue: {
          code: "E_PREVIEW_MODE",
          message: "当前运行在浏览器预览模式，尚未读取本地 OpenClaw 配置文件。",
          suggestion: "请使用 `npm run tauri:dev` 启动桌面模式后再读取和保存真实配置。",
        },
      };
    }

    return {
      values: defaultConfigValues,
      path: typeof result.error?.details?.path === "string" ? result.error.details.path : undefined,
      issue: result.error,
      usedDefaultValues: true,
    };
  },

  async testConnection(values: ConfigFormValues): Promise<ConnectionTestResult> {
    if (isTauriRuntime()) {
      try {
        const result = await invokeCommand<ConnectionTestData>("test_connection", {
          content: toConfigPayload(values),
        });
        if (result.success && result.data) {
          return toConnectionTestResult(result.data);
        }

        return toActionErrorResult(
          result.error,
          "Check backend network access, provider URL, and local certificates, then retry.",
        );
      } catch (error: unknown) {
        return buildUnexpectedErrorResult(
          error,
          "Check backend network access, provider URL, and local certificates, then retry.",
        );
      }
    }

    const startedAt = performance.now();
    try {
      if (values.providerType === "openai-compatible") {
        const url = `${stripTrailingSlash(values.baseUrl)}/models`;
        const response = await fetchWithTimeout(url, values.timeout, {
          Authorization: `Bearer ${values.apiKey}`,
        });
        const latencyMs = Math.round(performance.now() - startedAt);

        if (response.ok) {
          return {
            status: "success",
            detail: `Connected to OpenAI-compatible endpoint in ${latencyMs}ms.`,
            suggestion: "Connection looks good. You can save this configuration.",
            latencyMs,
          };
        }

        const text = await response.text();
        return {
          status: "failure",
          detail: `Request failed with HTTP ${response.status}. ${text.slice(0, 160)}`,
          suggestion:
            response.status === 401
              ? "Check API key and token permissions."
              : "Verify Base URL and API compatibility.",
          code: `HTTP_${response.status}`,
          latencyMs,
        };
      }

      const url = `${stripTrailingSlash(values.ollamaHost)}/api/tags`;
      const response = await fetchWithTimeout(url, values.timeout);
      const latencyMs = Math.round(performance.now() - startedAt);

      if (response.ok) {
        return {
          status: "success",
          detail: `Connected to Ollama in ${latencyMs}ms.`,
          suggestion: "Ollama is reachable. You can save this configuration.",
          latencyMs,
        };
      }

      const text = await response.text();
      return {
        status: "failure",
        detail: `Request failed with HTTP ${response.status}. ${text.slice(0, 160)}`,
        suggestion: "Ensure Ollama is running and host/port are correct.",
        code: `HTTP_${response.status}`,
        latencyMs,
      };
    } catch (error: unknown) {
      return buildUnexpectedErrorResult(
        error,
        values.providerType === "openai-compatible"
          ? "Check Base URL, API key, network policy, and TLS certificates."
          : "Check Ollama host, local firewall, and whether ollama serve is running.",
      );
    }
  },

  async saveConfig(values: ConfigFormValues): Promise<SaveConfigResult> {
    if (!isTauriRuntime()) {
      return {
        status: "error",
        detail: "Tauri invoke is unavailable in current runtime.",
        suggestion: "Run inside Tauri shell to save config to local file.",
        code: "E_TAURI_UNAVAILABLE",
      };
    }

    try {
      const backupResult = await invokeCommand<BackupConfigData>("backup_openclaw_config", {
        path: null,
      });
      if (!backupResult.success) {
        return {
          status: "failure",
          detail: backupResult.error?.message ?? "Failed to backup configuration.",
          suggestion:
            backupResult.error?.suggestion ?? "Check config directory permissions before retrying.",
          code: backupResult.error?.code ?? "E_CONFIG_BACKUP_FAILED",
        };
      }

      const writeResult = await invokeCommand<WriteConfigData>("write_openclaw_config", {
        path: null,
        content: toConfigPayload(values),
      });

      if (!writeResult.success || !writeResult.data) {
        return {
          status: "failure",
          detail: writeResult.error?.message ?? "Failed to save configuration.",
          suggestion:
            writeResult.error?.suggestion ??
            "Retry after checking file permissions and writable directory.",
          code: writeResult.error?.code ?? "E_SAVE_FAILED",
        };
      }

      return {
        status: "success",
        detail: "Configuration saved successfully.",
        suggestion: "Restart gateway if model/provider settings changed.",
        savedPath: writeResult.data.path,
        backupPath: backupResult.data?.backup_path ?? writeResult.data.backup_path ?? undefined,
      };
    } catch (error: unknown) {
      return buildUnexpectedErrorResult(
        error,
        "Check app logs and filesystem permissions, then retry.",
      );
    }
  },
};
