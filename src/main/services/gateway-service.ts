import { runCommand, type ShellOutput } from "../adapters/shell.js";
import { DEFAULT_GATEWAY_PORT } from "../adapters/platform.js";
import { AppError, ErrorCode } from "../models/error.js";
import { ensureOpenclawAvailable } from "./env-service.js";
import { appendLogLine, LogSource } from "./log-service.js";

const GATEWAY_TIMEOUT_MS = 30_000;
const GATEWAY_STATUS_TIMEOUT_MS = 8_000;
const GATEWAY_STATUS_CACHE_TTL_MS = 2_000;
const DASHBOARD_PROBE_TIMEOUT_MS = 3_000;

export interface GatewayStatusData {
  state: string;
  running: boolean;
  port: number;
  address: string;
  pid: number | null;
  lastStartedAt: string | null;
  statusDetail: string;
  suggestion: string;
  portConflictPort: number | null;
}

export interface GatewayActionData {
  detail: string;
  address: string | null;
  pid: number | null;
}

export interface DashboardProbeData {
  address: string;
  reachable: boolean;
  result: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  detail: string;
}

// ---- Status cache (same coalescing logic as Rust version) ----
interface StatusCacheEntry {
  result: GatewayStatusData | AppError;
  cachedAt: number;
}

let _statusCache: StatusCacheEntry | null = null;
let _statusInFlight: Promise<GatewayStatusData | AppError> | null = null;

function isStatusCacheValid(entry: StatusCacheEntry): boolean {
  return Date.now() - entry.cachedAt < GATEWAY_STATUS_CACHE_TTL_MS;
}

function setStatusCache(result: GatewayStatusData | AppError): void {
  _statusCache = { result, cachedAt: Date.now() };
}

export async function invalidateStatusCache(): Promise<void> {
  _statusCache = null;
}

export async function getGatewayStatus(): Promise<GatewayStatusData> {
  if (_statusCache && isStatusCacheValid(_statusCache)) {
    const r = _statusCache.result;
    if (r instanceof AppError) throw r;
    return r;
  }

  if (_statusInFlight) {
    const r = await _statusInFlight;
    if (r instanceof AppError) throw r;
    return r;
  }

  _statusInFlight = queryGatewayStatusUncached().then((result) => {
    _statusCache = { result, cachedAt: Date.now() };
    _statusInFlight = null;
    return result;
  }).catch((err: unknown) => {
    const appErr = err instanceof AppError ? err : new AppError(ErrorCode.GatewayStatusFailed, String(err), "Retry gateway status.");
    _statusCache = { result: appErr, cachedAt: Date.now() };
    _statusInFlight = null;
    return appErr;
  });

  const r = await _statusInFlight;
  if (r instanceof AppError) throw r;
  return r;
}

async function queryGatewayStatusUncached(): Promise<GatewayStatusData> {
  const program = await ensureOpenclawAvailable();
  const output = await runCommand(program, ["gateway", "status", "--json"], GATEWAY_STATUS_TIMEOUT_MS);
  logShellOutputBestEffort("failures-only", LogSource.Startup, "openclaw gateway status --json", output);

  if (output.exitCode !== 0) {
    const ctx = detectGatewayErrorContext(output, ErrorCode.GatewayStatusFailed);
    throw mapGatewayError(ctx.code, "Failed to query OpenClaw Gateway status.", "Check whether the Gateway service is installed correctly, then retry.", ctx.conflictPort, output);
  }

  return parseGatewayStatusOutput(output);
}

export async function startGateway(): Promise<GatewayActionData> {
  await invalidateStatusCache();
  const program = await ensureOpenclawAvailable();
  const output = await runCommand(program, ["gateway", "start", "--json"], GATEWAY_TIMEOUT_MS);
  logShellOutputBestEffort("always", LogSource.Startup, "openclaw gateway start --json", output);

  if (output.exitCode !== 0) {
    const ctx = detectGatewayErrorContext(output, ErrorCode.GatewayStartFailed);
    throw mapGatewayError(ctx.code, "OpenClaw Gateway failed to start.", "Check startup logs, configuration, and port usage, then retry.", ctx.conflictPort, output);
  }

  const status = parseGatewayStatusOutput(output);
  setStatusCache(status);
  return { detail: "Gateway start command completed.", address: status.address, pid: status.pid };
}

