/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { configService } from "../../src/services/configService";
import { defaultConfigValues, type ConfigFormValues } from "../../src/types/config";

type InvokeHandler = (payload?: Record<string, unknown>) => unknown | Promise<unknown>;

function createInvokeMock(handlers: Record<string, InvokeHandler>) {
  const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>) => {
    const handler = handlers[command];
    if (!handler) {
      throw new Error(`Unhandled invoke command in test: ${command}`);
    }
    return handler(payload);
  });

  Object.defineProperty(window, "__TAURI__", {
    configurable: true,
    writable: true,
    value: { core: { invoke } },
  });

  return invoke;
}

function createOpenAiFixture(overrides: Partial<ConfigFormValues> = {}): ConfigFormValues {
  return {
    ...defaultConfigValues,
    providerType: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    timeout: 15000,
    maxTokens: 2048,
    temperature: 0.7,
    ...overrides,
  };
}

describe("configService integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "__TAURI__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("returns default values with explicit issue metadata when backend reports corrupted config", async () => {
    createInvokeMock({
      read_openclaw_config: async () => ({
        success: false,
        error: {
          code: "E_CONFIG_CORRUPTED",
          message: "invalid json",
          suggestion: "restore backup",
        },
      }),
    });

    const result = await configService.readConfig();

    expect(result.values).toEqual(defaultConfigValues);
    expect(result.usedDefaultValues).toBe(true);
    expect(result.issue?.code).toBe("E_CONFIG_CORRUPTED");
  });

  it("backs up before writing when saveConfig succeeds", async () => {
    const invoke = createInvokeMock({
      backup_openclaw_config: async () => ({
        success: true,
        data: { path: "C:\\OpenClaw\\config.json", backup_path: "C:\\OpenClaw\\config.json.bak" },
      }),
      write_openclaw_config: async () => ({
        success: true,
        data: { path: "C:\\OpenClaw\\config.json", bytes_written: 128 },
      }),
    });

    const result = await configService.saveConfig(createOpenAiFixture());

    expect(invoke.mock.calls.map((call) => call[0])).toEqual([
      "backup_openclaw_config",
      "write_openclaw_config",
    ]);
    expect(result.status).toBe("success");
  });

  it("returns failure immediately when backup step fails", async () => {
    const invoke = createInvokeMock({
      backup_openclaw_config: async () => ({
        success: false,
        error: {
          code: "E_CONFIG_BACKUP_FAILED",
          message: "backup failed",
          suggestion: "check permission",
        },
      }),
      write_openclaw_config: async () => ({
        success: true,
        data: { path: "C:\\OpenClaw\\config.json", bytes_written: 128 },
      }),
    });

    const result = await configService.saveConfig(createOpenAiFixture());

    expect(result.code).toBe("E_CONFIG_BACKUP_FAILED");
    expect(invoke.mock.calls.map((call) => call[0])).toEqual(["backup_openclaw_config"]);
  });

  it("returns API key guidance when openai-compatible connection test gets HTTP 401", async () => {
    const fetchMock = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await configService.testConnection(createOpenAiFixture({ apiKey: "sk-bad" }));

    expect(result.code).toBe("HTTP_401");
    expect(result.suggestion).toContain("API key");
  });
});
