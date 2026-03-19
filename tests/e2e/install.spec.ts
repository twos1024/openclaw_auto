import { expect, test, type Page } from "@playwright/test";

type LogSource = "install" | "startup" | "gateway";

const installFailureFixture: Record<LogSource, string[]> = {
  install: [
    "[info] downloading openclaw package...",
    "[error] E_PATH_NOT_FOUND install archive missing at C:\\OpenClaw\\downloads\\openclaw.zip",
    "[error] permission denied while writing C:\\Program Files\\OpenClaw",
  ],
  startup: ["[info] startup noop"],
  gateway: ["[info] gateway noop"],
};

async function mockLogsBackend(page: Page, fixtures: Record<LogSource, string[]>): Promise<void> {
  await page.addInitScript((payload) => {
    const sources = payload.sources as Record<string, string[]>;

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => undefined,
      },
    });

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string, args?: { source?: string }) => {
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

          if (command === "read_logs") {
            const source = args?.source ?? "gateway";
            return {
              success: true,
              data: { source, lines: sources[source] ?? [] },
            };
          }

          if (command === "export_diagnostics") {
            const isBundle = Boolean((args as { archive?: boolean } | undefined)?.archive);
            return {
              success: true,
              data: {
                filePath: isBundle
                  ? "C:\\Temp\\clawdesk-diagnostics.zip"
                  : "C:\\Temp\\clawdesk-diagnostics.txt",
                format: isBundle ? "bundle" : "text",
                includedFiles: isBundle ? ["summary.txt", "manifest.json"] : ["summary.txt"],
              },
            };
          }

          return { success: true, data: {} };
        },
      },
    };
  }, { sources: fixtures });
}

