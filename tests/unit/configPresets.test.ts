import { describe, expect, it } from "vitest";
import {
  applyOpenAiCompatiblePreset,
  inferOpenAiCompatiblePresetId,
  openAiCompatiblePresets,
} from "../../src/services/configPresets";
import { defaultConfigValues, type ConfigFormValues } from "../../src/types/config";

function createFixture(overrides: Partial<ConfigFormValues> = {}): ConfigFormValues {
  return {
    ...defaultConfigValues,
    providerType: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-live",
    model: "gpt-4o-mini",
    timeout: 30000,
    maxTokens: 4096,
    temperature: 0.4,
    ollamaHost: "http://127.0.0.1:11434",
    ...overrides,
  };
}

describe("configPresets", () => {
  it("infers deepseek preset from normalized base URL", () => {
    expect(inferOpenAiCompatiblePresetId("https://api.deepseek.com/v1/")).toBe("deepseek");
  });

  it("infers openrouter preset from normalized base URL", () => {
    expect(inferOpenAiCompatiblePresetId("https://openrouter.ai/api/v1")).toBe("openrouter");
  });

  it("falls back to custom preset for unknown compatible endpoints", () => {
    expect(inferOpenAiCompatiblePresetId("https://llm.internal.example/v1")).toBe("custom");
  });

  it("applies a preset while preserving shared auth and tuning fields", () => {
    const next = applyOpenAiCompatiblePreset(createFixture(), "deepseek");

    expect(next.providerType).toBe("openai-compatible");
    expect(next.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(next.model).toBe("deepseek-chat");
    expect(next.apiKey).toBe("sk-live");
    expect(next.timeout).toBe(30000);
    expect(next.maxTokens).toBe(4096);
    expect(next.temperature).toBe(0.4);
    expect(next.ollamaHost).toBe("http://127.0.0.1:11434");
  });

  it("exposes a custom option plus known presets for the config UI", () => {
    expect(openAiCompatiblePresets.map((preset) => preset.id)).toEqual([
      "custom",
      "openai",
      "deepseek",
      "openrouter",
    ]);
  });
});
