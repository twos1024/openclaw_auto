/**
 * Pure functions for creating, updating, and previewing install phase timelines.
 * Extracted from installService to keep the service focused on I/O orchestration.
 */

import type { BackendError } from "../types/api";
import type {
  InstallActionResult,
  InstallEnvironment,
  InstallOpenClawData,
  InstallPhase,
  InstallPhaseId,
} from "../types/install";
import {
  buildIssueFromError,
  buildIssueFromShellOutput,
  classifyErrorStage,
  normalizeInstallIssue,
} from "./installIssues";

export function createBasePhases(): InstallPhase[] {
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
      title: "准备 Gateway 服务",
      status: "pending",
      detail: "等待在保存配置后安装或修复 Gateway 托管服务。",
      suggestion: "CLI 安装完成后，Gateway 步骤会继续准备本地服务。",
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

export function updatePhase(
  phases: InstallPhase[],
  phaseId: InstallPhaseId,
  patch: Partial<InstallPhase>,
): InstallPhase[] {
  return phases.map((phase) => (phase.id === phaseId ? { ...phase, ...patch } : phase));
}

export function toFailureResult(error?: BackendError): InstallActionResult {
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

export function toSuccessResult(data: InstallOpenClawData): InstallActionResult {
  let phases = createBasePhases();
  const gatewayServiceDeferred = Boolean(data.gatewayServiceDeferred);
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
    suggestion: "继续保存配置，再在 Gateway 步骤完成本地服务准备。",
  });
  phases = updatePhase(phases, "install-gateway", {
    status: gatewayServiceDeferred || data.gatewayServiceInstalled ? "success" : "warning",
    detail: gatewayServiceDeferred
      ? "Gateway 托管服务会在保存配置后，于 Gateway 步骤自动安装或修复。"
      : data.gatewayServiceInstalled
      ? "Gateway 托管服务安装成功。"
      : gatewayIssue?.message ?? "CLI 已安装，但 Gateway 托管服务仍需要人工关注。",
    suggestion: gatewayServiceDeferred
      ? "继续到配置和 Gateway 步骤，完成本地服务准备并启动 Gateway。"
      : data.gatewayServiceInstalled
      ? "继续验证安装结果。"
      : gatewayIssue?.suggestion ?? "可前往 Service 和 Logs 页面继续排查托管服务安装问题。",
    code: gatewayServiceDeferred || data.gatewayServiceInstalled ? undefined : gatewayIssue?.code,
  });
  phases = updatePhase(phases, "verify", {
    status: data.executablePath ? "success" : "warning",
    detail: data.executablePath
      ? `已检测到可执行路径：${data.executablePath}`
      : "未返回可执行路径，请在 Logs 中确认安装结果。",
    suggestion: gatewayServiceDeferred || data.gatewayServiceInstalled
      ? "继续前往 Config 与 Service 页面完成配置并启动 Gateway。"
      : "先检查 Gateway 服务安装，再继续启动。",
  });

  return {
    status: gatewayServiceDeferred || data.gatewayServiceInstalled ? "success" : "warning",
    stage: gatewayServiceDeferred || data.gatewayServiceInstalled ? "verify" : "install-gateway",
    detail: gatewayServiceDeferred
      ? "OpenClaw CLI 安装完成。Gateway 服务会在保存配置后继续准备。"
      : data.gatewayServiceInstalled
      ? "OpenClaw CLI 和 Gateway 托管服务安装完成。"
      : gatewayIssue?.message ?? "OpenClaw CLI 已安装，但 Gateway 托管服务还需要进一步处理。",
    suggestion: gatewayServiceDeferred || data.gatewayServiceInstalled
      ? "继续前往 Config 和 Service 页面完成配置并启动 Gateway。"
      : gatewayIssue?.suggestion ?? "查看安装日志并前往 Service 页面继续完成剩余步骤。",
    code: gatewayServiceDeferred || data.gatewayServiceInstalled ? undefined : gatewayIssue?.code,
    phases,
    issue: gatewayServiceDeferred ? undefined : gatewayIssue ?? undefined,
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
