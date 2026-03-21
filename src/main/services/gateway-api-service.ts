import { AppError, ErrorCode } from "../models/error.js";
import { getGatewayStatus } from "./gateway-service.js";

const GATEWAY_HTTP_TIMEOUT_MS = 10_000;

function normalizeBase(base: string): string {
  return base.replace(/\/$/, "");
}

function normalizePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

function buildGatewayUrl(base: string, p: string): string {
  return `${normalizeBase(base)}${normalizePath(p)}`;
}

async function resolveGatewayBaseUrl(): Promise<string> {
  const status = await getGatewayStatus();
  if (!status.running) {
    throw new AppError(
      ErrorCode.GatewayNotRunning,
      "Gateway is not running, API proxy request cannot be completed.",
      "Start Gateway first, then retry the API operation.",
      { address: status.address, port: status.port, state: status.state },
    );
  }
  return normalizeBase(status.address);
}

function parseResponseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw };
  }
}

export async function requestGatewayJson(
  method: string,
  paths: string[],
  body?: unknown,
): Promise<unknown> {
  if (paths.length === 0) {
    throw new AppError(ErrorCode.InvalidInput, "Gateway request has no candidate paths.", "Provide at least one API path before sending a Gateway request.");
  }

  const base = await resolveGatewayBaseUrl();

  let lastStatus: number | undefined;
  let lastBody: string | undefined;
  let lastUrl: string | undefined;
  let lastTransportError: string | undefined;

  for (const p of paths) {
    const url = buildGatewayUrl(base, p);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GATEWAY_HTTP_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const hasBody = body !== undefined && body !== null && method !== "GET" && method !== "DELETE";
      if (hasBody) headers["Content-Type"] = "application/json";

      const response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await response.text().catch(() => "");
      if (response.ok) {
        return parseResponseValue(text);
      }
      lastStatus = response.status;
      lastBody = text;
      lastUrl = url;
    } catch (err: unknown) {
      clearTimeout(timer);
      lastTransportError = (err as Error)?.message ?? String(err);
      lastUrl = url;
    }
  }

  if (lastTransportError) {
    throw new AppError(
      ErrorCode.NetworkFailed,
      "Gateway API request failed due to a network error.",
      "Check whether Gateway is running and the network is accessible.",
      { url: lastUrl, transportError: lastTransportError },
    );
  }

  throw new AppError(
    ErrorCode.InternalError,
    `Gateway API request failed with HTTP ${lastStatus}.`,
    "Check Gateway logs and ensure the API endpoint is correct.",
    { url: lastUrl, status: lastStatus, body: lastBody?.slice(0, 500) },
  );
}
