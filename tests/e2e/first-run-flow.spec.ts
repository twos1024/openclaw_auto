import { expect, test, type Page } from "@playwright/test";

type GatewayState = {
  nodeFound: boolean;
  npmFound: boolean;
  openclawFound: boolean;
  configSaved: boolean;
  gatewayRunning: boolean;
  installStartedAt: number;
  savedConfig: Record<string, unknown> | null;
};

async function mockFirstRunBackend(page: Page, options?: { installDelayMs?: number }): Promise<void> {
  await page.route("http://127.0.0.1:18789/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><head><title>OpenClaw</title></head><body>dashboard ok</body></html>",
    });
  });

  await page.addInitScript((payload) => {
    const installDelayMs = payload.installDelayMs as number | undefined;
    const state: GatewayState = {
      nodeFound: false,
      npmFound: false,
      openclawFound: false,
      configSaved: false,
      gatewayRunning: false,
      installStartedAt: 0,
      savedConfig: null,
    };

    const buildOfficialConfig = () => {
      const baseUrl =
        typeof state.savedConfig?.baseUrl === "string" ? state.savedConfig.baseUrl : "https://api.openai.com/v1";
      const apiKey = typeof state.savedConfig?.apiKey === "string" ? state.savedConfig.apiKey : "sk-clean-run";
      const model = typeof state.savedConfig?.model === "string" ? state.savedConfig.model : "gpt-4o-mini";
      const temperature = Number(state.savedConfig?.temperature ?? 0.7);
      const maxTokens = Number(state.savedConfig?.maxTokens ?? 2048);

      return {
        models: {
          providers: {
            "custom-proxy": {
              baseUrl,
              apiKey,
              api: "openai-completions",
              models: [{ id: model, name: model }],
            },
          },
        },
        agents: {
          defaults: {
            model: { primary: `custom-proxy/${model}` },
            models: {
              [`custom-proxy/${model}`]: {
                params: {
                  temperature,
                  maxTokens,
                },
              },
            },
          },
        },
      };
    };

    const buildRunbookModel = () => {
      if (state.gatewayRunning) {
        return {
          headline: "已经可以开始使用了",
          summary: "安装、API Key 配置和 Gateway 都已经就绪，现在可以直接打开 Dashboard。",
          primaryRoute: "/dashboard",
          primaryLabel: "打开 Dashboard",
          lastCheckedAt: "2026-03-20T00:00:00.000Z",
          overallLevel: "healthy",
          launchChecks: [
            { id: "install", title: "安装检查", level: "healthy", detail: "已检测到 OpenClaw 1.2.3", route: "/install?wizard=1" },
            { id: "config", title: "配置检查", level: "healthy", detail: "API Key 配置已保存，当前模型为 gpt-4o-mini。", route: "/config" },
            { id: "service", title: "服务检查", level: "healthy", detail: "Gateway is running.", route: "/service" },
            { id: "runtime", title: "运行时检查", level: "healthy", detail: "Rust 命令桥接正常，已检测到 Node.js 22.15.0", route: "/settings" },
            { id: "settings", title: "设置检查", level: "healthy", detail: "ClawDesk 应用设置已加载。", route: "/settings" },
          ],
          steps: [
            { id: "install", title: "安装 OpenClaw", description: "已检测到 OpenClaw 1.2.3", route: "/install?wizard=1", actionLabel: "去安装", status: "complete" },
            { id: "config", title: "填写 API Key", description: "API Key 配置已保存，当前模型为 gpt-4o-mini。", route: "/config", actionLabel: "去填写 API Key", status: "complete" },
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
        };
      }

      return {
        headline: "下一步：安装 OpenClaw",
        summary: "一次只做一件事。完成当前步骤后，再继续下一步。",
        primaryRoute: "/install?wizard=1",
        primaryLabel: "去安装",
        lastCheckedAt: "2026-03-20T00:00:00.000Z",
        overallLevel: "degraded",
        launchChecks: [
          { id: "install", title: "安装检查", level: "degraded", detail: "尚未检测到 OpenClaw CLI，请先完成安装。", route: "/install?wizard=1" },
          { id: "config", title: "配置检查", level: "degraded", detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", route: "/config" },
          { id: "service", title: "服务检查", level: "offline", detail: "Gateway 状态读取失败。", route: "/service" },
          { id: "runtime", title: "运行时检查", level: "healthy", detail: "Rust 命令桥接正常，已检测到 Node.js 22.15.0", route: "/settings" },
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
    };

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string, args?: { source?: string; content?: Record<string, unknown> }) => {
          if (command === "detect_env") {
            return {
              success: true,
              data: {
                platform: "windows",
                architecture: "x64",
                home_dir: "C:\\Users\\Tester",
                config_path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
                node_found: state.nodeFound,
                node_version: state.nodeFound ? "v22.15.0" : null,
                node_path: state.nodeFound ? "C:\\Program Files\\nodejs\\node.exe" : null,
                npm_found: state.npmFound,
                npm_version: state.npmFound ? "10.9.0" : null,
                openclaw_found: state.openclawFound,
                openclaw_path: state.openclawFound ? "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd" : null,
                openclaw_version: state.openclawFound ? "1.2.3" : null,
              },
            };
          }

          if (command === "read_openclaw_config") {
            if (!state.configSaved) {
              return {
                success: false,
                error: {
                  code: "E_PATH_NOT_FOUND",
                  message: "Config file not found.",
                  suggestion: "Create and save config first.",
                },
              };
            }

            return {
              success: true,
              data: {
                path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
                size_bytes: 512,
                content: buildOfficialConfig(),
              },
            };
          }

          if (command === "test_connection") {
            return {
              success: true,
              data: {
                status: "success",
                detail: "Connected to OpenAI-compatible endpoint in 128ms.",
                suggestion: "Connection looks good. You can save this configuration.",
                latency_ms: 128,
              },
            };
          }

          if (command === "write_openclaw_config") {
            state.savedConfig = { ...(args?.content ?? {}) };
            state.configSaved = true;
            return {
              success: true,
              data: {
                path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
                backup_path: "C:\\Users\\Tester\\.openclaw\\openclaw.json.bak",
                bytes_written: 512,
              },
            };
          }

          if (command === "install_openclaw") {
            state.installStartedAt = Date.now();
            if (installDelayMs && installDelayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, installDelayMs));
            }

            state.nodeFound = true;
            state.npmFound = true;
            state.openclawFound = true;

            return {
              success: true,
              data: {
                cliInstalled: true,
                gatewayServiceInstalled: true,
                executablePath: "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd",
                configPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
                notes: [],
                installOutput: {
                  program: "powershell",
                  args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "install.ps1"],
                  stdout: "installed",
                  stderr: "",
                  exitCode: 0,
                  durationMs: 1200,
                },
                serviceInstallOutput: {
                  program: "openclaw",
                  args: ["gateway", "install", "--json"],
                  stdout: "{\"ok\":true}",
                  stderr: "",
                  exitCode: 0,
                  durationMs: 900,
                },
              },
            };
          }

          if (command === "start_gateway") {
            state.gatewayRunning = true;
            return {
              success: true,
              data: {
                detail: "Gateway started successfully.",
                address: "http://127.0.0.1:18789",
                pid: 4242,
              },
            };
          }

          if (command === "open_dashboard") {
            return {
              success: true,
              data: {
                detail: "The dashboard should now open at http://127.0.0.1:18789.",
                address: "http://127.0.0.1:18789",
              },
            };
          }

          if (command === "get_gateway_status") {
            return {
              success: true,
              data: {
                state: state.gatewayRunning ? "running" : "stopped",
                running: state.gatewayRunning,
                port: 18789,
                address: "http://127.0.0.1:18789",
                pid: state.gatewayRunning ? 4242 : null,
                lastStartedAt: state.gatewayRunning ? "2026-03-20T00:00:00.000Z" : null,
                statusDetail: state.gatewayRunning ? "Gateway is running." : "Gateway is not running.",
                suggestion: state.gatewayRunning ? "Open dashboard." : "Start Gateway first.",
              },
            };
          }

          if (command === "probe_dashboard_endpoint") {
            return {
              success: true,
              data: {
                address: "http://127.0.0.1:18789",
                reachable: state.gatewayRunning,
                result: state.gatewayRunning ? "reachable" : "idle",
                httpStatus: state.gatewayRunning ? 200 : null,
                responseTimeMs: state.gatewayRunning ? 110 : null,
                detail: state.gatewayRunning
                  ? "Dashboard endpoint responded successfully."
                  : "Gateway is not running, so the dashboard endpoint was not probed.",
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
                modifiedAt: "2026-03-20T00:00:00.000Z",
              },
            };
          }

          if (command === "get_runbook_model") {
            return {
              success: true,
              data: buildRunbookModel(),
            };
          }

          if (command === "get_overview_status") {
            const ready = state.gatewayRunning;
            return {
              success: true,
              data: {
                appVersion: "2.0.4",
                platform: "windows",
                dashboardUrl: ready ? "http://127.0.0.1:18789" : "Unavailable",
                mode: "live",
                overall: ready
                  ? {
                      level: "healthy",
                      headline: "可以开始使用了",
                      summary: "OpenClaw 已经安装完成，API Key 已保存，Gateway 也已启动。现在直接打开 Dashboard 即可。",
                      updatedAt: "2026-03-20T00:00:00.000Z",
                    }
                  : {
                      level: "degraded",
                      headline: "下一步：安装 OpenClaw",
                      summary: "这是第 1 步。安装完成后，再去填写 API Key 并启动 Gateway。",
                      updatedAt: "2026-03-20T00:00:00.000Z",
                    },
                runtime: {
                  id: "openclaw-runtime",
                  title: "桌面 Runtime",
                  route: "/service",
                  ctaLabel: "查看 Service",
                  level: "healthy",
                  detail: "Rust 命令桥接正常，已检测到 Node.js 22.15.0",
                  updatedAt: "2026-03-20T00:00:00.000Z",
                },
                install: {
                  id: "openclaw-install",
                  title: "OpenClaw 安装",
                  route: "/install?wizard=1",
                  ctaLabel: ready ? "查看 Install" : "开始安装",
                  level: ready ? "healthy" : "degraded",
                  detail: ready ? "已检测到 OpenClaw 1.2.3" : "尚未检测到 OpenClaw CLI，请先完成安装。",
                  updatedAt: "2026-03-20T00:00:00.000Z",
                },
                config: {
                  id: "openclaw-config",
                  title: "OpenClaw 配置",
                  route: "/config",
                  ctaLabel: ready ? "查看配置" : "填写 API Key",
                  level: ready ? "healthy" : "degraded",
                  detail: ready
                    ? "API Key 配置已保存，当前模型为 gpt-4o-mini。下一步可以启动 Gateway。"
                    : "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。",
                  updatedAt: "2026-03-20T00:00:00.000Z",
                },
                service: {
                  id: "openclaw-service",
                  title: "Gateway 服务",
                  route: "/service",
                  ctaLabel: ready ? "查看运行状态" : "启动 Gateway",
                  level: ready ? "healthy" : "offline",
                  detail: ready ? "Gateway is running." : "Gateway 状态读取失败。",
                  updatedAt: "2026-03-20T00:00:00.000Z",
                },
                settings: {
                  id: "clawdesk-settings",
                  title: "ClawDesk 设置",
                  route: "/settings",
                  ctaLabel: "查看 Settings",
                  level: "healthy",
                  detail: "ClawDesk 应用设置已加载。",
                  updatedAt: "2026-03-20T00:00:00.000Z",
                },
                nextActions: ready
                  ? [
                      {
                        id: "open-dashboard",
                        label: "打开 Dashboard 开始使用",
                        route: "/dashboard",
                        description: "OpenClaw 已经准备好，直接进入 Dashboard 即可。",
                        kind: "open-dashboard",
                      },
                    ]
                  : [
                      {
                        id: "install-openclaw",
                        label: "开始安装 OpenClaw",
                        route: "/install?wizard=1",
                        description: "这是第 1 步。安装完成后，继续去填写 API Key。",
                      },
                    ],
              },
            };
          }

          return { success: true, data: {} };
        },
      },
    };
  }, { installDelayMs: options?.installDelayMs ?? 0 });
}

