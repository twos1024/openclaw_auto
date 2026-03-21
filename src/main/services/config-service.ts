import fs from "fs/promises";
import path from "path";
import JSON5 from "json5";
import { safeWriteBytes } from "../adapters/file-ops.js";
import { defaultOpenclawConfigPath } from "../adapters/platform.js";
import { AppError, ErrorCode } from "../models/error.js";
import { ensureOpenclawAvailable } from "./env-service.js";
import { runCommand } from "../adapters/shell.js";

const VALIDATE_TIMEOUT_MS = 20_000;

export interface ReadConfigData {
  path: string;
  content: unknown;
  sizeBytes: number;
  modifiedAt: string | null;
}

export interface WriteConfigData {
  path: string;
  backupPath: string | null;
  bytesWritten: number;
}

export interface BackupConfigData {
  path: string;
  backupPath: string | null;
  skipped: boolean;
}

export async function readOpenclawConfig(configPath?: string): Promise<ReadConfigData> {
  const resolved = resolvePath(configPath);

  let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new AppError(ErrorCode.PathNotFound, "OpenClaw config file does not exist.", "Install OpenClaw first or provide a valid config file path.", { path: resolved });
  }

  let raw: string;
  try {
    raw = await fs.readFile(resolved, "utf8");
  } catch (e: unknown) {
    throw mapReadError(resolved, e);
  }

  const parsed = parseJson5OrJson(raw, resolved);
  const content = toSimplifiedConfigView(parsed) ?? parsed;

  const modifiedAt = stat.mtime ? stat.mtime.toISOString() : null;

  return { path: resolved, content, sizeBytes: raw.length, modifiedAt };
}

export async function writeOpenclawConfig(configPath: string | undefined, content: unknown): Promise<WriteConfigData> {
  const resolved = resolvePath(configPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });

  let backupPath: string | null = null;
  try {
    await fs.access(resolved);
    backupPath = await backupFile(resolved);
  } catch {
    // file doesn't exist — no backup needed
  }

  const merged = looksLikeLegacySimplifiedConfig(content)
    ? await mergeSimplifiedIntoOfficial(resolved, content as Record<string, unknown>)
    : content;

  const serialized = JSON.stringify(merged, null, 2);

  try {
    await safeWriteBytes(resolved, serialized);
  } catch (e: unknown) {
    throw mapWriteError(resolved, e, ErrorCode.ConfigWriteFailed);
  }

  try {
    await validateOpenclawConfig(resolved);
  } catch (e: unknown) {
    // Roll back on validation failure
    if (backupPath) {
      try { await fs.copyFile(backupPath, resolved); } catch { /* ignore rollback error */ }
    }
    throw e;
  }

  return { path: resolved, backupPath, bytesWritten: Buffer.byteLength(serialized, "utf8") };
}

export async function backupOpenclawConfig(configPath?: string): Promise<BackupConfigData> {
  const resolved = resolvePath(configPath);
  try {
    await fs.access(resolved);
  } catch {
    return { path: resolved, backupPath: null, skipped: true };
  }
  const backupPath = await backupFile(resolved);
  return { path: resolved, backupPath, skipped: false };
}

// ---- helpers ----

function resolvePath(p?: string): string {
  if (p !== undefined) {
    const trimmed = p.trim();
    if (!trimmed) throw new AppError(ErrorCode.InvalidInput, "Config path cannot be empty.", "Provide a non-empty config path or omit it to use default path.");
    return trimmed;
  }
  return defaultOpenclawConfigPath();
}

async function backupFile(source: string): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 17);
  const backupPath = `${source}.bak.${ts}`;
  await fs.copyFile(source, backupPath);
  return backupPath;
}

function mapReadError(filePath: string, err: unknown): AppError {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return new AppError(ErrorCode.PathNotFound, "Config file not found.", "Verify the config path and ensure the file exists.", { path: filePath });
  if (code === "EACCES" || code === "EPERM") return new AppError(ErrorCode.PermissionDenied, "Permission denied while reading config file.", "Adjust file permissions and rerun the command.", { path: filePath });
  return new AppError(ErrorCode.ConfigReadFailed, "Failed to read config file.", "Check whether the file is locked by another process.", { path: filePath, osError: String(err) });
}

function mapWriteError(filePath: string, err: unknown, defaultCode: ErrorCode): AppError {
  const code = (err as NodeJS.ErrnoException)?.code;
  const errorCode = code === "EACCES" || code === "EPERM" ? ErrorCode.PermissionDenied
    : code === "ENOENT" ? ErrorCode.PathNotFound
    : defaultCode;
  return new AppError(errorCode, "Failed while writing config data.", "Check disk permissions and free space, then retry.", { path: filePath, osError: String(err) });
}

function parseJson5OrJson(raw: string, filePath: string): unknown {
  try {
    return JSON5.parse(raw);
  } catch (json5Error) {
    try {
      return JSON.parse(raw);
    } catch (jsonError) {
      throw new AppError(ErrorCode.ConfigCorrupted, "Config content is not valid JSON5/JSON.", "Repair the config format or restore from a backup file.", { path: filePath, json5Error: String(json5Error), jsonError: String(jsonError) });
    }
  }
}

function looksLikeLegacySimplifiedConfig(content: unknown): boolean {
  if (typeof content !== "object" || content === null) return false;
  const obj = content as Record<string, unknown>;
  return "providerType" in obj || "baseUrl" in obj || "apiKey" in obj;
}