async function mockInstallBackend(page: Page, options?: { installDelayMs?: number }): Promise<void> {
  await page.addInitScript((payload) => {
    const installDelayMs = payload.installDelayMs as number | undefined;
    const defaultLogLines: Record<LogSource, string[]> = {
      install: [],
      startup: ["[info] startup noop"],
      gateway: ["[info] gateway noop"],
    };
    const state = {
      openclawFound: false,
      installStartedAt: 0,
    };

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string, args?: { source?: string }) => {
          const buildRunbookData = () => ({
            headline: state.openclawFound ? "下一步：OpenClaw 配置" : "下一步：OpenClaw 安装",
            summary: "一次只做一件事。完成当前步骤后，再继续下一步。",
            primaryRoute: state.openclawFound ? "/config" : "/install?wizard=1",
            primaryLabel: state.openclawFound ? "去填写 API Key" : "去安装",
            lastCheckedAt: "2026-03-19T10:00:00.000Z",
            overallLevel: "degraded",
            launchChecks: [
              { id: "install", title: "安装检查", level: state.openclawFound ? "healthy" : "degraded", detail: state.openclawFound ? "已检测到 OpenClaw 1.2.3" : "尚未检测到 OpenClaw CLI，请先完成安装。", route: "/install?wizard=1" },
              { id: "config", title: "配置检查", level: "degraded", detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", route: "/config" },
              { id: "service", title: "服务检查", level: "degraded", detail: "Gateway 当前未启动。", route: "/service" },
              { id: "runtime", title: "运行时检查", level: "healthy", detail: "Rust 命令桥接正常，已检测到 npm 10.9.0", route: "/settings" },
              { id: "settings", title: "设置检查", level: "healthy", detail: "ClawDesk 应用设置已加载。", route: "/settings" },
            ],
            steps: [
              { id: "install", title: "安装 OpenClaw", description: state.openclawFound ? "已检测到 OpenClaw 1.2.3" : "尚未检测到 OpenClaw CLI，请先完成安装。", route: "/install?wizard=1", actionLabel: "去安装", status: state.openclawFound ? "complete" : "current" },
              { id: "config", title: "填写 API Key", description: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", route: "/config", actionLabel: "去填写 API Key", status: state.openclawFound ? "current" : "blocked" },
              { id: "service", title: "启动 Gateway", description: "Gateway 当前未启动。", route: "/service", actionLabel: "去启动 Gateway", status: "blocked" },
              { id: "dashboard", title: "开始使用 OpenClaw", description: "需要先启动 Gateway，才能打开 Dashboard 正常使用。", route: "/dashboard", actionLabel: "打开 Dashboard", status: "blocked" },
            ],
            blockers: state.openclawFound
              ? [
                  { id: "config", title: "OpenClaw 配置", detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", level: "degraded", route: "/config", actionLabel: "去填写 API Key" },
                  { id: "service", title: "Gateway 服务", detail: "Gateway 当前未启动。", level: "degraded", route: "/service", actionLabel: "去启动 Gateway" },
                ]
              : [
                  { id: "install", title: "OpenClaw 安装", detail: "尚未检测到 OpenClaw CLI，请先完成安装。", level: "degraded", route: "/install?wizard=1", actionLabel: "去安装" },
                  { id: "config", title: "OpenClaw 配置", detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", level: "degraded", route: "/config", actionLabel: "去填写 API Key" },
                  { id: "service", title: "Gateway 服务", detail: "Gateway 当前未启动。", level: "degraded", route: "/service", actionLabel: "去启动 Gateway" },
                ],
            currentBlocker: state.openclawFound
              ? { id: "config", title: "OpenClaw 配置", detail: "OpenClaw 已安装，下一步请填写 API Key、接口地址和模型。", level: "degraded", route: "/config", actionLabel: "去填写 API Key" }
              : { id: "install", title: "OpenClaw 安装", detail: "尚未检测到 OpenClaw CLI，请先完成安装。", level: "degraded", route: "/install?wizard=1", actionLabel: "去安装" },
            supportActions: state.openclawFound
              ? [
                  { id: "primary", label: "去填写 API Key", route: "/config", description: "先完成当前这一步，再继续下面的流程。" },
                  { id: "runbook", label: "查看完整步骤", route: "/runbook", description: "如果你想看完整流程顺序，再打开这里。" },
                  { id: "logs", label: "查看日志", route: "/logs", description: "只有安装或启动失败时，再来这里看错误日志。" },
                  { id: "settings", label: "打开设置", route: "/settings", description: "当桌面运行时有问题时，再来这里检查设置和环境。" },
                ]
              : [
                  { id: "primary", label: "去安装", route: "/install?wizard=1", description: "先完成当前这一步，再继续下面的流程。" },
                  { id: "runbook", label: "查看完整步骤", route: "/runbook", description: "如果你想看完整流程顺序，再打开这里。" },
                  { id: "logs", label: "查看日志", route: "/logs", description: "只有安装或启动失败时，再来这里看错误日志。" },
                  { id: "settings", label: "打开设置", route: "/settings", description: "当桌面运行时有问题时，再来这里检查设置和环境。" },
                ],
            banner: {
              mode: "live",
              tone: "warning",
              headline: state.openclawFound ? "下一步：填写 API Key" : "下一步：安装 OpenClaw",
              summary: state.openclawFound
                ? "这是第 2 步。把 API Key、接口地址和模型保存好，再启动 Gateway。"
                : "这是第 1 步。安装完成后，再去填写 API Key 并启动 Gateway。",
              primaryAction: {
                label: state.openclawFound ? "填写 API Key" : "开始安装 OpenClaw",
                route: state.openclawFound ? "/config" : "/install?wizard=1",
                description: state.openclawFound
                  ? "这是第 2 步。填好 API Key、接口地址和模型后再启动 Gateway。"
                  : "这是第 1 步。安装完成后，继续去填写 API Key。",
              },
              meta: [
                { label: "Runtime Mode", value: "tauri-runtime-available" },
                { label: "Tauri Shell", value: "detected" },
                { label: "Invoke Bridge", value: "detected" },
                { label: "Bridge Source", value: "official API bridge" },
                { label: "App Version", value: "2.0.4" },
                { label: "Platform", value: "windows" },
                { label: "Dashboard", value: state.openclawFound ? "http://127.0.0.1:18789" : "Unavailable" },
              ],
            },
          });

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
                dashboardUrl: state.openclawFound ? "http://127.0.0.1:18789" : "Unavailable",
                mode: "live",
                overall: state.openclawFound
                  ? {
                      level: "degraded",
                      headline: "下一步：填写 API Key",
                      summary: "这是第 2 步。把 API Key、接口地址和模型保存好，再启动 Gateway。",
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
                  ctaLabel: state.openclawFound ? "查看 Install" : "开始安装",
                  level: state.openclawFound ? "healthy" : "degraded",
                  detail: state.openclawFound ? "已检测到 OpenClaw 1.2.3" : "尚未检测到 OpenClaw CLI，请先完成安装。",
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
                  level: "degraded",
                  detail: "Gateway 当前未启动。",
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
                    id: state.openclawFound ? "configure-provider" : "install-openclaw",
                    label: state.openclawFound ? "填写 API Key" : "开始安装 OpenClaw",
                    route: state.openclawFound ? "/config" : "/install?wizard=1",
                    description: state.openclawFound
                      ? "这是第 2 步。填好 API Key、接口地址和模型后再启动 Gateway。"
                      : "这是第 1 步。安装完成后，继续去填写 API Key。",
                  },
                ],
              },
            };
          }

          if (command === "detect_env") {
            return {
              success: true,
              data: {
                platform: "windows",
                architecture: "x64",
                home_dir: "C:\\Users\\Tester",
                config_path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
                npm_found: true,
                npm_version: "10.9.0",
                openclaw_found: state.openclawFound,
                openclaw_path: state.openclawFound
                  ? "C:\\Users\\Tester\\AppData\\Roaming\\npm\\openclaw.cmd"
                  : null,
                openclaw_version: state.openclawFound ? "1.2.3" : null,
              },
            };
          }

          if (command === "install_openclaw") {
            state.installStartedAt = Date.now();
            if (installDelayMs && installDelayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, installDelayMs));
            }
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
                  program: "npm",
                  args: ["install", "-g", "openclaw@latest"],
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

          if (command === "read_logs") {
            const source = args?.source ?? "gateway";
            if (source === "install") {
              if (!state.installStartedAt) {
                return {
                  success: true,
                  data: { source, lines: [] },
                };
              }

              const elapsedMs = Date.now() - state.installStartedAt;
              const lines = [
                "[phase] stage=install-cli state=running detail=Installing OpenClaw CLI via npm global install.",
              ];

              if (elapsedMs >= 700) {
                lines.push("[phase] stage=install-cli state=success detail=OpenClaw CLI install finished.");
                lines.push("[stdout] added 12 packages in 3s");
                lines.push("[phase] stage=install-gateway state=running detail=Installing Gateway managed service.");
              }

              if (state.openclawFound) {
                lines.push("[phase] stage=install-gateway state=success detail=Gateway managed install finished.");
                lines.push("[phase] stage=verify state=success detail=Install flow completed.");
              }

              return {
                success: true,
                data: { source, lines },
              };
            }
            return {
              success: true,
              data: { source, lines: defaultLogLines[source as LogSource] ?? [] },
            };
          }

          if (command === "export_diagnostics") {
            const isBundle = Boolean((args as { archive?: boolean } | undefined)?.archive);
            return {
              success: true,
              data: {
                filePath: isBundle
                  ? "C:\\Temp\\clawdesk-diagnostics.zip"
                  : "C:\\Temp\\clawdesk-diagnostics.txt",
                format: isBundle ? "bundle" : "text",
                includedFiles: isBundle ? ["summary.txt", "manifest.json"] : ["summary.txt"],
              },
            };
          }

          return { success: true, data: {} };
        },
      },
    };
  }, { installDelayMs: options?.installDelayMs ?? 0 });
}

