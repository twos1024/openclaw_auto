/**
 * Gateway HTTP client — calls the openclaw gateway REST API directly.
 * The gateway runs on localhost at the port reported by get_gateway_status.
 */
import { invokeCommand } from "@/services/hostClient";

interface CachedUrl {
  url: string;
  cachedAt: number;
}

/** Cache TTL: 30 s. After this, re-check gateway status to detect restarts. */
const CACHE_TTL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 10_000;

let _cached: CachedUrl | null = null;
let _inflight: Promise<string | null> | null = null;

export async function getGatewayUrl(): Promise<string | null> {
  const now = Date.now();
  if (_cached && now - _cached.cachedAt < CACHE_TTL_MS) {
    return _cached.url;
  }

  if (_inflight) {
    return _inflight;
  }

  _inflight = (async () => {
    const result = await invokeCommand<{ address: string; running: boolean }>("get_gateway_status");
    if (result.success && result.data?.running && result.data.address) {
      _cached = { url: result.data.address, cachedAt: Date.now() };
      return _cached.url;
    }
    _cached = null;
    return null;
  })();

  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}

export function clearGatewayUrlCache() {
  _cached = null;
}

export async function gatewayFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const base = await getGatewayUrl();
  if (!base) throw new Error("Gateway is not running");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      // Gateway error → invalidate cache in case URL changed
      if (res.status >= 500) clearGatewayUrlCache();
      throw new Error(`Gateway ${res.status}: ${text}`);
    }
    const json: T = await res.json();
    return json;
  } catch (err) {
    // Network failure → stale cache, force re-check next call
    if (err instanceof TypeError) clearGatewayUrlCache();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Create an EventSource connected to the gateway SSE stream. */
export async function createGatewaySSE(path: string): Promise<EventSource | null> {
  const base = await getGatewayUrl();
  if (!base) return null;
  return new EventSource(`${base}${path}`);
}

// ─── Typed domain API helpers ───────────────────────────────────────────────

// Channel API

import type { Channel, CreateChannelPayload } from "@/types/channel";
import type { Provider, CreateProviderPayload } from "@/types/provider";
import type { CronJob, CreateCronJobPayload } from "@/types/cron";

export const channelApi = {
  list: () => gatewayFetch<Channel[]>("/api/channels"),
  create: (payload: CreateChannelPayload) =>
    gatewayFetch<Channel>("/api/channels", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CreateChannelPayload>) =>
    gatewayFetch<Channel>(`/api/channels/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id: string) =>
    gatewayFetch<{ success: boolean }>(`/api/channels/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// Provider API

export const providerApi = {
  list: () => gatewayFetch<Provider[]>("/api/providers"),
  create: (payload: CreateProviderPayload) =>
    gatewayFetch<Provider>("/api/providers", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CreateProviderPayload>) =>
    gatewayFetch<Provider>(`/api/providers/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id: string) =>
    gatewayFetch<{ success: boolean }>(`/api/providers/${encodeURIComponent(id)}`, { method: "DELETE" }),
  validate: (id: string) =>
    gatewayFetch<{ valid: boolean; detail?: string }>(`/api/providers/${encodeURIComponent(id)}/validate`, { method: "POST" }),
};

// Cron API

export const cronApi = {
  list: () => gatewayFetch<CronJob[]>("/api/cron/jobs"),
  create: (payload: CreateCronJobPayload) =>
    gatewayFetch<CronJob>("/api/cron/jobs", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CreateCronJobPayload>) =>
    gatewayFetch<CronJob>(`/api/cron/jobs/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id: string) =>
    gatewayFetch<{ success: boolean }>(`/api/cron/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }),
  trigger: (id: string) =>
    gatewayFetch<{ triggered: boolean }>(`/api/cron/jobs/${encodeURIComponent(id)}/trigger`, { method: "POST" }),
};
