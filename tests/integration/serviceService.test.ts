/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { serviceService } from "../../src/services/serviceService";

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

describe("serviceService integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("maps structured port conflict details from backend action errors", async () => {
    createInvokeMock({
      start_gateway: async () => ({
        success: false,
        error: {
          code: "E_PORT_CONFLICT",
          message: "OpenClaw Gateway failed to start.",
          suggestion: "Check startup logs, configuration, and port usage, then retry.",
          details: {
            portConflictPort: 3000,
            stderr: "listen EADDRINUSE: address already in use 127.0.0.1:3000",
          },
        },
      }),
    });

    const result = await serviceService.startGateway();

    expect(result.status).toBe("failure");
    expect(result.conflictPort).toBe(3000);
    expect(result.detail).toContain("3000");
  });

  it("surfaces gateway status failures without relabeling them as start failures", async () => {
    createInvokeMock({
      get_gateway_status: async () => ({
        success: false,
        error: {
          code: "E_GATEWAY_STATUS_FAILED",
          message: "Failed to query OpenClaw Gateway status.",
          suggestion: "Check whether the Gateway service is installed correctly, then retry.",
        },
      }),
    });

    const result = await serviceService.getGatewayStatus();

    expect(result.state).toBe("error");
    expect(result.statusDetail).toBe("Failed to query OpenClaw Gateway status.");
  });
});
