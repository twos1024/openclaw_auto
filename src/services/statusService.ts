import type { OverviewStatus, ServiceResult } from "../types/status";
import { getHostDiagnostics, invokeCommand } from "./hostClient";
import {
  buildBackendUnavailableOverview,
  buildPreviewOverview,
  buildRuntimeUnavailableOverview,
} from "./overview/builders";

function nowIso(): string {
  return new Date().toISOString();
}

export const statusService = {
  async getOverviewStatus(): Promise<ServiceResult<OverviewStatus>> {
    const updatedAt = nowIso();
    const runtime = getHostDiagnostics();
    if (runtime.mode === "browser-preview") {
      return {
        ok: true,
        data: buildPreviewOverview(updatedAt, runtime),
      };
    }

    if (runtime.mode === "host-runtime-unavailable") {
      return {
        ok: true,
        data: buildRuntimeUnavailableOverview(updatedAt, runtime),
      };
    }

    const result = await invokeCommand<OverviewStatus>("get_overview_status");
    if (result.success && result.data) {
      return {
        ok: true,
        data: result.data,
      };
    }

    const error = result.error ?? {
      code: "E_UNKNOWN",
      message: "Failed to load overview status from backend.",
      suggestion: "Check desktop runtime status and retry.",
    };

    return {
      ok: false,
      error,
      data: buildBackendUnavailableOverview(updatedAt, runtime, error.message),
    };
  },
};
