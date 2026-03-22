/**
 * Pure functions for normalizing, classifying, and building InstallIssue objects
 * from backend errors, shell output, and structured data.
 * Extracted from installService to keep the service focused on I/O orchestration.
 */

import type { BackendError } from "../types/api";
import type { InstallIssue, InstallPhaseId, ShellCommandOutput } from "../types/install";

export function isInstallPhaseId(value: unknown): value is InstallPhaseId {
  return value === "prerequisite" || value === "install-cli" || value === "install-gateway" || value === "verify";
}

export function firstMeaningfulLine(text: string): string | null {
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

export function normalizeInstallIssue(raw: unknown, fallback?: Partial<InstallIssue>): InstallIssue | null {
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

  return { stage, failureKind, code, message, suggestion, step, exitCode, sample };
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

export function fallbackStep(stage: InstallPhaseId): string {
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

export function buildIssueFromShellOutput(
  stage: InstallPhaseId,
  step: string,
  output?: ShellCommandOutput | null,
): InstallIssue | null {
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

export function classifyErrorStage(error?: BackendError): InstallPhaseId {
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

export function buildIssueFromError(error?: BackendError): InstallIssue | null {
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

  const stage = classifyErrorStage(error);
  const structured = normalizeInstallIssue(error.details, {
    stage,
    code: error.code,
    message: error.message,
    suggestion: error.suggestion,
    step: fallbackStep(stage),
  });
  if (structured) return structured;

  return createFallbackIssue(stage, error);
}
