import { expect, test } from "@playwright/test";

test.describe("Runbook workspace", () => {
  test("shows the new runbook route and current blocker guidance", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
        core: {
          invoke: async (command: string) => {
            if (command === "detect_env") {
              return {
                success: true,
                data: {
                  platform: "windows",
                  npm_found: true,
                  npm_version: "10.9.0",
                  openclaw_found: false,
                  openclaw_version: null,
                  config_path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
                },
              };
            }

            if (command === "get_gateway_status") {
              return {
                success: false,
                error: {
                  code: "E_GATEWAY_NOT_RUNNING",
                  message: "Gateway is not running.",
                  suggestion: "Start Gateway from the service page.",
                },
              };
            }

            if (command === "read_openclaw_config") {
              return {
                success: false,
                error: {
                  code: "E_PATH_NOT_FOUND",
                  message: "Config file not found.",
                  suggestion: "Save config first.",
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
    await expect(page.getByText("Resolve the current blocker before continuing.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Resolve Install", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Launch Checks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Guided Workflow" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Logs/i })).toBeVisible();
  });
});
