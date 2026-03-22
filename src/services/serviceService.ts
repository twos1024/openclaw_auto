import type { BackendError } from "../types/api";
import type { DashboardProbeResult } from "../types/dashboard";
import { getRuntimeDiagnostics, invokeCommand } from "./tauriClient";

export type GatewayRuntimeState = "running" | "stopped" | "starting" | "stopping" | "error";

export interface GatewayStatus {
  state: GatewayRuntimeState;
  running: boolean;
  port: number | null;
  address: string | null;
  pid: number | null;
  lastStartedAt: string | null;
  statusDetail: string;
  suggestion: string;
  portConflictPort: number | null;
}

export interface ServiceActionResult {
  status: "success" | "failure" | "error";
  detail: string;
  suggestion: string;
  code?: string;
  conflictPort?: number;
  address?: string | null;
  pid?: number | null;
}

const STATUS_CACHE_TTL_MS = 5_000;
let statusCache: { value: GatewayStatus; cachedAt: number } | null = null;
let statusInFlight: Promise<GatewayStatus> | null = null;

function cloneGatewayStatus(value: GatewayStatus): GatewayStatus {
  return { ...value };
}

function invalidateGatewayStatusCache(): void {
  statusCache = null;
}

function normalizeProbeData(raw: unknown, fallbackAddress: string): DashboardProbeResult {
  if (!raw || typeof raw !== "object") {
    return {
      address: fallbackAddress,
      reachable: false,
      result: "unreachable",
      httpStatus: null,
      responseTimeMs: null,
      detail: "Dashboard probe returned an empty payload.",
    };
  }

  const obj = raw as Record<string, unknown>;
  const address = typeof obj.address === "string" ? obj.address : fallbackAddress;
  const result = typeof obj.result === "string" ? obj.result : "unreachable";
  return {
    address,
    reachable: Boolean(obj.reachable),
    result:
      result === "reachable" ||
      result === "timeout" ||
      result === "unreachable" ||
      result === "invalid-address" ||
      result === "idle" ||
      result === "probing"
        ? result
        : "unreachable",
    httpStatus: toNumber(obj.httpStatus ?? obj.http_status),
    responseTimeMs: toNumber(obj.responseTimeMs ?? obj.response_time_ms),
    detail:
      typeof obj.detail === "string" ? obj.detail : "Dashboard endpoint probe did not return a detail message.",
  };
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeState(value: unknown): GatewayRuntimeState {
  if (value === "running" || value === "stopped" || value === "starting" || value === "stopping") {
    return value;
  }
  return "error";
}

function normalizeStatusData(raw: unknown): GatewayStatus {
  if (!raw || typeof raw !== "object") {
    return buildPreviewStatus();
  }
  const obj = raw as Record<string, unknown>;

  const running = Boolean(obj.running);
  const port = toNumber(obj.port ?? obj.gatewayPort);
  const addressValue = obj.address ?? obj.dashboardUrl ?? (port ? `http://127.0.0.1:${port}` : null);
  const address = typeof addressValue === "string" ? addressValue : null;
  const pid = toNumber(obj.pid);
  const state = safeState(obj.state ?? (running ? "running" : "stopped"));
  const detail =
    typeof obj.statusDetail === "string"
      ? obj.statusDetail
      : running
        ? "Gateway is running."
        : "Gateway is not running.";
  const suggestion =
    typeof obj.suggestion === "string"
      ? obj.suggestion
      : running
        ? "You can open dashboard or restart service if needed."
        : "Click Start Gateway to launch OpenClaw service.";

  const portConflictPort = toNumber(obj.portConflictPort ?? obj.conflictPort);
  const lastStartedAt =
    typeof obj.lastStartedAt === "string"
      ? obj.lastStartedAt
      : typeof obj.last_started_at === "string"
        ? obj.last_started_at
        : null;

  return {
    state,
    running,
    port,
    address,
    pid,
    lastStartedAt,
    statusDetail: detail,
    suggestion,
    portConflictPort,
  };
}

function buildPreviewStatus(): GatewayStatus {
  return {
    state: "error",
    running: false,
    port: null,
    address: null,
    pid: null,
    lastStartedAt: null,
    statusDetail: "Gateway status is unavailable in browser preview mode.",
    suggestion: "Run ClawDesk inside Tauri to manage the local OpenClaw Gateway.",
    portConflictPort: null,
  };
}

function buildUnavailableRuntimeStatus(): GatewayStatus {
  return {
    state: "error",
    running: false,
    port: null,
    address: null,
    pid: null,
    lastStartedAt: null,
    statusDetail: "ClawDesk is running in a desktop shell, but the Tauri command bridge is unavailable.",
    suggestion: "Relaunch or reinstall ClawDesk and verify the frontend bundles the Tauri API bridge.",
    portConflictPort: null,
  };
}

function normalizeActionError(error?: BackendError): ServiceActionResult {
  if (!error) {
    return {
      status: "error",
      detail: "Unknown gateway command error.",
      suggestion: "Check logs and retry.",
      code: "E_UNKNOWN",
    };
  }

  const code = error.code ?? "E_UNKNOWN";
  if (code.includes("PORT") || code.includes("CONFLICT")) {
    const conflictPort = toNumber(
      error.details?.portConflictPort ?? error.details?.port_conflict_port ?? error.details?.port,
    );
    return {
      status: "failure",
      detail: conflictPort
        ? `Port ${conflictPort} is already in use.`
        : "Gateway start failed because port is already in use.",
      suggestion: "Stop the conflicting process or change gateway port.",
      code,
      conflictPort: conflictPort ?? undefined,
    };
  }

  return {
    status: "failure",
    detail: error.message || "Gateway command failed.",
    suggestion: error.suggestion || "Check service logs and retry.",
    code,
  };
}

function defaultSuccessSuggestion(command: string, address: string | null): string {
  if (command === "open_dashboard") {
    return address
      ? `The dashboard should now open at ${address}.`
      : "The dashboard should now open in the system browser.";
  }

  if (command === "start_gateway" || command === "restart_gateway") {
    return address
      ? `Refresh status to confirm gateway health at ${address}.`
      : "Refresh status to confirm gateway health.";
  }

  if (command === "stop_gateway") {
    return "Refresh status to confirm the gateway has stopped.";
  }

  return "Refresh status to confirm gateway health.";
}

function normalizeActionSuccess(command: string, raw: unknown): ServiceActionResult {
  if (!raw || typeof raw !== "object") {
    return {
      status: "success",
      detail: "Command executed successfully.",
      suggestion: defaultSuccessSuggestion(command, null),
    };
  }

  const value = raw as Record<string, unknown>;
  const address = typeof value.address === "string" ? value.address : null;
  const pid = toNumber(value.pid);
  const detail =
    typeof value.detail === "string" && value.detail.trim().length > 0
      ? value.detail
      : "Command executed successfully.";

  return {
    status: "success",
    detail,
    suggestion: defaultSuccessSuggestion(command, address),
    address,
    pid,
  };
}

function buildLiveErrorStatus(error?: BackendError): GatewayStatus {
  return {
    state: "error",
    running: false,
    port: toNumber(error?.details?.port ?? error?.details?.gatewayPort),
    address: typeof error?.details?.address === "string" ? error.details.address : null,
    pid: toNumber(error?.details?.pid),
    lastStartedAt:
      typeof error?.details?.lastStartedAt === "string"
        ? error.details.lastStartedAt
        : typeof error?.details?.last_started_at === "string"
          ? error.details.last_started_at
          : null,
    statusDetail: error?.message ?? "Failed to query OpenClaw Gateway status.",
    suggestion: error?.suggestion ?? "Check whether the Gateway service is installed correctly, then retry.",
    portConflictPort: toNumber(error?.details?.portConflictPort ?? error?.details?.conflictPort ?? error?.details?.port),
  };
}

async function invokeAction(command: string): Promise<ServiceActionResult> {
  const runtime = getRuntimeDiagnostics();
  if (runtime.mode !== "tauri-runtime-available") {
    return {
      status: "error",
      detail:
        runtime.mode === "browser-preview"
          ? "Gateway controls are unavailable in browser preview mode."
          : "Gateway controls are unavailable because the Tauri command bridge is not ready in this desktop runtime.",
      suggestion:
        runtime.mode === "browser-preview"
          ? "Start ClawDesk in Tauri to run local process commands."
          : "Relaunch or reinstall ClawDesk and verify the frontend bundles the Tauri API bridge.",
      code: runtime.mode === "browser-preview" ? "E_PREVIEW_MODE" : "E_TAURI_UNAVAILABLE",
    };
  }

  const result = await invokeCommand<Record<string, unknown>>(command);
  if (!result.success) {
    return normalizeActionError(result.error);
  }

  if (command === "start_gateway" || command === "stop_gateway" || command === "restart_gateway") {
    invalidateGatewayStatusCache();
  }

  return normalizeActionSuccess(command, result.data);
}

export const serviceService = {
  async getGatewayStatus(): Promise<GatewayStatus> {
    const runtime = getRuntimeDiagnostics();
    if (runtime.mode === "browser-preview") {
      return buildPreviewStatus();
    }
    if (runtime.mode === "tauri-runtime-unavailable") {
      return buildUnavailableRuntimeStatus();
    }

    const now = Date.now();
    if (statusCache && now - statusCache.cachedAt < STATUS_CACHE_TTL_MS) {
      return cloneGatewayStatus(statusCache.value);
    }

    if (statusInFlight) {
      const shared = await statusInFlight;
      return cloneGatewayStatus(shared);
    }

    statusInFlight = (async () => {
      const result = await invokeCommand<Record<string, unknown>>("get_gateway_status");
      const next = !result.success || !result.data ? buildLiveErrorStatus(result.error) : normalizeStatusData(result.data);
      statusCache = { value: next, cachedAt: Date.now() };
      return next;
    })();

    try {
      const next = await statusInFlight;
      return cloneGatewayStatus(next);
    } finally {
      statusInFlight = null;
    }
  },

  async startGateway(): Promise<ServiceActionResult> {
    return invokeAction("start_gateway");
  },

  async stopGateway(): Promise<ServiceActionResult> {
    return invokeAction("stop_gateway");
  },

  async restartGateway(): Promise<ServiceActionResult> {
    return invokeAction("restart_gateway");
  },

  async openDashboard(): Promise<ServiceActionResult> {
    return invokeAction("open_dashboard");
  },

  async probeDashboardEndpoint(address: string): Promise<DashboardProbeResult> {
    if (!address) {
      return {
        address: "",
        reachable: false,
        result: "invalid-address",
        httpStatus: null,
        responseTimeMs: null,
        detail: "Dashboard address is missing.",
      };
    }

    const runtime = getRuntimeDiagnostics();
    if (runtime.mode !== "tauri-runtime-available") {
      return {
        address,
        reachable: false,
        result: runtime.mode === "browser-preview" ? "idle" : "unreachable",
        httpStatus: null,
        responseTimeMs: null,
        detail:
          runtime.mode === "browser-preview"
            ? "Endpoint probe is only available in the Tauri runtime."
            : "Endpoint probe is unavailable because the Tauri command bridge is not ready.",
      };
    }

    const result = await invokeCommand<Record<string, unknown>>("probe_dashboard_endpoint", { address });
    if (!result.success || !result.data) {
      const invalidAddress = result.error?.code === "E_INVALID_INPUT";
      return {
        address,
        reachable: false,
        result: invalidAddress ? "invalid-address" : "unreachable",
        httpStatus: null,
        responseTimeMs: null,
        detail: result.error?.message || "Dashboard endpoint probe failed.",
      };
    }

    return normalizeProbeData(result.data, address);
  },
};
