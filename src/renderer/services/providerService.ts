import { gatewayFetch } from "@/lib/gateway-client";
import type { BackendError } from "@/types/api";
import { invokeCommand } from "@/services/tauriClient";
import type {
  CreateProviderPayload,
  Provider,
  ProviderVendor,
  UpdateProviderPayload,
} from "@/types/provider";
import type { ServiceResult } from "@/types/status";
import { toBackendError } from "@/services/domainErrors";

interface ProviderDeleteResult {
  deleted: boolean;
  id: string;
}

interface ProviderValidationResult {
  valid: boolean;
  detail: string;
}

async function requestWithFallback<T>(paths: string[], options: RequestInit): Promise<T> {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      return await gatewayFetch<T>(path, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Provider API request failed.");
}

function normalizeVendor(value: unknown): ProviderVendor {
  const vendor = typeof value === "string" ? value : "custom";
  return vendor === "openai" ||
    vendor === "anthropic" ||
    vendor === "deepseek" ||
    vendor === "ollama" ||
    vendor === "google" ||
    vendor === "qwen" ||
    vendor === "zhipu" ||
    vendor === "moonshot" ||
    vendor === "groq" ||
    vendor === "mistral" ||
    vendor === "custom"
    ? vendor
    : "custom";
}

function normalizeProvider(raw: unknown): Provider {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof value.id === "string" ? value.id : crypto.randomUUID();
  const status = typeof value.status === "string" ? value.status : "ready";
  return {
    id,
    name: typeof value.name === "string" ? value.name : "Unnamed Provider",
    vendor: normalizeVendor(value.vendor),
    apiKeyMasked:
      typeof value.apiKeyMasked === "string"
        ? value.apiKeyMasked
        : typeof value.apiKey === "string"
          ? `${value.apiKey.slice(0, 3)}***`
          : undefined,
    baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : undefined,
    modelCount: Number.isFinite(value.modelCount)
      ? Number(value.modelCount)
      : Array.isArray(value.models)
        ? value.models.length
        : 0,
    status:
      status === "ready" ||
      status === "checking" ||
      status === "error" ||
      status === "disabled"
        ? status
        : "ready",
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  };
}

function normalizeList(raw: unknown): Provider[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeProvider);
  }
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    if (Array.isArray(value.providers)) {
      return value.providers.map(normalizeProvider);
    }
    if (Array.isArray(value.data)) {
      return value.data.map(normalizeProvider);
    }
  }
  return [];
}

function toResultError(
  error: unknown,
  fallbackMessage: string,
  fallbackSuggestion: string,
): BackendError {
  return toBackendError(error, fallbackMessage, fallbackSuggestion);
}

export const providerService = {
  async listProviders(): Promise<ServiceResult<Provider[]>> {
    try {
      const data = await requestWithFallback<unknown>(["/api/providers", "/providers"], {});
      return { ok: true, data: normalizeList(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("list_providers");
      if (commandResult.success) {
        return { ok: true, data: normalizeList(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to load providers.",
          "Ensure gateway is running and provider API is reachable.",
        ),
      };
    }
  },

  async createProvider(payload: CreateProviderPayload): Promise<ServiceResult<Provider>> {
    try {
      const data = await requestWithFallback<unknown>(["/api/providers", "/providers"], {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { ok: true, data: normalizeProvider(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("create_provider", payload as unknown as Record<string, unknown>);
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: normalizeProvider(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to create provider.",
          "Check provider credentials and retry.",
        ),
      };
    }
  },

  async updateProvider(payload: UpdateProviderPayload): Promise<ServiceResult<Provider>> {
    try {
      const id = encodeURIComponent(payload.id);
      const data = await requestWithFallback<unknown>(
        [`/api/providers/${id}`, `/providers/${id}`],
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      return { ok: true, data: normalizeProvider(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("update_provider", payload as unknown as Record<string, unknown>);
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: normalizeProvider(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to update provider.",
          "Check provider fields and retry.",
        ),
      };
    }
  },

  async deleteProvider(id: string): Promise<ServiceResult<ProviderDeleteResult>> {
    try {
      const encoded = encodeURIComponent(id);
      const data = await requestWithFallback<unknown>(
        [`/api/providers/${encoded}`, `/providers/${encoded}`],
        {
          method: "DELETE",
        },
      );
      if (data && typeof data === "object" && "deleted" in data) {
        return { ok: true, data: data as ProviderDeleteResult };
      }
      return { ok: true, data: { deleted: true, id } };
    } catch (error) {
      const commandResult = await invokeCommand<ProviderDeleteResult>("delete_provider", { id });
      if (commandResult.success) {
        return { ok: true, data: commandResult.data ?? { deleted: true, id } };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to delete provider.",
          "Check whether provider is used by active agents, then retry.",
        ),
      };
    }
  },

  async validateProvider(id: string): Promise<ServiceResult<ProviderValidationResult>> {
    try {
      let data: unknown;
      try {
        const encoded = encodeURIComponent(id);
        data = await requestWithFallback<unknown>(
          [`/api/providers/${encoded}/validate`, `/providers/${encoded}/validate`],
          {
            method: "POST",
          },
        );
      } catch (primaryError) {
        try {
          const encoded = encodeURIComponent(id);
          data = await requestWithFallback<unknown>(
            [`/api/providers/${encoded}/test`, `/providers/${encoded}/test`],
            {
              method: "POST",
            },
          );
        } catch (fallbackError) {
          throw fallbackError instanceof Error ? fallbackError : primaryError;
        }
      }
      if (data && typeof data === "object") {
        const value = data as Record<string, unknown>;
        const valid =
          typeof value.valid === "boolean"
            ? value.valid
            : typeof value.ok === "boolean"
              ? value.ok
              : typeof value.success === "boolean"
                ? value.success
                : false;
        return {
          ok: true,
          data: {
            valid,
            detail:
              typeof value.detail === "string"
                ? value.detail
                : valid
                  ? "Provider validation succeeded."
                  : "Provider validation failed.",
          },
        };
      }
      return {
        ok: true,
        data: {
          valid: true,
          detail: "Provider validation succeeded.",
        },
      };
    } catch (error) {
      const commandResult = await invokeCommand<ProviderValidationResult>("validate_provider", { id });
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: commandResult.data };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to validate provider.",
          "Check network access and provider credentials, then retry.",
        ),
      };
    }
  },
};
