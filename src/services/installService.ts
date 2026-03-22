import type {
  InstallActionResult,
  InstallEnvResult,
  InstallEnvironment,
  InstallOpenClawData,
} from "../types/install";
import type { ReadLogsData } from "../types/logs";
import { invokeCommand } from "./tauriClient";
import { toFailureResult, toSuccessResult } from "./installPhases";

// Re-export for consumers that imported buildInstallPhasesPreview from here
export { buildInstallPhasesPreview } from "./installPhases";

interface DetectEnvPayload {
  platform?: string;
  architecture?: string;
  home_dir?: string | null;
  config_path?: string;
  node_found?: boolean;
  node_version?: string | null;
  node_path?: string | null;
  npm_found?: boolean;
  npm_version?: string | null;
  openclaw_found?: boolean;
  openclaw_path?: string | null;
  openclaw_version?: string | null;
}

function normalizeEnvironment(raw: DetectEnvPayload): InstallEnvironment {
  return {
    platform: raw.platform ?? "unknown",
    architecture: raw.architecture ?? "unknown",
    homeDir: raw.home_dir ?? null,
    configPath: raw.config_path ?? "",
    nodeFound: Boolean(raw.node_found),
    nodeVersion: raw.node_version ?? null,
    nodePath: raw.node_path ?? null,
    npmFound: Boolean(raw.npm_found),
    npmVersion: raw.npm_version ?? null,
    openclawFound: Boolean(raw.openclaw_found),
    openclawPath: raw.openclaw_path ?? null,
    openclawVersion: raw.openclaw_version ?? null,
  };
}

export const installService = {
  async detectEnv(): Promise<InstallEnvResult> {
    const result = await invokeCommand<DetectEnvPayload>("detect_env");
    if (!result.success || !result.data) {
      return {
        ok: false,
        error: result.error,
      };
    }

    return {
      ok: true,
      data: normalizeEnvironment(result.data),
    };
  },

  async installOpenClaw(): Promise<InstallActionResult> {
    const result = await invokeCommand<InstallOpenClawData>("install_openclaw");
    if (!result.success || !result.data) {
      return toFailureResult(result.error);
    }

    return toSuccessResult(result.data);
  },

  async readInstallLogLines(limit = 80): Promise<string[]> {
    const result = await invokeCommand<ReadLogsData>("read_logs", {
      source: "install",
      lines: limit,
    });

    if (!result.success || !result.data) {
      return [];
    }

    if (Array.isArray(result.data.lines)) {
      return result.data.lines.map((line) => String(line));
    }

    if (typeof result.data.content === "string") {
      return result.data.content.split(/\r?\n/u).filter((line) => line.trim().length > 0);
    }

    return [];
  },
};
