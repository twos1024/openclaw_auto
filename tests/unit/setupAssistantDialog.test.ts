/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { SetupAssistantDialog } from "../../src/components/dialogs/SetupAssistantDialog";
import { buildRunbookModel } from "../../src/services/runbookService";
import type { OverviewStatus } from "../../src/types/status";

const mockUseSetupAssistant = vi.hoisted(() => vi.fn());

vi.mock("../../src/hooks/useSetupAssistant", () => ({
  useSetupAssistant: mockUseSetupAssistant,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createStatus(overrides?: Partial<OverviewStatus>): OverviewStatus {
  return {
    appVersion: "0.2.0",
    platform: "windows",
    dashboardUrl: "http://127.0.0.1:18789",
    mode: "runtime-unavailable",
    overall: {
      level: "degraded",
      headline: "Setup required",
      summary: "Complete install and startup.",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    runtime: {
      id: "runtime",
      title: "Runtime",
      route: "/settings",
      ctaLabel: "Inspect Runtime",
      level: "offline",
      detail: "Frontend is not connected to the invoke bridge.",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    install: {
      id: "install",
      title: "Install",
      route: "/install",
      ctaLabel: "Install",
      level: "offline",
      detail: "Install missing",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    config: {
      id: "config",
      title: "Config",
      route: "/config",
      ctaLabel: "Config",
      level: "offline",
      detail: "Config missing",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    service: {
      id: "service",
      title: "Service",
      route: "/service",
      ctaLabel: "Service",
      level: "offline",
      detail: "Gateway stopped",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    settings: {
      id: "settings",
      title: "Settings",
      route: "/settings",
      ctaLabel: "Settings",
      level: "healthy",
      detail: "Settings loaded",
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
    nextActions: [],
    ...overrides,
  };
}

afterEach(() => {
  mockUseSetupAssistant.mockReset();
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("SetupAssistantDialog", () => {
  it("routes the footer CTA to the active blocker when runtime is unavailable", () => {
    const model = buildRunbookModel(createStatus());
    mockUseSetupAssistant.mockReturnValue({
      model,
      isLoading: false,
      errorText: null,
      refresh: vi.fn(),
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/"] },
          React.createElement(SetupAssistantDialog, {
            open: true,
            onClose: vi.fn(),
          }),
        ),
      );
    });

    const footerLink = Array.from(container.querySelectorAll("a[href='/settings']")).find(
      (element) => element.textContent === "修复运行时",
    );
    expect(footerLink).not.toBeNull();
    expect(footerLink?.textContent).toBe("修复运行时");
    expect(container.textContent).toContain("当前先处理：修复桌面运行时桥接");
    expect(container.textContent).toContain("Launch Checks");
    expect(container.textContent).toContain("安装检查");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