function toSimplifiedConfigView(parsed: unknown): Record<string, unknown> | null {
  if (looksLikeLegacySimplifiedConfig(parsed)) {
    return { ...(parsed as Record<string, unknown>), _format: "legacy-simplified" };
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const primary = readStringPath(obj, ["agents", "defaults", "model", "primary"]);
  if (!primary) return null;

  const [providerId, modelId] = splitModelRef(primary);
  const providerType = providerId.toLowerCase() === "ollama" ? "ollama" : "openai-compatible";
  const baseUrl = readStringPath(obj, ["models", "providers", providerId, "baseUrl"]) ?? "";
  const apiKey = readStringPath(obj, ["models", "providers", providerId, "apiKey"]) ?? "";

  return {
    providerType,
    baseUrl,
    apiKey,
    model: modelId,
    ...(providerType === "ollama" ? { ollamaHost: baseUrl } : {}),
    _format: "official-json5",
    _providerId: providerId,
    _modelRef: primary,
  };
}

function splitModelRef(ref: string): [string, string] {
  const trimmed = ref.trim();
  const slash = trimmed.indexOf("/");
  if (slash > 0) {
    const provider = trimmed.slice(0, slash).trim();
    const model = trimmed.slice(slash + 1).trim();
    if (provider && model) return [provider, model];
  }
  return ["custom-proxy", trimmed];
}

function readStringPath(obj: Record<string, unknown>, keys: string[]): string | null {
  let cur: unknown = obj;
  for (const key of keys) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : null;
}

async function mergeSimplifiedIntoOfficial(
  resolved: string,
  simplified: Record<string, unknown>,
): Promise<unknown> {
  let existing: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(resolved, "utf8");
    const p = parseJson5OrJson(raw, resolved);
    if (typeof p === "object" && p !== null) existing = p as Record<string, unknown>;
  } catch {
    // start fresh
  }

  const providerType = (simplified["providerType"] as string | undefined) ?? "openai-compatible";
  const model = ((simplified["model"] as string | undefined) ?? "").trim() || "default";
  const temperature = simplified["temperature"] as number | undefined;
  const maxTokens = simplified["maxTokens"] as number | undefined;

  let providerId: string, baseUrl: string, apiKey: string | undefined, modelRef: string;

  if (providerType === "ollama") {
    const rawHost = (simplified["ollamaHost"] ?? simplified["baseUrl"] ?? "http://127.0.0.1:11434") as string;
    baseUrl = normalizeOllamaBaseUrl(rawHost);
    providerId = "ollama";
    apiKey = undefined;
    modelRef = `ollama/${model}`;
  } else {
    baseUrl = ((simplified["baseUrl"] as string | undefined) ?? "").trim().replace(/\/$/, "");
    const rawKey = simplified["apiKey"] as string | undefined;
    apiKey = rawKey?.trim() || undefined;
    providerId = "custom-proxy";
    modelRef = `${providerId}/${model}`;
  }

  // Deep-merge into existing structure
  deepSet(existing, ["models", "mode"], "merge");
  deepSet(existing, ["models", "providers", providerId, "baseUrl"], baseUrl);
  deepSet(existing, ["models", "providers", providerId, "api"], "openai-completions");
  if (apiKey) deepSet(existing, ["models", "providers", providerId, "apiKey"], apiKey);
  if (providerType === "ollama") deepSet(existing, ["models", "providers", providerId, "injectNumCtxForOpenAICompat"], true);
  deepSet(existing, ["models", "providers", providerId, "models"], [{ id: model, name: model }]);
  deepSet(existing, ["agents", "defaults", "model", "primary"], modelRef);

  const params: Record<string, unknown> = {};
  if (temperature !== undefined) params["temperature"] = temperature;
  if (maxTokens !== undefined) params["maxTokens"] = maxTokens;
  if (Object.keys(params).length > 0) {
    deepSet(existing, ["agents", "defaults", "models", modelRef, "params"], params);
  }

  return existing;
}

function normalizeOllamaBaseUrl(host: string): string {
  const trimmed = host.trim().replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function deepSet(obj: Record<string, unknown>, keys: string[], value: unknown): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (typeof cur[key] !== "object" || cur[key] === null) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]!] = value;
}

async function validateOpenclawConfig(filePath: string): Promise<void> {
  const openclaw = await ensureOpenclawAvailable();

  let program: string;
  let args: string[];

  if (process.platform === "win32") {
    program = "powershell";
    args = [
      "-NoProfile",
      "-Command",
      `$env:OPENCLAW_CONFIG_PATH='${filePath.replace(/'/g, "''")}'; & '${openclaw.replace(/'/g, "''")}' config validate --json`,
    ];
  } else {
    program = "bash";
    args = ["-lc", `OPENCLAW_CONFIG_PATH='${filePath.replace(/'/g, "'\\''")}' '${openclaw.replace(/'/g, "'\\''")}' config validate --json`];
  }

  const output = await runCommand(program, args, VALIDATE_TIMEOUT_MS);
  if (output.exitCode !== 0) {
    throw new AppError(
      ErrorCode.InvalidInput,
      "OpenClaw config validation failed after writing.",
      "Fix the provider URL/API key/model settings and retry.",
      { stdout: output.stdout, stderr: output.stderr, exitCode: output.exitCode },
    );
  }
}
