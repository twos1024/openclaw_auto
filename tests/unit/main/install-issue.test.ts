// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  classifyInstallError,
  classifyInstallOutput,
  installErrorFromError,
  installErrorFromOutput,
} from "../../../src/main/services/install-issue.js";
import { AppError, ErrorCode } from "../../../src/main/models/error.js";
import type { ShellOutput } from "../../../src/main/adapters/shell.js";

function makeOutput(stderr: string, stdout: string, exitCode: number | null = 1): ShellOutput {
  return { program: "powershell", args: ["-Command", "install.ps1"], stdout, stderr, exitCode, durationMs: 1500 };
}

function makeAppError(code: ErrorCode, message: string, suggestion = "Retry.", details?: unknown): AppError {
  const err = new AppError(code, message, suggestion);
  return details !== undefined ? err.withDetails(details) : err;
}

describe("classifyInstallError", () => {
  it("classifies missing installer prerequisite — spawn powershell enoent", () => {
    const error = makeAppError(ErrorCode.ShellSpawnFailed, "Failed to spawn command: powershell", "Check binary.", { osError: "spawn powershell ENOENT" });
    const issue = classifyInstallError("prerequisite", "powershell install.ps1", error);
    expect(issue.stage).toBe("prerequisite");
    expect(issue.failureKind).toBe("missing-installer-prerequisite");
    expect(issue.errorCode).toBe(ErrorCode.PathNotFound);
  });

  it("classifies permission denied from error message", () => {
    const error = makeAppError(ErrorCode.ShellSpawnFailed, "Permission denied when accessing /usr/local/bin", "Run as admin.");
    const issue = classifyInstallError("install-cli", "bash install-cli.sh", error);
    expect(issue.failureKind).toBe("permission-denied");
    expect(issue.errorCode).toBe(ErrorCode.PermissionDenied);
  });

  it("classifies network failure when openclaw.ai appears in error", () => {
    const error = makeAppError(ErrorCode.NetworkFailed, "Failed to fetch https://openclaw.ai/install-cli.sh", "Check network.");
    const issue = classifyInstallError("install-cli", "bash install-cli.sh", error);
    expect(issue.failureKind).toBe("network-failure");
    expect(issue.errorCode).toBe(ErrorCode.NetworkFailed);
  });

  it("classifies post-install binary not found as verify stage", () => {
    const error = makeAppError(ErrorCode.PathNotFound, "Unable to resolve OpenClaw executable", "Check PATH.");
    const issue = classifyInstallError("verify", "resolve openclaw path", error);
    expect(issue.stage).toBe("verify");
    expect(issue.failureKind).toBe("binary-not-found");
  });

  it("classifies shell timeout", () => {
    const error = makeAppError(ErrorCode.ShellTimeout, "Command timed out", "Retry.");
    const issue = classifyInstallError("install-cli", "bash install-cli.sh", error);
    expect(issue.failureKind).toBe("command-timeout");
    expect(issue.errorCode).toBe(ErrorCode.ShellTimeout);
  });

  it("classifies gateway stage failures as gateway-install-failed", () => {
    const error = makeAppError(ErrorCode.InternalError, "Unknown gateway error", "Retry.");
    const issue = classifyInstallError("install-gateway", "openclaw gateway install", error);
    expect(issue.failureKind).toBe("gateway-install-failed");
    expect(issue.errorCode).toBe(ErrorCode.GatewayInstallFailed);
  });

  it("falls back to unknown with original error code", () => {
    const error = makeAppError(ErrorCode.ConfigWriteFailed, "Some other error", "Check config.");
    const issue = classifyInstallError("install-cli", "npm install -g openclaw", error);
    expect(issue.failureKind).toBe("unknown");
    expect(issue.errorCode).toBe(ErrorCode.ConfigWriteFailed);
    expect(issue.message).toBe("Some other error");
  });
});

describe("classifyInstallOutput", () => {
  it("classifies access denied from stderr", () => {
    const output = makeOutput("access is denied", "", 243);
    const issue = classifyInstallOutput("install-cli", "powershell install.ps1", output);
    expect(issue.failureKind).toBe("permission-denied");
    expect(issue.exitCode).toBe(243);
    expect(issue.errorCode).toBe(ErrorCode.PermissionDenied);
  });

  it("classifies network failure from openclaw.ai in stderr", () => {
    const output = makeOutput("curl: (6) Could not resolve host: openclaw.ai", "", 1);
    const issue = classifyInstallOutput("install-cli", "bash install-cli.sh", output);
    expect(issue.failureKind).toBe("network-failure");
    expect(issue.errorCode).toBe(ErrorCode.NetworkFailed);
  });

  it("classifies timeout from stderr", () => {
    const output = makeOutput("operation timed out after 60 seconds", "", 1);
    const issue = classifyInstallOutput("install-cli", "bash install-cli.sh", output);
    expect(issue.failureKind).toBe("command-timeout");
    expect(issue.errorCode).toBe(ErrorCode.ShellTimeout);
  });

  it("classifies gateway stage with special gateway message", () => {
    const output = makeOutput("unexpected service error", "", 1);
    const issue = classifyInstallOutput("install-gateway", "openclaw gateway install", output);
    expect(issue.failureKind).toBe("gateway-install-failed");
    expect(issue.errorCode).toBe(ErrorCode.GatewayInstallFailed);
  });

  it("classifies unknown non-zero as E_INSTALL_COMMAND_FAILED", () => {
    const output = makeOutput("something unexpected happened", "", 1);
    const issue = classifyInstallOutput("install-cli", "powershell install.ps1", output);
    expect(issue.failureKind).toBe("unknown");
    expect(issue.errorCode).toBe(ErrorCode.InstallCommandFailed);
  });

  it("sets sample from first meaningful stderr line", () => {
    const output = makeOutput("\n  error: npm ERR! missing script\n", "", 1);
    const issue = classifyInstallOutput("install-cli", "npm run install", output);
    expect(issue.sample).toBeTruthy();
    expect(issue.sample).toContain("error");
  });

  it("falls back to stdout sample when stderr is empty", () => {
    const output = makeOutput("", "WARNING: something weird happened", 1);
    const issue = classifyInstallOutput("install-cli", "npm run install", output);
    expect(issue.sample).toContain("WARNING");
  });
});

describe("installErrorFromOutput", () => {
  it("returns AppError with install details attached", () => {
    const output = makeOutput("EACCES: permission denied, mkdir '/usr/local/lib'", "", 1);
    const err = installErrorFromOutput("install-cli", "npm install -g openclaw", output);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe(ErrorCode.PermissionDenied);
    const details = err.details as Record<string, unknown>;
    expect(details["stage"]).toBe("install-cli");
    expect(details["step"]).toBe("npm install -g openclaw");
    expect(details["exitCode"]).toBe(1);
    expect(details["stderr"]).toContain("EACCES");
  });
});

describe("installErrorFromError", () => {
  it("wraps AppError with classification details", () => {
    const sourceError = makeAppError(ErrorCode.ShellTimeout, "Command timed out after 600s", "Check network.");
    const err = installErrorFromError("install-cli", "bash install-cli.sh", sourceError);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe(ErrorCode.ShellTimeout);
    const details = err.details as Record<string, unknown>;
    expect(details["stage"]).toBe("install-cli");
    expect((details["sourceError"] as Record<string, unknown>)["code"]).toBe("E_SHELL_TIMEOUT");
  });
});
