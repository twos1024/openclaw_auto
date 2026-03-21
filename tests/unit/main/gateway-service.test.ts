// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron before importing the service
vi.mock("electron", () => ({ shell: { openExternal: vi.fn() } }));

// Mock shell adapter
vi.mock("../../../src/main/adapters/shell.js", () => ({
  runCommand: vi.fn(),
}));

// Mock env-service
vi.mock("../../../src/main/services/env-service.js", () => ({
  ensureOpenclawAvailable: vi.fn(),
}));

// Mock log-service
vi.mock("../../../src/main/services/log-service.js", () => ({
  appendLogLine: vi.fn(),
  LogSource: { Gateway: "gateway", Install: "install", Startup: "startup" },
}));

import { runCommand } from "../../../src/main/adapters/shell.js";
import { ensureOpenclawAvailable } from "../../../src/main/services/env-service.js";
import {
  getGatewayStatus,
  invalidateStatusCache,
  probeDashboardEndpoint,
} from "../../../src/main/services/gateway-service.js";
import { AppError } from "../../../src/main/models/error.js";
import type { ShellOutput } from "../../../src/main/adapters/shell.js";

const mockRunCommand = vi.mocked(runCommand);
const mockEnsureOpenclawAvailable = vi.mocked(ensureOpenclawAvailable);

function makeGatewayStatusOutput(json: object): ShellOutput {
  return {
    program: "openclaw",
    args: ["gateway", "status", "--json"],
    stdout: JSON.stringify(json),
    stderr: "",
    exitCode: 0,
    durationMs: 120,
  };
}

describe("gateway-service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await invalidateStatusCache();
    mockEnsureOpenclawAvailable.mockResolvedValue("/usr/local/bin/openclaw");
  });

  afterEach(async () => {
    await invalidateStatusCache();
  });

  describe("getGatewayStatus()", () => {
    it("returns running status when gateway reports running state", async () => {
      mockRunCommand.mockResolvedValue(makeGatewayStatusOutput({
        state: "running",
        running: true,
        port: 18789,
        address: "http://localhost:18789",
        pid: 1234,
        lastStartedAt: "2025-01-01T00:00:00Z",
      }));

      const status = await getGatewayStatus();
      expect(status.running).toBe(true);
      expect(status.state).toBe("running");
      expect(status.port).toBe(18789);
      expect(status.address).toBe("http://localhost:18789");
    });

    it("returns stopped status when gateway reports stopped state", async () => {
      mockRunCommand.mockResolvedValue(makeGatewayStatusOutput({
        state: "stopped",
        running: false,
        port: 18789,
        address: "http://localhost:18789",
        pid: null,
        lastStartedAt: null,
      }));

      const status = await getGatewayStatus();
      expect(status.running).toBe(false);
      expect(status.state).toBe("stopped");
    });

    it("caches the result — second call does not invoke shell again", async () => {
      mockRunCommand.mockResolvedValue(makeGatewayStatusOutput({
        state: "running", running: true, port: 18789, address: "http://localhost:18789", pid: 99, lastStartedAt: null,
      }));

      const first = await getGatewayStatus();
      const second = await getGatewayStatus();

      expect(first).toEqual(second);
      expect(mockRunCommand).toHaveBeenCalledTimes(1);
    });

    it("re-fetches after cache invalidation", async () => {
      mockRunCommand.mockResolvedValue(makeGatewayStatusOutput({
        state: "running", running: true, port: 18789, address: "http://localhost:18789", pid: 1, lastStartedAt: null,
      }));

      await getGatewayStatus();
      await invalidateStatusCache();
      await getGatewayStatus();

      expect(mockRunCommand).toHaveBeenCalledTimes(2);
    });

    it("throws AppError when shell command fails with non-zero exit code", async () => {
      mockRunCommand.mockResolvedValue({
        program: "openclaw",
        args: ["gateway", "status", "--json"],
        stdout: "",
        stderr: "openclaw: command not found",
        exitCode: 127,
        durationMs: 50,
      });

      await expect(getGatewayStatus()).rejects.toBeInstanceOf(AppError);
    });

    it("coalesces concurrent calls into a single shell invocation", async () => {
      let resolveShell!: (v: ShellOutput) => void;
      const pending = new Promise<ShellOutput>((res) => { resolveShell = res; });
      mockRunCommand.mockReturnValueOnce(pending);

      // Fire two concurrent calls
      const p1 = getGatewayStatus();
      const p2 = getGatewayStatus();

      resolveShell(makeGatewayStatusOutput({
        state: "running", running: true, port: 18789, address: "http://localhost:18789", pid: 42, lastStartedAt: null,
      }));

      const [s1, s2] = await Promise.all([p1, p2]);
      expect(s1).toEqual(s2);
      expect(mockRunCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe("probeDashboardEndpoint()", () => {
    it("returns reachable when fetch succeeds", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      const result = await probeDashboardEndpoint("http://localhost:18789");
      expect(result.reachable).toBe(true);
      expect(result.httpStatus).toBe(200);
      vi.unstubAllGlobals();
    });

    it("returns unreachable when fetch rejects", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
      const result = await probeDashboardEndpoint("http://localhost:18789");
      expect(result.reachable).toBe(false);
      vi.unstubAllGlobals();
    });

    it("returns unreachable when HTTP status is not ok", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
      const result = await probeDashboardEndpoint("http://localhost:18789");
      expect(result.reachable).toBe(false);
      expect(result.httpStatus).toBe(503);
      vi.unstubAllGlobals();
    });
  });
});
