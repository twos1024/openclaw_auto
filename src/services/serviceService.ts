import type { BackendError } from "../types/api";
import { invokeCommand, isTauriRuntime } from "./tauriClient";

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
    port: 18789,
    address: "http://127.0.0.1:18789",
    pid: null,
    lastStartedAt: null,
    statusDetail: "Gateway status is unavailable in browser preview mode.",
    suggestion: "Run ClawDesk inside Tauri to manage the local OpenClaw Gateway.",
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
    const conflictPort = toNumber(error.details?.port);
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

async function invokeAction(command: string): Promise<ServiceActionResult> {
  if (!isTauriRuntime()) {
    return {
      status: "error",
      detail: "Gateway controls are unavailable in browser preview mode.",
      suggestion: "Start ClawDesk in Tauri to run local process commands.",
      code: "E_PREVIEW_MODE",
    };
  }

  const result = await invokeCommand<Record<string, unknown>>(command);
  if (!result.success) {
    return normalizeActionError(result.error);
  }

  return {
    status: "success",
    detail: "Command executed successfully.",
    suggestion: "Refresh status to confirm gateway health.",
  };
}

export const serviceService = {
  async getGatewayStatus(): Promise<GatewayStatus> {
    if (!isTauriRuntime()) {
      return buildPreviewStatus();
    }

    const result = await invokeCommand<Record<string, unknown>>("get_gateway_status");
    if (!result.success || !result.data) {
      const normalized = normalizeActionError(result.error);
      return {
        ...buildPreviewStatus(),
        state: "error",
        statusDetail: normalized.detail,
        suggestion: normalized.suggestion,
        portConflictPort: normalized.conflictPort ?? null,
      };
    }

    return normalizeStatusData(result.data);
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
};
