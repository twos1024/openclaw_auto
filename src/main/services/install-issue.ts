import { AppError, ErrorCode } from "../models/error.js";
import type { ShellOutput } from "../adapters/shell.js";

export interface InstallIssue {
  stage: string;
  failureKind: string;
  code: string;
  message: string;
  suggestion: string;
  step: string;
  exitCode?: number | null;
  sample?: string;
  errorCode?: ErrorCode;
}

export function installErrorFromError(stage: string, step: string, error: AppError): AppError {
  const issue = classifyInstallError(stage, step, error);
  return issueToAppError(issue, error, null);
}

export function installErrorFromOutput(stage: string, step: string, output: ShellOutput): AppError {
  const issue = classifyInstallOutput(stage, step, output);
  return issueToAppError(issue, null, output);
}

export function classifyInstallError(stage: string, step: string, error: AppError): InstallIssue {
  const haystack = collectErrorHaystack(error);

  if (looksLikeMissingInstallerPrereq(haystack)) {
    return buildInstallIssue("prerequisite", "missing-installer-prerequisite", ErrorCode.PathNotFound,
      "OpenClaw install prerequisites are missing.",
      "Ensure PowerShell (Windows) or bash/curl (macOS/Linux) are available, then retry.",
      step, undefined, findSample(haystack));
  }

  if (looksLikePermissionDenied(haystack)) {
    return buildInstallIssue(stage, "permission-denied", ErrorCode.PermissionDenied,
      "OpenClaw install could not access the required directory or command target.",
      "Run ClawDesk with elevated privileges, or change the target directory to a writable location.",
      step, undefined, findSample(haystack));
  }

  if (looksLikeNetworkFailure(haystack)) {
    return buildInstallIssue(stage, "network-failure", ErrorCode.NetworkFailed,
      "OpenClaw install failed while downloading required components.",
      "Check network access, DNS/proxy/TLS settings, then retry.",
      step, undefined, findSample(haystack));
  }

  if (stage === "verify" && error.code === ErrorCode.PathNotFound) {
    return buildInstallIssue(stage, "binary-not-found", ErrorCode.PathNotFound,
      "OpenClaw CLI appears installed, but its executable path could not be resolved.",
      "Check PATH configuration, the OpenClaw install prefix, and whether the binary was installed successfully.",
      step, undefined, findSample(haystack));
  }

  if (error.code === ErrorCode.ShellTimeout || looksLikeTimeout(haystack)) {
    return buildInstallIssue(stage, "command-timeout", ErrorCode.ShellTimeout,
      "The install command timed out before finishing.",
      "Check whether downloads are blocked by the network or a stalled process, then retry.",
      step, undefined, findSample(haystack));
  }

  if (stage === "install-gateway") {
    return buildInstallIssue(stage, "gateway-install-failed", ErrorCode.GatewayInstallFailed,
      "Gateway managed install did not complete successfully.",
      "Open the Service and Logs pages to inspect the managed install output and finish setup manually if needed.",
      step, undefined, findSample(haystack));
  }

  return buildInstallIssue(stage, "unknown", error.code,
    error.message, error.suggestion, step, undefined, findSample(haystack));
}

export function classifyInstallOutput(stage: string, step: string, output: ShellOutput): InstallIssue {
  const haystack = `${output.stderr}\n${output.stdout}`.toLowerCase();
  const sample = firstMeaningfulLine(output.stderr) ?? firstMeaningfulLine(output.stdout);
  const sampleStr = sample ? truncateSample(sample) : undefined;

  if (looksLikePermissionDenied(haystack)) {
    return buildInstallIssue(stage, "permission-denied", ErrorCode.PermissionDenied,
      stage === "install-gateway"
        ? "Gateway managed install could not write the local service registration."
        : "OpenClaw installer could not write to the destination directory.",
      stage === "install-gateway"
        ? "Run with elevated privileges or use a service directory that ClawDesk can write to."
        : "Run the install with elevated privileges or change the install prefix to a writable location.",
      step, output.exitCode, sampleStr);
  }

  if (looksLikeNetworkFailure(haystack)) {
    return buildInstallIssue(stage, "network-failure", ErrorCode.NetworkFailed,
      "OpenClaw install failed while downloading required components.",
      "Check network connectivity, proxy/TLS settings, and retry the install.",
      step, output.exitCode, sampleStr);
  }

  if (looksLikeTimeout(haystack)) {
    return buildInstallIssue(stage, "command-timeout", ErrorCode.ShellTimeout,
      "The install command did not finish before the timeout.",
      "Retry after checking network speed and any blocked child processes.",
      step, output.exitCode, sampleStr);
  }

  if (stage === "install-gateway") {
    return buildInstallIssue(stage, "gateway-install-failed", ErrorCode.GatewayInstallFailed,
      "Gateway managed install could not register the local service.",
      "Open Service and Logs to inspect the managed install output and continue setup manually if needed.",
      step, output.exitCode, sampleStr);
  }

  return buildInstallIssue(stage, "unknown", ErrorCode.InstallCommandFailed,
    "OpenClaw installation command returned a non-zero exit code.",
    "Check installer output, network access, and permissions, then retry.",
    step, output.exitCode, sampleStr);
}

