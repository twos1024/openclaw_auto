import type {
  InstallActionResult,
  InstallEnvironment,
  InstallPhase,
  InstallPhaseId,
  InstallProgressModel,
  InstallProgressTone,
  InstallTelemetry,
} from "../types/install";

interface InstallingPhasesArgs {
  environment: InstallEnvironment | null;
  elapsedMs: number;
  telemetry: InstallTelemetry | null;
}

interface ProgressModelArgs {
  environment: InstallEnvironment | null;
  installResult: InstallActionResult | null;
  isInstalling: boolean;
  elapsedMs: number;
  telemetry: InstallTelemetry | null;
  telemetryStageElapsedMs?: number;
}

const phaseTitles: Record<InstallPhaseId, string> = {
  prerequisite: "环境检查",
  "install-cli": "安装 OpenClaw CLI",
  "install-gateway": "准备 Gateway 服务",
  verify: "结果验证",
};

const runningSegments = [
  {
    phaseId: "install-cli" as const,
    startMs: 0,
    endMs: 3200,
    startPercent: 18,
    endPercent: 58,
    detail: "调用官方安装脚本安装 OpenClaw CLI，并自动补齐本机运行环境。",
    suggestion: "请保持窗口开启，等待官方安装脚本返回结果。",
  },
  {
    phaseId: "install-gateway" as const,
    startMs: 3200,
    endMs: 6400,
    startPercent: 58,
    endPercent: 84,
    detail: "正在记录 Gateway 下一步准备计划。保存 API 配置后，Gateway 步骤会安装或修复本地服务。",
    suggestion: "安装阶段只完成 CLI，后续 Gateway 服务会在配置完成后处理。",
  },
  {
    phaseId: "verify" as const,
    startMs: 6400,
    endMs: Number.POSITIVE_INFINITY,
    startPercent: 84,
    endPercent: 95,
    detail: "正在等待后端完成最终校验并回传安装结果。",
    suggestion: "最终成功、warning 或 failure 状态以后端返回结果为准。",
  },
];

