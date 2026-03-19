import {
  defaultConfigValues,
  type ConfigLoadResult,
  type ConfigFormValues,
  type ConnectionTestData,
  type ConnectionTestResult,
  type SaveConfigResult,
  type ReadConfigData,
  type WriteConfigData,
} from "../types/config";
import {
  createRuntimeAccessError,
  getRuntimeDiagnostics,
  invokeCommand,
  isTauriRuntime,
} from "./tauriClient";
import type { BackendError, RuntimeDiagnostics } from "../types/api";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNestedValue(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!isRecord(current) || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function readString(root: unknown, path: string[], fallback = ""): string {
  const value = readNestedValue(root, path);
  return typeof value === "string" ? value : fallback;
}

function stripOllamaSuffix(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/v1$/i, "");
}

function resolveOfficialProvider(content: Record<string, unknown>): {
  providerId: string;
  provider: Record<string, unknown>;
  primaryModelPath: string | null;
} | null {
  const providersRaw = readNestedValue(content, ["models", "providers"]);
  if (!isRecord(providersRaw)) {
    return null;
  }

  const primary = readString(content, ["agents", "defaults", "model", "primary"], "").trim();
  const primaryProviderId = primary.includes("/") ? primary.split("/")[0] : "";
  if (primaryProviderId && isRecord(providersRaw[primaryProviderId])) {
    return {
      providerId: primaryProviderId,
      provider: providersRaw[primaryProviderId] as Record<string, unknown>,
      primaryModelPath: primary || null,
    };
  }

  const entries = Object.entries(providersRaw).filter(([, value]) => isRecord(value));
  if (entries.length === 0) {
    return null;
  }

  const [providerId, provider] = entries[0];
  return {
    providerId,
    provider: provider as Record<string, unknown>,
    primaryModelPath: primary || null,
  };
}

function parseModelFromPrimary(primaryModelPath: string | null): string {
  if (!primaryModelPath) {
    return defaultConfigValues.model;
  }
  const parts = primaryModelPath.split("/");
  const last = parts[parts.length - 1] ?? "";
  return last.trim() || defaultConfigValues.model;
}

function readModelParams(
  content: Record<string, unknown>,
  primaryModelPath: string | null,
): Record<string, unknown> | null {
  if (!primaryModelPath) {
    return null;
  }

  const direct = readNestedValue(content, ["agents", "defaults", "models", primaryModelPath, "params"]);
  return isRecord(direct) ? direct : null;
}

