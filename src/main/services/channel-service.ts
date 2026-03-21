import { requestGatewayJson } from "./gateway-api-service.js";

export interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  connectionType: string;
  description?: string;
  providerId?: string;
  agentIds: string[];
  updatedAt: string;
}

export interface CreateChannelPayload {
  name: string;
  type: string;
  connectionType: string;
  description?: string;
  providerId?: string;
  agentIds?: string[];
}

export interface UpdateChannelPayload {
  id: string;
  name?: string;
  type?: string;
  connectionType?: string;
  description?: string;
  providerId?: string;
  agentIds?: string[];
  status?: string;
}

export interface DeleteChannelData {
  deleted: boolean;
  id: string;
}

export async function listChannels(): Promise<Channel[]> {
  const payload = await requestGatewayJson("GET", ["/api/channels", "/channels"]);
  return parseChannelList(payload);
}

export async function addChannel(payload: CreateChannelPayload): Promise<Channel> {
  const response = await requestGatewayJson("POST", ["/api/channels", "/channels"], payload);
  return parseSingleChannelResponse(response);
}

export async function updateChannel(payload: UpdateChannelPayload): Promise<Channel> {
  const { id } = payload;
  const response = await requestGatewayJson("PUT", [`/api/channels/${id}`, `/channels/${id}`], payload);
  return parseSingleChannelResponse(response);
}

export async function deleteChannel(id: string): Promise<DeleteChannelData> {
  const response = await requestGatewayJson("DELETE", [`/api/channels/${id}`, `/channels/${id}`]);
  return parseDeleteData(response, id);
}

// ---- parsers ----

function parseSingleChannelResponse(value: unknown): Channel {
  const obj = value as Record<string, unknown>;
  if (obj["channel"] && typeof obj["channel"] === "object") return parseChannel(obj["channel"]);
  if (obj["data"] && typeof obj["data"] === "object" && !Array.isArray(obj["data"])) return parseChannel(obj["data"]);
  return parseChannel(value);
}

function parseChannelList(value: unknown): Channel[] {
  if (Array.isArray(value)) return value.map(parseChannel);
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj["channels"])) return (obj["channels"] as unknown[]).map(parseChannel);
  if (Array.isArray(obj["data"])) return (obj["data"] as unknown[]).map(parseChannel);
  return [];
}

function parseChannel(value: unknown): Channel {
  const obj = value as Record<string, unknown>;
  return {
    id: extractString(obj, ["id"]) ?? fallbackId("channel"),
    name: extractString(obj, ["name"]) ?? "Unnamed Channel",
    type: normalizeChannelType(extractString(obj, ["type", "channelType"]) ?? "custom"),
    status: normalizeChannelStatus(extractString(obj, ["status"]) ?? "idle"),
    connectionType: normalizeConnectionType(extractString(obj, ["connectionType", "connection_type"]) ?? "none"),
    description: extractString(obj, ["description"]) ?? undefined,
    providerId: extractString(obj, ["providerId", "provider_id"]) ?? undefined,
    agentIds: extractStringArray(obj, ["agentIds", "agent_ids"]),
    updatedAt: extractString(obj, ["updatedAt", "updated_at"]) ?? new Date().toISOString(),
  };
}

function parseDeleteData(value: unknown, fallback: string): DeleteChannelData {
  const obj = value as Record<string, unknown>;
  return {
    deleted: typeof obj["deleted"] === "boolean" ? obj["deleted"] : true,
    id: extractString(obj, ["id"]) ?? fallback,
  };
}

function normalizeChannelType(v: string): string {
  return ["openclaw", "openai-compatible", "custom", "webhook"].includes(v) ? v : "custom";
}

function normalizeChannelStatus(v: string): string {
  return ["connected", "disconnected", "error", "idle"].includes(v) ? v : "idle";
}

function normalizeConnectionType(v: string): string {
  return ["api-key", "oauth", "none"].includes(v) ? v : "none";
}

function extractString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const found = findKeyRecursive(obj, key);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
}

function extractStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const found = findKeyRecursive(obj, key);
    if (Array.isArray(found)) return found.filter((v): v is string => typeof v === "string");
  }
  return [];
}

function findKeyRecursive(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findKeyRecursive(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const found = findKeyRecursive(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function fallbackId(prefix: string): string {
  return `${prefix}-${Date.now().toString(16)}`;
}
