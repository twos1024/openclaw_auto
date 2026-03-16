import { describe, expect, it } from "vitest";
import { defaultConfigValues, type ConfigFormValues } from "../../src/types/config";
import { hasValidationError, validateConfigForm } from "../../src/utils/validators";

function createOpenAiFixture(overrides: Partial<ConfigFormValues> = {}): ConfigFormValues {
  return {
    ...defaultConfigValues,
    providerType: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    timeout: 15000,
    maxTokens: 2048,
    temperature: 0.7,
    ...overrides,
  };
}

describe("validateConfigForm", () => {
  it("returns apiKey error when provider is openai-compatible and apiKey is empty", () => {
    const input = createOpenAiFixture({ apiKey: "" });
    const errors = validateConfigForm(input);

    expect(errors.apiKey).toBe("API key is required for OpenAI-compatible mode.");
  });

  it("returns ollamaHost error when provider is ollama and host is invalid", () => {
    const input = createOpenAiFixture({
      providerType: "ollama",
      ollamaHost: "127.0.0.1:11434",
      apiKey: "",
    });
    const errors = validateConfigForm(input);

    expect(errors.ollamaHost).toBe("Ollama host must start with http:// or https://");
  });

  it("returns timeout error when timeout is outside allowed range", () => {
    const input = createOpenAiFixture({ timeout: 500 });
    const errors = validateConfigForm(input);

    expect(errors.timeout).toBe("Timeout must be between 1000 and 300000 ms.");
  });

  it("returns no validation error for a valid openai-compatible form", () => {
    const input = createOpenAiFixture();
    const errors = validateConfigForm(input);

    expect(hasValidationError(errors)).toBe(false);
  });
});