function issueToAppError(issue: InstallIssue, sourceError: AppError | null, output: ShellOutput | null): AppError {
  const details: Record<string, unknown> = {
    stage: issue.stage,
    failureKind: issue.failureKind,
    step: issue.step,
    exitCode: issue.exitCode,
    sample: issue.sample,
  };

  if (output) {
    details["program"] = output.program;
    details["args"] = output.args;
    details["stdout"] = output.stdout;
    details["stderr"] = output.stderr;
  }

  if (sourceError) {
    details["sourceError"] = sourceError.toJSON();
  }

  return new AppError(
    issue.errorCode ?? ErrorCode.InternalError,
    issue.message,
    issue.suggestion,
  ).withDetails(details);
}

function buildInstallIssue(
  stage: string, failureKind: string, errorCode: ErrorCode,
  message: string, suggestion: string, step: string,
  exitCode: number | null | undefined, sample: string | undefined,
): InstallIssue {
  return {
    stage, failureKind,
    code: errorCode as string,
    message, suggestion, step,
    exitCode: exitCode ?? undefined,
    sample,
    errorCode,
  };
}

function collectErrorHaystack(error: AppError): string {
  const parts: string[] = [error.message.toLowerCase(), error.suggestion.toLowerCase()];
  if (error.details) collectJsonStrings(error.details, parts);
  return parts.join("\n");
}

function collectJsonStrings(value: unknown, parts: string[]): void {
  if (typeof value === "string") { parts.push(value.toLowerCase()); return; }
  if (Array.isArray(value)) { for (const item of value) collectJsonStrings(item, parts); return; }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectJsonStrings(v, parts);
  }
}

function looksLikeMissingInstallerPrereq(h: string): boolean {
  return h.includes("failed to spawn command: powershell") || h.includes("spawn powershell enoent")
    || h.includes("failed to spawn command: bash") || h.includes("spawn bash enoent")
    || h.includes("curl: command not found") || h.includes("curl: not found")
    || h.includes("iwr : the term") || h.includes("node: command not found")
    || h.includes("npm: command not found") || h.includes("nodejs not found");
}

function looksLikePermissionDenied(h: string): boolean {
  return h.includes("permission denied") || h.includes("access is denied")
    || h.includes("operation not permitted") || h.includes("eacces") || h.includes("eperm");
}

function looksLikeNetworkFailure(h: string): boolean {
  return h.includes("openclaw.ai") || h.includes("nodejs.org") || h.includes("github.com")
    || h.includes("enotfound") || h.includes("econnreset") || h.includes("socket hang up")
    || h.includes("network request failed") || h.includes("getaddrinfo")
    || h.includes("proxy") || h.includes("self signed certificate") || h.includes("certificate");
}

function looksLikeTimeout(h: string): boolean {
  return h.includes("timed out") || h.includes("timeout") || h.includes("deadline exceeded");
}

function findSample(haystack: string): string | undefined {
  const line = firstMeaningfulLine(haystack);
  return line ? truncateSample(line) : undefined;
}

function firstMeaningfulLine(text: string): string | undefined {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function truncateSample(sample: string): string {
  const MAX_LEN = 180;
  if (sample.length <= MAX_LEN) return sample;
  return sample.slice(0, MAX_LEN) + "...";
}
