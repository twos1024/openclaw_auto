import { describe, expect, it } from "vitest";
import type { InstallActionResult, InstallEnvironment } from "../../src/types/install";
import { buildInstallProgressModel, buildInstallingPhases } from "../../src/services/installProgress";
import { parseInstallTelemetry } from "../../src/services/installTelemetry";

const readyEnvironment: InstallEnvironment = {
  platform: "windows",
  architecture: "x64",
  homeDir: "C:\\Users\\Tester",
  configPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
  npmFound: true,
  npmVersion: "10.9.0",
  openclawFound: false,
  openclawPath: null,
  openclawVersion: null,
};

describe("installProgress", () => {
  it("parses latest install phase event from install logs", () => {
    const telemetry = parseInstallTelemetry([
      "[phase] stage=install-cli state=running detail=Installing OpenClaw CLI via npm global install.",
      "[stdout] added 12 packages in 3s",
      "[phase] stage=install-cli state=success detail=OpenClaw CLI install finished.",
      "[phase] stage=install-gateway state=running detail=Installing Gateway managed service.",
    ]);

    expect(telemetry.activePhaseId).toBe("install-gateway");
    expect(telemetry.phaseState).toBe("running");
    expect(telemetry.detail).toContain("Gateway managed service");
    expect(telemetry.latestLogLine).toBe("added 12 packages in 3s");
  });

  it("builds bounded estimated progress while install is still running", () => {
    const early = buildInstallProgressModel({
      environment: readyEnvironment,
      installResult: null,
      isInstalling: true,
      elapsedMs: 1200,
      telemetry: null,
    });
    const later = buildInstallProgressModel({
      environment: readyEnvironment,
      installResult: null,
      isInstalling: true,
      elapsedMs: 5200,
      telemetry: null,
    });

    expect(early.visible).toBe(true);
    expect(early.tone).toBe("running");
    expect(early.activePhaseId).toBe("install-cli");
    expect(early.percent).toBeGreaterThan(0);
    expect(early.percent).toBeLessThan(100);

    expect(later.activePhaseId).toBe("install-gateway");
    expect(later.percent).toBeGreaterThan(early.percent);
    expect(later.percent).toBeLessThan(100);
  });

  it("returns completed progress for successful installs", () => {
    const result: InstallActionResult = {
      status: "success",
      stage: "verify",
      detail: "OpenClaw CLI 和 Gateway 托管服务安装完成。",
      suggestion: "继续前往 Config 和 Service 页面完成配置并启动 Gateway。",
      phases: [],
    };

    const progress = buildInstallProgressModel({
      environment: readyEnvironment,
      installResult: result,
      isInstalling: false,
      elapsedMs: 0,
      telemetry: null,
    });

    expect(progress.visible).toBe(true);
    expect(progress.tone).toBe("success");
    expect(progress.percent).toBe(100);
    expect(progress.activePhaseId).toBe("verify");
  });

  it("returns failed progress model pinned to the failed stage", () => {
    const result: InstallActionResult = {
      status: "failure",
      stage: "install-cli",
      detail: "OpenClaw install failed.",
      suggestion: "Check install logs and retry.",
      code: "E_INSTALL_COMMAND_FAILED",
      phases: [],
    };

    const progress = buildInstallProgressModel({
      environment: readyEnvironment,
      installResult: result,
      isInstalling: false,
      elapsedMs: 0,
      telemetry: null,
    });

    expect(progress.visible).toBe(true);
    expect(progress.tone).toBe("failure");
    expect(progress.activePhaseId).toBe("install-cli");
    expect(progress.percent).toBeGreaterThan(0);
    expect(progress.percent).toBeLessThan(100);
  });

  it("marks downstream phases as warning instead of success when npm is missing but OpenClaw is detectable", () => {
    const phases = buildInstallingPhases({
      environment: {
        ...readyEnvironment,
        npmFound: false,
        npmVersion: null,
        openclawFound: true,
        openclawPath: "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd",
        openclawVersion: "1.2.3",
      },
      elapsedMs: 0,
      telemetry: null,
    });

    expect(phases.find((phase) => phase.id === "prerequisite")?.status).toBe("failure");
    expect(phases.find((phase) => phase.id === "install-cli")?.status).toBe("warning");
    expect(phases.find((phase) => phase.id === "verify")?.status).toBe("warning");
  });

  it("prefers install log telemetry over elapsed-only inference when building progress", () => {
    const progress = buildInstallProgressModel({
      environment: readyEnvironment,
      installResult: null,
      isInstalling: true,
      elapsedMs: 900,
      telemetry: {
        activePhaseId: "install-gateway",
        phaseState: "running",
        detail: "Installing Gateway managed service.",
        latestLogLine: "Gateway service registration requested.",
      },
    });

    expect(progress.activePhaseId).toBe("install-gateway");
    expect(progress.detail).toContain("Gateway managed service");
    expect(progress.hint).toContain("实时阶段来自安装日志");
    expect(progress.percent).toBeGreaterThanOrEqual(58);
    expect(progress.percent).toBeLessThan(100);
  });
});
