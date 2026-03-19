import type { BackendError } from "../types/api";
import type {
  InstallActionResult,
  InstallEnvResult,
  InstallEnvironment,
  InstallIssue,
  InstallOpenClawData,
  InstallPhase,
  InstallPhaseId,
  ShellCommandOutput,
} from "../types/install";
import type { ReadLogsData } from "../types/logs";
import { invokeCommand } from "./tauriClient";

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

function createBasePhases(): InstallPhase[] {
  return [
    {
      id: "prerequisite",
      title: "环境检查",
      status: "pending",
      detail: "等待检查 Node.js、npm 与本地安装条件。",
      suggestion: "先刷新环境，确认 Node.js 和 npm 的可见性。",
    },
    {
      id: "install-cli",
      title: "安装 OpenClaw CLI",
      status: "pending",
      detail: "等待执行 OpenClaw CLI 安装。",
      suggestion: "安装命令会调用官方安装脚本，并在必要时自动补齐 Node.js。",
    },
    {
      id: "install-gateway",
      title: "安装 Gateway 托管服务",
      status: "pending",
      detail: "等待执行 Gateway managed install。",
      suggestion: "CLI 安装完成后会继续尝试安装 Gateway 服务。",
    },
    {
      id: "verify",
      title: "结果验证",
      status: "pending",
      detail: "等待确认可执行路径与后续操作。",
      suggestion: "安装完成后会校验可执行路径并给出下一步建议。",
    },
  ];
}

function updatePhase(
  phases: InstallPhase[],
  phaseId: InstallPhaseId,
  patch: Partial<InstallPhase>,
): InstallPhase[] {
  return phases.map((phase) => (phase.id === phaseId ? { ...phase, ...patch } : phase));
}

function isInstallPhaseId(value: unknown): value is InstallPhaseId {
  return value === "prerequisite" || value === "install-cli" || value === "install-gateway" || value === "verify";
}

function firstMeaningfulLine(text: string): string | null {
  return (
    text
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .find((item) => item.length > 0) ?? null
  );
}

function hasStructuredInstallIssueMarkers(value: Record<string, unknown>): boolean {
  return (
    typeof value.failureKind === "string" ||
    typeof value.step === "string" ||
    (typeof value.stage === "string" && typeof value.message === "string" && typeof value.suggestion === "string")
  );
}

function normalizeInstallIssue(raw: unknown, fallback?: Partial<InstallIssue>): InstallIssue | null {
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Record<string, unknown>;
  if (!hasStructuredInstallIssueMarkers(value)) return null;

  const stage = isInstallPhaseId(value.stage) ? value.stage : fallback?.stage ?? "install-cli";
  const failureKind = typeof value.failureKind === "string" ? value.failureKind : fallback?.failureKind ?? "unknown";
  const code = typeof value.code === "string" ? value.code : fallback?.code ?? "E_UNKNOWN";
  const message =
    typeof value.message === "string"
      ? value.message
      : fallback?.message ?? "OpenClaw install encountered an issue.";
  const suggestion =
    typeof value.suggestion === "string"
      ? value.suggestion
      : fallback?.suggestion ?? "Check logs and retry the install flow.";
  const step =
    typeof value.step === "string"
      ? value.step
      : fallback?.step ?? "official OpenClaw installer script";
  const exitCode =
    typeof value.exitCode === "number" ? value.exitCode : fallback?.exitCode ?? null;
  const sample =
    typeof value.sample === "string" ? value.sample : fallback?.sample ?? null;

  return {
    stage,
    failureKind,
    code,
    message,
    suggestion,
    step,
    exitCode,
    sample,
  };
}

function getDetailNumber(error: BackendError | undefined, key: string): number | null {
  const value = error?.details?.[key];
  return typeof value === "number" ? value : null;
}

function getDetailString(error: BackendError | undefined, key: string): string | null {
  const value = error?.details?.[key];
  return typeof value === "string" ? value : null;
}

function looksLikeMissingNpmSpawnError(error?: BackendError): boolean {
  if (!error) return false;
  return error.code === "E_SHELL_SPAWN_FAILED" && error.message.toLowerCase().includes("npm");
}

function fallbackStep(stage: InstallPhaseId): string {
  if (stage === "install-gateway") return "openclaw gateway install --json";
  if (stage === "verify") return "resolve openclaw executable path";
  return "official OpenClaw installer script";
}

function createFallbackIssue(stage: InstallPhaseId, error?: BackendError): InstallIssue | null {
  if (!error) return null;

  return {
    stage,
    failureKind: "unknown",
    code: error.code ?? "E_UNKNOWN",
    message: error.message ?? "OpenClaw install failed.",
    suggestion: error.suggestion ?? "Check install logs and retry.",
    step: fallbackStep(stage),
    exitCode: getDetailNumber(error, "exitCode") ?? getDetailNumber(error, "exit_code"),
    sample:
      getDetailString(error, "sample") ??
      firstMeaningfulLine(getDetailString(error, "stderr") ?? getDetailString(error, "stdout") ?? ""),
  };
}

