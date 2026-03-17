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

async function mockInstallBackend(page: Page, options?: { installDelayMs?: number }): Promise<void> {
  await page.addInitScript((payload) => {
    const installDelayMs = payload.installDelayMs as number | undefined;
    const state = {
      openclawFound: false,
      installStartedAt: 0,
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

    await expect(page.getByText("环境探测失败")).toBeVisible();
    await expect(page.getByText("浏览器预览模式")).toBeVisible();
    await expect(page.getByRole("button", { name: "Desktop Runtime Required" })).toBeDisabled();
  });

  test("installs OpenClaw from the install page and refreshes environment state", async ({ page }) => {
    await mockInstallBackend(page);
    await page.goto("/#/install");

    await expect(page.getByText("OpenClaw Missing")).toBeVisible();
    await expect(page.getByText("安装阶段")).toBeVisible();
    await page.getByRole("button", { name: "Install OpenClaw" }).click();

    await expect(page.getByRole("progressbar", { name: "安装进度" })).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByText("OpenClaw Installed")).toBeVisible();
    await expect(page.getByText("3. 安装 Gateway 托管服务", { exact: true })).toBeVisible();
  });

  test("opens install wizard and shows detected platform guidance", async ({ page }) => {
    await mockInstallBackend(page);
    await page.goto("/#/install");

    await page.getByRole("button", { name: "Open Install Wizard" }).click();
    const dialog = page.getByRole("dialog", { name: "Install Wizard" });
    await expect(dialog.getByRole("heading", { name: "Install Wizard" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Platform Guidance" })).toBeVisible();
    await expect(dialog.getByText("Windows", { exact: true })).toBeVisible();
  });

  test("shows progress UI while the install command is still running", async ({ page }) => {
    await mockInstallBackend(page, { installDelayMs: 2600 });
    await page.goto("/#/install");

    await page.getByRole("button", { name: "Install OpenClaw" }).click();

    const progressBar = page.getByRole("progressbar", { name: "安装进度" });
    await expect(progressBar).toBeVisible();
    await expect(progressBar).toHaveAttribute("aria-valuenow", /^(?:[1-9]|[1-8]\d|9[0-5])$/);
    await expect(page.getByText(/^当前阶段：安装 OpenClaw CLI$/)).toBeVisible();
    await expect(page.getByText(/^当前阶段：安装 Gateway 托管服务$/)).toBeVisible();

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
