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

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string) => {
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

  test("opens setup assistant and routes to install when setup is incomplete", async ({ page }) => {
    await mockWorkspaceBackend(page, { running: false });
    await page.goto("/#/");

    await page.getByRole("button", { name: "Setup Assistant" }).click();
    await expect(page.getByRole("heading", { name: "Setup Assistant" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Launch Check" })).toBeVisible();
    await expect(page.getByText("Install OpenClaw")).toBeVisible();

    await page.getByRole("link", { name: "Continue Setup" }).click();
    await expect(page).toHaveURL(/#\/install\?wizard=1$/);
    await expect(page.getByRole("dialog", { name: "Install Wizard" })).toBeVisible();
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
});
