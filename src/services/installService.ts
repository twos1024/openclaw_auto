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
import { invokeCommand } from "./tauriClient";

interface DetectEnvPayload {
  platform?: string;
  architecture?: string;
  home_dir?: string | null;
  config_path?: string;
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
      detail: "等待检查 npm 与本地安装条件。",
      suggestion: "先刷新环境，确认 npm 和本地路径可用。",
    },
    {
      id: "install-cli",
      title: "安装 OpenClaw CLI",
      status: "pending",
      detail: "等待执行 OpenClaw CLI 安装。",
      suggestion: "安装命令会通过 npm 全局安装 OpenClaw。",
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

function collectErrorText(error?: BackendError): string {
  if (!error) return "";
  const chunks = [error.message, error.suggestion];
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      chunks.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(error.details);
  return chunks.join("\n").toLowerCase();
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

function deriveIssueFromText(
  stage: InstallPhaseId,
  step: string,
  code: string,
  message: string,
  suggestion: string,
  rawText: string,
  exitCode?: number | null,
  sample?: string | null,
): InstallIssue {
  const haystack = rawText.toLowerCase();

  if (
    haystack.includes("spawn npm enoent") ||
    haystack.includes("failed to spawn command: npm") ||
    haystack.includes("npm not found")
  ) {
    return {
      stage: "prerequisite",
      failureKind: "missing-npm",
      code: "E_PATH_NOT_FOUND",
      message: "OpenClaw install prerequisites are missing.",
      suggestion: "先安装 Node.js / npm，再刷新环境检查并重试。",
      step,
      exitCode,
      sample: sample ?? firstMeaningfulLine(rawText),
    };
  }

  if (
    haystack.includes("permission denied") ||
    haystack.includes("access is denied") ||
    haystack.includes("operation not permitted") ||
    haystack.includes("eacces") ||
    haystack.includes("eperm")
  ) {
    return {
      stage,
      failureKind: "permission-denied",
      code: "E_PERMISSION_DENIED",
      message,
      suggestion,
      step,
      exitCode,
      sample: sample ?? firstMeaningfulLine(rawText),
    };
  }

  if (
    haystack.includes("registry.npmjs.org") ||
    haystack.includes("enotfound") ||
    haystack.includes("econnreset") ||
    haystack.includes("socket hang up") ||
    haystack.includes("network request failed") ||
    haystack.includes("proxy") ||
    haystack.includes("certificate")
  ) {
    return {
      stage,
      failureKind: "network-failure",
      code: "E_NETWORK_FAILED",
      message: "OpenClaw CLI installation failed while downloading packages from npm.",
      suggestion: "检查 npm registry、代理、证书和网络链路后重试。",
      step,
      exitCode,
      sample: sample ?? firstMeaningfulLine(rawText),
    };
  }

  if (haystack.includes("timeout") || haystack.includes("timed out") || haystack.includes("deadline exceeded")) {
    return {
      stage,
      failureKind: "command-timeout",
      code: "E_SHELL_TIMEOUT",
      message,
      suggestion,
      step,
      exitCode,
      sample: sample ?? firstMeaningfulLine(rawText),
    };
  }

  if (stage === "install-gateway") {
    return {
      stage,
      failureKind: "gateway-install-failed",
      code: code || "E_GATEWAY_INSTALL_FAILED",
      message,
      suggestion,
      step,
      exitCode,
      sample: sample ?? firstMeaningfulLine(rawText),
    };
  }

  return {
    stage,
    failureKind: "unknown",
    code,
    message,
    suggestion,
    step,
    exitCode,
    sample: sample ?? firstMeaningfulLine(rawText),
  };
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
      : fallback?.step ?? "npm install -g openclaw@latest";
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

function buildIssueFromShellOutput(stage: InstallPhaseId, step: string, output?: ShellCommandOutput | null): InstallIssue | null {
  if (!output) return null;

  const rawText = [output.stderr, output.stdout].filter(Boolean).join("\n");
  const code = stage === "install-gateway" ? "E_GATEWAY_INSTALL_FAILED" : "E_UNKNOWN";
  const message =
    stage === "install-gateway"
      ? "Gateway managed install could not register the local service."
      : "OpenClaw install command returned a non-zero exit code.";
  const suggestion =
    stage === "install-gateway"
      ? "前往 Service 与 Logs 页面继续排查托管安装输出。"
      : "检查 npm 输出、权限和网络后重试。";

  return deriveIssueFromText(stage, step, code, message, suggestion, rawText, output.exitCode ?? null);
}

function classifyErrorStage(error?: BackendError): InstallPhaseId {
  if (error?.details && typeof error.details.stage === "string" && isInstallPhaseId(error.details.stage)) {
    return error.details.stage;
  }

  const haystack = collectErrorText(error);
  const code = error?.code ?? "";

  if (haystack.includes("spawn npm enoent") || haystack.includes("failed to spawn command: npm")) {
    return "prerequisite";
  }

  if (
    haystack.includes("permission denied") ||
    haystack.includes("access is denied") ||
    code === "E_PERMISSION_DENIED" ||
    code === "E_NETWORK_FAILED"
  ) {
    return "install-cli";
  }

  if (haystack.includes("gateway install") || haystack.includes("managed gateway") || code === "E_GATEWAY_INSTALL_FAILED") {
    return "install-gateway";
  }

  return "install-cli";
}

function buildIssueFromError(error?: BackendError): InstallIssue | null {
  if (!error) return null;

  const fallbackStage = classifyErrorStage(error);
  const structured = normalizeInstallIssue(error.details, {
    stage: fallbackStage,
    code: error.code,
    message: error.message,
    suggestion: error.suggestion,
    step: fallbackStage === "install-gateway" ? "openclaw gateway install --json" : "npm install -g openclaw@latest",
  });
  if (structured) return structured;

  const stage = fallbackStage;
  const step = stage === "install-gateway" ? "openclaw gateway install --json" : "npm install -g openclaw@latest";
  return deriveIssueFromText(stage, step, error.code, error.message, error.suggestion, collectErrorText(error));
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
    suggestion: "继续执行 CLI 安装。",
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
      ? "继续前往 Config 与 Service 页面完成配置和启动。"
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
    status: environment.npmFound ? "success" : "failure",
    detail: environment.npmFound
      ? `已检测到 npm${environment.npmVersion ? ` ${environment.npmVersion}` : ""}。`
      : "未检测到 npm，当前无法开始安装。",
    suggestion: environment.npmFound
      ? "可以开始安装 OpenClaw CLI。"
      : "先安装 Node.js / npm，再刷新环境检查。",
  });

  if (environment.openclawFound) {
    phases = updatePhase(phases, "install-cli", {
      status: "success",
      detail: `已检测到 OpenClaw${environment.openclawVersion ? ` ${environment.openclawVersion}` : ""}。`,
      suggestion: "如需重装，可重新执行安装流程。",
    });
    phases = updatePhase(phases, "verify", {
      status: "success",
      detail: environment.openclawPath
        ? `当前 CLI 路径：${environment.openclawPath}`
        : "当前已检测到 OpenClaw CLI。",
      suggestion: "继续前往 Config 与 Service 页面完成配置和启动。",
    });
  }

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
};