async function mockSettingsBackend(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      settings: {
        preferredInstallSource: "npm-global",
        diagnosticsDir: "C:\\Users\\Tester\\Diagnostics",
        logLineLimit: 1200,
        gatewayPollMs: 5000,
      },
    };

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string, args?: { content?: Record<string, unknown> }) => {
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
                ],
              },
            };
          }

          if (command === "read_app_settings") {
            return {
              success: true,
              data: {
                path: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json",
                exists: true,
                content: state.settings,
                modifiedAt: "2026-03-16T00:00:00.000Z",
              },
            };
          }

          if (command === "write_app_settings") {
            state.settings = {
              ...state.settings,
              ...(args?.content ?? {}),
            };
            return {
              success: true,
              data: {
                path: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json",
                backupPath: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json.bak",
                bytesWritten: 256,
              },
            };
          }

          return { success: true, data: {} };
        },
      },
    };
  });
}

test.describe("Install failure diagnostics", () => {
  test("keeps install flow read-only in browser preview mode", async ({ page }) => {
    await page.goto("/#/install");

    const envErrorBanner = page.getByText("Environment check failed").locator("..");
    await expect(envErrorBanner).toBeVisible();
    await expect(envErrorBanner.getByText("Local commands are unavailable in browser preview mode.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Desktop Runtime Required" })).toBeDisabled();
  });

  test("installs OpenClaw from the install page and refreshes environment state", async ({ page }) => {
    await mockInstallBackend(page);
    await page.goto("/#/install");

    await expect(page.getByText("OpenClaw Missing")).toBeVisible();
    await expect(page.getByText("Install steps")).toBeVisible();
    await page.getByRole("button", { name: "Install OpenClaw" }).click();

    await expect(page.getByRole("progressbar", { name: "Install progress" })).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByText("OpenClaw Installed")).toBeVisible();
    await expect(page.getByText("3. 安装 Gateway 托管服务", { exact: true })).toBeVisible();
  });

  test("opens install wizard and shows detected platform guidance", async ({ page }) => {
    await mockInstallBackend(page);
    await page.goto("/#/install");

    await page.getByRole("button", { name: "Open installer", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "OpenClaw installation wizard" });
    await expect(dialog.getByRole("heading", { name: "OpenClaw installation wizard" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Follow this order" })).toBeVisible();
    await expect(dialog.getByRole("article")).toHaveCount(3);
    await expect(dialog.getByText("Look at the right system card")).toBeVisible();
    await expect(dialog.getByText("Windows")).toBeVisible();
    await expect(dialog.getByText("macOS")).toBeVisible();
    await expect(dialog.getByText("Linux")).toBeVisible();
    await expect(dialog.getByText("Current system")).toBeVisible();
  });

  test("shows progress UI while the install command is still running", async ({ page }) => {
    await mockInstallBackend(page, { installDelayMs: 2600 });
    await page.goto("/#/install");

    await page.getByRole("button", { name: "Install OpenClaw" }).click();

    const progressBar = page.getByRole("progressbar", { name: "Install progress" });
    await expect(progressBar).toBeVisible();
    await expect(progressBar).toHaveAttribute("aria-valuenow", /^(?:[1-9]|[1-8]\d|9[0-5])$/);
    await expect(page.getByText(/^正在安装 OpenClaw CLI$/)).toBeVisible();
    await expect(page.getByText(/^正在安装 Gateway 托管服务$/)).toBeVisible();

    await expect(page.getByText("OpenClaw Installed")).toBeVisible();
    await expect(progressBar).toHaveAttribute("aria-valuenow", "100");
  });

  test("shows readable install error summary for missing install artifact", async ({ page }) => {
    await mockLogsBackend(page, installFailureFixture);
    await page.goto("/#/logs");

    await page.getByRole("button", { name: "安装日志" }).click();

    await expect(page.getByText("路径不存在")).toBeVisible();
  });

  test("exports diagnostics after install failure logs are loaded", async ({ page }) => {
    await mockLogsBackend(page, installFailureFixture);
    await page.goto("/#/logs");

    await page.getByRole("button", { name: "安装日志" }).click();
    await page.getByRole("button", { name: "Export diagnostics info" }).click();

    await expect(page.getByText("诊断信息已导出到 C:\\Temp\\clawdesk-diagnostics.txt")).toBeVisible();
  });

  test("exports diagnostics bundle from logs page", async ({ page }) => {
    await mockLogsBackend(page, installFailureFixture);
    await page.goto("/#/logs");

    await page.getByRole("button", { name: "安装日志" }).click();
    await page.getByRole("button", { name: "Export diagnostics ZIP" }).click();

    await expect(page.getByText("诊断包已导出到 C:\\Temp\\clawdesk-diagnostics.zip（共 2 个文件）")).toBeVisible();
  });

  test("saves app settings from settings page", async ({ page }) => {
    await mockSettingsBackend(page);
    await page.goto("/#/settings");

    await page.getByLabel("Log Line Limit").fill("800");
    await page.getByRole("button", { name: "Save settings" }).click();

    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  });
});