test.describe("First run flow", () => {
  test("completes install, config, gateway startup, and dashboard open on a clean machine", async ({ page }) => {
    await mockFirstRunBackend(page, { installDelayMs: 1200 });
    await page.goto("/#/setup");

    await expect(page.getByRole("heading", { name: /初始化向导|Initial Setup/ })).toBeVisible();
    await expect(page.getByText(/Node\.js 缺失|Node.js missing/)).toBeVisible();
    await expect(page.getByText(/OpenClaw 未安装|OpenClaw missing/)).toBeVisible();

    await page.getByRole("button", { name: /继续到安装|Continue to Install/ }).click();
    await page.getByRole("button", { name: /安装 OpenClaw|Install OpenClaw/ }).click();
    await expect(page.getByRole("progressbar", { name: /安装进度|Install progress/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /配置提供方|Configure the provider/ })).toBeVisible();

    await page.getByLabel("API Key").fill("sk-clean-run");
    await page.getByLabel("Base URL").fill("https://api.openai.com/v1");
    await page.getByLabel("Model").fill("gpt-4o-mini");
    await page.getByRole("button", { name: /测试连接|Test Connection/ }).click();
    await expect(page.getByText(/Connected to OpenAI-compatible endpoint/)).toBeVisible();

    await page.getByRole("button", { name: /保存并继续|Save & Continue/ }).click();
    await expect(page.getByRole("heading", { name: /启动 Gateway|Start Gateway/ })).toBeVisible();

    await page.getByRole("button", { name: /启动 Gateway|Start Gateway/ }).click();
    await expect(page.getByRole("heading", { name: /初始化完成|Setup complete/ })).toBeVisible();

    await page.getByRole("button", { name: /打开 Dashboard|Open Dashboard/ }).click();
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByRole("heading", { name: /嵌入式 Dashboard|Embedded Dashboard/ })).toBeVisible();
    await expect(page.locator('iframe[title="OpenClaw Dashboard"]')).toHaveAttribute("src", "http://127.0.0.1:18789");
  });
});
