/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/components/layout/AppShell";

const translationMap = vi.hoisted(
  (): Record<string, string> => ({
    "navigation:dashboard": "Dashboard",
    "navigation:setupAssistant": "Open Setup Assistant",
  }),
);

vi.mock("../../src/components/navigation/Sidebar", () => ({
  Sidebar: () => React.createElement("aside", { "data-testid": "sidebar" }, "Sidebar"),
}));

vi.mock("../../src/components/dialogs/SetupAssistantDialog", () => ({
  SetupAssistantDialog: ({ open }: { open: boolean }) =>
    React.createElement(
      "div",
      { "data-testid": "setup-assistant-dialog" },
      open ? "open" : "closed",
    ),
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
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("AppShell", () => {
  it("shows the shell title and opens the setup assistant from the top bar", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: React.createElement(AppShell),
          children: [
            {
              path: "dashboard",
              element: React.createElement("div", { "data-testid": "page" }, "Dashboard page"),
            },
          ],
        },
      ],
      { initialEntries: ["/dashboard"] },
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(RouterProvider, { router }));
      await flush();
    });

    expect(container.querySelector("[data-testid='sidebar']")).toBeTruthy();
    expect(container.querySelector("h1")?.textContent).toBe("Dashboard");
    expect(container.querySelector("[data-testid='setup-assistant-dialog']")?.textContent).toBe("closed");

    const button = Array.from(container.querySelectorAll("button")).find((element) =>
      element.textContent?.includes("Open Setup Assistant"),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      (button as HTMLButtonElement).click();
      await flush();
    });

    expect(container.querySelector("[data-testid='setup-assistant-dialog']")?.textContent).toBe("open");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
