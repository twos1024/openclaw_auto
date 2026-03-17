import {
  defaultConfigValues,
  type ConfigFormValues,
  type OpenAiCompatiblePresetDefinition,
  type OpenAiCompatiblePresetId,
} from "../types/config";

export const openAiCompatiblePresets: OpenAiCompatiblePresetDefinition[] = [
  {
    id: "custom",
    label: "Custom Compatible Endpoint",
    description: "Use any OpenAI-compatible API endpoint.",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Official OpenAI API endpoint.",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek OpenAI-compatible endpoint.",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "Route requests through OpenRouter's OpenAI-compatible API.",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
  },
];

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function inferOpenAiCompatiblePresetId(baseUrl: string): OpenAiCompatiblePresetId {
  const normalized = normalizeBaseUrl(baseUrl);

  const match = openAiCompatiblePresets.find((preset) => {
    if (!preset.baseUrl) {
      return false;
    }

    return normalizeBaseUrl(preset.baseUrl) === normalized;
  });

  return match?.id ?? "custom";
}

export function applyOpenAiCompatiblePreset(
  values: ConfigFormValues,
  presetId: OpenAiCompatiblePresetId,
): ConfigFormValues {
  const preset = openAiCompatiblePresets.find((candidate) => candidate.id === presetId);
  if (!preset || preset.id === "custom" || !preset.baseUrl) {
    return {
      ...values,
      providerType: "openai-compatible",
    };
  }

  return {
    ...values,
    providerType: "openai-compatible",
    baseUrl: preset.baseUrl,
    model: preset.defaultModel ?? defaultConfigValues.model,
  };
}
