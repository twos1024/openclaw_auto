/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeDiagnostics, invokeCommand, isTauriRuntime } from "../../src/services/tauriClient";
import {
  resetHostBridgeGlobals,
  simulateHostRuntimeAvailable,
  simulateHostRuntimeUnavailable,
} from "../helpers/hostBridgeMock";

describe("tauriClient runtime detection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetHostBridgeGlobals();
  });

  it("returns browser-preview when neither shell nor invoke bridge is available", async () => {
    const runtime = getRuntimeDiagnostics();
    const result = await invokeCommand("detect_env");

    expect(runtime).toMatchObject({
      mode: "browser-preview",
      hasTauriShell: false,
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(isTauriRuntime()).toBe(false);
    expect(result.error?.code).toBe("E_PREVIEW_MODE");
  });

  it("returns tauri-runtime-available when official invoke bridge is present", async () => {
    simulateHostRuntimeAvailable({
      detect_env: async () => ({ success: true, data: { ok: true } }),
    });

    const runtime = getRuntimeDiagnostics();
    const result = await invokeCommand<{ ok: boolean }>("detect_env");

    expect(runtime).toMatchObject({
      mode: "tauri-runtime-available",
      hasTauriShell: true,
      hasInvokeBridge: true,
      bridgeSource: "official-api",
    });
    expect(isTauriRuntime()).toBe(true);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });

  it("returns tauri-runtime-unavailable when shell is detected but invoke bridge is missing", async () => {
    simulateHostRuntimeUnavailable();

    const runtime = getRuntimeDiagnostics();
    const result = await invokeCommand("detect_env");

    expect(runtime).toMatchObject({
      mode: "tauri-runtime-unavailable",
      hasTauriShell: true,
      hasInvokeBridge: false,
      bridgeSource: "none",
    });
    expect(isTauriRuntime()).toBe(false);
    expect(result.error?.code).toBe("E_TAURI_UNAVAILABLE"); // shim maps E_HOST_UNAVAILABLE back to legacy code
  });
});
