import { gatewayFetch } from "@/lib/gateway-client";
import type { BackendError } from "@/types/api";
import { invokeCommand } from "@/services/hostClient";
import type {
  CreateCronJobPayload,
  CronExecution,
  CronJob,
  CronJobStatus,
  UpdateCronJobPayload,
} from "@/types/cron";
import type { ServiceResult } from "@/types/status";
import { toBackendError } from "@/services/domainErrors";

interface CronDeleteResult {
  deleted: boolean;
  id: string;
}

interface CronTriggerResult {
  triggered: boolean;
  id: string;
  detail: string;
}

async function requestWithFallback<T>(
  paths: string[],
  options: RequestInit,
): Promise<T> {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      return await gatewayFetch<T>(path, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Cron API request failed.");
}

function normalizeStatus(value: unknown): CronJobStatus {
  const status = typeof value === "string" ? value : "idle";
  return status === "idle" ||
    status === "running" ||
    status === "success" ||
    status === "error" ||
    status === "disabled"
    ? status
    : "idle";
}

function normalizeExecution(raw: unknown): CronExecution {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status = normalizeStatus(value.status);
  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    startedAt:
      typeof value.startedAt === "string"
        ? value.startedAt
        : new Date().toISOString(),
    durationMs: Number.isFinite(value.durationMs) ? Number(value.durationMs) : undefined,
    status: status === "running" ? "running" : status === "error" ? "error" : "success",
    summary: typeof value.summary === "string" ? value.summary : undefined,
  };
}

function normalizeCronJob(raw: unknown): CronJob {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    name: typeof value.name === "string" ? value.name : "Unnamed Job",
    schedule: typeof value.schedule === "string" ? value.schedule : "0 * * * *",
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    agentId: typeof value.agentId === "string" ? value.agentId : "",
    channelId: typeof value.channelId === "string" ? value.channelId : "",
    template: typeof value.template === "string" ? value.template : "",
    nextRunAt: typeof value.nextRunAt === "string" ? value.nextRunAt : null,
    lastRunAt: typeof value.lastRunAt === "string" ? value.lastRunAt : null,
    status: normalizeStatus(value.status),
    history: Array.isArray(value.history)
      ? value.history.map(normalizeExecution)
      : [],
  };
}

function normalizeList(raw: unknown): CronJob[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeCronJob);
  }
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    if (Array.isArray(value.jobs)) {
      return value.jobs.map(normalizeCronJob);
    }
    if (Array.isArray(value.data)) {
      return value.data.map(normalizeCronJob);
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

export const cronService = {
  async listCronJobs(): Promise<ServiceResult<CronJob[]>> {
    try {
      const data = await requestWithFallback<unknown>(["/api/cron/jobs", "/api/cron"], {});
      return { ok: true, data: normalizeList(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("list_cron_jobs");
      if (commandResult.success) {
        return { ok: true, data: normalizeList(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to load cron jobs.",
          "Ensure gateway is running and cron API is reachable.",
        ),
      };
    }
  },

  async createCronJob(payload: CreateCronJobPayload): Promise<ServiceResult<CronJob>> {
    try {
      const data = await requestWithFallback<unknown>(["/api/cron/jobs", "/api/cron"], {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { ok: true, data: normalizeCronJob(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("create_cron_job", payload as unknown as Record<string, unknown>);
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: normalizeCronJob(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to create cron job.",
          "Check cron expression and selected targets, then retry.",
        ),
      };
    }
  },

  async updateCronJob(payload: UpdateCronJobPayload): Promise<ServiceResult<CronJob>> {
    try {
      const id = encodeURIComponent(payload.id);
      const data = await requestWithFallback<unknown>(
        [`/api/cron/jobs/${id}`, `/api/cron/${id}`],
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      return { ok: true, data: normalizeCronJob(data) };
    } catch (error) {
      const commandResult = await invokeCommand<unknown>("update_cron_job", payload as unknown as Record<string, unknown>);
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: normalizeCronJob(commandResult.data) };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to update cron job.",
          "Check cron fields and retry.",
        ),
      };
    }
  },

  async deleteCronJob(id: string): Promise<ServiceResult<CronDeleteResult>> {
    try {
      const encoded = encodeURIComponent(id);
      const data = await requestWithFallback<unknown>(
        [`/api/cron/jobs/${encoded}`, `/api/cron/${encoded}`],
        {
          method: "DELETE",
        },
      );
      if (data && typeof data === "object" && "deleted" in data) {
        return { ok: true, data: data as CronDeleteResult };
      }
      return { ok: true, data: { deleted: true, id } };
    } catch (error) {
      const commandResult = await invokeCommand<CronDeleteResult>("delete_cron_job", { id });
      if (commandResult.success) {
        return { ok: true, data: commandResult.data ?? { deleted: true, id } };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to delete cron job.",
          "Check whether the job is running, then retry.",
        ),
      };
    }
  },

  async triggerCronJob(id: string): Promise<ServiceResult<CronTriggerResult>> {
    try {
      const encoded = encodeURIComponent(id);
      const data = await requestWithFallback<unknown>(
        [`/api/cron/jobs/${encoded}/trigger`, `/api/cron/${encoded}/trigger`],
        {
          method: "POST",
        },
      );
      if (data && typeof data === "object") {
        const value = data as Record<string, unknown>;
        return {
          ok: true,
          data: {
            triggered: value.triggered !== false,
            id,
            detail:
              typeof value.detail === "string"
                ? value.detail
                : "Cron job triggered.",
          },
        };
      }
      return {
        ok: true,
        data: {
          triggered: true,
          id,
          detail: "Cron job triggered.",
        },
      };
    } catch (error) {
      const commandResult = await invokeCommand<CronTriggerResult>("trigger_cron_job", { id });
      if (commandResult.success && commandResult.data) {
        return { ok: true, data: commandResult.data };
      }
      return {
        ok: false,
        error: toResultError(
          commandResult.error ?? error,
          "Failed to trigger cron job.",
          "Check gateway runtime and retry.",
        ),
      };
    }
  },
};
