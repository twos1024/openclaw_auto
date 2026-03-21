import path from "path";
import fs from "fs";
import { desktopRuntimeBinDirs } from "./platform.js";

export function binaryName(): string {
  return process.platform === "win32" ? "openclaw.cmd" : "openclaw";
}

export function npmProgram(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function binaryCandidates(): string[] {
  const candidates: string[] = [];

  try {
    const cwd = process.cwd();
    candidates.push(path.join(cwd, binaryName()));
  } catch {
    // ignore
  }

  for (const dir of desktopRuntimeBinDirs()) {
    candidates.push(path.join(dir, binaryName()));
    if (process.platform === "win32") {
      candidates.push(path.join(dir, "openclaw.exe"));
    }
  }

  return candidates;
}

export function resolveBinaryPath(): string | null {
  for (const candidate of binaryCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
