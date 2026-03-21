// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ok, err } from "../../../src/main/models/result.js";
import { AppError, ErrorCode } from "../../../src/main/models/error.js";

describe("CommandResult factories", () => {
  describe("ok()", () => {
    it("wraps data in a success result", () => {
      const result = ok({ count: 3 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ count: 3 });
      expect(result.error).toBeUndefined();
    });

    it("works with null data", () => {
      const result = ok(null);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("works with primitive data", () => {
      expect(ok(42).data).toBe(42);
      expect(ok("hello").data).toBe("hello");
      expect(ok(true).data).toBe(true);
    });
  });

  describe("err()", () => {
    it("wraps AppError into a failure result", () => {
      const error = new AppError(ErrorCode.ConfigReadFailed, "Read failed", "Check the file.");
      const result = err(error);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe("E_CONFIG_READ_FAILED");
      expect(result.error!.message).toBe("Read failed");
      expect(result.error!.suggestion).toBe("Check the file.");
    });

    it("includes error details when present", () => {
      const error = new AppError(ErrorCode.NetworkFailed, "Timeout", "Retry.").withDetails({ host: "x.com" });
      const result = err(error);
      const errorJson = result.error as Record<string, unknown>;
      expect(errorJson["details"]).toEqual({ host: "x.com" });
    });

    it("does not include details key when error has no details", () => {
      const error = new AppError(ErrorCode.InternalError, "Oops", "Retry.");
      const result = err(error);
      const errorJson = result.error as Record<string, unknown>;
      expect("details" in errorJson).toBe(false);
    });
  });
});
