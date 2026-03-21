import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { runCommand, type ShellOutput } from "../adapters/shell.js";
import { locatorCommand, defaultOpenclawConfigPath, displayPlatform, currentPlatform } from "../adapters/platform.js";
import { binaryName, npmProgram, resolveBinaryPath } from "../adapters/openclaw.js";
import { AppError, ErrorCode } from "../models/error.js";

const NODE_VERSION_TIMEOUT_MS = 5_000;
const NPM_VERSION_TIMEOUT_MS = 5_000;
const OPENCLAW_VERSION_TIMEOUT_MS = 5_000;
const LOCATOR_TIMEOUT_MS = 5_000;
const DETECT_ENV_CACHE_TTL_MS = 2_000;

export interface DetectEnvData {
  platform: string;
  architecture: string;
  homeDir: string | null;
  configPath: string;
  nodeFound: boolean;
  nodeVersion: string | null;
  nodePath: string | null;
  nodeOutput: ShellOutput | null;
  npmFound: boolean;
  npmVersion: string | null;
  npmOutput: ShellOutput | null;
  openclawFound: boolean;
  openclawPath: string | null;
  openclawVersion: string | null;
  locatorOutput: ShellOutput | null;
  versionOutput: ShellOutput | null;
}

interface CacheEntry {
  result: DetectEnvData | AppError;
  cachedAt: number;
}

let _cache: CacheEntry | null = null;
let _inFlight: Promise<DetectEnvData | AppError> | null = null;

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt < DETECT_ENV_CACHE_TTL_MS;
}

export async function invalidateDetectEnvCache(): Promise<void> {
  _cache = null;
}

export async function detectEnv(): Promise<DetectEnvData> {
  if (_cache && isCacheValid(_cache)) {
    const result = _cache.result;
    if (result instanceof AppError) throw result;
    return result;
  }

  if (_inFlight) {
    const result = await _inFlight;
    if (result instanceof AppError) throw result;
    return result;
  }

  _inFlight = detectEnvUncached().then((result) => {
    _cache = { result, cachedAt: Date.now() };
    _inFlight = null;
    return result;
  }).catch((err: unknown) => {
    const appErr = err instanceof AppError ? err : new AppError(ErrorCode.InternalError, String(err), "Retry detecting the environment.");
    _cache = { result: appErr, cachedAt: Date.now() };
    _inFlight = null;
    return appErr;
  });

  const result = await _inFlight;
  if (result instanceof AppError) throw result;
  return result;
}

async function detectEnvUncached(): Promise<DetectEnvData> {
  const nodeOutput = await runCommand("node", ["--version"], NODE_VERSION_TIMEOUT_MS).catch(() => null);
  const nodeVersion = nodeOutput?.exitCode === 0
    ? nodeOutput.stdout.split("\n")[0]?.trim() ?? null
    : null;
  const nodeFound = nodeVersion !== null;

  const [locatorProgram, locatorArgs] = locatorCommand("node");
  const nodeLocatorOutput = await runCommand(locatorProgram, locatorArgs, LOCATOR_TIMEOUT_MS).catch(() => null);
  const nodePath = pathFromLocatorOutput(nodeLocatorOutput) ?? (nodeFound ? "node" : null);

  const npmOutput = await runCommand(npmProgram(), ["--version"], NPM_VERSION_TIMEOUT_MS).catch(() => null);
  const npmVersion = npmOutput?.exitCode === 0
    ? npmOutput.stdout.split("\n")[0]?.trim() ?? null
    : null;
  const npmFound = npmVersion !== null;

  let openclawPath = resolveBinaryPath();

  const [ocLocatorProgram, ocLocatorArgs] = locatorCommand("openclaw");
  const locatorOutput = await runCommand(ocLocatorProgram, ocLocatorArgs, LOCATOR_TIMEOUT_MS).catch(() => null);
  if (!openclawPath) {
    openclawPath = pathFromLocatorOutput(locatorOutput);
  }

  const openclawFound = openclawPath !== null;

  let versionOutput: ShellOutput | null = null;
  let openclawVersion: string | null = null;
  if (openclawFound && openclawPath) {
    versionOutput = await runCommand(openclawPath, ["--version"], OPENCLAW_VERSION_TIMEOUT_MS).catch(() => null);
    if (versionOutput?.exitCode === 0) {
      openclawVersion = versionOutput.stdout.split("\n")[0]?.trim() ?? null;
    }
  }

  return {
    platform: displayPlatform(),
    architecture: os.arch(),
    homeDir: os.homedir() || null,
    configPath: defaultOpenclawConfigPath(),
    nodeFound,
    nodeVersion,
    nodePath,
    nodeOutput,
    npmFound,
    npmVersion,
    npmOutput,
    openclawFound,
    openclawPath,
    openclawVersion,
    locatorOutput,
    versionOutput,
  };
}

export async function ensureOpenclawAvailable(): Promise<string> {
  const env = await detectEnv();
  if (!env.openclawFound || !env.openclawPath) {
    throw new AppError(
      ErrorCode.PathNotFound,
      "Unable to resolve the OpenClaw executable.",
      "Install OpenClaw first, or check whether the global npm bin directory is on PATH.",
    );
  }
  return env.openclawPath;
}

function pathFromLocatorOutput(output: ShellOutput | null): string | null {
  if (!output || output.exitCode !== 0) return null;
  const line = output.stdout.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  return line || null;
}

// Helper used by install-service to resolve openclaw path from local npm prefix
export function resolveOpenclawFromLocalPrefix(): string | null {
  try {
    const prefix = execFileSync(npmProgram(), ["config", "get", "prefix"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    }).trim();
    if (!prefix) return null;

    const candidate = path.join(prefix, "bin", binaryName());
    if (fs.existsSync(candidate)) return candidate;

    // Windows: npm puts binaries directly under prefix, not prefix/bin
    if (currentPlatform() === "windows") {
      const winCandidate = path.join(prefix, binaryName());
      if (fs.existsSync(winCandidate)) return winCandidate;
    }
  } catch {
    // ignore
  }
  return null;
}
