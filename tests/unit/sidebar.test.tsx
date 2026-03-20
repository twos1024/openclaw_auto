/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../src/components/navigation/Sidebar";

const translationMap = vi.hoisted(
  (): Record<string, string> => ({
    "common:poweredBy": "powered by",
    "common:cancel": "Cancel",
    "navigation:agents": "Agents",
    "navigation:chat": "Chat",
    "navigation:dashboard": "Dashboard",
    "navigation:models": "Models",
    "navigation:channels": "Channels",
    "navigation:providers": "Providers",
    "navigation:cron": "Cron",
    "navigation:plugins": "Plugins",
    "navigation:skills": "Skills",
    "navigation:settings": "Settings",
    "navigation:feedback": "Feedback",
    "navigation:newChat": "New chat",
    "navigation:agentsCount": "Agents",
    "navigation:running": "Running",
    "navigation:buckets.today": "Today",
    "navigation:buckets.yesterday": "Yesterday",
    "navigation:buckets.thisWeek": "This week",
    "navigation:buckets.thisMonth": "This month",
    "navigation:buckets.older": "Older",
    "overview:sidebar.brand": "OpenClaw",
    "overview:sidebar.appDisplay": "OpenClaw Manager",
    "overview:sidebar.confirmDelete": "Confirm",
    "overview:sidebar.deleteSession": "Delete session",
  }),
);

const mockToggleSidebar = vi.hoisted(() => vi.fn());
const mockLoadSessions = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../src/store/useAgentStore", () => ({
  useAgentStore: (selector: (state: { agents: Array<{ status: string }> }) => unknown) =>
    selector({
      agents: [{ status: "active" }, { status: "idle" }],
    }),
}));

vi.mock("../../src/store/useChatStore", () => ({
  useChatStore: (selector: (state: {
    sessions: Array<{ key: string; label: string; lastActivity: number }>;
    currentSessionKey: string;
    switchSession: (key: string) => void;
    newSession: (agentId?: string) => void;
    deleteSession: (key: string) => Promise<void>;
    loadSessions: () => Promise<void>;
    messages: unknown[];
  }) => unknown) =>
    selector({
      sessions: [],
      currentSessionKey: "agent:main:1",
      switchSession: vi.fn(),
      newSession: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      loadSessions: mockLoadSessions,
      messages: [],
    }),
}));

vi.mock("../../src/store/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: { sidebarCollapsed: boolean; toggleSidebar: () => void }) => unknown) =>
    selector({
      sidebarCollapsed: false,
      toggleSidebar: mockToggleSidebar,
    }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translationMap[key] ?? key,
  }),
}));

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  mockToggleSidebar.mockClear();
  mockLoadSessions.mockClear();
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("Sidebar", () => {
  it("shows the Dashboard navigation item", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/dashboard"] },
          React.createElement(Sidebar),
        ),
      );
      await flush();
    });

    expect(container.textContent).toContain("Dashboard");

    const dashboardLink = Array.from(container.querySelectorAll("a")).find((element) =>
      element.textContent?.includes("Dashboard"),
    );
    expect(dashboardLink).toBeTruthy();
    expect(dashboardLink?.textContent).toBe("Dashboard");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
