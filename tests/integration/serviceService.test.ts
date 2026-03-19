/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

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

async function loadServiceService() {
  const module = await import("../../src/services/serviceService");
  return module.serviceService;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("serviceService integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("maps structured port conflict details from backend action errors", async () => {
    const serviceService = await loadServiceService();
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
    const serviceService = await loadServiceService();
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
    const serviceService = await loadServiceService();
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
    const serviceService = await loadServiceService();
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
    const serviceService = await loadServiceService();
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
    const serviceService = await loadServiceService();
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
    const serviceService = await loadServiceService();
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

  it("deduplicates concurrent gateway status invocations", async () => {
    const serviceService = await loadServiceService();
    const pending = deferred<{
      success: boolean;
      data: {
        state: string;
        running: boolean;
        port: number;
        address: string;
        pid: number;
        statusDetail: string;
        suggestion: string;
      };
    }>();

    const invoke = createInvokeMock({
      get_gateway_status: () => pending.promise,
    });

    const p1 = serviceService.getGatewayStatus();
    const p2 = serviceService.getGatewayStatus();
    const p3 = serviceService.getGatewayStatus();

    pending.resolve({
      success: true,
      data: {
        state: "running",
        running: true,
        port: 18789,
        address: "http://127.0.0.1:18789",
        pid: 4242,
        statusDetail: "Gateway is running.",
        suggestion: "ok",
      },
    });

    const [s1, s2, s3] = await Promise.all([p1, p2, p3]);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(s1.running).toBe(true);
    expect(s2.running).toBe(true);
    expect(s3.running).toBe(true);
  });

  it("invalidates status cache after start action succeeds", async () => {
    const serviceService = await loadServiceService();
    const invoke = createInvokeMock({
      get_gateway_status: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: {
            state: "stopped",
            running: false,
            port: 18789,
            address: "http://127.0.0.1:18789",
            pid: null,
            statusDetail: "Gateway is not running.",
            suggestion: "start it",
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            state: "running",
            running: true,
            port: 18789,
            address: "http://127.0.0.1:18789",
            pid: 5150,
            statusDetail: "Gateway is running.",
            suggestion: "ok",
          },
        }),
      start_gateway: async () => ({
        success: true,
        data: {
          detail: "Gateway start command completed.",
          address: "http://127.0.0.1:18789",
          pid: 5150,
        },
      }),
    });

    const first = await serviceService.getGatewayStatus();
    expect(first.running).toBe(false);

    await serviceService.startGateway();

    const second = await serviceService.getGatewayStatus();
    expect(second.running).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
