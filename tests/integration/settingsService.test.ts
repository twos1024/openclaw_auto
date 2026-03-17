/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { settingsService } from "../../src/services/settingsService";

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

describe("settingsService integration", () => {
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

  it("reads app settings from backend payload", async () => {
    createInvokeMock({
      read_app_settings: async () => ({
        success: true,
        data: {
          path: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json",
          exists: true,
          content: {
            preferredInstallSource: "npm-global",
            diagnosticsDir: "C:\\Users\\Tester\\Diagnostics",
            logLineLimit: 600,
            gatewayPollMs: 3000,
          },
          modifiedAt: "2026-03-16T00:00:00.000Z",
        },
      }),
    });

    const result = await settingsService.readSettings();

    expect(result.values.logLineLimit).toBe(600);
    expect(result.exists).toBe(true);
  });

  it("returns save success when backend writes settings", async () => {
    createInvokeMock({
      write_app_settings: async () => ({
        success: true,
        data: {
          path: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json",
          backupPath: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json.bak",
          bytesWritten: 240,
        },
      }),
    });

    const result = await settingsService.saveSettings({
      preferredInstallSource: "npm-global",
      diagnosticsDir: "C:\\Users\\Tester\\Diagnostics",
      logLineLimit: 1200,
      gatewayPollMs: 5000,
    });

    expect(result.status).toBe("success");
    expect(result.backupPath).toContain(".bak");
  });

  it("surfaces desktop runtime bridge failures without pretending to be browser preview", async () => {
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

    const result = await settingsService.readSettings();

    expect(result.issue).toMatchObject({
      code: "E_TAURI_UNAVAILABLE",
    });
    expect(result.issue?.message).toContain("桌面窗口");
    expect(result.issue?.message).not.toContain("浏览器预览模式");
  });
});
