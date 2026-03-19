import { expect, test, type Page } from "@playwright/test";

interface GatewayMockOptions {
  portConflict?: boolean;
}

async function mockGatewayBackend(page: Page, options: GatewayMockOptions = {}): Promise<void> {
  await page.addInitScript((payload) => {
    const shouldConflict = Boolean(payload.portConflict);
    const state = {
      running: false,
      port: 8080,
      address: "http://127.0.0.1:8080",
      pid: null as number | null,
      lastStartedAt: null as string | null,
    };

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      core: {
        invoke: async (command: string) => {
          if (command === "get_gateway_status") {
            return {
              success: true,
              data: {
                state: state.running ? "running" : "stopped",
                running: state.running,
                port: state.port,
                address: state.address,
                pid: state.pid,
                lastStartedAt: state.lastStartedAt,
                statusDetail: state.running ? "Gateway is running." : "Gateway is not running.",
                suggestion: state.running
                  ? "You can open dashboard or restart service if needed."
                  : "Click Start Gateway to launch OpenClaw service.",
                portConflictPort: null,
              },
            };
          }

          if (command === "start_gateway") {
            if (shouldConflict) {
              return {
                success: false,
                error: {
                  code: "E_PORT_CONFLICT",
                  message: "address already in use",
                  suggestion: "change port",
                  details: { port: 8080 },
                },
              };
            }

            state.running = true;
            state.pid = 43210;
            state.lastStartedAt = new Date().toISOString();
            return { success: true, data: {} };
          }

          if (command === "stop_gateway") {
            state.running = false;
            state.pid = null;
            return { success: true, data: {} };
          }

          if (command === "restart_gateway") {
            state.running = true;
            state.pid = 56789;
            state.lastStartedAt = new Date().toISOString();
            return { success: true, data: {} };
          }

          if (command === "open_dashboard") {
            return { success: true, data: {} };
          }

          return { success: true, data: {} };
        },
      },
    };
  }, options);
}

test.describe("Service gateway control", () => {
  test("starts gateway and shows running snapshot", async ({ page }) => {
    await mockGatewayBackend(page, { portConflict: false });
    await page.goto("/#/service");

    await page.getByRole("button", { name: "Start Gateway", exact: true }).click();

    await expect(page.getByText("Running: Yes")).toBeVisible();
  });

  test("shows explicit port conflict guidance when startup fails on occupied port", async ({ page }) => {
    await mockGatewayBackend(page, { portConflict: true });
    await page.goto("/#/service");

    await page.getByRole("button", { name: "Start Gateway", exact: true }).click();

    await expect(page.getByText("Port conflict")).toBeVisible();
  });
});
