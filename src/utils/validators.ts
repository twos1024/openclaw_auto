import type { ConfigFormErrors, ConfigFormValues } from "../types/config";

const isHttpUrl = (value: string): boolean => /^https?:\/\/.+/i.test(value.trim());

export function validateConfigForm(values: ConfigFormValues): ConfigFormErrors {
  const errors: ConfigFormErrors = {};

  if (!values.model.trim()) {
    errors.model = "Model is required.";
  }

  if (!Number.isFinite(values.timeout) || values.timeout < 1000 || values.timeout > 300000) {
    errors.timeout = "Timeout must be between 1000 and 300000 ms.";
  }

  if (!Number.isFinite(values.maxTokens) || values.maxTokens < 1 || values.maxTokens > 200000) {
    errors.maxTokens = "Max tokens must be between 1 and 200000.";
  }

  if (!Number.isFinite(values.temperature) || values.temperature < 0 || values.temperature > 2) {
    errors.temperature = "Temperature must be between 0 and 2.";
  }

  if (values.providerType === "openai-compatible") {
    if (!values.baseUrl.trim()) {
      errors.baseUrl = "Base URL is required for OpenAI-compatible mode.";
    } else if (!isHttpUrl(values.baseUrl)) {
      errors.baseUrl = "Base URL must start with http:// or https://";
    }

    if (!values.apiKey.trim()) {
      errors.apiKey = "API key is required for OpenAI-compatible mode.";
    }
  }

  if (values.providerType === "ollama") {
    if (!values.ollamaHost.trim()) {
      errors.ollamaHost = "Ollama host is required.";
    } else if (!isHttpUrl(values.ollamaHost)) {
      errors.ollamaHost = "Ollama host must start with http:// or https://";
    }
  }

  return errors;
}

export function hasValidationError(errors: ConfigFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

