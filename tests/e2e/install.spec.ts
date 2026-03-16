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

async function mockInstallBackend(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      openclawFound: false,
    };

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string, args?: { source?: string }) => {
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
            return {
              success: true,
              data: { source, lines: fixtures[source as LogSource] ?? [] },
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
  });
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
  test("installs OpenClaw from the install page and refreshes environment state", async ({ page }) => {
    await mockInstallBackend(page);
    await page.goto("/#/install");

    await expect(page.getByText("OpenClaw Missing")).toBeVisible();
    await expect(page.getByText("安装阶段")).toBeVisible();
    await page.getByRole("button", { name: "Install OpenClaw" }).click();

    await expect(page.getByText("安装完成", { exact: true })).toBeVisible();
    await expect(page.getByText("OpenClaw Installed")).toBeVisible();
    await expect(page.getByText("3. 安装 Gateway 托管服务", { exact: true })).toBeVisible();
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
    await page.getByRole("button", { name: "导出诊断信息" }).click();

    await expect(page.getByText("诊断信息已导出到 C:\\Temp\\clawdesk-diagnostics.txt")).toBeVisible();
  });

  test("exports diagnostics bundle from logs page", async ({ page }) => {
    await mockLogsBackend(page, installFailureFixture);
    await page.goto("/#/logs");

    await page.getByRole("button", { name: "安装日志" }).click();
    await page.getByRole("button", { name: "导出诊断包 ZIP" }).click();

    await expect(page.getByText("诊断包已导出到 C:\\Temp\\clawdesk-diagnostics.zip（共 2 个文件）")).toBeVisible();
  });

  test("saves app settings from settings page", async ({ page }) => {
    await mockSettingsBackend(page);
    await page.goto("/#/settings");

    await page.getByLabel("Log Line Limit").fill("800");
    await page.getByRole("button", { name: "Save Settings" }).click();

    await expect(page.getByText("设置已保存")).toBeVisible();
  });
});
