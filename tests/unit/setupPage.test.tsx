/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { SetupPage } from "../../src/pages/SetupPage";

const mockUseInstallFlow = vi.hoisted(() => vi.fn());
const mockUseConfigForm = vi.hoisted(() => vi.fn());
const mockGetGatewayStatus = vi.hoisted(() => vi.fn());
const mockSetSetupComplete = vi.hoisted(() => vi.fn());
const mockSetProviderType = vi.hoisted(() => vi.fn());

const translationMap = vi.hoisted(
  (): Record<string, string> => ({
    "page.title": "Initial Setup",
    "page.description": "Check the machine, install OpenClaw, configure the API key, and start Gateway.",
    "page.badges.completed": "Completed",
    "page.badges.fresh": "First Run",
    "page.stepIndex": "Step {{current}} / {{total}}",
    "steps.environment": "Environment",
    "steps.install": "Install",
    "steps.config": "Configuration",
    "steps.gateway": "Gateway",
    "steps.complete": "Complete",
    "stepStates.done": "Done",
    "stepStates.current": "Current",
    "stepStates.pending": "Pending",
    "environment.title": "Check the environment",
    "environment.description": "Environment overview.",
    "environment.labels.platform": "Platform",
    "environment.labels.node": "Node.js",
    "environment.labels.npm": "npm",
    "environment.labels.openclaw": "OpenClaw",
    "environment.labels.configPath": "Config path",
    "environment.values.waiting": "Waiting",
    "environment.values.installed": "Installed",
    "environment.values.missing": "Missing",
    "environment.actions.refresh": "Refresh Environment",
    "environment.actions.next": "Continue to Install",
    "environment.actions.nextShortcut": "Skip to Install",
    "environment.pills.nodeReady": "Node.js ready",
    "environment.pills.nodeMissing": "Node.js missing",
    "environment.pills.npmReady": "npm ready",
    "environment.pills.npmMissing": "npm missing",
    "environment.pills.openclawReady": "OpenClaw ready",
    "environment.pills.openclawMissing": "OpenClaw missing",
    "install.title": "Install OpenClaw",
    "install.description": "Install the CLI and gateway.",
    "install.notice.title": "Official bootstrap",
    "install.notice.description": "Installer can patch runtime dependencies.",
    "install.actions.install": "Install OpenClaw",
    "install.actions.skipToConfig": "Skip to Configuration",
    "config.title": "Configure the provider",
    "config.description": "Enter the provider details.",
    "config.defaultValues": "Default values in use.",
    "config.loadedPath": "Loaded config: ",
    "config.actions.test": "Test Connection",
    "config.actions.save": "Save & Continue",
    "config.actions.next": "Continue to Gateway",
    "gateway.title": "Start Gateway",
    "gateway.description": "Start and verify Gateway.",
    "gateway.status.running": "Running",
    "gateway.status.pending": "Pending",
    "gateway.status.idle": "Gateway has not started yet.",
    "gateway.status.helper": "After Gateway starts, the dashboard becomes available.",
    "gateway.meta.port": "Port {{value}}",
    "gateway.errors.startFailed": "Failed to start Gateway.",
    "gateway.errors.statusFailed": "Failed to fetch Gateway status.",
    "gateway.actions.start": "Start Gateway",
    "gateway.actions.openDashboard": "Open Dashboard",
    "gateway.actions.next": "Continue",
    "complete.title": "Setup complete",
    "complete.description": "OpenClaw is installed, configured, and Gateway is ready.",
    "complete.summaryTitle": "What is ready now",
    "complete.summary": "You can open the dashboard and continue into the workspace.",
    "complete.badges.installReady": "Installer finished",
    "complete.badges.configReady": "Config saved",
    "complete.badges.gatewayReady": "Gateway ready",
    "complete.actions.openDashboard": "Open Dashboard",
    "complete.actions.enterApp": "Enter App",
    "actions.previous": "Previous",
  }),
);

vi.mock("../../src/hooks/useInstallFlow", () => ({
  useInstallFlow: mockUseInstallFlow,
}));

vi.mock("../../src/hooks/useConfigForm", () => ({
  useConfigForm: mockUseConfigForm,
}));

vi.mock("../../src/services/serviceService", () => ({
  serviceService: {
    getGatewayStatus: mockGetGatewayStatus,
    startGateway: vi.fn(),
    openDashboard: vi.fn(),
  },
}));

