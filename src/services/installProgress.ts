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
  "install-gateway": "安装 Gateway 托管服务",
  verify: "结果验证",
};

const runningSegments = [
  {
    phaseId: "install-cli" as const,
    startMs: 0,
    endMs: 3200,
    startPercent: 18,
    endPercent: 58,
    detail: "通过 npm 全局安装 OpenClaw CLI，准备后续 Gateway 托管安装。",
    suggestion: "请保持窗口开启，等待 CLI 安装命令返回结果。",
  },
  {
    phaseId: "install-gateway" as const,
    startMs: 3200,
    endMs: 6400,
    startPercent: 58,
    endPercent: 84,
    detail: "正在尝试注册 Gateway 托管服务，失败时会以 warning 形式给出后续建议。",
    suggestion: "如果本机服务注册受限，后续可在 Service 与 Logs 页面继续处理。",
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
      detail: "等待检查 npm 与本地安装条件。",
      suggestion: "先刷新环境，确认 npm 和本地路径可用。",
    },
    {
      id: "install-cli",
      title: phaseTitles["install-cli"],
      status: "pending",
      detail: "等待执行 OpenClaw CLI 安装。",
      suggestion: "安装命令会通过 npm 全局安装 OpenClaw。",
    },
    {
      id: "install-gateway",
      title: phaseTitles["install-gateway"],
      status: "pending",
      detail: "等待执行 Gateway managed install。",
      suggestion: "CLI 安装完成后会继续尝试安装 Gateway 服务。",
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

  const npmReady = environment.npmFound;
  phases = updatePhase(phases, "prerequisite", {
    status: npmReady ? "success" : "failure",
    detail: npmReady
      ? `已检测到 npm${environment.npmVersion ? ` ${environment.npmVersion}` : ""}。`
      : "未检测到 npm，当前无法开始安装。",
    suggestion: npmReady
      ? "前置条件满足，可以开始执行 OpenClaw 安装。"
      : "先安装 Node.js / npm，再刷新环境检查。",
  });

  if (!npmReady && environment.openclawFound) {
    phases = updatePhase(phases, "install-cli", {
      status: "warning",
      detail: `已检测到 OpenClaw${environment.openclawVersion ? ` ${environment.openclawVersion}` : ""}，但 npm 当前不可用。`,
      suggestion: "先恢复 npm 与 PATH，再继续安装、重装或修复 OpenClaw CLI。",
    });
    phases = updatePhase(phases, "verify", {
      status: "warning",
      detail: environment.openclawPath
        ? `当前 CLI 路径仍可解析：${environment.openclawPath}，但环境前置检查未通过。`
        : "当前已检测到 OpenClaw CLI，但环境前置检查未通过。",
      suggestion: "先修复 npm / PATH 环境，再继续后续安装和验证步骤。",
    });
    return phases;
  }

  if (!npmReady) {
    return phases;
  }

  if (telemetry?.activePhaseId) {
    phases = updatePhase(phases, "prerequisite", {
      status: "success",
      detail: `已检测到 npm${environment.npmVersion ? ` ${environment.npmVersion}` : ""}。`,
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
                ? "Gateway 托管安装阶段已完成。"
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
            : "Gateway 托管安装步骤已提交，等待后端最终确认。",
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
    if (!environment?.npmFound) {
      return {
        visible: true,
        percent: 12,
        tone: "blocked",
        activePhaseId: "prerequisite",
        headline: "等待修复安装前置条件",
        detail: "当前未检测到 npm，无法继续执行 OpenClaw 安装。",
        hint: "先修复 Node.js / npm 环境，再重新开始安装。",
      };
    }

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
