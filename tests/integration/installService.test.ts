/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInstallPhasesPreview, installService } from "../../src/services/installService";

type InvokeHandler = (payload?: Record<string, unknown>) => unknown | Promise<unknown>;

function createInvokeMock(handlers: Record<string, InvokeHandler>) {
  const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>) => {
    const handler = handlers[command];
    if (!handler) {
      throw new Error(`Unhandled invoke command in test: ${command}`);
    }
    return handler(payload);
  });

  Object.defineProperty(window, "__TAURI__", {
    configurable: true,
    writable: true,
    value: { core: { invoke } },
  });

  return invoke;
}

describe("installService integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "isTauri", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, "isTauri", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("maps detect_env payload into install environment shape", async () => {
    createInvokeMock({
      detect_env: async () => ({
        success: true,
        data: {
          platform: "windows",
          architecture: "x64",
          home_dir: "C:\\Users\\Tester",
          config_path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
          npm_found: true,
          npm_version: "10.9.0",
          openclaw_found: false,
          openclaw_path: null,
          openclaw_version: null,
        },
      }),
    });

    const result = await installService.detectEnv();

    expect(result.ok).toBe(true);
    expect(result.data?.npmFound).toBe(true);
    expect(result.data?.configPath).toContain(".openclaw");
  });

  it("returns success when install_openclaw succeeds", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: true,
        data: {
          cliInstalled: true,
          gatewayServiceInstalled: true,
          executablePath: "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd",
          configPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
          notes: [],
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("success");
    expect(result.data?.gatewayServiceInstalled).toBe(true);
  });

  it("returns warning phases when Gateway managed install needs manual attention", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: true,
        data: {
          cliInstalled: true,
          gatewayServiceInstalled: false,
          executablePath: "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd",
          configPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
          notes: ["Gateway service install requires manual follow-up."],
        },
      }),
    });

    const result = await installService.installOpenClaw();
    const phase = result.phases.find((item) => item.id === "install-gateway");

    expect(result.status).toBe("warning");
    expect(result.stage).toBe("install-gateway");
    expect(phase?.status).toBe("warning");
  });

  it("classifies npm missing as prerequisite failure", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: false,
        error: {
          code: "E_PATH_NOT_FOUND",
          message: "OpenClaw install prerequisites are missing.",
          suggestion: "Install Node.js and npm first.",
          details: {
            stage: "prerequisite",
            failureKind: "missing-npm",
            step: "npm install -g openclaw@latest",
            sample: "spawn npm ENOENT",
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("failure");
    expect(result.stage).toBe("prerequisite");
    expect(result.issue).toMatchObject({
      failureKind: "missing-npm",
      step: "npm install -g openclaw@latest",
      sample: "spawn npm ENOENT",
    });
    expect(result.phases[0]).toMatchObject({
      id: "prerequisite",
      status: "failure",
      code: "E_PATH_NOT_FOUND",
    });
  });

  it("classifies permission denied as CLI install failure with structured issue context", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: false,
        error: {
          code: "E_PERMISSION_DENIED",
          message: "OpenClaw CLI installation could not write to the global npm directory.",
          suggestion: "Run the install with elevated privileges or change the npm global directory.",
          details: {
            stage: "install-cli",
            failureKind: "permission-denied",
            step: "npm install -g openclaw@latest",
            exitCode: 243,
            sample: "npm ERR! code EACCES",
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("failure");
    expect(result.stage).toBe("install-cli");
    expect(result.issue).toMatchObject({
      failureKind: "permission-denied",
      step: "npm install -g openclaw@latest",
      exitCode: 243,
      sample: "npm ERR! code EACCES",
    });
    expect(result.phases.find((item) => item.id === "install-cli")).toMatchObject({
      status: "failure",
      code: "E_PERMISSION_DENIED",
    });
  });

  it("classifies network failures with actionable install guidance", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: false,
        error: {
          code: "E_NETWORK_FAILED",
          message: "OpenClaw CLI installation failed while downloading packages from npm.",
          suggestion: "Check registry connectivity, proxy settings, and retry.",
          details: {
            stage: "install-cli",
            failureKind: "network-failure",
            step: "npm install -g openclaw@latest",
            exitCode: 1,
            sample: "npm ERR! request to https://registry.npmjs.org/openclaw failed",
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("failure");
    expect(result.stage).toBe("install-cli");
    expect(result.code).toBe("E_NETWORK_FAILED");
    expect(result.issue?.failureKind).toBe("network-failure");
  });

  it("keeps generic non-zero install exits in a dedicated install failure code", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: false,
        error: {
          code: "E_INSTALL_COMMAND_FAILED",
          message: "OpenClaw installation command returned a non-zero exit code.",
          suggestion: "Check npm output and retry.",
          details: {
            stage: "install-cli",
            failureKind: "unknown",
            step: "npm install -g openclaw@latest",
            exitCode: 1,
            sample: "npm ERR! unexpected internal failure",
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("failure");
    expect(result.stage).toBe("install-cli");
    expect(result.code).toBe("E_INSTALL_COMMAND_FAILED");
    expect(result.issue?.code).toBe("E_INSTALL_COMMAND_FAILED");
  });

  it("treats post-install binary lookup failures as verify-stage issues instead of prerequisites", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: false,
        error: {
          code: "E_PATH_NOT_FOUND",
          message: "OpenClaw CLI appears installed, but its executable path could not be resolved.",
          suggestion: "Check the npm global bin directory and PATH configuration.",
          details: {
            stage: "verify",
            failureKind: "binary-not-found",
            step: "resolve openclaw executable path",
            sample: "INFO: Could not find files for the given pattern(s).",
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("failure");
    expect(result.stage).toBe("verify");
    expect(result.issue).toMatchObject({
      failureKind: "binary-not-found",
      step: "resolve openclaw executable path",
      code: "E_PATH_NOT_FOUND",
    });
  });

  it("keeps legacy-shaped backend errors generic instead of reclassifying stderr in the frontend", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: false,
        error: {
          code: "E_SHELL_SPAWN_FAILED",
          message: "Failed to spawn command: npm",
          suggestion: "Check whether the binary exists and is executable.",
          details: {
            sourceError: {
              details: {
                os_error: "spawn npm ENOENT",
              },
            },
            program: "npm",
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("failure");
    expect(result.stage).toBe("prerequisite");
    expect(result.issue).toMatchObject({
      failureKind: "unknown",
      code: "E_SHELL_SPAWN_FAILED",
    });
  });

  it("uses gatewayInstallIssue to explain partial managed install warnings", async () => {
    createInvokeMock({
      install_openclaw: async () => ({
        success: true,
        data: {
          cliInstalled: true,
          gatewayServiceInstalled: false,
          executablePath: "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd",
          configPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
          notes: ["Managed service install requires manual follow-up."],
          gatewayInstallIssue: {
            stage: "install-gateway",
            failureKind: "gateway-install-failed",
            code: "E_GATEWAY_INSTALL_FAILED",
            message: "Gateway managed install could not register the local service.",
            suggestion: "Open Service and Logs to inspect the managed install output.",
            step: "openclaw gateway install --json",
            exitCode: 1,
            sample: "service registration failed",
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();
    const phase = result.phases.find((item) => item.id === "install-gateway");

    expect(result.status).toBe("warning");
    expect(result.issue).toMatchObject({
      failureKind: "gateway-install-failed",
      code: "E_GATEWAY_INSTALL_FAILED",
      step: "openclaw gateway install --json",
    });
    expect(phase).toMatchObject({
      status: "warning",
      code: "E_GATEWAY_INSTALL_FAILED",
      detail: "Gateway managed install could not register the local service.",
    });
  });

  it("keeps preview phases non-successful when npm is missing but OpenClaw CLI is still detectable", () => {
    const phases = buildInstallPhasesPreview({
      platform: "windows",
      architecture: "x64",
      homeDir: "C:\\Users\\Tester",
      configPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
      npmFound: false,
      npmVersion: null,
      openclawFound: true,
      openclawPath: "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd",
      openclawVersion: "0.9.0",
    });

    expect(phases.find((item) => item.id === "prerequisite")).toMatchObject({
      status: "failure",
    });
    expect(phases.find((item) => item.id === "install-cli")).toMatchObject({
      status: "warning",
    });
    expect(phases.find((item) => item.id === "verify")).toMatchObject({
      status: "warning",
    });
  });

  it("returns a prerequisite-stage runtime bridge issue when desktop shell is present without invoke bridge", async () => {
    Object.defineProperty(window, "isTauri", {
      configurable: true,
      writable: true,
      value: true,
    });
    Object.defineProperty(globalThis, "isTauri", {
      configurable: true,
      writable: true,
      value: true,
    });

    const envResult = await installService.detectEnv();
    const installResult = await installService.installOpenClaw();

    expect(envResult.ok).toBe(false);
    expect(envResult.error?.code).toBe("E_TAURI_UNAVAILABLE");
    expect(installResult.stage).toBe("prerequisite");
    expect(installResult.issue).toMatchObject({
      failureKind: "runtime-bridge-unavailable",
      code: "E_TAURI_UNAVAILABLE",
      step: "initialize the Tauri command bridge",
    });
  });
});