function buildIssueFromShellOutput(stage: InstallPhaseId, step: string, output?: ShellCommandOutput | null): InstallIssue | null {
  if (!output) return null;

  return {
    stage,
    failureKind: stage === "install-gateway" ? "gateway-install-failed" : "unknown",
    code: stage === "install-gateway" ? "E_GATEWAY_INSTALL_FAILED" : "E_UNKNOWN",
    message:
      stage === "install-gateway"
        ? "Gateway managed install could not register the local service."
        : "OpenClaw install command returned a non-zero exit code.",
    suggestion:
      stage === "install-gateway"
        ? "前往 Service 与 Logs 页面继续排查托管安装输出。"
        : "检查安装日志和命令输出后重试。",
    step,
    exitCode: output.exitCode ?? null,
    sample: firstMeaningfulLine(output.stderr) ?? firstMeaningfulLine(output.stdout),
  };
}

function classifyErrorStage(error?: BackendError): InstallPhaseId {
  if (error?.details && typeof error.details.stage === "string" && isInstallPhaseId(error.details.stage)) {
    return error.details.stage;
  }

  const code = error?.code ?? "";

  if (code === "E_PREVIEW_MODE" || code === "E_TAURI_UNAVAILABLE") {
    return "prerequisite";
  }

  if (looksLikeMissingNpmSpawnError(error)) {
    return "prerequisite";
  }

  if (code === "E_GATEWAY_INSTALL_FAILED") {
    return "install-gateway";
  }

  if (code === "E_PATH_NOT_FOUND" && (error?.message ?? "").toLowerCase().includes("executable")) {
    return "verify";
  }

  return "install-cli";
}

function buildIssueFromError(error?: BackendError): InstallIssue | null {
  if (!error) return null;

  if (error.code === "E_PREVIEW_MODE") {
    return {
      stage: "prerequisite",
      failureKind: "preview-mode",
      code: error.code,
      message: error.message,
      suggestion: error.suggestion,
      step: "launch ClawDesk in the desktop shell",
      sample: null,
    };
  }

  if (error.code === "E_TAURI_UNAVAILABLE") {
    return {
      stage: "prerequisite",
      failureKind: "runtime-bridge-unavailable",
      code: error.code,
      message: error.message,
      suggestion: error.suggestion,
      step: "initialize the Tauri command bridge",
      sample: null,
    };
  }

  const fallbackStage = classifyErrorStage(error);
  const structured = normalizeInstallIssue(error.details, {
    stage: fallbackStage,
    code: error.code,
    message: error.message,
    suggestion: error.suggestion,
    step: fallbackStep(fallbackStage),
  });
  if (structured) return structured;

  return createFallbackIssue(fallbackStage, error);
}

function toFailureResult(error?: BackendError): InstallActionResult {
  const issue = buildIssueFromError(error);
  const stage = issue?.stage ?? classifyErrorStage(error);
  let phases = createBasePhases();

  if (stage !== "prerequisite") {
    phases = updatePhase(phases, "prerequisite", {
      status: "success",
      detail: "已通过环境前置检查，可以继续执行安装。",
      suggestion: "继续安装 OpenClaw CLI。",
    });
  }

  phases = updatePhase(phases, stage, {
    status: "failure",
    detail: issue?.message ?? error?.message ?? "OpenClaw install failed.",
    suggestion: issue?.suggestion ?? error?.suggestion ?? "Check install logs and retry.",
    code: issue?.code ?? error?.code,
  });

  return {
    status: "failure",
    stage,
    detail: issue?.message ?? error?.message ?? "OpenClaw install failed.",
    suggestion: issue?.suggestion ?? error?.suggestion ?? "Check install logs and retry.",
    code: issue?.code ?? error?.code,
    phases,
    issue: issue ?? undefined,
  };
}

