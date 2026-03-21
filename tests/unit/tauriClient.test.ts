/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeDiagnostics, invokeCommand, isTauriRuntime } from "../../src/renderer/services/tauriClient";

describe("tauriClient runtime detection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "api", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "electron", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("returns browser-preview when neither electron shell nor invoke bridge is available", async () => {
    const runtime = getRuntimeDiagnostics();
    const result = await invokeCommand("detect_env");

    expect(runtime).toMatchObject({
      mode: "browser-preview",
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(isTauriRuntime()).toBe(false);
    expect(result.error?.code).toBe("E_PREVIEW_MODE");
  });

  it("returns electron-runtime-available when window.api.invoke is a function", async () => {
    Object.defineProperty(window, "api", {
      configurable: true,
      writable: true,
      value: {
        invoke: vi.fn(async () => ({ success: true, data: { ok: true } })),
        on: vi.fn(),
        removeListener: vi.fn(),
      },
    });

    const runtime = getRuntimeDiagnostics();
    const result = await invokeCommand<{ ok: boolean }>("detect_env");

    expect(runtime).toMatchObject({
      mode: "electron-runtime-available",
      hasInvokeBridge: true,
      bridgeSource: "electron-ipc",
    });
    expect(isTauriRuntime()).toBe(true);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });

  it("returns electron-runtime-unavailable when window.electron exists but window.api is undefined", async () => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      writable: true,
      value: { platform: "win32", versions: {} },
    });

    const runtime = getRuntimeDiagnostics();
    const result = await invokeCommand("detect_env");

    expect(runtime).toMatchObject({
      mode: "electron-runtime-unavailable",
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(isTauriRuntime()).toBe(false);
    expect(result.error?.code).toBe("E_IPC_UNAVAILABLE");
  });
});
