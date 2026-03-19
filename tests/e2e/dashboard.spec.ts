import { expect, test, type Page } from "@playwright/test";

async function mockWorkspaceBackend(
  page: Page,
  options?: { running?: boolean; routeDashboardFrame?: boolean; timeoutMode?: boolean },
): Promise<void> {
  if (options?.routeDashboardFrame) {
    await page.route("http://127.0.0.1:18789/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head><title>OpenClaw</title></head><body>dashboard ok</body></html>",
      });
    });
  }
  if (options?.timeoutMode) {
    await page.route("http://127.0.0.1:18789/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body>late dashboard</body></html>",
      });
    });
  }

  await page.addInitScript((payload) => {
    const running = payload.running as boolean;
    const state = { probeCalls: 0 };
    (window as unknown as { __probeCalls?: number }).__probeCalls = 0;

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string) => {
          const buildRunbookData = () => running
            ? {
                headline: "已经可以开始使用了",
                summary: "安装、API Key 配置和 Gateway 都已经就绪，现在可以直接打开 Dashboard。",
                primaryRoute: "/dashboard",
                primaryLabel: "打开 Dashboard",
                lastCheckedAt: "2026-03-19T10:00:00.000Z",
                overallLevel: "healthy",
                launchChecks: [
                  { id: "install", title: "安装检查", level: "healthy", detail: "已检测到 OpenClaw 1.2.3", route: "/install?wizard=1" },
                  { id: "config", title: "配置检查", level: "healthy", detail: "API Key 配置已保存，当前模型为 gpt-4o-mini。下一步可以启动 Gateway。", route: "/config" },
                  { id: "service", title: "服务检查", level: "healthy", detail: "Gateway is running.", route: "/service" },
                  { id: "runtime", title: "运行时检查", level: "healthy", detail: "Rust 命令桥接正常，已检测到 npm 10.9.0", route: "/settings" },
                  { id: "settings", title: "设置检查", level: "healthy", detail: "ClawDesk 应用设置已加载。", route: "/settings" },
                ],
                steps: [
                  { id: "install", title: "安装 OpenClaw", description: "已检测到 OpenClaw 1.2.3", route: "/install?wizard=1", actionLabel: "去安装", status: "complete" },
                  { id: "config", title: "填写 API Key", description: "API Key 配置已保存，当前模型为 gpt-4o-mini。下一步可以启动 Gateway。", route: "/config", actionLabel: "去填写 API Key", status: "complete" },
                  { id: "service", title: "启动 Gateway", description: "Gateway is running.", route: "/service", actionLabel: "去启动 Gateway", status: "complete" },
                  { id: "dashboard", title: "开始使用 OpenClaw", description: "Gateway 已就绪，现在可以直接打开 Dashboard 开始使用。", route: "/dashboard", actionLabel: "打开 Dashboard", status: "ready" },
                ],
                blockers: [],
                currentBlocker: null,
                supportActions: [
                  { id: "runbook", label: "查看完整步骤", route: "/runbook", description: "如果你想看完整流程顺序，再打开这里。" },
                  { id: "logs", label: "查看日志", route: "/logs", description: "只有安装或启动失败时，再来这里看错误日志。" },
                  { id: "settings", label: "打开设置", route: "/settings", description: "当桌面运行时有问题时，再来这里检查设置和环境。" },
                ],
                banner: {
                  mode: "live",
                  tone: "success",
                  headline: "可以开始使用了",
                  summary: "OpenClaw 已经安装完成，API Key 已保存，Gateway 也已启动。现在直接打开 Dashboard 即可。",
                  primaryAction: {
                    label: "打开 Dashboard 开始使用",
                    route: "/dashboard",
                    description: "OpenClaw 已经准备好，直接进入 Dashboard 即可。",
                  },
                  meta: [
                    { label: "Runtime Mode", value: "tauri-runtime-available" },
                    { label: "Tauri Shell", value: "detected" },
                    { label: "Invoke Bridge", value: "detected" },
                    { label: "Bridge Source", value: "official API bridge" },
                    { label: "App Version", value: "2.0.4" },
                    { label: "Platform", value: "windows" },
                    { label: "Dashboard", value: "http://127.0.0.1:18789" },
                  ],
                },
              }
            : {
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
              };

          if (command === "get_runbook_model") {
            return {
              success: true,
              data: buildRunbookData(),
            };
          }

          if (command === "get_overview_status") {
            return {
              success: true,
              data: {
                appVersion: "2.0.4",
                platform: "windows",
                dashboardUrl: running ? "http://127.0.0.1:18789" : "Unavailable",
                mode: "live",
                overall: running
                  ? {
                      level: "healthy",
                      headline: "可以开始使用了",
                      summary:
                        "OpenClaw 已经安装完成，API Key 已保存，Gateway 也已启动。现在直接打开 Dashboard 即可。",
                      updatedAt: "2026-03-19T10:00:00.000Z",
                    }
                  : {
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
                  ctaLabel: running ? "查看 Install" : "开始安装",
                  level: running ? "healthy" : "degraded",
                  detail: running ? "已检测到 OpenClaw 1.2.3" : "尚未检测到 OpenClaw CLI，请先完成安装。",
                  updatedAt: "2026-03-19T10:00:00.000Z",
                },
                config: {
                  id: "openclaw-config",
                  title: "OpenClaw 配置",
                  route: "/config",
                  ctaLabel: running ? "查看配置" : "填写 API Key",
                  level: running ? "healthy" : "degraded",
                  detail: running
                    ? "API Key 配置已保存，当前模型为 gpt-4o-mini。下一步可以启动 Gateway。"
                    : "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。",
                  updatedAt: "2026-03-19T10:00:00.000Z",
                },
                service: {
                  id: "openclaw-service",
                  title: "Gateway 服务",
                  route: "/service",
                  ctaLabel: running ? "查看运行状态" : "启动 Gateway",
                  level: running ? "healthy" : "offline",
                  detail: running ? "Gateway is running." : "Gateway 状态读取失败。",
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
                nextActions: running
                  ? [
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
                    ]
                  : [
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

          if (command === "get_gateway_status") {
            return {
              success: true,
              data: {
                state: running ? "running" : "stopped",
                running,
                port: 18789,
                address: "http://127.0.0.1:18789",
                pid: running ? 4242 : null,
                statusDetail: running ? "Gateway is running." : "Gateway is not running.",
                suggestion: running ? "Open dashboard." : "Start Gateway first.",
              },
            };
          }

          if (command === "detect_env") {
            return {
              success: true,
              data: {
                platform: "windows",
                npm_found: true,
                npm_version: "10.9.0",
                openclaw_found: running,
                openclaw_version: running ? "1.2.3" : null,
                openclaw_path: running ? "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd" : null,
                config_path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
              },
            };
          }

          if (command === "read_openclaw_config") {
            return running
              ? {
                  success: true,
                  data: {
                    path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
                    exists: true,
                    content: {
                      providerType: "openai-compatible",
                      model: "gpt-4o-mini",
                    },
                  },
                }
              : {
                  success: false,
                  error: {
                    code: "E_PATH_NOT_FOUND",
                    message: "Config file not found.",
                    suggestion: "Create and save config first.",
                  },
                };
          }

          if (command === "read_app_settings") {
            return {
              success: true,
              data: {
                path: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json",
                exists: true,
                content: {
                  preferredInstallSource: "npm-global",
                  diagnosticsDir: "C:\\Users\\Tester\\Diagnostics",
                  logLineLimit: 1200,
                  gatewayPollMs: 5000,
                },
                modifiedAt: "2026-03-17T00:00:00.000Z",
              },
            };
          }

          if (command === "start_gateway" || command === "open_dashboard") {
            return {
              success: true,
              data: {},
            };
          }

          if (command === "probe_dashboard_endpoint") {
            state.probeCalls += 1;
            (window as unknown as { __probeCalls?: number }).__probeCalls = state.probeCalls;
            return {
              success: true,
              data: {
                address: "http://127.0.0.1:18789",
                reachable: running,
                result: running ? "reachable" : "idle",
                httpStatus: running ? 200 : null,
                responseTimeMs: running ? 110 : null,
                detail: running
                  ? "Dashboard endpoint responded successfully."
                  : "Gateway is not running, so the dashboard endpoint was not probed.",
              },
            };
          }

          return { success: true, data: {} };
        },
      },
    };
  }, { running: options?.running ?? true });
}

test.describe("Dashboard workspace", () => {
  test("shows embedded dashboard iframe when gateway is running", async ({ page }) => {
    await mockWorkspaceBackend(page, { running: true, routeDashboardFrame: true });
    await page.goto("/#/dashboard");

    await expect(page.getByRole("heading", { name: "Embedded Dashboard", exact: true })).toBeVisible();
    await expect(page.locator('iframe[title="OpenClaw Dashboard"]')).toHaveAttribute(
      "src",
      "http://127.0.0.1:18789",
    );
  });

  test("opens setup assistant automatically and routes to install when setup is incomplete", async ({ page }) => {
    await mockWorkspaceBackend(page, { running: false });
    await page.goto("/#/");

    await expect(page.getByRole("dialog", { name: /OpenClaw setup assistant|OpenClaw 设置助手/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /OpenClaw setup assistant|OpenClaw 设置助手/ })).toBeVisible();
    await expect(page.getByText(/Focus on: OpenClaw 安装|当前先处理：OpenClaw 安装/)).toBeVisible();
    await expect(page.getByText("Launch Checks")).toBeVisible();
    await expect(page.getByRole("link", { name: "去安装" }).first()).toBeVisible();

    await page.getByRole("link", { name: "去安装" }).first().click();
    await expect(page).toHaveURL(/#\/install\?wizard=1$/);
    await expect(page.getByRole("dialog", { name: /OpenClaw installation wizard|OpenClaw 安装向导/ })).toBeVisible();
  });

  test("shows a timeout recovery state when the embedded dashboard never becomes ready", async ({ page }) => {
    await mockWorkspaceBackend(page, { running: true, timeoutMode: true });
    await page.goto("/#/dashboard");

    await expect(page.getByText("Dashboard connection timed out")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Setup Assistant" })).toBeVisible();
  });

  test("shows live diagnostics for a reachable dashboard endpoint", async ({ page }) => {
    await mockWorkspaceBackend(page, { running: true, routeDashboardFrame: true });
    await page.goto("/#/dashboard");

    await expect(page.getByRole("heading", { name: "Dashboard Diagnostics" })).toBeVisible();
    await expect(page.getByText("Local Endpoint Probe")).toBeVisible();
    await expect(page.getByText("HTTP 200")).toBeVisible();
  });

  test("refreshing status triggers only one additional dashboard probe", async ({ page }) => {
    await mockWorkspaceBackend(page, { running: true, routeDashboardFrame: true });
    await page.goto("/#/dashboard");

    await expect.poll(() => page.evaluate(() => (window as unknown as { __probeCalls?: number }).__probeCalls ?? 0)).toBe(1);

    await page.getByRole("button", { name: "Refresh Status" }).click();

    await expect.poll(() => page.evaluate(() => (window as unknown as { __probeCalls?: number }).__probeCalls ?? 0)).toBe(2);
    await page.waitForTimeout(400);
    const finalProbeCalls = await page.evaluate(() => (window as unknown as { __probeCalls?: number }).__probeCalls ?? 0);
    expect(finalProbeCalls).toBe(2);
  });
});
