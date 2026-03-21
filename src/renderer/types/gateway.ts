export type GatewayRuntimeState = "running" | "stopped" | "starting" | "stopping" | "error" | "unknown";

export interface GatewayStatus {
  state: GatewayRuntimeState;
  running: boolean;
  port: number | null;
  address: string | null;
  pid: number | null;
  lastStartedAt?: string | null;
  statusDetail: string;
  suggestion?: string;
  portConflictPort?: number | null;
}

export interface GatewayHealth {
  status: "healthy" | "degraded" | "offline";
  detail: string;
  updatedAt: string;
}