vi.mock("../../src/store/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: { setupComplete: boolean; setSetupComplete: typeof mockSetSetupComplete }) => unknown) =>
    selector({
      setupComplete: false,
      setSetupComplete: mockSetSetupComplete,
    }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const value = translationMap[key] ?? key;
      if (!options) return value;
      return value.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options[token] ?? ""));
    },
  }),
}));

vi.mock("../../src/components/config/OpenAIConfigForm", () => ({
  OpenAIConfigForm: () => React.createElement("div", { "data-testid": "config-form" }, "Config form"),
}));

vi.mock("../../src/components/install/InstallIssueCard", () => ({
  InstallIssueCard: () => null,
}));

vi.mock("../../src/components/install/InstallPhaseTimeline", () => ({
  InstallPhaseTimeline: () => null,
}));

vi.mock("../../src/components/install/InstallProgressCard", () => ({
  InstallProgressCard: () => null,
}));

vi.mock("../../src/components/install/InstallResultCard", () => ({
  InstallResultCard: () => null,
}));

vi.mock("../../src/components/runbook/RunbookContextPanel", () => ({
  RunbookContextPanel: () => null,
}));

vi.mock("../../src/components/common/NoticeBanner", () => ({
  NoticeBanner: () => null,
}));

vi.mock("../../src/components/common/PageHero", () => ({
  PageHero: () => null,
}));

vi.mock("../../src/components/install/PlatformGuidancePanel", () => ({
  PlatformGuidancePanel: () => null,
}));

const installEnvironment = {
  platform: "linux",
  architecture: "x64",
  homeDir: "/home/user",
  configPath: "/home/user/.config/openclaw/openclaw.json",
  nodeFound: true,
  nodeVersion: "v22.0.0",
  nodePath: "/usr/bin/node",
  npmFound: true,
  npmVersion: "10.0.0",
  openclawFound: true,
  openclawPath: "/usr/local/bin/openclaw",
  openclawVersion: "1.2.3",
};

const installResult = {
  status: "success",
  stage: "verify",
  detail: "Install complete.",
  suggestion: "Continue setup.",
  phases: [],
};

const saveResult = {
  status: "success",
  detail: "Config saved.",
  suggestion: "Continue setup.",
};

function resetMocks(): void {
  mockUseInstallFlow.mockReturnValue({
    environment: installEnvironment,
    envError: null,
    installResult,
    phases: [],
    installProgress: {
      visible: false,
      percent: 100,
      tone: "success",
      activePhaseId: null,
      headline: "",
      detail: "",
      hint: "",
    },
    isLoading: false,
    isInstalling: false,
    refreshEnvironment: vi.fn(),
    installOpenClaw: vi.fn(),
  });

  mockUseConfigForm.mockReturnValue({
    form: {
      providerType: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      timeout: 30000,
      maxTokens: 4096,
      temperature: 0.7,
    },
    errors: {},
    isLoading: false,
    isTesting: false,
    isSaving: false,
    loadIssue: null,
    loadedPath: "/home/user/.config/openclaw/openclaw.json",
    usedDefaultValues: false,
    testResult: null,
    saveResult,
    setField: vi.fn(),
    setProviderType: mockSetProviderType,
    applyCompatiblePreset: vi.fn(),
    testConnection: vi.fn(),
    saveConfig: vi.fn(),
    resetToDefault: vi.fn(),
    reload: vi.fn(),
  });

  mockGetGatewayStatus.mockResolvedValue({
    state: "running",
    running: true,
    port: 8080,
    address: "http://127.0.0.1:8080",
    pid: 12345,
    lastStartedAt: "2026-03-21T00:00:00.000Z",
    statusDetail: "Gateway is running.",
    suggestion: "Gateway is ready.",
    portConflictPort: null,
  });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  mockGetGatewayStatus.mockReset();
  mockSetSetupComplete.mockReset();
  mockSetProviderType.mockReset();
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("SetupPage", () => {
  it("refreshes gateway status when entering the gateway step and advances to completion when already running", async () => {
    resetMocks();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/setup"] },
          React.createElement(SetupPage),
        ),
      );
      await flush();
    });

    const clickButton = async (label: string) => {
      const button = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.includes(label));
      expect(button).toBeTruthy();
      await act(async () => {
        (button as HTMLButtonElement).click();
        await flush();
      });
    };

    await clickButton("Continue to Install");
    await clickButton("Skip to Configuration");
    await clickButton("Continue to Gateway");
    await act(async () => {
      await flush();
      await flush();
    });

    expect(mockGetGatewayStatus).toHaveBeenCalled();
    expect(container.textContent).toContain("Setup complete");
    expect(container.textContent).toContain("Gateway ready");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
