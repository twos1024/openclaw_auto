/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { useSettingsForm, type UseSettingsFormResult } from "../../src/hooks/useSettingsForm";

const mockReadSettings = vi.hoisted(() => vi.fn());
const mockSaveSettings = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/settingsService", () => ({
  settingsService: {
    readSettings: mockReadSettings,
    saveSettings: mockSaveSettings,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: UseSettingsFormResult | null = null;

function Harness(): JSX.Element | null {
  latest = useSettingsForm();
  return null;
}

async function renderHarness(): Promise<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(Harness));
    await Promise.resolve();
  });

  return { root, container };
}

describe("useSettingsForm", () => {
  afterEach(() => {
    latest = null;
    mockReadSettings.mockReset();
    mockSaveSettings.mockReset();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("preserves the user's draft when saving settings fails", async () => {
    mockReadSettings.mockResolvedValue({
      values: {
        preferredInstallSource: "npm-global",
        diagnosticsDir: "C:\\Users\\Tester\\Diagnostics",
        logLineLimit: 1200,
        gatewayPollMs: 5000,
      },
      exists: true,
      path: "C:\\Users\\Tester\\AppData\\Roaming\\ClawDesk\\settings.json",
      modifiedAt: "2026-03-19T00:00:00.000Z",
    });
    mockSaveSettings.mockResolvedValue({
      status: "error",
      detail: "permission denied",
      suggestion: "check filesystem permissions",
      code: "E_PERMISSION_DENIED",
    });

    const { root, container } = await renderHarness();

    await act(async () => {
      latest?.setField("diagnosticsDir", "D:\\Temp\\ClawDesk");
    });

    await act(async () => {
      await latest?.saveSettings();
    });

    expect(latest?.form.diagnosticsDir).toBe("D:\\Temp\\ClawDesk");
    expect(latest?.saveResult).toMatchObject({
      status: "error",
      detail: "permission denied",
    });
    expect(mockReadSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
