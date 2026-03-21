// @vitest-environment node

import { describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../../src/main/models/error.js";

describe("AppError", () => {
  it("constructs with required fields", () => {
    const err = new AppError(ErrorCode.InternalError, "Something broke", "Try again.");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe("AppError");
    expect(err.code).toBe(ErrorCode.InternalError);
    expect(err.message).toBe("Something broke");
    expect(err.suggestion).toBe("Try again.");
    expect(err.details).toBeUndefined();
  });

  it("stores details when provided", () => {
    const details = { path: "/tmp/foo", exitCode: 1 };
    const err = new AppError(ErrorCode.PathNotFound, "Not found", "Check path.", details);
    expect(err.details).toEqual(details);
  });

  it("withDetails returns a new AppError with updated details", () => {
    const original = new AppError(ErrorCode.ConfigReadFailed, "Read failed", "Retry.");
    const enriched = original.withDetails({ attempt: 1 });
    expect(enriched).toBeInstanceOf(AppError);
    expect(enriched).not.toBe(original);
    expect(enriched.code).toBe(ErrorCode.ConfigReadFailed);
    expect(enriched.details).toEqual({ attempt: 1 });
    expect(original.details).toBeUndefined();
  });

  it("toJSON serializes all fields", () => {
    const err = new AppError(ErrorCode.NetworkFailed, "Timeout", "Check network.").withDetails({ host: "openclaw.ai" });
    const json = err.toJSON() as Record<string, unknown>;
    expect(json["code"]).toBe("E_NETWORK_FAILED");
    expect(json["message"]).toBe("Timeout");
    expect(json["suggestion"]).toBe("Check network.");
    expect(json["details"]).toEqual({ host: "openclaw.ai" });
  });

  it("toJSON omits details when not present", () => {
    const err = new AppError(ErrorCode.InternalError, "Oops", "Retry.");
    const json = err.toJSON() as Record<string, unknown>;
    expect("details" in json).toBe(false);
  });

  it("ErrorCode values match expected string constants", () => {
    expect(ErrorCode.InvalidInput).toBe("E_INVALID_INPUT");
    expect(ErrorCode.PathNotFound).toBe("E_PATH_NOT_FOUND");
    expect(ErrorCode.PermissionDenied).toBe("E_PERMISSION_DENIED");
    expect(ErrorCode.ShellTimeout).toBe("E_SHELL_TIMEOUT");
    expect(ErrorCode.GatewayNotRunning).toBe("E_GATEWAY_NOT_RUNNING");
    expect(ErrorCode.InstallCommandFailed).toBe("E_INSTALL_COMMAND_FAILED");
    expect(ErrorCode.NetworkFailed).toBe("E_NETWORK_FAILED");
  });
});
