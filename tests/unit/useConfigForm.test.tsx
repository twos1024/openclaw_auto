/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { useConfigForm, type UseConfigFormResult } from "../../src/renderer/hooks/useConfigForm";
import { defaultConfigValues } from "../../src/renderer/types/config";

const mockReadConfig = vi.hoisted(() => vi.fn());
const mockSaveConfig = vi.hoisted(() => vi.fn());
const mockTestConnection = vi.hoisted(() => vi.fn());

vi.mock("../../src/renderer/services/configService", () => ({
  configService: {
    readConfig: mockReadConfig,
    saveConfig: mockSaveConfig,
    testConnection: mockTestConnection,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: UseConfigFormResult | null = null;

function Harness(): JSX.Element | null {
  latest = useConfigForm();
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

describe("useConfigForm", () => {
  afterEach(() => {
    latest = null;
    mockReadConfig.mockReset();
    mockSaveConfig.mockReset();
    mockTestConnection.mockReset();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("reloads config after a successful save so stale load warnings are cleared", async () => {
    mockReadConfig
      .mockResolvedValueOnce({
        values: defaultConfigValues,
        usedDefaultValues: true,
        issue: {
          code: "E_PATH_NOT_FOUND",
          message: "config missing",
          suggestion: "save a config file",
        },
      })
      .mockResolvedValueOnce({
        values: {
          ...defaultConfigValues,
          apiKey: "sk-live",
        },
        usedDefaultValues: false,
        path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
      });
    mockSaveConfig.mockResolvedValue({
      status: "success",
      detail: "Configuration saved successfully.",
      suggestion: "Restart gateway if model/provider settings changed.",
      savedPath: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
    });

    const { root, container } = await renderHarness();

    expect(latest?.loadIssue?.code).toBe("E_PATH_NOT_FOUND");
    expect(latest?.usedDefaultValues).toBe(true);

    await act(async () => {
      latest?.setField("apiKey", "sk-live");
    });

    await act(async () => {
      await latest?.saveConfig();
    });

    expect(mockReadConfig).toHaveBeenCalledTimes(2);
    expect(latest?.loadIssue).toBeNull();
    expect(latest?.usedDefaultValues).toBe(false);
    expect(latest?.loadedPath).toBe("C:\\Users\\Tester\\.openclaw\\openclaw.json");
    expect(latest?.form.apiKey).toBe("sk-live");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