function fromUnknownConfig(content: Record<string, unknown>): ConfigFormValues {
  const legacyProvider =
    content.providerType === "ollama"
      ? "ollama"
      : content.providerType === "openai-compatible"
        ? "openai-compatible"
        : null;

  if (legacyProvider) {
    return {
      providerType: legacyProvider,
      baseUrl: String(content.baseUrl ?? defaultConfigValues.baseUrl),
      apiKey: String(content.apiKey ?? defaultConfigValues.apiKey),
      model: String(content.model ?? defaultConfigValues.model),
      timeout: toFiniteNumber(content.timeout, defaultConfigValues.timeout),
      maxTokens: toFiniteNumber(content.maxTokens, defaultConfigValues.maxTokens),
      temperature: toFiniteNumber(content.temperature, defaultConfigValues.temperature),
      ollamaHost: String(content.ollamaHost ?? defaultConfigValues.ollamaHost),
    };
  }

  const official = resolveOfficialProvider(content);
  if (!official) {
    return defaultConfigValues;
  }

  const providerApi = readString(official.provider, ["api"], "").toLowerCase();
  const baseUrl = readString(official.provider, ["baseUrl"], defaultConfigValues.baseUrl);
  const apiKey =
    readString(official.provider, ["apiKey"], "") ||
    readString(official.provider, ["auth", "apiKey"], "") ||
    defaultConfigValues.apiKey;
  const primaryModel = parseModelFromPrimary(official.primaryModelPath);
  const providerModels = readNestedValue(official.provider, ["models"]);
  const firstModel =
    Array.isArray(providerModels) && providerModels.length > 0 && isRecord(providerModels[0])
      ? String(
          providerModels[0].id ??
            providerModels[0].name ??
            providerModels[0].modelId ??
            primaryModel,
        )
      : primaryModel;
  const params = readModelParams(content, official.primaryModelPath);

  const timeoutValue =
    toFiniteNumber(params?.timeoutMs, Number.NaN) ||
    toFiniteNumber(params?.timeout, Number.NaN) ||
    toFiniteNumber(content.timeout, defaultConfigValues.timeout);
  const maxTokensValue =
    toFiniteNumber(params?.maxTokens, Number.NaN) ||
    toFiniteNumber(params?.max_tokens, Number.NaN) ||
    toFiniteNumber(content.maxTokens, defaultConfigValues.maxTokens);
  const temperatureValue =
    toFiniteNumber(params?.temperature, Number.NaN) ||
    toFiniteNumber(content.temperature, defaultConfigValues.temperature);

  const providerType =
    providerApi === "ollama" || official.providerId.toLowerCase().includes("ollama")
      ? "ollama"
      : "openai-compatible";

  return {
    providerType,
    baseUrl:
      providerType === "ollama"
        ? stripOllamaSuffix(baseUrl) || defaultConfigValues.ollamaHost
        : baseUrl || defaultConfigValues.baseUrl,
    apiKey,
    model: firstModel || defaultConfigValues.model,
    timeout: Number.isFinite(timeoutValue) ? timeoutValue : defaultConfigValues.timeout,
    maxTokens: Number.isFinite(maxTokensValue) ? maxTokensValue : defaultConfigValues.maxTokens,
    temperature: Number.isFinite(temperatureValue)
      ? temperatureValue
      : defaultConfigValues.temperature,
    ollamaHost:
      providerType === "ollama"
        ? stripOllamaSuffix(baseUrl) || defaultConfigValues.ollamaHost
        : String(content.ollamaHost ?? defaultConfigValues.ollamaHost),
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

function buildConfigRuntimeIssue(runtime: RuntimeDiagnostics): BackendError {
  if (runtime.mode === "browser-preview") {
    return {
      code: "E_PREVIEW_MODE",
      message: "当前运行在浏览器预览模式，尚未读取本地 OpenClaw 配置文件。",
      suggestion: "请使用 ClawDesk 桌面应用或 `npm run tauri:dev` 后再读取和保存真实配置。",
      details: {
        runtimeMode: runtime.mode,
        bridgeSource: runtime.bridgeSource,
      },
    };
  }

  return {
    code: "E_TAURI_UNAVAILABLE",
    message: "当前已进入桌面窗口，但 Tauri 命令桥不可用，无法读取本地 OpenClaw 配置。",
    suggestion: "请重启或重新安装 ClawDesk；若问题持续，请检查前端是否正确集成 Tauri API。",
    details: {
      runtimeMode: runtime.mode,
      bridgeSource: runtime.bridgeSource,
    },
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

    if (result.error?.code === "E_PREVIEW_MODE" || result.error?.code === "E_TAURI_UNAVAILABLE") {
      const runtime = getRuntimeDiagnostics();
      return {
        values: defaultConfigValues,
        usedDefaultValues: true,
        issue: buildConfigRuntimeIssue(runtime),
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
    const runtime = getRuntimeDiagnostics();

    if (runtime.mode === "tauri-runtime-available") {
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

    if (runtime.mode === "tauri-runtime-unavailable") {
      return toActionErrorResult(
        createRuntimeAccessError(runtime),
        "Check desktop runtime initialization and retry.",
      );
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
      const runtimeError = createRuntimeAccessError();
      return {
        status: runtimeError.code === "E_PREVIEW_MODE" ? "failure" : "error",
        detail: runtimeError.message,
        suggestion: runtimeError.suggestion,
        code: runtimeError.code,
      };
    }

    try {
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
        backupPath: writeResult.data.backup_path ?? undefined,
      };
    } catch (error: unknown) {
      return buildUnexpectedErrorResult(
        error,
        "Check app logs and filesystem permissions, then retry.",
      );
    }
  },
};
