import { requestGatewayJson } from "./gateway-api-service.js";

export interface CronExecution {
  id: string;
  startedAt: string;
  durationMs?: number;
  status: string;
  summary?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  agentId: string;
  channelId: string;
  template: string;
  nextRunAt?: string;
  lastRunAt?: string;
  status: string;
  history: CronExecution[];
}

export interface CreateCronJobPayload {
  name: string;
  schedule: string;
  agentId: string;
  channelId: string;
  template: string;
  enabled?: boolean;
}

export interface UpdateCronJobPayload {
  id: string;
  name?: string;
  schedule?: string;
  agentId?: string;
  channelId?: string;
  template?: string;
  enabled?: boolean;
  status?: string;
}

export interface DeleteCronJobData { deleted: boolean; id: string; }
export interface TriggerCronJobData { triggered: boolean; id: string; detail: string; }

export async function listCronJobs(): Promise<CronJob[]> {
  const payload = await requestGatewayJson("GET", ["/api/cron/jobs", "/api/cron"]);
  return parseCronJobList(payload);
}

export async function createCronJob(payload: CreateCronJobPayload): Promise<CronJob> {
  const response = await requestGatewayJson("POST", ["/api/cron/jobs", "/api/cron"], payload);
  return parseSingleCronJobResponse(response);
}

export async function updateCronJob(payload: UpdateCronJobPayload): Promise<CronJob> {
  const { id } = payload;
  const response = await requestGatewayJson("PUT", [`/api/cron/jobs/${id}`, `/api/cron/${id}`], payload);
  return parseSingleCronJobResponse(response);
}

export async function deleteCronJob(id: string): Promise<DeleteCronJobData> {
  const response = await requestGatewayJson("DELETE", [`/api/cron/jobs/${id}`, `/api/cron/${id}`]);
  return parseDeleteData(response, id);
}

export async function triggerCronJob(id: string): Promise<TriggerCronJobData> {
  const response = await requestGatewayJson("POST", [`/api/cron/jobs/${id}/trigger`, `/api/cron/${id}/trigger`]);
  return parseTriggerData(response, id);
}

// ---- parsers ----

function parseSingleCronJobResponse(value: unknown): CronJob {
  const obj = value as Record<string, unknown>;
  if (obj["job"] && typeof obj["job"] === "object") return parseCronJob(obj["job"]);
  if (obj["data"] && typeof obj["data"] === "object" && !Array.isArray(obj["data"])) return parseCronJob(obj["data"]);
  return parseCronJob(value);
}

function parseCronJobList(value: unknown): CronJob[] {
  if (Array.isArray(value)) return value.map(parseCronJob);
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj["jobs"])) return (obj["jobs"] as unknown[]).map(parseCronJob);
  if (Array.isArray(obj["data"])) return (obj["data"] as unknown[]).map(parseCronJob);
  return [];
}

function parseCronJob(value: unknown): CronJob {
  const obj = value as Record<string, unknown>;
  return {
    id: extractString(obj, ["id"]) ?? fallbackId("cron"),
    name: extractString(obj, ["name"]) ?? "Unnamed Job",
    schedule: extractString(obj, ["schedule"]) ?? "0 * * * *",
    enabled: obj["enabled"] === true || obj["enabled"] !== false,
    agentId: extractString(obj, ["agentId", "agent_id"]) ?? "",
    channelId: extractString(obj, ["channelId", "channel_id"]) ?? "",
    template: extractString(obj, ["template", "message"]) ?? "",
    nextRunAt: extractString(obj, ["nextRunAt", "next_run_at"]) ?? undefined,
    lastRunAt: extractString(obj, ["lastRunAt", "last_run_at"]) ?? undefined,
    status: normalizeCronStatus(extractString(obj, ["status"]) ?? "idle"),
    history: Array.isArray(obj["history"])
      ? (obj["history"] as unknown[]).map(parseExecution)
      : [],
  };
}

function parseExecution(value: unknown): CronExecution {
  const obj = value as Record<string, unknown>;
  return {
    id: extractString(obj, ["id"]) ?? fallbackId("exec"),
    startedAt: extractString(obj, ["startedAt", "started_at"]) ?? new Date().toISOString(),
    durationMs: typeof obj["durationMs"] === "number" ? obj["durationMs"]
      : typeof obj["duration_ms"] === "number" ? obj["duration_ms"] : undefined,
    status: normalizeExecStatus(extractString(obj, ["status"]) ?? "success"),
    summary: extractString(obj, ["summary", "detail"]) ?? undefined,
  };
}

function parseDeleteData(value: unknown, fallback: string): DeleteCronJobData {
  const obj = value as Record<string, unknown>;
  return {
    deleted: typeof obj["deleted"] === "boolean" ? obj["deleted"] : true,
    id: extractString(obj, ["id"]) ?? fallback,
  };
}

function parseTriggerData(value: unknown, fallback: string): TriggerCronJobData {
  const obj = value as Record<string, unknown>;
  const triggered = (obj["triggered"] ?? obj["ok"] ?? obj["success"]) === true;
  return {
    triggered,
    id: extractString(obj, ["id"]) ?? fallback,
    detail: extractString(obj, ["detail", "message"]) ?? "Cron job triggered.",
  };
}

function normalizeCronStatus(v: string): string {
  return ["idle", "running", "success", "error", "disabled"].includes(v) ? v : "idle";
}

function normalizeExecStatus(v: string): string {
  return ["running", "success", "error"].includes(v) ? v : "success";
}

function extractString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const found = findKeyRecursive(obj, key);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
}

function findKeyRecursive(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findKeyRecursive(item, key); if (found !== undefined) return found; }
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) { const found = findKeyRecursive(v, key); if (found !== undefined) return found; }
  return undefined;
}

function fallbackId(prefix: string): string {
  return `${prefix}-${Date.now().toString(16)}`;
}