function toSuccessResult(data: InstallOpenClawData): InstallActionResult {
  let phases = createBasePhases();
  const gatewayIssue =
    normalizeInstallIssue(data.gatewayInstallIssue) ??
    buildIssueFromShellOutput("install-gateway", "openclaw gateway install --json", data.serviceInstallOutput);

  phases = updatePhase(phases, "prerequisite", {
    status: "success",
    detail: "环境检查通过，已开始执行安装。",
    suggestion: "继续执行官方安装脚本。",
  });
  phases = updatePhase(phases, "install-cli", {
    status: "success",
    detail: data.executablePath
      ? `OpenClaw CLI 已安装到 ${data.executablePath}。`
      : "OpenClaw CLI 安装成功。",
    suggestion: "继续安装 Gateway 托管服务。",
  });
  phases = updatePhase(phases, "install-gateway", {
    status: data.gatewayServiceInstalled ? "success" : "warning",
    detail: data.gatewayServiceInstalled
      ? "Gateway 托管服务安装成功。"
      : gatewayIssue?.message ?? "CLI 已安装，但 Gateway 托管服务仍需要人工关注。",
    suggestion: data.gatewayServiceInstalled
      ? "继续验证安装结果。"
      : gatewayIssue?.suggestion ?? "可前往 Service 和 Logs 页面继续排查托管服务安装问题。",
    code: data.gatewayServiceInstalled ? undefined : gatewayIssue?.code,
  });
  phases = updatePhase(phases, "verify", {
    status: data.executablePath ? "success" : "warning",
    detail: data.executablePath
      ? `已检测到可执行路径：${data.executablePath}`
      : "未返回可执行路径，请在 Logs 中确认安装结果。",
    suggestion: data.gatewayServiceInstalled
      ? "继续前往 Config 与 Service 页面完成配置并启动 Gateway。"
      : "先检查 Gateway 服务安装，再继续启动。",
  });

  return {
    status: data.gatewayServiceInstalled ? "success" : "warning",
    stage: data.gatewayServiceInstalled ? "verify" : "install-gateway",
    detail: data.gatewayServiceInstalled
      ? "OpenClaw CLI 和 Gateway 托管服务安装完成。"
      : gatewayIssue?.message ?? "OpenClaw CLI 已安装，但 Gateway 托管服务还需要进一步处理。",
    suggestion: data.gatewayServiceInstalled
      ? "继续前往 Config 和 Service 页面完成配置并启动 Gateway。"
      : gatewayIssue?.suggestion ?? "查看安装日志并前往 Service 页面继续完成剩余步骤。",
    code: data.gatewayServiceInstalled ? undefined : gatewayIssue?.code,
    phases,
    issue: gatewayIssue ?? undefined,
    data,
  };
}

export function buildInstallPhasesPreview(
  environment: InstallEnvironment | null,
  envError?: BackendError | null,
): InstallPhase[] {
  let phases = createBasePhases();

  if (envError) {
    return updatePhase(phases, "prerequisite", {
      status: "failure",
      detail: envError.message,
      suggestion: envError.suggestion,
      code: envError.code,
    });
  }

  if (!environment) {
    return phases;
  }

  phases = updatePhase(phases, "prerequisite", {
    status: environment.nodeFound && environment.npmFound ? "success" : "warning",
    detail: [
      environment.nodeFound
        ? `已检测到 Node.js${environment.nodeVersion ? ` ${environment.nodeVersion}` : ""}。`
        : "未检测到 Node.js，但官方安装脚本可以自动补齐。",
      environment.npmFound
        ? `已检测到 npm${environment.npmVersion ? ` ${environment.npmVersion}` : ""}。`
        : "未检测到 npm，但安装脚本会自动处理依赖。",
    ].join(" "),
    suggestion: "可以直接开始安装 OpenClaw，安装器会自动补齐缺失环境。",
  });

  if (environment.openclawFound) {
    const downstreamStatus = environment.nodeFound && environment.npmFound ? "success" : "warning";
    phases = updatePhase(phases, "install-cli", {
      status: downstreamStatus,
      detail: environment.nodeFound && environment.npmFound
        ? `已检测到 OpenClaw${environment.openclawVersion ? ` ${environment.openclawVersion}` : ""}。`
        : `已检测到 OpenClaw${environment.openclawVersion ? ` ${environment.openclawVersion}` : ""}，但环境仍需要自动补齐或修复。`,
      suggestion: environment.npmFound
        ? "如需重装，可重新执行安装流程。"
        : "安装脚本仍可自动修复环境后重装或升级 OpenClaw CLI。",
    });
    phases = updatePhase(phases, "verify", {
      status: downstreamStatus,
      detail: environment.nodeFound && environment.npmFound
        ? environment.openclawPath
          ? `当前 CLI 路径：${environment.openclawPath}`
          : "当前已检测到 OpenClaw CLI。"
        : environment.openclawPath
          ? `当前 CLI 路径仍可解析：${environment.openclawPath}，但环境仍需要自动补齐或修复。`
          : "当前已检测到 OpenClaw CLI，但环境仍需要自动补齐或修复。",
      suggestion: environment.npmFound
        ? "继续前往 Config 与 Service 页面完成配置和启动。"
        : "安装器可以继续自动补齐环境，再完成后续配置和启动。",
    });
    return phases;
  }

  phases = updatePhase(phases, "install-cli", {
    status: "pending",
    detail: "等待执行官方 OpenClaw 安装脚本。",
    suggestion: "安装脚本会自动检测并补齐 Node.js / npm。",
  });

  return phases;
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
