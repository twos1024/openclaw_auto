/**
 * Gateway HTTP client — calls the openclaw gateway REST API directly.
 * The gateway runs on localhost at the port reported by get_gateway_status.
 */
import { invokeCommand } from "@/services/tauriClient";

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
