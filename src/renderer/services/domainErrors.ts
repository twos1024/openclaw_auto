import type { BackendError } from "@/types/api";

export function toBackendError(error: unknown, fallbackMessage: string, fallbackSuggestion: string): BackendError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const value = error as Partial<BackendError>;
    return {
      code: value.code ?? "E_UNKNOWN",
      message: value.message ?? fallbackMessage,
      suggestion: value.suggestion ?? fallbackSuggestion,
      details: value.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "E_NETWORK_FAILED",
      message: error.message || fallbackMessage,
      suggestion: fallbackSuggestion,
    };
  }

  return {
    code: "E_UNKNOWN",
    message: fallbackMessage,
    suggestion: fallbackSuggestion,
  };
}
