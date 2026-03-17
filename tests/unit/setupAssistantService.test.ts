import { describe, expect, it } from "vitest";
import { buildSetupAssistantModel } from "../../src/services/setupAssistantService";
import type { OverviewStatus } from "../../src/types/status";

function createStatus(overrides?: Partial<OverviewStatus>): OverviewStatus {
  return {
    appVersion: "0.1.1",
    platform: "windows",
    dashboardUrl: "http://127.0.0.1:18789",
    mode: "live",
    overall: {
      level: "degraded",
      headline: "Setup required",
      summary: "Complete install and startup.",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    runtime: {
      id: "runtime",
      title: "Runtime",
      route: "/service",
      ctaLabel: "Service",
      level: "healthy",
      detail: "Runtime ready",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    install: {
      id: "install",
      title: "Install",
      route: "/install",
      ctaLabel: "Install",
      level: "offline",
      detail: "Install missing",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    config: {
      id: "config",
      title: "Config",
      route: "/config",
      ctaLabel: "Config",
      level: "offline",
      detail: "Config missing",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    service: {
      id: "service",
      title: "Service",
      route: "/service",
      ctaLabel: "Service",
      level: "offline",
      detail: "Gateway stopped",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    settings: {
      id: "settings",
      title: "Settings",
      route: "/settings",
      ctaLabel: "Settings",
      level: "healthy",
      detail: "Settings loaded",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    nextActions: [],
    ...overrides,
  };
}

describe("setupAssistantService", () => {
  it("blocks downstream steps when install is not healthy", () => {
    const model = buildSetupAssistantModel(createStatus());

    expect(model.steps[0]?.status).toBe("current");
    expect(model.steps[1]?.status).toBe("blocked");
    expect(model.steps[2]?.status).toBe("blocked");
    expect(model.steps[3]?.status).toBe("blocked");
    expect(model.primaryRoute).toBe("/install?wizard=1");
    expect(model.launchChecks[0]?.route).toBe("/install?wizard=1");
    expect(model.launchChecks[0]).toMatchObject({
      title: "安装检查",
      level: "offline",
    });
  });

  it("marks dashboard step ready only when service is healthy", () => {
    const model = buildSetupAssistantModel(
      createStatus({
        install: {
          id: "install",
          title: "Install",
          route: "/install",
          ctaLabel: "Install",
          level: "healthy",
          detail: "Install done",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
        config: {
          id: "config",
          title: "Config",
          route: "/config",
          ctaLabel: "Config",
          level: "healthy",
          detail: "Config done",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
        service: {
          id: "service",
          title: "Service",
          route: "/service",
          ctaLabel: "Service",
          level: "healthy",
          detail: "Gateway running",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
      }),
    );

    expect(model.steps[0]?.status).toBe("complete");
    expect(model.steps[1]?.status).toBe("complete");
    expect(model.steps[2]?.status).toBe("complete");
    expect(model.steps[3]?.status).toBe("ready");
    expect(model.primaryRoute).toBe("/dashboard");
    expect(model.launchChecks[2]).toMatchObject({
      title: "服务检查",
      level: "healthy",
    });
  });
});
