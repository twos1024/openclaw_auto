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
    expect(result.address).toBeNull();
    expect(result.port).toBeNull();
  });

  it("preserves backend success detail for gateway actions", async () => {
    createInvokeMock({
      open_dashboard: async () => ({
        success: true,
        data: {
          detail: "Dashboard opened successfully.",
          address: "http://127.0.0.1:18789",
          pid: 4242,
        },
      }),
    });

    const result = await serviceService.openDashboard();

    expect(result).toMatchObject({
      status: "success",
      detail: "Dashboard opened successfully.",
      address: "http://127.0.0.1:18789",
      pid: 4242,
    });
  });

  it("normalizes dashboard probe diagnostics from the backend command", async () => {
    createInvokeMock({
      probe_dashboard_endpoint: async () => ({
        success: true,
        data: {
          address: "http://127.0.0.1:18789",
          reachable: true,
          result: "reachable",
          httpStatus: 200,
          responseTimeMs: 125,
          detail: "Dashboard endpoint responded successfully.",
        },
      }),
    });

    const result = await serviceService.probeDashboardEndpoint("http://127.0.0.1:18789");

    expect(result).toMatchObject({
      address: "http://127.0.0.1:18789",
      reachable: true,
      result: "reachable",
      httpStatus: 200,
      responseTimeMs: 125,
    });
  });

  it("preserves timeout probe results from the backend command", async () => {
    createInvokeMock({
      probe_dashboard_endpoint: async () => ({
        success: true,
        data: {
          address: "http://127.0.0.1:18789",
          reachable: false,
          result: "timeout",
          httpStatus: null,
          responseTimeMs: null,
          detail: "Dashboard endpoint timed out after 3000ms.",
        },
      }),
    });

    const result = await serviceService.probeDashboardEndpoint("http://127.0.0.1:18789");

    expect(result).toMatchObject({
      reachable: false,
      result: "timeout",
      detail: "Dashboard endpoint timed out after 3000ms.",
    });
  });

  it("preserves non-2xx probe results from the backend command", async () => {
    createInvokeMock({
      probe_dashboard_endpoint: async () => ({
        success: true,
        data: {
          address: "http://127.0.0.1:18789",
          reachable: false,
          result: "unreachable",
          httpStatus: 500,
          responseTimeMs: 57,
          detail: "Dashboard endpoint returned HTTP 500.",
        },
      }),
    });

    const result = await serviceService.probeDashboardEndpoint("http://127.0.0.1:18789");

    expect(result).toMatchObject({
      reachable: false,
      result: "unreachable",
      httpStatus: 500,
      detail: "Dashboard endpoint returned HTTP 500.",
    });
  });

  it("maps invalid probe input to an invalid-address diagnostic payload", async () => {
    createInvokeMock({
      probe_dashboard_endpoint: async () => ({
        success: false,
        error: {
          code: "E_INVALID_INPUT",
          message: "Dashboard address is invalid and cannot be probed.",
          suggestion: "Refresh gateway status and retry the dashboard diagnostics probe.",
        },
      }),
    });

    const result = await serviceService.probeDashboardEndpoint("http://bad");

    expect(result).toMatchObject({
      address: "http://bad",
      reachable: false,
      result: "invalid-address",
      detail: "Dashboard address is invalid and cannot be probed.",
    });
  });
});
