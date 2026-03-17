/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { statusService } from "../../src/services/statusService";

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

describe("statusService integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("builds install-first next actions when OpenClaw is not installed", async () => {
    createInvokeMock({
      detect_env: async () => ({
        success: true,
        data: {
          platform: "windows",
          npm_found: true,
          npm_version: "10.9.0",
          openclaw_found: false,
          openclaw_version: null,
          config_path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
        },
      }),
      get_gateway_status: async () => ({
        success: false,
        error: {
          code: "E_PATH_NOT_FOUND",
          message: "OpenClaw CLI is not installed.",
          suggestion: "Install OpenClaw first.",
        },
      }),
      read_openclaw_config: async () => ({
        success: false,
        error: {
          code: "E_PATH_NOT_FOUND",
          message: "config missing",
          suggestion: "create config",
        },
      }),
      read_app_settings: async () => ({
        success: true,
        data: {
          path: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json",
          exists: true,
          content: {
            preferredInstallSource: "npm-global",
            diagnosticsDir: "C:\\Users\\Tester\\Diagnostics",
            logLineLimit: 1200,
            gatewayPollMs: 5000,
          },
        },
      }),
    });

    const result = await statusService.getOverviewStatus();
    const data = result.data as {
      overall: { level: string; headline: string };
      install: { level: string };
      settings: { level: string };
      nextActions: Array<{ route: string; label: string }>;
    };

    expect(result.ok).toBe(true);
    expect(data.overall.level).toBe("degraded");
    expect(data.install.level).toBe("degraded");
    expect(data.settings.level).toBe("healthy");
    expect(data.nextActions[0]).toMatchObject({
      route: "/install?wizard=1",
      label: "安装 OpenClaw",
    });
  });

  it("marks overview healthy and recommends opening dashboard when runtime is ready", async () => {
    createInvokeMock({
      detect_env: async () => ({
        success: true,
        data: {
          platform: "macos",
          npm_found: true,
          npm_version: "10.9.0",
          openclaw_found: true,
          openclaw_version: "1.2.3",
          config_path: "/Users/tester/.openclaw/openclaw.json",
        },
      }),
      get_gateway_status: async () => ({
        success: true,
        data: {
          state: "running",
          running: true,
          address: "http://127.0.0.1:18789",
          port: 18789,
          pid: 43210,
          statusDetail: "Gateway is running.",
          suggestion: "Open dashboard",
        },
      }),
      read_openclaw_config: async () => ({
        success: true,
        data: {
          path: "/Users/tester/.openclaw/openclaw.json",
          exists: true,
          content: {
            providerType: "openai-compatible",
            model: "gpt-4o-mini",
          },
        },
      }),
      read_app_settings: async () => ({
        success: true,
        data: {
          path: "/Users/tester/Library/Application Support/ClawDesk/settings.json",
          exists: true,
          content: {
            preferredInstallSource: "npm-global",
            diagnosticsDir: "/Users/tester/Diagnostics",
            logLineLimit: 1200,
            gatewayPollMs: 5000,
          },
        },
      }),
    });

    const result = await statusService.getOverviewStatus();
    const data = result.data as {
      overall: { level: string; headline: string };
      nextActions: Array<{ label: string; route: string }>;
    };

    expect(result.ok).toBe(true);
    expect(data.overall.level).toBe("healthy");
    expect(data.nextActions[0]).toMatchObject({
      label: "打开 Dashboard",
      route: "/dashboard",
      kind: "open-dashboard",
    });
  });
});