function createBasePhases(): InstallPhase[] {
  return [
    {
      id: "prerequisite",
      title: phaseTitles.prerequisite,
      status: "pending",
      detail: "等待检查 Node.js、npm 与本地安装条件。",
      suggestion: "先刷新环境，确认 Node.js 和 npm 的可见性。",
    },
    {
      id: "install-cli",
      title: phaseTitles["install-cli"],
      status: "pending",
      detail: "等待执行 OpenClaw CLI 安装。",
      suggestion: "安装命令会调用官方安装脚本，并在必要时自动补齐 Node.js。",
    },
    {
      id: "install-gateway",
      title: phaseTitles["install-gateway"],
      status: "pending",
      detail: "等待在保存配置后安装或修复 Gateway 托管服务。",
      suggestion: "CLI 安装完成后，Gateway 步骤会继续准备本地服务。",
    },
    {
      id: "verify",
      title: phaseTitles.verify,
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

function interpolatePercent(elapsedMs: number, segment: (typeof runningSegments)[number]): number {
  if (!Number.isFinite(segment.endMs)) {
    return segment.endPercent;
  }

  const rangeMs = Math.max(segment.endMs - segment.startMs, 1);
  const ratio = Math.min(Math.max((elapsedMs - segment.startMs) / rangeMs, 0), 1);
  return Math.round(segment.startPercent + (segment.endPercent - segment.startPercent) * ratio);
}

function progressForFailureStage(stage: InstallPhaseId): number {
  switch (stage) {
    case "prerequisite":
      return 12;
    case "install-cli":
      return 44;
    case "install-gateway":
      return 78;
    case "verify":
      return 92;
    default:
      return 24;
  }
}

function progressBoundsForPhase(phaseId: InstallPhaseId): { start: number; end: number } {
  switch (phaseId) {
    case "prerequisite":
      return { start: 4, end: 18 };
    case "install-cli":
      return { start: 18, end: 58 };
    case "install-gateway":
      return { start: 58, end: 84 };
    case "verify":
      return { start: 84, end: 95 };
    default:
      return { start: 18, end: 58 };
  }
}

function estimateTelemetryPhasePercent(
  phaseId: InstallPhaseId,
  stageElapsedMs: number,
  phaseState: InstallTelemetry["phaseState"],
): number {
  const { start, end } = progressBoundsForPhase(phaseId);
  if (phaseState === "success") {
    return end;
  }
  if (phaseState === "failure") {
    return Math.max(start + 2, end - 4);
  }
  if (phaseState === "warning") {
    return Math.max(start + 2, end - 6);
  }

  const nominalDurationMs =
    phaseId === "install-cli" ? 3200 : phaseId === "install-gateway" ? 2600 : phaseId === "verify" ? 1800 : 1200;
  const ratio = Math.min(Math.max(stageElapsedMs / nominalDurationMs, 0.12), 0.88);
  return Math.round(start + (end - start) * ratio);
}

function toneFromResult(result: InstallActionResult): InstallProgressTone {
  if (result.status === "success") return "success";
  if (result.status === "warning") return "warning";
  return "failure";
}

export function buildInstallingPhases({ environment, elapsedMs, telemetry }: InstallingPhasesArgs): InstallPhase[] {
  let phases = createBasePhases();

  if (!environment) {
    return phases;
  }

  const runtimeReady = environment.nodeFound || environment.npmFound;
  phases = updatePhase(phases, "prerequisite", {
    status: runtimeReady ? "success" : "warning",
    detail: runtimeReady
      ? [
          environment.nodeFound
            ? `已检测到 Node.js${environment.nodeVersion ? ` ${environment.nodeVersion}` : ""}。`
            : "未检测到 Node.js，但安装脚本可以自动补齐。",
          environment.npmFound
            ? `已检测到 npm${environment.npmVersion ? ` ${environment.npmVersion}` : ""}。`
            : "未检测到 npm，但安装脚本会自动处理依赖。",
        ].join(" ")
      : "未检测到 Node.js / npm，但官方安装脚本会自动处理依赖。",
    suggestion: runtimeReady
      ? "前置条件满足，可以开始执行 OpenClaw 安装。"
      : "即使环境未完全就绪，安装器也会自动补齐缺失依赖。",
  });

  if (environment.openclawFound) {
    const downstreamStatus = runtimeReady ? "success" : "warning";
    phases = updatePhase(phases, "install-cli", {
      status: downstreamStatus,
      detail: runtimeReady
        ? `已检测到 OpenClaw${environment.openclawVersion ? ` ${environment.openclawVersion}` : ""}。`
        : `已检测到 OpenClaw${environment.openclawVersion ? ` ${environment.openclawVersion}` : ""}，但环境仍需要自动补齐或修复。`,
      suggestion: runtimeReady
        ? "如需重装，可重新执行安装流程。"
        : "安装脚本仍可自动修复环境后重装或升级 OpenClaw CLI。",
    });
    phases = updatePhase(phases, "verify", {
      status: downstreamStatus,
      detail: runtimeReady
        ? environment.openclawPath
          ? `当前 CLI 路径：${environment.openclawPath}`
          : "当前已检测到 OpenClaw CLI。"
        : environment.openclawPath
          ? `当前 CLI 路径仍可解析：${environment.openclawPath}，但环境仍需要自动补齐或修复。`
          : "当前已检测到 OpenClaw CLI，但环境仍需要自动补齐或修复。",
      suggestion: runtimeReady
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

  if (telemetry?.activePhaseId) {
    phases = updatePhase(phases, "prerequisite", {
      status: "success",
      detail: runtimeReady
        ? "环境检查已通过，正在执行安装。"
        : "环境检查未完全就绪，但安装脚本会自动补齐依赖。",
      suggestion: "前置条件满足，可以继续执行 OpenClaw 安装。",
    });

    const orderedPhaseIds: InstallPhaseId[] = ["install-cli", "install-gateway", "verify"];
    const activeIndex = orderedPhaseIds.indexOf(telemetry.activePhaseId);
    orderedPhaseIds.forEach((phaseId, index) => {
      if (index < activeIndex) {
        phases = updatePhase(phases, phaseId, {
          status: "success",
          detail:
            phaseId === "install-cli"
              ? "OpenClaw CLI 安装阶段已完成。"
              : phaseId === "install-gateway"
                ? "Gateway 服务准备阶段已完成。"
                : "安装验证阶段已完成。",
          suggestion: "继续等待后续阶段完成。",
        });
        return;
      }

      if (phaseId === telemetry.activePhaseId) {
        phases = updatePhase(phases, phaseId, {
          status: telemetry.phaseStatus,
          detail: telemetry.detail ?? `正在${phaseTitles[phaseId]}，请稍候...`,
          suggestion:
            telemetry.phaseState === "failure"
              ? "可前往日志页面查看详细信息，修复后重新安装。"
              : "安装正在后台进行，请保持页面开启。",
        });
      }
    });

    return phases;
  }

  const segment =
    runningSegments.find((item) => elapsedMs >= item.startMs && elapsedMs < item.endMs) ??
    runningSegments[runningSegments.length - 1];

  for (const item of runningSegments) {
    if (item.phaseId === segment.phaseId) {
      phases = updatePhase(phases, item.phaseId, {
        status: "running",
        detail: item.detail,
        suggestion: item.suggestion,
      });
      continue;
    }

    if (item.startMs < segment.startMs) {
      phases = updatePhase(phases, item.phaseId, {
        status: "success",
          detail:
            item.phaseId === "install-cli"
              ? "OpenClaw CLI 安装步骤已提交，等待后端最终确认。"
              : "Gateway 服务准备步骤已提交，等待后端最终确认。",
        suggestion: "继续等待安装命令完成。",
      });
    }
  }

  return phases;
}

export function buildInstallProgressModel({
  environment,
  installResult,
  isInstalling,
  elapsedMs,
  telemetry,
  telemetryStageElapsedMs = 0,
}: ProgressModelArgs): InstallProgressModel {
  void environment;

  if (installResult) {
    const tone = toneFromResult(installResult);
    return {
      visible: true,
      percent: installResult.status === "failure" ? progressForFailureStage(installResult.stage) : 100,
      tone,
      activePhaseId: installResult.stage,
      headline:
        installResult.status === "success"
          ? "安装完成"
          : installResult.status === "warning"
            ? "安装部分完成"
            : "安装失败",
      detail: installResult.detail,
      hint: installResult.suggestion,
    };
  }

  if (isInstalling) {
    if (telemetry?.activePhaseId) {
      return {
        visible: true,
        percent: estimateTelemetryPhasePercent(
          telemetry.activePhaseId,
          telemetryStageElapsedMs,
          telemetry.phaseState,
        ),
        tone: telemetry.phaseState === "warning" ? "warning" : "running",
        activePhaseId: telemetry.activePhaseId,
        headline:
          telemetry.phaseState === "success"
            ? `${phaseTitles[telemetry.activePhaseId]}已完成`
            : telemetry.phaseState === "failure"
              ? `${phaseTitles[telemetry.activePhaseId]}出现问题`
              : `正在${phaseTitles[telemetry.activePhaseId]}`,
        detail: telemetry.detail ?? `正在${phaseTitles[telemetry.activePhaseId]}，请稍候...`,
        hint: "安装正在后台运行，完成后将自动显示结果。",
      };
    }

    const segment =
      runningSegments.find((item) => elapsedMs >= item.startMs && elapsedMs < item.endMs) ??
      runningSegments[runningSegments.length - 1];
    return {
      visible: true,
      percent: interpolatePercent(elapsedMs, segment),
      tone: "running",
      activePhaseId: segment.phaseId,
      headline: `正在${phaseTitles[segment.phaseId]}`,
      detail: segment.detail,
      hint: "安装正在后台运行，完成后将自动显示结果。",
    };
  }

  return {
    visible: false,
    percent: 0,
    tone: "idle",
    activePhaseId: null,
    headline: "等待开始安装",
    detail: "先完成环境检查，然后开始执行 OpenClaw 安装。",
    hint: "安装开始后，这里会展示当前阶段和预计进度。",
  };
}
