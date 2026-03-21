import fs from "fs/promises";
import path from "path";
import { safeWriteBytes } from "../adapters/file-ops.js";
import { clawdeskAppDir, clawdeskDiagnosticsDir } from "../adapters/platform.js";
import { AppError, ErrorCode } from "../models/error.js";

export interface AppSettings {
  preferredInstallSource: string;
  diagnosticsDir: string;
  logLineLimit: number;
  gatewayPollMs: number;
}

export interface ReadAppSettingsData {
  path: string;
  exists: boolean;
  content: AppSettings;
  modifiedAt: string | null;
}

export interface WriteAppSettingsData {
  path: string;
  backupPath: string | null;
  bytesWritten: number;
}

export function defaultAppSettings(): AppSettings {
  return {
    preferredInstallSource: "npm-global",
    diagnosticsDir: clawdeskDiagnosticsDir(),
    logLineLimit: 1200,
    gatewayPollMs: 5_000,
  };
}

export function settingsFilePath(): string {
  return path.join(clawdeskAppDir(), "settings.json");
}

export async function readAppSettings(settingsPath?: string): Promise<ReadAppSettingsData> {
  const resolved = resolvePath(settingsPath);

  try {
    await fs.access(resolved);
  } catch {
    return { path: resolved, exists: false, content: defaultAppSettings(), modifiedAt: null };
  }

  let raw: string;
  try {
    raw = await fs.readFile(resolved, "utf8");
  } catch (e: unknown) {
    throw mapReadError(resolved, e);
  }

  let content: AppSettings;
  try {
    content = JSON.parse(raw) as AppSettings;
  } catch (e: unknown) {
    throw new AppError(ErrorCode.ConfigCorrupted, "App settings content is not valid JSON.", "Repair the settings file format or restore from a backup file.", { path: resolved, jsonError: String(e) });
  }

  const stat = await fs.stat(resolved).catch(() => null);
  const modifiedAt = stat?.mtime?.toISOString() ?? null;

  return { path: resolved, exists: true, content, modifiedAt };
}

export async function writeAppSettings(settingsPath: string | undefined, content: AppSettings): Promise<WriteAppSettingsData> {
  validateSettings(content);

  const resolved = resolvePath(settingsPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });

  let backupPath: string | null = null;
  try {
    await fs.access(resolved);
    const ts = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 17);
    backupPath = `${resolved}.bak.${ts}`;
    await fs.copyFile(resolved, backupPath);
  } catch {
    // no existing file — no backup needed
  }

  const serialized = JSON.stringify(content, null, 2);
  try {
    await safeWriteBytes(resolved, serialized);
  } catch (e: unknown) {
    throw mapWriteError(resolved, e, ErrorCode.ConfigWriteFailed);
  }

  return { path: resolved, backupPath, bytesWritten: Buffer.byteLength(serialized, "utf8") };
}

function resolvePath(p?: string): string {
  if (p !== undefined) {
    const trimmed = p.trim();
    if (!trimmed) throw new AppError(ErrorCode.InvalidInput, "Settings path cannot be empty.", "Provide a non-empty settings path or omit it to use the default path.");
    return trimmed;
  }
  return settingsFilePath();
}

function validateSettings(s: AppSettings): void {
  if (!s.diagnosticsDir?.trim()) throw new AppError(ErrorCode.InvalidInput, "Diagnostics directory cannot be empty.", "Provide a writable diagnostics directory path before saving settings.");
  if (!s.logLineLimit || s.logLineLimit < 1 || s.logLineLimit > 20_000) throw new AppError(ErrorCode.InvalidInput, "Log line limit must be between 1 and 20000.", "Adjust the log line limit to a reasonable value and retry.");
  if (s.gatewayPollMs < 1_000 || s.gatewayPollMs > 60_000) throw new AppError(ErrorCode.InvalidInput, "Gateway polling interval must be between 1000 and 60000 milliseconds.", "Adjust the polling interval and retry.");
}

function mapReadError(filePath: string, err: unknown): AppError {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return new AppError(ErrorCode.PathNotFound, "App settings file not found.", "Save settings once to create the file, or verify the settings path.", { path: filePath });
  if (code === "EACCES" || code === "EPERM") return new AppError(ErrorCode.PermissionDenied, "Permission denied while reading app settings.", "Adjust file permissions and rerun the command.", { path: filePath });
  return new AppError(ErrorCode.ConfigReadFailed, "Failed to read app settings file.", "Check whether the file is locked by another process.", { path: filePath, osError: String(err) });
}

function mapWriteError(filePath: string, err: unknown, defaultCode: ErrorCode): AppError {
  const code = (err as NodeJS.ErrnoException)?.code;
  const errorCode = code === "EACCES" || code === "EPERM" ? ErrorCode.PermissionDenied
    : code === "ENOENT" ? ErrorCode.PathNotFound
    : defaultCode;
  return new AppError(errorCode, "Failed while writing app settings.", "Check disk permissions and available space, then retry.", { path: filePath, osError: String(err) });
}
