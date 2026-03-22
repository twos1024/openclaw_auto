/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHostAccessError, getHostDiagnostics, invokeHostCommand, isHostRuntime } from "../../src/services/hostClient";

describe("hostClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "__OPENCLAW_HOST__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "__OPENCLAW_HOST_INTERNALS__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
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
    Object.defineProperty(window, "isOpenClawHost", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "isTauri", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("returns browser-preview when no host bridge is available", async () => {
    const runtime = getHostDiagnostics();
    const result = await invokeHostCommand("detect_env");

    expect(runtime).toMatchObject({
      mode: "browser-preview",
      hasHostShell: false,
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(isHostRuntime()).toBe(false);
    expect(result.error?.code).toBe("E_PREVIEW_MODE");
  });

  it("detects an Electron-style host bridge exposed on window.__OPENCLAW_HOST__", async () => {
    Object.defineProperty(window, "isOpenClawHost", {
      configurable: true,
      writable: true,
      value: true,
    });
    Object.defineProperty(window, "__OPENCLAW_HOST__", {
      configurable: true,
      writable: true,
      value: {
        invoke: vi.fn(async (command: string) => ({ success: true, data: { command } })),
      },
    });

    const runtime = getHostDiagnostics();
    const result = await invokeHostCommand<{ command: string }>("detect_env");

    expect(runtime).toMatchObject({
      mode: "host-runtime-available",
      hasHostShell: true,
      hasInvokeBridge: true,
      bridgeSource: "window-fallback",
    });
    expect(isHostRuntime()).toBe(true);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ command: "detect_env" });
  });

  it("returns a host-unavailable error when a desktop shell is detected but no bridge exists", async () => {
    Object.defineProperty(window, "isOpenClawHost", {
      configurable: true,
      writable: true,
      value: true,
    });

    const runtime = getHostDiagnostics();
    const error = createHostAccessError(runtime);

    expect(runtime).toMatchObject({
      mode: "host-runtime-unavailable",
      hasHostShell: true,
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(error.code).toBe("E_HOST_UNAVAILABLE");
  });
});
