/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { OverviewPage } from "../../src/pages/OverviewPage";

const mockGetOverviewStatus = vi.hoisted(() => vi.fn());
const mockOpenDashboard = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/statusService", () => ({
  statusService: {
    getOverviewStatus: mockGetOverviewStatus,
  },
}));

vi.mock("../../src/services/serviceService", () => ({
  serviceService: {
    openDashboard: mockOpenDashboard,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("OverviewPage", () => {
  afterEach(() => {
    mockGetOverviewStatus.mockReset();
    mockOpenDashboard.mockReset();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("keeps rendering fallback overview data while surfacing backend aggregation errors", async () => {
    mockGetOverviewStatus.mockResolvedValue({
      ok: false,
      error: {
        code: "E_INTERNAL",
        message: "backend aggregation failed",
        suggestion: "inspect logs",
      },
      data: {
        appVersion: "0.6.0",
        platform: "desktop-runtime",
        dashboardUrl: "Unavailable",
        mode: "live",
        overall: {
          level: "offline",
          headline: "后端聚合异常",
          summary: "桌面命令桥已连接，但后端状态聚合失败。",
          updatedAt: "2026-03-19T10:00:00.000Z",
        },
        runtime: {
          id: "openclaw-runtime",
          title: "桌面 Runtime",
          route: "/settings",
          ctaLabel: "查看 Settings",
          level: "healthy",
          detail: "桌面命令桥可用，但后端聚合命令执行失败。",
          updatedAt: "2026-03-19T10:00:00.000Z",
          meta: [
            { label: "Mode", value: "tauri-runtime-available" },
            { label: "Invoke Bridge", value: "detected" },
          ],
        },
        install: {
          id: "openclaw-install",
          title: "OpenClaw 安装",
          route: "/install?wizard=1",
          ctaLabel: "查看 Install",
          level: "unknown",
          detail: "后端聚合状态不可用，暂时无法确认安装状态。",
          updatedAt: "2026-03-19T10:00:00.000Z",
        },
        config: {
          id: "openclaw-config",
          title: "OpenClaw 配置",
          route: "/config",
          ctaLabel: "查看 Config",
          level: "unknown",
          detail: "后端聚合状态不可用，暂时无法确认配置状态。",
          updatedAt: "2026-03-19T10:00:00.000Z",
        },
        service: {
          id: "openclaw-service",
          title: "Gateway 服务",
          route: "/service",
          ctaLabel: "查看 Service",
          level: "unknown",
          detail: "后端聚合状态不可用，暂时无法确认 Gateway 状态。",
          updatedAt: "2026-03-19T10:00:00.000Z",
        },
        settings: {
          id: "clawdesk-settings",
          title: "ClawDesk 设置",
          route: "/settings",
          ctaLabel: "查看 Settings",
          level: "unknown",
          detail: "后端聚合状态不可用，暂时无法确认本地设置状态。",
          updatedAt: "2026-03-19T10:00:00.000Z",
        },
        nextActions: [
          {
            id: "review-logs",
            label: "查看错误日志",
            route: "/logs",
            description: "backend aggregation failed",
          },
        ],
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/overview"] },
          React.createElement(OverviewPage, { autoRefreshMs: 0 }),
        ),
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("backend aggregation failed");
    expect(container.textContent).toContain("后端聚合异常");
    expect(container.textContent).toContain("查看错误日志");
    expect(container.textContent).toContain("桌面 Runtime");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