export async function stopGateway(): Promise<GatewayActionData> {
  await invalidateStatusCache();
  const program = await ensureOpenclawAvailable();
  const output = await runCommand(program, ["gateway", "stop", "--json"], GATEWAY_TIMEOUT_MS);
  logShellOutputBestEffort("always", LogSource.Startup, "openclaw gateway stop --json", output);

  if (output.exitCode !== 0) {
    throw mapGatewayError(ErrorCode.GatewayStopFailed, "OpenClaw Gateway failed to stop.", "Check whether the Gateway is already stopped or managed externally, then retry.", null, output);
  }

  return { detail: "Gateway stopped successfully.", address: gatewayAddress(DEFAULT_GATEWAY_PORT), pid: null };
}

export async function restartGateway(): Promise<GatewayActionData> {
  await invalidateStatusCache();
  const program = await ensureOpenclawAvailable();
  const output = await runCommand(program, ["gateway", "restart", "--json"], GATEWAY_TIMEOUT_MS);
  logShellOutputBestEffort("always", LogSource.Startup, "openclaw gateway restart --json", output);

  if (output.exitCode !== 0) {
    const ctx = detectGatewayErrorContext(output, ErrorCode.GatewayStartFailed);
    throw mapGatewayError(ctx.code, "OpenClaw Gateway failed to restart.", "Check startup logs, configuration, and port usage, then retry.", ctx.conflictPort, output);
  }

  const status = parseGatewayStatusOutput(output);
  setStatusCache(status);
  return { detail: "Gateway restarted successfully.", address: status.address, pid: status.pid };
}

export async function openDashboard(): Promise<GatewayActionData> {
  const program = await ensureOpenclawAvailable();
  const status = await getGatewayStatus();
  if (!status.running) {
    throw new AppError(
      ErrorCode.GatewayNotRunning,
      "Gateway is not running, so the dashboard cannot be opened yet.",
      "Start the gateway first, wait for the running state, then open the dashboard.",
      { port: status.port, address: status.address },
    );
  }

  const output = await runCommand(program, ["dashboard"], 15_000);
  logShellOutputBestEffort("always", LogSource.Startup, "openclaw dashboard", output);

  if (output.exitCode !== 0) {
    throw mapGatewayError(ErrorCode.DashboardOpenFailed, "OpenClaw failed to open the local dashboard.", "Check whether the local dashboard is available and whether the system browser can be launched.", null, output);
  }

  return { detail: "Dashboard opened successfully.", address: status.address, pid: status.pid };
}

export async function probeDashboardEndpoint(address: string): Promise<DashboardProbeData> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(address);
  } catch {
    throw new AppError(
      ErrorCode.InvalidInput,
      "Dashboard address is invalid and cannot be probed.",
      "Refresh gateway status and retry the dashboard diagnostics probe.",
      { address },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DASHBOARD_PROBE_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      method: "GET",
    });
    clearTimeout(timer);
    const responseTimeMs = Date.now() - startedAt;
    const statusCode = response.status;
    const successful = statusCode >= 200 && statusCode < 300;

    return {
      address,
      reachable: successful,
      result: successful ? "reachable" : "unreachable",
      httpStatus: statusCode,
      responseTimeMs,
      detail: successful
        ? "Dashboard endpoint responded successfully."
        : `Dashboard endpoint returned HTTP ${statusCode}.`,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const responseTimeMs = Date.now() - startedAt;
    const isTimeout = (err as Error)?.name === "AbortError";

    return {
      address,
      reachable: false,
      result: isTimeout ? "timeout" : "unreachable",
      httpStatus: null,
      responseTimeMs: isTimeout ? null : responseTimeMs,
      detail: isTimeout
        ? `Dashboard endpoint timed out after ${DASHBOARD_PROBE_TIMEOUT_MS}ms.`
        : `Dashboard endpoint probe failed: ${(err as Error)?.message || String(err)}`,
    };
  }
}

// ---- Parsing helpers ----

