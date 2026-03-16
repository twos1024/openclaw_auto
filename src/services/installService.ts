import type { BackendError } from "../types/api";
import type {
  InstallActionResult,
  InstallEnvResult,
  InstallEnvironment,
  InstallOpenClawData,
  InstallPhase,
  InstallPhaseId,
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

function classifyErrorStage(error?: BackendError): InstallPhaseId {
  const haystack = collectErrorText(error);
  const code = error?.code ?? "";

  if (haystack.includes("spawn npm enoent") || haystack.includes("failed to spawn command: npm")) {
    return "prerequisite";
  }

  if (haystack.includes("permission denied") || haystack.includes("access is denied") || code === "E_PERMISSION_DENIED") {
    return "install-cli";
  }

  if (haystack.includes("gateway install") || haystack.includes("managed gateway")) {
    return "install-gateway";
  }

  return "install-cli";
}

function toFailureResult(error?: BackendError): InstallActionResult {
  const stage = classifyErrorStage(error);
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
    detail: error?.message ?? "OpenClaw install failed.",
    suggestion: error?.suggestion ?? "Check install logs and retry.",
    code: error?.code,
  });

  return {
    status: "failure",
    stage,
    detail: error?.message ?? "OpenClaw install failed.",
    suggestion: error?.suggestion ?? "Check install logs and retry.",
    code: error?.code,
    phases,
  };
}

function toSuccessResult(data: InstallOpenClawData): InstallActionResult {
  let phases = createBasePhases();

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
      : "CLI 已安装，但 Gateway 托管服务仍需要人工关注。",
    suggestion: data.gatewayServiceInstalled
      ? "继续验证安装结果。"
      : "可前往 Service 和 Logs 页面继续排查托管服务安装问题。",
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
      : "OpenClaw CLI 已安装，但 Gateway 托管服务还需要进一步处理。",
    suggestion: data.gatewayServiceInstalled
      ? "继续前往 Config 和 Service 页面完成配置并启动 Gateway。"
      : "查看安装日志并前往 Service 页面继续完成剩余步骤。",
    phases,
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
