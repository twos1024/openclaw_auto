import { describe, expect, it } from "vitest";
import { buildRunbookModel, buildWorkspaceBanner } from "../../src/services/runbookService";
import type { OverviewStatus } from "../../src/types/status";

function createStatus(overrides?: Partial<OverviewStatus>): OverviewStatus {
  return {
    appVersion: "0.2.0",
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
      route: "/settings",
      ctaLabel: "Inspect Runtime",
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
    nextActions: [
      {
        id: "install",
        label: "安装 OpenClaw",
        route: "/install?wizard=1",
        description: "先完成安装。",
      },
    ],
    ...overrides,
  };
}

describe("runbookService", () => {
  it("builds a preview banner with read-only guidance", () => {
    const banner = buildWorkspaceBanner(
      createStatus({
        mode: "preview",
        overall: {
          level: "unknown",
          headline: "Preview",
          summary: "Preview",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
      }),
    );

    expect(banner.tone).toBe("warning");
    expect(banner.headline).toBe("Browser Preview Mode");
    expect(banner.summary).toContain("只读预览");
    expect(banner.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Runtime Mode", value: "Browser Preview" }),
        expect.objectContaining({ label: "Tauri Shell", value: "not-detected" }),
        expect.objectContaining({ label: "Invoke Bridge", value: "missing" }),
        expect.objectContaining({ label: "Bridge Source", value: "missing" }),
      ]),
    );
  });

  it("prioritizes runtime bridge blockers ahead of install/config/service", () => {
    const model = buildRunbookModel(
      createStatus({
        mode: "runtime-unavailable",
        runtime: {
          id: "runtime",
          title: "Runtime",
          route: "/settings",
          ctaLabel: "Inspect Runtime",
          level: "offline",
          detail: "Frontend is not connected to the invoke bridge.",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
      }),
    );

    expect(model.currentBlocker).toMatchObject({
      id: "runtime-bridge",
      route: "/settings",
      actionLabel: "修复运行时",
    });
    expect(model.primaryRoute).toBe("/settings");
    expect(model.primaryLabel).toBe("修复运行时");
    expect(model.supportActions[0]).toMatchObject({
      route: "/settings",
      label: "修复运行时",
    });
  });

  it("marks dashboard ready only when install, config, and service are healthy", () => {
    const model = buildRunbookModel(
      createStatus({
        overall: {
          level: "healthy",
          headline: "Ready",
          summary: "Workspace is ready.",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
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
        nextActions: [
          {
            id: "dashboard",
            label: "打开 Dashboard",
            route: "/dashboard",
            description: "Open the dashboard.",
            kind: "open-dashboard",
          },
        ],
      }),
    );

    expect(model.currentBlocker).toBeNull();
    expect(model.steps[3]?.status).toBe("ready");
    expect(model.banner.primaryAction).toMatchObject({
      label: "打开 Dashboard",
      route: "/dashboard",
    });
    expect(model.launchChecks.map((check) => check.id)).toEqual([
      "install",
      "config",
      "service",
      "runtime",
      "settings",
    ]);
    expect(model.launchChecks[3]).toMatchObject({
      title: "运行时检查",
      route: "/settings",
    });
    expect(model.launchChecks[4]).toMatchObject({
      title: "设置检查",
      route: "/settings",
    });
  });
});
