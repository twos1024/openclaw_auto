import { requestGatewayJson } from "./gateway-api-service.js";

export interface Agent {
  id: string;
  name: string;
  status: string;
  model?: string;
  description?: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface AgentListData {
  agents: Agent[];
  total: number;
}

export interface CreateAgentPayload {
  name: string;
  model?: string;
  description?: string;
  [key: string]: unknown;
}

export interface UpdateAgentPayload {
  id: string;
  name?: string;
  model?: string;
  description?: string;
  [key: string]: unknown;
}

export interface DeleteAgentData {
  deleted: boolean;
  id: string;
}

export async function listAgents(search?: string): Promise<AgentListData> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const payload = await requestGatewayJson("GET", [
    `/api/agents${qs}`,
    `/api/instances${qs}`,
    `/agents${qs}`,
    `/instances${qs}`,
  ]);
  return parseAgentListData(payload);
}

export async function createAgent(payload: CreateAgentPayload): Promise<Agent> {
  const response = await requestGatewayJson("POST", ["/api/agents", "/api/instances", "/agents", "/instances"], payload);
  return parseSingleAgentResponse(response);
}

export async function updateAgent(payload: UpdateAgentPayload): Promise<Agent> {
  const { id } = payload;
  const response = await requestGatewayJson("PUT", [
    `/api/agents/${id}`, `/api/instances/${id}`, `/agents/${id}`, `/instances/${id}`,
  ], payload);
  return parseSingleAgentResponse(response);
}

export async function startAgent(id: string): Promise<Agent> {
  const response = await requestGatewayJson("POST", [
    `/api/agents/${id}/start`, `/api/instances/${id}/start`,
    `/agents/${id}/start`, `/instances/${id}/start`,
  ]);
  return parseSingleAgentResponse(response);
}

export async function stopAgent(id: string): Promise<Agent> {
  const response = await requestGatewayJson("POST", [
    `/api/agents/${id}/stop`, `/api/instances/${id}/stop`,
    `/agents/${id}/stop`, `/instances/${id}/stop`,
  ]);
  return parseSingleAgentResponse(response);
}

export async function deleteAgent(id: string): Promise<DeleteAgentData> {
  const response = await requestGatewayJson("DELETE", [
    `/api/agents/${id}`, `/api/instances/${id}`, `/agents/${id}`, `/instances/${id}`,
  ]);
  return parseDeleteData(response, id);
}

// ---- parsers ----

function parseSingleAgentResponse(value: unknown): Agent {
  const obj = value as Record<string, unknown>;
  const inner = obj["agent"] ?? obj["instance"] ?? obj["data"];
  if (inner && typeof inner === "object" && !Array.isArray(inner)) return parseAgent(inner);
  return parseAgent(value);
}

function parseAgentListData(value: unknown): AgentListData {
  if (Array.isArray(value)) {
    const agents = value.map(parseAgent);
    return { agents, total: agents.length };
  }
  const obj = value as Record<string, unknown>;
  const rawList = obj["agents"] ?? obj["instances"] ?? obj["data"];
  if (Array.isArray(rawList)) {
    const agents = rawList.map(parseAgent);
    return {
      agents,
      total: typeof obj["total"] === "number" ? obj["total"] : agents.length,
    };
  }
  return { agents: [], total: 0 };
}

function parseAgent(value: unknown): Agent {
  const obj = value as Record<string, unknown>;
  return {
    id: (obj["id"] as string | undefined) ?? fallbackId("agent"),
    name: (obj["name"] as string | undefined) ?? "Unnamed Agent",
    status: (obj["status"] as string | undefined) ?? "idle",
    model: (obj["model"] as string | undefined) ?? undefined,
    description: (obj["description"] as string | undefined) ?? undefined,
    updatedAt: (obj["updatedAt"] as string | undefined) ?? (obj["updated_at"] as string | undefined) ?? new Date().toISOString(),
    ...obj,
  };
}

function parseDeleteData(value: unknown, fallback: string): DeleteAgentData {
  const obj = value as Record<string, unknown>;
  return {
    deleted: typeof obj["deleted"] === "boolean" ? obj["deleted"] : true,
    id: (obj["id"] as string | undefined) ?? fallback,
  };
}

function fallbackId(prefix: string): string {
  return `${prefix}-${Date.now().toString(16)}`;
}
