import { gatewayFetch } from "@/lib/gateway-client";
import type { BackendError } from "@/types/api";
import { invokeCommand } from "@/services/tauriClient";
import type {
  Channel,
  CreateChannelPayload,
  UpdateChannelPayload,
} from "@/types/channel";
import type { ServiceResult } from "@/types/status";
import { toBackendError } from "@/services/domainErrors";

interface ChannelDeleteResult {
  deleted: boolean;
  id: string;
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
  throw lastError ?? new Error("Channel API request failed.");
}

function normalizeChannel(raw: unknown): Channel {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof value.id === "string" ? value.id : crypto.randomUUID();
  const type = typeof value.type === "string" ? value.type : "openclaw";
  const status = typeof value.status === "string" ? value.status : "idle";
  const connectionType =
    typeof value.connectionType === "string" ? value.connectionType : "none";
  const updatedAt =
    typeof value.updatedAt === "string"
      ? value.updatedAt
      : new Date().toISOString();
  return {
    id,
    name: typeof value.name === "string" ? value.name : "Unnamed Channel",
    type:
      type === "openclaw" ||
      type === "openai-compatible" ||
      type === "custom" ||
      type === "webhook"
        ? type
        : "custom",
    status:
      status === "connected" ||
      status === "disconnected" ||
      status === "error" ||
      status === "idle"
        ? status
        : "idle",
    connectionType:
      connectionType === "api-key" ||
      connectionType === "oauth" ||
      connectionType === "none"
        ? connectionType
        : "none",
    description:
      typeof value.description === "string" ? value.description : undefined,
    providerId:
      typeof value.providerId === "string" ? value.providerId : undefined,
    agentIds: Array.isArray(value.agentIds)
      ? value.agentIds.filter((item): item is string => typeof item === "string")
      : [],
    updatedAt,
  };
}

function normalizeList(raw: unknown): Channel[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeChannel);
  }
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    if (Array.isArray(value.channels)) {
      return value.channels.map(normalizeChannel);
    }
    if (Array.isArray(value.data)) {
      return value.data.map(normalizeChannel);
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

export const channelService = {
  async listChannels(): Promise<ServiceResult<Channel[]>> {
    try {
      const data = await requestWithFallback<unknown>(["/api/channels", "/channels"], {});
      return { ok: true, data: normalizeList(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("list_channels");
      if (commandResult.success) {
        return { ok: true, data: normalizeList(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to load channels.",
          "Ensure gateway is running and channel API is reachable.",
        ),
      };
    }
  },

  async createChannel(payload: CreateChannelPayload): Promise<ServiceResult<Channel>> {
    try {
      const data = await requestWithFallback<unknown>(["/api/channels", "/channels"], {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { ok: true, data: normalizeChannel(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("add_channel", payload as unknown as Record<string, unknown>);
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: normalizeChannel(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to create channel.",
          "Check channel fields and gateway logs, then retry.",
        ),
      };
    }
  },

  async updateChannel(payload: UpdateChannelPayload): Promise<ServiceResult<Channel>> {
    try {
      const id = encodeURIComponent(payload.id);
      const data = await requestWithFallback<unknown>(
        [`/api/channels/${id}`, `/channels/${id}`],
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      return { ok: true, data: normalizeChannel(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("update_channel", payload as unknown as Record<string, unknown>);
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: normalizeChannel(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to update channel.",
          "Check channel state and retry.",
        ),
      };
    }
  },

  async deleteChannel(id: string): Promise<ServiceResult<ChannelDeleteResult>> {
    try {
      const encoded = encodeURIComponent(id);
      const data = await requestWithFallback<unknown>(
        [`/api/channels/${encoded}`, `/channels/${encoded}`],
        {
          method: "DELETE",
        },
      );
      if (data && typeof data === "object" && "deleted" in data) {
        return { ok: true, data: data as ChannelDeleteResult };
      }
      return { ok: true, data: { deleted: true, id } };
    } catch (error) {
      const commandResult = await invokeCommand<ChannelDeleteResult>("delete_channel", { id });
      if (commandResult.success) {
        return { ok: true, data: commandResult.data ?? { deleted: true, id } };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to delete channel.",
          "Check whether the channel is bound to running jobs, then retry.",
        ),
      };
    }
  },
};
