/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { SetupAssistantDialog } from "../../src/components/dialogs/SetupAssistantDialog";
import type { RunbookModel } from "../../src/types/workspace";

const mockUseSetupAssistant = vi.hoisted(() => vi.fn());

vi.mock("../../src/hooks/useSetupAssistant", () => ({
  useSetupAssistant: mockUseSetupAssistant,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createRunbookModel(overrides?: Partial<RunbookModel>): RunbookModel {
  return {
    headline: "下一步：修复桌面运行时桥接",
    summary: "一次只做一件事。完成当前步骤后，再继续下一步。",
    primaryRoute: "/settings",
    primaryLabel: "修复运行时",
    lastCheckedAt: "2026-03-17T00:00:00.000Z",
    overallLevel: "offline",
    launchChecks: [
      {
        id: "install",
        title: "安装检查",
        level: "offline",
        detail: "Install missing",
        route: "/install?wizard=1",
      },
      {
        id: "config",
        title: "配置检查",
        level: "offline",
        detail: "Config missing",
        route: "/config",
      },
      {
        id: "service",
        title: "服务检查",
        level: "offline",
        detail: "Gateway stopped",
        route: "/service",
      },
      {
        id: "runtime",
        title: "运行时检查",
        level: "offline",
        detail: "Frontend is not connected to the invoke bridge.",
        route: "/settings",
      },
      {
        id: "settings",
        title: "设置检查",
        level: "healthy",
        detail: "Settings loaded",
        route: "/settings",
      },
    ],
    steps: [
      {
        id: "install",
        title: "安装 OpenClaw",
        description: "Install missing",
        route: "/install?wizard=1",
        actionLabel: "去安装",
        status: "blocked",
      },
      {
        id: "config",
        title: "填写 API Key",
        description: "Config missing",
        route: "/config",
        actionLabel: "去填写 API Key",
        status: "blocked",
      },
      {
        id: "service",
        title: "启动 Gateway",
        description: "Gateway stopped",
        route: "/service",
        actionLabel: "去启动 Gateway",
        status: "blocked",
      },
      {
        id: "dashboard",
        title: "开始使用 OpenClaw",
        description: "需要先启动 Gateway，才能打开 Dashboard 正常使用。",
        route: "/dashboard",
        actionLabel: "打开 Dashboard",
        status: "blocked",
      },
    ],
    blockers: [
      {
        id: "runtime-bridge",
        title: "修复桌面运行时桥接",
        detail: "Frontend is not connected to the invoke bridge.",
        level: "offline",
        route: "/settings",
        actionLabel: "修复运行时",
      },
      {
        id: "install",
        title: "OpenClaw 安装",
        detail: "Install missing",
        level: "offline",
        route: "/install?wizard=1",
        actionLabel: "去安装",
      },
    ],
    currentBlocker: {
      id: "runtime-bridge",
      title: "修复桌面运行时桥接",
      detail: "Frontend is not connected to the invoke bridge.",
      level: "offline",
      route: "/settings",
      actionLabel: "修复运行时",
    },
    supportActions: [
      {
        id: "primary",
        label: "修复运行时",
        route: "/settings",
        description: "先完成当前这一步，再继续下面的流程。",
      },
      {
        id: "runbook",
        label: "查看完整步骤",
        route: "/runbook",
        description: "如果你想看完整流程顺序，再打开这里。",
      },
      {
        id: "logs",
        label: "查看日志",
        route: "/logs",
        description: "只有安装或启动失败时，再来这里看错误日志。",
      },
    ],
    banner: {
      mode: "runtime-unavailable",
      tone: "error",
      headline: "Desktop Runtime Bridge Unavailable",
      summary: "当前已进入桌面窗口，但前端未连上 Tauri 命令桥。",
      primaryAction: {
        label: "先修复桌面运行时",
        route: "/settings",
        description: "先让桌面命令桥恢复正常，再继续安装、配置 API Key 和启动 Gateway。",
      },
      meta: [
        { label: "Runtime Mode", value: "Desktop Runtime Unavailable" },
        { label: "Tauri Shell", value: "detected" },
        { label: "Invoke Bridge", value: "missing" },
        { label: "Bridge Source", value: "missing" },
      ],
    },
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
    const model = createRunbookModel();
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
