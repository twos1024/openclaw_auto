/**
 * Pure functions for parsing unknown OpenClaw config objects into typed ConfigFormValues.
 * Extracted from configService to keep the service layer focused on I/O orchestration.
 */

import { defaultConfigValues, type ConfigFormValues } from "../types/config";

export function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toConfigPayload(values: ConfigFormValues): Record<string, unknown> {
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

/**
 * Parse an unknown config object (legacy flat format or official nested format)
 * into a strongly-typed ConfigFormValues.
 */
export function fromUnknownConfig(content: Record<string, unknown>): ConfigFormValues {
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
