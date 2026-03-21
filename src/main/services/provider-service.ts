import { requestGatewayJson } from "./gateway-api-service.js";

export interface Provider {
  id: string;
  name: string;
  vendor: string;
  apiKeyMasked?: string;
  baseUrl?: string;
  modelCount: number;
  status: string;
  updatedAt: string;
}

export interface CreateProviderPayload {
  name: string;
  vendor: string;
  apiKey: string;
  baseUrl?: string;
}

export interface UpdateProviderPayload {
  id: string;
  name?: string;
  vendor?: string;
  apiKey?: string;
  baseUrl?: string;
  status?: string;
}

export interface DeleteProviderData {
  deleted: boolean;
  id: string;
}

export interface ProviderValidationData {
  valid: boolean;
  detail: string;
}

export async function listProviders(): Promise<Provider[]> {
  const payload = await requestGatewayJson("GET", ["/api/providers", "/providers"]);
  return parseProviderList(payload);
}

export async function createProvider(payload: CreateProviderPayload): Promise<Provider> {
  const response = await requestGatewayJson("POST", ["/api/providers", "/providers"], payload);
  return parseSingleProviderResponse(response);
}

export async function updateProvider(payload: UpdateProviderPayload): Promise<Provider> {
  const { id } = payload;
  const response = await requestGatewayJson("PUT", [`/api/providers/${id}`, `/providers/${id}`], payload);
  return parseSingleProviderResponse(response);
}

export async function deleteProvider(id: string): Promise<DeleteProviderData> {
  const response = await requestGatewayJson("DELETE", [`/api/providers/${id}`, `/providers/${id}`]);
  return parseDeleteProviderData(response, id);
}

export async function validateProvider(id: string): Promise<ProviderValidationData> {
  const response = await requestGatewayJson("POST", [
    `/api/providers/${id}/validate`, `/providers/${id}/validate`,
    `/api/providers/${id}/test`, `/providers/${id}/test`,
  ]);
  return parseValidationData(response);
}

// ---- parsers ----

function parseSingleProviderResponse(value: unknown): Provider {
  const obj = value as Record<string, unknown>;
  if (obj["provider"] && typeof obj["provider"] === "object") return parseProvider(obj["provider"]);
  if (obj["data"] && typeof obj["data"] === "object" && !Array.isArray(obj["data"])) return parseProvider(obj["data"]);
  return parseProvider(value);
}

function parseProviderList(value: unknown): Provider[] {
  if (Array.isArray(value)) return value.map(parseProvider);
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj["providers"])) return (obj["providers"] as unknown[]).map(parseProvider);
  if (Array.isArray(obj["data"])) return (obj["data"] as unknown[]).map(parseProvider);
  return [];
}

function parseProvider(value: unknown): Provider {
  const obj = value as Record<string, unknown>;
  const models = Array.isArray(obj["models"]) ? obj["models"] : null;
  const rawApiKey = extractString(obj, ["apiKey", "api_key"]);
  return {
    id: extractString(obj, ["id"]) ?? fallbackId("provider"),
    name: extractString(obj, ["name"]) ?? "Unnamed Provider",
    vendor: normalizeVendor(extractString(obj, ["vendor"]) ?? "custom"),
    apiKeyMasked: extractString(obj, ["apiKeyMasked", "api_key_masked"])
      ?? (rawApiKey ? maskApiKey(rawApiKey) : undefined),
    baseUrl: extractString(obj, ["baseUrl", "base_url"]) ?? undefined,
    modelCount: typeof obj["modelCount"] === "number" ? obj["modelCount"]
      : typeof obj["model_count"] === "number" ? obj["model_count"]
      : models?.length ?? 0,
    status: normalizeProviderStatus(extractString(obj, ["status"]) ?? "ready"),
    updatedAt: extractString(obj, ["updatedAt", "updated_at"]) ?? new Date().toISOString(),
  };
}

function parseDeleteProviderData(value: unknown, fallback: string): DeleteProviderData {
  const obj = value as Record<string, unknown>;
  return {
    deleted: typeof obj["deleted"] === "boolean" ? obj["deleted"] : true,
    id: extractString(obj, ["id"]) ?? fallback,
  };
}

function parseValidationData(value: unknown): ProviderValidationData {
  const obj = value as Record<string, unknown>;
  const valid = (obj["valid"] ?? obj["ok"] ?? obj["success"]) === true;
  const detail = extractString(obj, ["detail", "message"])
    ?? (valid ? "Provider validation succeeded." : "Provider validation failed.");
  return { valid, detail };
}

function maskApiKey(raw: string): string {
  if (!raw) return raw;
  if (raw.length <= 3) return "***";
  return `${raw.slice(0, 3)}***`;
}

function normalizeVendor(v: string): string {
  const known = ["openai", "anthropic", "deepseek", "ollama", "google", "qwen", "zhipu", "moonshot", "groq", "mistral", "custom"];
  return known.includes(v) ? v : "custom";
}

function normalizeProviderStatus(v: string): string {
  return ["ready", "checking", "error", "disabled"].includes(v) ? v : "ready";
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
