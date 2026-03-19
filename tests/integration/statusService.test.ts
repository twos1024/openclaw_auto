/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { statusService } from "../../src/services/statusService";

type InvokeHandler = (payload?: Record<string, unknown>) => unknown | Promise<unknown>;

function createInvokeMock(handlers: Record<string, InvokeHandler>) {
  const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>) => {
    const handler = handlers[command];
    if (!handler) {
      throw new Error(`Unhandled invoke command in test: ${command}`);
    }
    return handler(payload);
  });

  Object.defineProperty(window, "__TAURI__", {
    configurable: true,
    writable: true,
    value: { core: { invoke } },
  });

  return invoke;
}

describe("statusService integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "isTauri", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, "isTauri", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("returns live overview payload from backend aggregation command", async () => {
    createInvokeMock({
      get_overview_status: async () => ({
        success: true,
        data: {
          appVersion: "2.0.4",
          platform: "windows",
          dashboardUrl: "Unavailable",
          mode: "live",
          overall: {
            level: "degraded",
            headline: "下一步：安装 OpenClaw",
            summary: "这是第 1 步。安装完成后，再去填写 API Key 并启动 Gateway。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          runtime: {
            id: "openclaw-runtime",
            title: "桌面 Runtime",
            route: "/service",
            ctaLabel: "查看 Service",
            level: "healthy",
            detail: "Rust 命令桥接正常，已检测到 npm 10.9.0",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          install: {
            id: "openclaw-install",
            title: "OpenClaw 安装",
            route: "/install?wizard=1",
            ctaLabel: "开始安装",
            level: "degraded",
            detail: "尚未检测到 OpenClaw CLI，请先完成安装。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          config: {
            id: "openclaw-config",
            title: "OpenClaw 配置",
            route: "/config",
            ctaLabel: "填写 API Key",
            level: "degraded",
            detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          service: {
            id: "openclaw-service",
            title: "Gateway 服务",
            route: "/service",
            ctaLabel: "启动 Gateway",
            level: "offline",
            detail: "Gateway 状态读取失败。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          settings: {
            id: "clawdesk-settings",
            title: "ClawDesk 设置",
            route: "/settings",
            ctaLabel: "查看 Settings",
            level: "healthy",
            detail: "ClawDesk 应用设置已加载。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          nextActions: [
            {
              id: "install-openclaw",
              label: "开始安装 OpenClaw",
              route: "/install?wizard=1",
              description: "这是第 1 步。安装完成后，继续去填写 API Key。",
            },
            {
              id: "configure-provider",
              label: "填写 API Key",
              route: "/config",
              description: "这是第 2 步。填好 API Key、接口地址和模型后再启动 Gateway。",
            },
            {
              id: "start-gateway",
              label: "启动 Gateway",
              route: "/service",
              description: "这是第 3 步。Gateway 启动成功后，就可以打开 Dashboard 开始使用。",
            },
            {
              id: "review-logs",
              label: "遇到问题再看日志",
              route: "/logs",
              description: "只有安装、配置或启动失败时，再到这里查看错误和导出诊断信息。",
            },
          ],
        },
      }),
    });

    const result = await statusService.getOverviewStatus();
    const data = result.data as {
      mode: string;
      install: { level: string };
      settings: { level: string };
      nextActions: Array<{ route: string; label: string }>;
    };

    expect(result.ok).toBe(true);
    expect(data.mode).toBe("live");
    expect(data.install.level).toBe("degraded");
    expect(data.settings.level).toBe("healthy");
    expect(data.nextActions[0]).toMatchObject({
      route: "/install?wizard=1",
      label: "开始安装 OpenClaw",
    });
  });

  it("surfaces backend aggregation failures without misclassifying them as runtime bridge outages", async () => {
    createInvokeMock({
      get_overview_status: async () => ({
        success: false,
        error: {
          code: "E_INTERNAL",
          message: "backend aggregation failed",
          suggestion: "inspect logs",
        },
      }),
    });

    const result = await statusService.getOverviewStatus();
    const data = result.data as {
      mode: string;
      overall: { level: string; headline: string };
      runtime: { level: string; detail: string };
      nextActions: Array<{ route: string }>;
    };

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("E_INTERNAL");
    expect(data.mode).toBe("live");
    expect(data.overall.level).toBe("offline");
    expect(data.overall.headline).toBe("后端聚合异常");
    expect(data.runtime.level).toBe("healthy");
    expect(data.runtime.detail).toContain("后端聚合命令执行失败");
    expect(data.nextActions[0]?.route).toBe("/logs");
  });

  it("recommends opening dashboard when backend returns healthy runtime overview", async () => {
    createInvokeMock({
      get_overview_status: async () => ({
        success: true,
        data: {
          appVersion: "2.0.4",
          platform: "macos",
          dashboardUrl: "http://127.0.0.1:18789",
          mode: "live",
          overall: {
            level: "healthy",
            headline: "可以开始使用了",
            summary: "OpenClaw 已经安装完成，API Key 已保存，Gateway 也已启动。现在直接打开 Dashboard 即可。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          runtime: {
            id: "openclaw-runtime",
            title: "桌面 Runtime",
            route: "/service",
            ctaLabel: "查看 Service",
            level: "healthy",
            detail: "Rust 命令桥接正常，已检测到 npm 10.9.0",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          install: {
            id: "openclaw-install",
            title: "OpenClaw 安装",
            route: "/install?wizard=1",
            ctaLabel: "查看 Install",
            level: "healthy",
            detail: "已检测到 OpenClaw 1.2.3",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          config: {
            id: "openclaw-config",
            title: "OpenClaw 配置",
            route: "/config",
            ctaLabel: "查看配置",
            level: "healthy",
            detail: "API Key 配置已保存，当前模型为 gpt-4o-mini。下一步可以启动 Gateway。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          service: {
            id: "openclaw-service",
            title: "Gateway 服务",
            route: "/service",
            ctaLabel: "查看运行状态",
            level: "healthy",
            detail: "Gateway is running.",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          settings: {
            id: "clawdesk-settings",
            title: "ClawDesk 设置",
            route: "/settings",
            ctaLabel: "查看 Settings",
            level: "healthy",
            detail: "ClawDesk 应用设置已加载。",
            updatedAt: "2026-03-19T10:00:00.000Z",
          },
          nextActions: [
            {
              id: "open-dashboard",
              label: "打开 Dashboard 开始使用",
              route: "/dashboard",
              description: "OpenClaw 已经准备好，直接进入 Dashboard 即可。",
              kind: "open-dashboard",
            },
            {
              id: "review-logs",
              label: "遇到问题再看日志",
              route: "/logs",
              description: "只有安装、配置或启动失败时，再到这里查看错误和导出诊断信息。",
            },
          ],
        },
      }),
    });

    const result = await statusService.getOverviewStatus();
    const data = result.data as {
      overall: { level: string; headline: string };
      nextActions: Array<{ label: string; route: string; kind?: string }>;
    };

    expect(result.ok).toBe(true);
    expect(data.overall.level).toBe("healthy");
    expect(data.nextActions[0]).toMatchObject({
      label: "打开 Dashboard 开始使用",
      route: "/dashboard",
      kind: "open-dashboard",
    });
  });

  it("builds a preview overview when running outside desktop runtime", async () => {
    const result = await statusService.getOverviewStatus();
    const data = result.data as {
      mode: string;
      overall: { level: string; headline: string };
      runtime: { level: string };
      dashboardUrl: string;
    };

    expect(result.ok).toBe(true);
    expect(data.mode).toBe("preview");
    expect(data.overall.level).toBe("unknown");
    expect(data.runtime.level).toBe("unknown");
    expect(data.dashboardUrl).toBe("Unavailable in preview");
  });

  it("builds a runtime-unavailable overview when desktop shell is present without invoke bridge", async () => {
    Object.defineProperty(window, "isTauri", {
      configurable: true,
      writable: true,
      value: true,
    });
    Object.defineProperty(globalThis, "isTauri", {
      configurable: true,
      writable: true,
      value: true,
    });

    const result = await statusService.getOverviewStatus();
    const data = result.data as {
      mode: string;
      overall: { level: string; headline: string };
      runtime: { level: string; detail: string; meta?: Array<{ label: string; value: string }> };
      dashboardUrl: string;
    };

    expect(result.ok).toBe(true);
    expect(data.mode).toBe("runtime-unavailable");
    expect(data.overall.headline).toBe("桌面运行时异常");
    expect(data.runtime.level).toBe("offline");
    expect(data.runtime.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Mode", value: "tauri-runtime-unavailable" }),
        expect.objectContaining({ label: "Invoke Bridge", value: "missing" }),
      ]),
    );
    expect(data.dashboardUrl).toBe("Unavailable");
  });
});
