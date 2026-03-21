// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock fs/promises
vi.mock("fs/promises");
// Mock platform adapters
vi.mock("../../../src/main/adapters/platform.js", () => ({
  clawdeskAppDir: vi.fn(() => "/mock/clawdesk"),
  clawdeskDiagnosticsDir: vi.fn(() => "/mock/clawdesk/diagnostics"),
}));
// Mock file-ops
vi.mock("../../../src/main/adapters/file-ops.js", () => ({
  safeWriteBytes: vi.fn(),
}));

import * as fs from "fs/promises";
import {
  defaultAppSettings,
  readAppSettings,
  writeAppSettings,
  type AppSettings,
} from "../../../src/main/services/settings-service.js";
import { safeWriteBytes } from "../../../src/main/adapters/file-ops.js";
import { AppError, ErrorCode } from "../../../src/main/models/error.js";

const mockFsAccess = vi.mocked(fs.access);
const mockFsReadFile = vi.mocked(fs.readFile);
const mockFsStat = vi.mocked(fs.stat);
const mockFsMkdir = vi.mocked(fs.mkdir);
const mockFsCopyFile = vi.mocked(fs.copyFile);
const mockSafeWriteBytes = vi.mocked(safeWriteBytes);

const validSettings: AppSettings = {
  preferredInstallSource: "npm-global",
  diagnosticsDir: "/mock/clawdesk/diagnostics",
  logLineLimit: 1200,
  gatewayPollMs: 5000,
};

describe("settings-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFsMkdir.mockResolvedValue(undefined);
    mockFsCopyFile.mockResolvedValue(undefined);
    mockSafeWriteBytes.mockResolvedValue(undefined);
    mockFsStat.mockResolvedValue({ mtime: new Date("2025-01-01T00:00:00Z") } as Awaited<ReturnType<typeof fs.stat>>);
  });

  describe("defaultAppSettings()", () => {
    it("returns expected field types and sensible defaults", () => {
      const defaults = defaultAppSettings();
      expect(typeof defaults.preferredInstallSource).toBe("string");
      expect(typeof defaults.logLineLimit).toBe("number");
      expect(typeof defaults.gatewayPollMs).toBe("number");
      expect(defaults.logLineLimit).toBeGreaterThan(0);
      expect(defaults.logLineLimit).toBeLessThanOrEqual(20000);
      expect(defaults.gatewayPollMs).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("readAppSettings()", () => {
    it("returns parsed settings when file exists", async () => {
      mockFsAccess.mockResolvedValue(undefined); // file exists
      mockFsReadFile.mockResolvedValue(JSON.stringify(validSettings));

      const result = await readAppSettings();
      expect(result.exists).toBe(true);
      expect(result.content.logLineLimit).toBe(1200);
      expect(result.content.gatewayPollMs).toBe(5000);
      expect(result.modifiedAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("returns defaults and exists=false when settings file does not exist", async () => {
      mockFsAccess.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

      const result = await readAppSettings();
      expect(result.exists).toBe(false);
      expect(result.content).toMatchObject(defaultAppSettings());
      expect(result.modifiedAt).toBeNull();
    });

    it("throws AppError with ConfigCorrupted when JSON is invalid", async () => {
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue("{ this is not valid json }");

      await expect(readAppSettings()).rejects.toMatchObject({ code: ErrorCode.ConfigCorrupted });
    });

    it("throws AppError with PermissionDenied when EACCES on read", async () => {
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));

      await expect(readAppSettings()).rejects.toMatchObject({ code: ErrorCode.PermissionDenied });
    });

    it("accepts a custom path override", async () => {
      mockFsAccess.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue(JSON.stringify(validSettings));

      const result = await readAppSettings("/custom/settings.json");
      expect(result.path).toBe("/custom/settings.json");
    });
  });

  describe("writeAppSettings()", () => {
    it("writes settings without backup when no existing file", async () => {
      // fs.access throws = file does not exist
      mockFsAccess.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

      const result = await writeAppSettings(undefined, validSettings);
      expect(mockSafeWriteBytes).toHaveBeenCalledOnce();
      expect(result.path).toContain("settings.json");
      expect(result.backupPath).toBeNull();
      expect(result.bytesWritten).toBeGreaterThan(0);
    });

    it("creates a backup when existing settings file is present", async () => {
      mockFsAccess.mockResolvedValue(undefined); // file exists → backup

      const result = await writeAppSettings(undefined, validSettings);
      expect(mockFsCopyFile).toHaveBeenCalledOnce();
      expect(result.backupPath).not.toBeNull();
    });

    it("rejects logLineLimit = 0 as invalid", async () => {
      const bad = { ...validSettings, logLineLimit: 0 };
      await expect(writeAppSettings(undefined, bad)).rejects.toBeInstanceOf(AppError);
    });

    it("rejects logLineLimit > 20000 as invalid", async () => {
      const bad = { ...validSettings, logLineLimit: 20001 };
      await expect(writeAppSettings(undefined, bad)).rejects.toBeInstanceOf(AppError);
    });

    it("rejects gatewayPollMs < 1000", async () => {
      const bad = { ...validSettings, gatewayPollMs: 500 };
      await expect(writeAppSettings(undefined, bad)).rejects.toBeInstanceOf(AppError);
    });

    it("rejects gatewayPollMs > 60000", async () => {
      const bad = { ...validSettings, gatewayPollMs: 90000 };
      await expect(writeAppSettings(undefined, bad)).rejects.toBeInstanceOf(AppError);
    });

    it("rejects empty diagnosticsDir", async () => {
      const bad = { ...validSettings, diagnosticsDir: "   " };
      await expect(writeAppSettings(undefined, bad)).rejects.toBeInstanceOf(AppError);
    });
  });
});
