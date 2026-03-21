import os from "os";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";

export type RuntimePlatform = "windows" | "macos" | "linux" | "unknown";

export function currentPlatform(): RuntimePlatform {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

export function homeDir(): string {
  return os.homedir() || process.env["HOME"] || process.env["USERPROFILE"] || ".";
}

function xdgConfigHome(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  if (xdg && xdg.trim()) return xdg.trim();
  return path.join(homeDir(), ".config");
}

export function defaultOpenclawConfigPath(): string {
  const envPath = process.env["OPENCLAW_CONFIG_PATH"];
  if (envPath && envPath.trim()) return envPath.trim();

  const home = homeDir();
  const officialPath = path.join(home, ".openclaw", "openclaw.json");

  if (fs.existsSync(officialPath)) return officialPath;

  let legacyPath: string;
  const platform = currentPlatform();
  switch (platform) {
    case "windows": {
      const appData =
        process.env["APPDATA"] ||
        (process.env["USERPROFILE"]
          ? path.join(process.env["USERPROFILE"], "AppData", "Roaming")
          : ".");
      legacyPath = path.join(appData, "OpenClaw", "config.json");
      break;
    }
    case "macos":
      legacyPath = path.join(home, "Library", "Application Support", "OpenClaw", "config.json");
      break;
    case "linux":
      legacyPath = path.join(xdgConfigHome(), "openclaw", "config.json");
      break;
    default:
      legacyPath = path.join(home, ".config", "openclaw", "config.json");
  }

  if (fs.existsSync(legacyPath)) return legacyPath;
  return officialPath;
}

export function clawdeskAppDir(): string {
  const home = homeDir();
  const platform = currentPlatform();
  switch (platform) {
    case "windows": {
      const appData =
        process.env["APPDATA"] ||
        (process.env["USERPROFILE"]
          ? path.join(process.env["USERPROFILE"], "AppData", "Roaming")
          : ".");
      return path.join(appData, "ClawDesk");
    }
    case "macos":
      return path.join(home, "Library", "Application Support", "ClawDesk");
    case "linux":
      return path.join(xdgConfigHome(), "clawdesk");
    default:
      return path.join(home, ".config", "clawdesk");
  }
}

export function clawdeskLogDir(): string {
  return path.join(clawdeskAppDir(), "logs");
}

export function clawdeskDiagnosticsDir(): string {
  return path.join(clawdeskAppDir(), "diagnostics");
}

export const DEFAULT_GATEWAY_PORT = 18789;

export function locatorCommand(binaryName: string): [string, string[]] {
  if (currentPlatform() === "windows") {
    return ["where", [`${binaryName}.cmd`]];
  }
  return ["which", [binaryName]];
}

export function displayPlatform(): string {
  return currentPlatform();
}

let _nodeBinDirCache: string | undefined | null = undefined;

function getCachedNodeBinDir(): string | null {
  if (_nodeBinDirCache !== undefined) return _nodeBinDirCache ?? null;

  if (currentPlatform() !== "windows") {
    _nodeBinDirCache = null;
    return null;
  }

  try {
    const result = execFileSync("where", ["node"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    })
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .find((l: string) => l.length > 0);

    if (result) {
      const dirName = path.dirname(result);
      _nodeBinDirCache = dirName;
      return dirName;
    }
  } catch {
    // ignore
  }
  _nodeBinDirCache = null;
  return null;
}

export function desktopRuntimeBinDirs(): string[] {
  const dirs: string[] = [];
  const home = homeDir();

  const npmPrefix = process.env["NPM_CONFIG_PREFIX"]?.trim();
  if (npmPrefix) dirs.push(path.join(npmPrefix, "bin"));

  const pnpmHome = process.env["PNPM_HOME"]?.trim();
  if (pnpmHome) dirs.push(pnpmHome);

  const voltaHome = process.env["VOLTA_HOME"]?.trim();
  if (voltaHome) dirs.push(path.join(voltaHome, "bin"));

  const xdgBin = process.env["XDG_BIN_HOME"]?.trim();
  if (xdgBin) dirs.push(xdgBin);

  const platform = currentPlatform();
  switch (platform) {
    case "windows": {
      const appData =
        process.env["APPDATA"] ||
        (process.env["USERPROFILE"]
          ? path.join(process.env["USERPROFILE"], "AppData", "Roaming")
          : null);
      if (appData) dirs.push(path.join(appData, "npm"));

      const localAppData = process.env["LOCALAPPDATA"];
      if (localAppData) dirs.push(path.join(localAppData, "npm"));

      const nodeDir = getCachedNodeBinDir();
      if (nodeDir) dirs.push(nodeDir);
      break;
    }
    case "macos":
      dirs.push(
        path.join(home, ".npm-global", "bin"),
        path.join(home, ".local", "bin"),
        path.join(home, ".volta", "bin"),
        path.join(home, ".nvm", "current", "bin"),
        path.join(home, ".asdf", "shims"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      );
      break;
    case "linux":
      dirs.push(
        path.join(home, ".npm-global", "bin"),
        path.join(home, ".local", "bin"),
        path.join(home, ".volta", "bin"),
        path.join(home, ".nvm", "current", "bin"),
        path.join(home, ".asdf", "shims"),
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/local/sbin",
        "/usr/sbin",
        "/sbin",
        "/snap/bin",
      );
      break;
    default:
      dirs.push(path.join(home, ".local", "bin"), "/usr/local/bin", "/usr/bin", "/bin");
  }

  return dedupePaths(dirs);
}

export function normalizedPathEnv(): string | null {
  const current = process.env["PATH"] || "";
  const currentDirs = current ? current.split(path.delimiter) : [];
  const ordered = [...desktopRuntimeBinDirs(), ...currentDirs];
  const deduped = dedupePaths(ordered);

  const existing = deduped.filter((d) => {
    try {
      return fs.existsSync(d);
    } catch {
      return false;
    }
  });

  if (existing.length === 0) return null;
  return existing.join(path.delimiter);
}

export function dedupePaths(dirs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const dir of dirs) {
    if (!dir) continue;
    if (!seen.has(dir)) {
      seen.add(dir);
      result.push(dir);
    }
  }
  return result;
}
