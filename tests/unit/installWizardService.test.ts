import { describe, expect, it } from "vitest";
import { buildInstallWizardModel, buildPlatformGuidance } from "../../src/services/installWizardService";
import type { InstallActionResult, InstallEnvironment } from "../../src/types/install";

const baseEnvironment: InstallEnvironment = {
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

describe("installWizardService", () => {
  it("keeps the wizard on environment check when npm is missing", () => {
    const model = buildInstallWizardModel({
      environment: { ...baseEnvironment, npmFound: false, npmVersion: null },
      installResult: null,
    });

    expect(model.steps[0]?.status).toBe("current");
    expect(model.steps[1]?.status).toBe("blocked");
    expect(model.primaryRoute).toBe("/install");
  });

  it("moves the active step to config after install succeeds", () => {
    const installResult: InstallActionResult = {
      status: "success",
      stage: "verify",
      detail: "Install done",
      suggestion: "Continue to config",
      phases: [],
      data: {
        cliInstalled: true,
        gatewayServiceInstalled: true,
        executablePath: "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd",
        configPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
        notes: [],
      },
    };

    const model = buildInstallWizardModel({
      environment: { ...baseEnvironment, openclawFound: true, openclawVersion: "1.2.3" },
      installResult,
    });

    expect(model.steps[0]?.status).toBe("complete");
    expect(model.steps[1]?.status).toBe("complete");
    expect(model.steps[2]?.status).toBe("current");
    expect(model.primaryRoute).toBe("/config");
  });

  it("highlights the current platform guidance card", () => {
    const cards = buildPlatformGuidance("linux");
    const current = cards.find((card) => card.isCurrent);

    expect(current?.platform).toBe("linux");
    expect(current?.title).toBe("Linux");
  });
});
