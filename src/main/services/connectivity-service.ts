import { AppError, ErrorCode } from "../models/error.js";

export interface ConnectionConfigInput {
  providerType: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  maxTokens?: number;
  temperature?: number;
  ollamaHost: string;
}

export interface ConnectionTestData {
  status: string;
  detail: string;
  suggestion: string;
  code: string | null;
  latencyMs: number | null;
}

export async function testConnection(input: ConnectionConfigInput): Promise<ConnectionTestData> {
  if (!input.timeout || input.timeout <= 0) {
    throw new AppError(ErrorCode.InvalidInput, "Timeout must be greater than 0 milliseconds.", "Provide a positive timeout value before testing the connection.");
  }

  const providerType = input.providerType.trim();
  if (providerType !== "openai-compatible" && providerType !== "ollama") {
    throw new AppError(ErrorCode.InvalidInput, "Unsupported provider type for connection test.", "Choose either OpenAI-compatible or Ollama mode, then retry.", { providerType });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeout);

  const isOpenAI = providerType === "openai-compatible";
  const requestUrl = isOpenAI
    ? `${input.baseUrl.replace(/\/$/, "")}/models`
    : `${input.ollamaHost.replace(/\/$/, "")}/api/tags`;
  const suggestion = isOpenAI
    ? "Check Base URL, API key, network policy, and TLS certificates."
    : "Check Ollama host, local firewall, and whether `ollama serve` is running.";

  const startedAt = Date.now();

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (isOpenAI && input.apiKey) {
      headers["Authorization"] = `Bearer ${input.apiKey}`;
    }

    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    const statusCode = response.status;

    if (response.ok) {
      return {
        status: "success",
        detail: isOpenAI
          ? `Connected to OpenAI-compatible endpoint in ${latencyMs}ms.`
          : `Connected to Ollama in ${latencyMs}ms.`,
        suggestion: isOpenAI
          ? "Connection looks good. You can save this configuration."
          : "Ollama is reachable. You can save this configuration.",
        code: null,
        latencyMs,
      };
    }

    const body = await response.text().catch(() => "");
    const failSuggestion = isOpenAI
      ? statusCode === 401
        ? "Check API key and token permissions."
        : "Verify Base URL and API compatibility."
      : "Ensure Ollama is running and host/port are correct.";

    return {
      status: "failure",
      detail: `Request failed with HTTP ${statusCode}. ${body.slice(0, 160)}`,
      suggestion: failSuggestion,
      code: `HTTP_${statusCode}`,
      latencyMs,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    const isTimeout = (err as Error)?.name === "AbortError";
    return {
      status: "error",
      detail: isTimeout ? `Request timed out after ${input.timeout}ms.` : String((err as Error)?.message ?? err),
      suggestion,
      code: "E_CONNECTION_TEST",
      latencyMs: isTimeout ? null : latencyMs,
    };
  }
}
