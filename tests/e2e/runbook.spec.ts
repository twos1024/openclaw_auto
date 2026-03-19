import { expect, test } from "@playwright/test";

test.describe("Runbook workspace", () => {
  test("shows the new runbook route and current blocker guidance", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
        core: {
          invoke: async (command: string) => {
            if (command === "get_runbook_model") {
              return {
                success: true,
                data: {
                  headline: "下一步：OpenClaw 安装",
                  summary: "一次只做一件事。完成当前步骤后，再继续下一步。",
                  primaryRoute: "/install?wizard=1",
                  primaryLabel: "去安装",
                  lastCheckedAt: "2026-03-19T10:00:00.000Z",
                  overallLevel: "degraded",
                  launchChecks: [
                    { id: "install", title: "安装检查", level: "degraded", detail: "尚未检测到 OpenClaw CLI，请先完成安装。", route: "/install?wizard=1" },
                    { id: "config", title: "配置检查", level: "degraded", detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", route: "/config" },
                    { id: "service", title: "服务检查", level: "offline", detail: "Gateway 状态读取失败。", route: "/service" },
                    { id: "runtime", title: "运行时检查", level: "healthy", detail: "Rust 命令桥接正常，已检测到 npm 10.9.0", route: "/settings" },
                    { id: "settings", title: "设置检查", level: "healthy", detail: "ClawDesk 应用设置已加载。", route: "/settings" },
                  ],
                  steps: [
                    { id: "install", title: "安装 OpenClaw", description: "尚未检测到 OpenClaw CLI，请先完成安装。", route: "/install?wizard=1", actionLabel: "去安装", status: "current" },
                    { id: "config", title: "填写 API Key", description: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", route: "/config", actionLabel: "去填写 API Key", status: "blocked" },
                    { id: "service", title: "启动 Gateway", description: "Gateway 状态读取失败。", route: "/service", actionLabel: "去启动 Gateway", status: "blocked" },
                    { id: "dashboard", title: "开始使用 OpenClaw", description: "需要先启动 Gateway，才能打开 Dashboard 正常使用。", route: "/dashboard", actionLabel: "打开 Dashboard", status: "blocked" },
                  ],
                  blockers: [
                    { id: "install", title: "OpenClaw 安装", detail: "尚未检测到 OpenClaw CLI，请先完成安装。", level: "degraded", route: "/install?wizard=1", actionLabel: "去安装" },
                    { id: "config", title: "OpenClaw 配置", detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", level: "degraded", route: "/config", actionLabel: "去填写 API Key" },
                    { id: "service", title: "Gateway 服务", detail: "Gateway 状态读取失败。", level: "offline", route: "/service", actionLabel: "去启动 Gateway" },
                  ],
                  currentBlocker: {
                    id: "install",
                    title: "OpenClaw 安装",
                    detail: "尚未检测到 OpenClaw CLI，请先完成安装。",
                    level: "degraded",
                    route: "/install?wizard=1",
                    actionLabel: "去安装",
                  },
                  supportActions: [
                    { id: "primary", label: "去安装", route: "/install?wizard=1", description: "先完成当前这一步，再继续下面的流程。" },
                    { id: "runbook", label: "查看完整步骤", route: "/runbook", description: "如果你想看完整流程顺序，再打开这里。" },
                    { id: "logs", label: "查看日志", route: "/logs", description: "只有安装或启动失败时，再来这里看错误日志。" },
                    { id: "settings", label: "打开设置", route: "/settings", description: "当桌面运行时有问题时，再来这里检查设置和环境。" },
                  ],
                  banner: {
                    mode: "live",
                    tone: "warning",
                    headline: "下一步：安装 OpenClaw",
                    summary: "这是第 1 步。安装完成后，再去填写 API Key 并启动 Gateway。",
                    primaryAction: {
                      label: "开始安装 OpenClaw",
                      route: "/install?wizard=1",
                      description: "这是第 1 步。安装完成后，继续去填写 API Key。",
                    },
                    meta: [
                      { label: "Runtime Mode", value: "tauri-runtime-available" },
                      { label: "Tauri Shell", value: "detected" },
                      { label: "Invoke Bridge", value: "detected" },
                      { label: "Bridge Source", value: "official API bridge" },
                      { label: "App Version", value: "2.0.4" },
                      { label: "Platform", value: "windows" },
                      { label: "Dashboard", value: "Unavailable" },
                    ],
                  },
                },
              };
            }

            if (command === "get_overview_status") {
              return {
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
              };
            }

            return { success: true, data: {} };
          },
        },
      };
    });

    await page.goto("/#/runbook");

    await expect(page.getByRole("heading", { name: "Runbook" })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: "下一步：" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Launch Checks" })).toBeVisible();
    await expect(page.getByText("运行时检查")).toBeVisible();
    await expect(page.getByText("设置检查")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Guided Workflow" })).toBeVisible();
    await expect(page.getByRole("link", { name: "查看日志" })).toBeVisible();
    await expect(page.getByRole("link", { name: "去安装" }).first()).toBeVisible();
  });
});
