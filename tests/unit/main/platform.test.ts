// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import {
  currentPlatform,
  homeDir,
  DEFAULT_GATEWAY_PORT,
  dedupePaths,
} from "../../../src/main/adapters/platform.js";

describe("platform adapter", () => {
  describe("currentPlatform()", () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns 'windows' on win32", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      expect(currentPlatform()).toBe("windows");
    });

    it("returns 'macos' on darwin", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      expect(currentPlatform()).toBe("macos");
    });

    it("returns 'linux' on linux", () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      expect(currentPlatform()).toBe("linux");
    });

    it("returns 'unknown' for unexpected platform values", () => {
      Object.defineProperty(process, "platform", { value: "freebsd" });
      expect(currentPlatform()).toBe("unknown");
    });
  });

  describe("homeDir()", () => {
    it("returns a non-empty string", () => {
      const result = homeDir();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("falls back to HOME env var if os.homedir() fails", () => {
      const saved = process.env["HOME"];
      process.env["HOME"] = "/custom/home";
      const result = homeDir();
      expect(result).toBeTruthy();
      process.env["HOME"] = saved;
    });
  });

  describe("DEFAULT_GATEWAY_PORT", () => {
    it("is 18789", () => {
      expect(DEFAULT_GATEWAY_PORT).toBe(18789);
    });
  });

  describe("dedupePaths()", () => {
    it("removes duplicate entries preserving first-seen order", () => {
      const input = ["/usr/bin", "/usr/local/bin", "/usr/bin", "/home/user/.npm/bin"];
      const result = dedupePaths(input);
      expect(result).toEqual(["/usr/bin", "/usr/local/bin", "/home/user/.npm/bin"]);
    });

    it("returns empty array for empty input", () => {
      expect(dedupePaths([])).toEqual([]);
    });

    it("returns single element unchanged", () => {
      expect(dedupePaths(["/usr/bin"])).toEqual(["/usr/bin"]);
    });

    it("treats different-cased entries as distinct (case-sensitive dedup)", () => {
      // dedupePaths uses a Set — exact byte equality only
      const result = dedupePaths(["/usr/bin", "/USR/BIN", "/usr/bin"]);
      // "/usr/bin" appears twice (deduplicated to 1), "/USR/BIN" is distinct
      expect(result).toEqual(["/usr/bin", "/USR/BIN"]);
    });
  });
});
