/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { installService } from "../../src/services/installService";

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
          code: "E_SHELL_SPAWN_FAILED",
          message: "Failed to spawn command: npm",
          suggestion: "Install Node.js and npm first.",
          details: {
            source_error: {
              details: {
                os_error: "spawn npm ENOENT",
              },
            },
          },
        },
      }),
    });

    const result = await installService.installOpenClaw();

    expect(result.status).toBe("failure");
    expect(result.stage).toBe("prerequisite");
    expect(result.phases[0]).toMatchObject({
      id: "prerequisite",
      status: "failure",
      code: "E_SHELL_SPAWN_FAILED",
    });
  });
});