function parseGatewayStatusOutput(output: ShellOutput): GatewayStatusData {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(output.stdout);
  } catch {
    // ignore
  }

  const port = resolveGatewayPort(parsed);
  const address = extractString(parsed, ["address", "url", "dashboardUrl"]) ?? gatewayAddress(port);
  const running =
    extractBool(parsed, ["running", "isRunning", "active"]) ??
    output.stdout.toLowerCase().includes('"running":true');
  const pid = extractNumber(parsed, ["pid", "processId"]) ?? null;
  const lastStartedAt = extractString(parsed, ["lastStartedAt", "startedAt", "updatedAt"]) ?? null;
  const statusDetail =
    extractString(parsed, ["statusDetail", "message", "detail"]) ??
    (running ? "Gateway is running." : "Gateway is not running.");
  const suggestion =
    extractString(parsed, ["suggestion"]) ??
    (running ? "You can open dashboard or restart service if needed." : "Click Start Gateway to launch OpenClaw service.");
  const state =
    extractString(parsed, ["state", "status"]) ?? (running ? "running" : "stopped");
  const portConflictPort = extractNumber(parsed, ["portConflictPort", "conflictPort"]) ?? null;

  return { state, running, port, address, pid, lastStartedAt, statusDetail, suggestion, portConflictPort };
}

function resolveGatewayPort(parsed: unknown): number {
  return extractNumber(parsed, ["port", "gatewayPort"]) ?? DEFAULT_GATEWAY_PORT;
}

function gatewayAddress(port: number): string {
  return `http://127.0.0.1:${port}`;
}

function extractString(value: unknown, keys: string[]): string | null {
  for (const key of keys) {
    const found = findKeyRecursive(value, key);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
}

function extractBool(value: unknown, keys: string[]): boolean | null {
  for (const key of keys) {
    const found = findKeyRecursive(value, key);
    if (typeof found === "boolean") return found;
    if (typeof found === "string") {
      const lower = found.trim().toLowerCase();
      if (lower === "true" || lower === "running" || lower === "active") return true;
      if (lower === "false" || lower === "stopped" || lower === "inactive") return false;
    }
  }
  return null;
}

function extractNumber(value: unknown, keys: string[]): number | null {
  for (const key of keys) {
    const found = findKeyRecursive(value, key);
    if (typeof found === "number") return found;
    if (typeof found === "string") {
      const n = parseInt(found, 10);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function findKeyRecursive(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
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

interface GatewayErrorContext {
  code: ErrorCode;
  conflictPort: number | null;
}

function detectGatewayErrorContext(output: ShellOutput, defaultCode: ErrorCode): GatewayErrorContext {
  const haystack = `${output.stdout}\n${output.stderr}`.toLowerCase();
  if (haystack.includes("address already in use") || haystack.includes("eaddrinuse") || haystack.includes("port conflict")) {
    return { code: ErrorCode.PortConflict, conflictPort: extractPortConflict(haystack) };
  }
  return { code: defaultCode, conflictPort: null };
}

function extractPortConflict(text: string): number | null {
  const afterPort = text.indexOf("port ");
  if (afterPort !== -1) {
    const digits = text.slice(afterPort + 5).match(/\d+/)?.[0];
    if (digits) return parseInt(digits, 10);
  }
  const afterColon = text.lastIndexOf(":");
  if (afterColon !== -1) {
    const digits = text.slice(afterColon + 1).match(/^\d+/)?.[0];
    if (digits) return parseInt(digits, 10);
  }
  return null;
}

function mapGatewayError(
  code: ErrorCode,
  message: string,
  suggestion: string,
  conflictPort: number | null,
  output: ShellOutput,
): AppError {
  return new AppError(code, message, suggestion, {
    program: output.program,
    args: output.args,
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.exitCode,
    portConflictPort: conflictPort,
    port: conflictPort,
  });
}

function logShellOutputBestEffort(
  policy: "always" | "failures-only",
  source: LogSource,
  step: string,
  output: ShellOutput,
): void {
  if (policy === "failures-only" && output.exitCode === 0) return;
  try {
    appendLogLine(source, `[info] step=${step} exitCode=${output.exitCode} durationMs=${output.durationMs}`);
    for (const line of output.stdout.split("\n").filter(Boolean)) {
      appendLogLine(source, `[stdout] ${line}`);
    }
    for (const line of output.stderr.split("\n").filter(Boolean)) {
      appendLogLine(source, `[stderr] ${line}`);
    }
  } catch {
    // best-effort
  }
}
