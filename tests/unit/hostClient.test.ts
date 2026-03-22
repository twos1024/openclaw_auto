/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";
import { createHostAccessError, getHostDiagnostics, invokeCommand, isHostRuntime } from "../../src/services/hostClient";
import {
  resetHostBridgeGlobals,
  simulateBrowserPreview,
  simulateHostRuntimeAvailable,
  simulateHostRuntimeUnavailable,
  simulateLegacyTauriBridge,
} from "../helpers/hostBridgeMock";

describe("hostClient — host runtime detection", () => {
  beforeEach(() => {
    resetHostBridgeGlobals();
  });

  it("returns browser-preview when neither shell nor invoke bridge is available", async () => {
    simulateBrowserPreview();

    const host = getHostDiagnostics();
    const result = await invokeCommand("detect_env");

    expect(host).toMatchObject({
      mode: "browser-preview",
      hasTauriShell: false,
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(isHostRuntime()).toBe(false);
    expect(result.error?.code).toBe("E_PREVIEW_MODE");
  });

  it("returns host-runtime-available when official invoke bridge is present", async () => {
    simulateHostRuntimeAvailable({
      detect_env: async () => ({ success: true, data: { ok: true } }),
    });

    const host = getHostDiagnostics();
    const result = await invokeCommand<{ ok: boolean }>("detect_env");

    expect(host).toMatchObject({
      mode: "host-runtime-available",
      hasTauriShell: true,
      hasInvokeBridge: true,
      bridgeSource: "official-api",
    });
    expect(isHostRuntime()).toBe(true);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });

  it("returns host-runtime-unavailable when shell is detected but invoke bridge is missing", async () => {
    simulateHostRuntimeUnavailable();

    const host = getHostDiagnostics();
    const result = await invokeCommand("detect_env");

    expect(host).toMatchObject({
      mode: "host-runtime-unavailable",
      hasTauriShell: true,
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(isHostRuntime()).toBe(false);
    expect(result.error?.code).toBe("E_HOST_UNAVAILABLE");
  });

  it("createHostAccessError message does not mention Tauri in browser-preview mode", () => {
    simulateBrowserPreview();
    const error = createHostAccessError();
    expect(error.code).toBe("E_PREVIEW_MODE");
    expect(error.message.toLowerCase()).not.toContain("tauri");
  });

  it("createHostAccessError returns E_HOST_UNAVAILABLE in host-runtime-unavailable mode", () => {
    simulateHostRuntimeUnavailable();
    const error = createHostAccessError();
    expect(error.code).toBe("E_HOST_UNAVAILABLE");
    expect(error.message.toLowerCase()).not.toContain("tauri");
  });

  it("uses global-fallback bridge (__TAURI__.core.invoke) when __TAURI_INTERNALS__ is absent", async () => {
    simulateLegacyTauriBridge({
      detect_env: async () => ({ success: true, data: { legacy: true } }),
    });

    const host = getHostDiagnostics();
    const result = await invokeCommand<{ legacy: boolean }>("detect_env");

    expect(host).toMatchObject({
      mode: "host-runtime-available",
      hasInvokeBridge: true,
      bridgeSource: "global-fallback",
    });
    expect(isHostRuntime()).toBe(true);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ legacy: true });
  });

  it("surfaces E_INVOKE when the invoke bridge throws an unexpected exception", async () => {
    simulateHostRuntimeAvailable({
      bad_command: async () => {
        throw new Error("Rust panic: command not found");
      },
    });

    const result = await invokeCommand("bad_command");

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("E_INVOKE");
    expect(result.error?.message).toContain("Rust panic");
  });
});
