/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { configService } from "../../src/renderer/services/configService";
import { defaultConfigValues, type ConfigFormValues } from "../../src/renderer/types/config";

type InvokeHandler = (payload?: Record<string, unknown>) => unknown | Promise<unknown>;

function createInvokeMock(handlers: Record<string, InvokeHandler>) {
  const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>) => {
    const handler = handlers[command];
    if (!handler) {
      throw new Error(`Unhandled invoke command in test: ${command}`);
    }
    return handler(payload);
  });

  Object.defineProperty(window, "api", {
    configurable: true,
    writable: true,
    value: { invoke, on: vi.fn(), removeListener: vi.fn() },
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
    Object.defineProperty(window, "api", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "electron", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("reads the official OpenClaw config shape into the form model", async () => {
    createInvokeMock({
      read_openclaw_config: async () => ({
        success: true,
        data: {
          path: "C:\\Users\\Tester\\.openclaw\\openclaw.json",
          size_bytes: 512,
          content: {
            models: {
              providers: {
                "custom-proxy": {
                  baseUrl: "https://api.deepseek.com/v1",
                  apiKey: "sk-live",
                  api: "openai-completions",
                  models: [{ id: "deepseek-chat", name: "deepseek-chat" }],
                },
              },
            },
            agents: {
              defaults: {
                model: { primary: "custom-proxy/deepseek-chat" },
                models: {
                  "custom-proxy/deepseek-chat": {
                    params: {
                      temperature: 0.2,
                      maxTokens: 1024,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    const result = await configService.readConfig();

    expect(result.path).toBe("C:\\Users\\Tester\\.openclaw\\openclaw.json");
    expect(result.values).toMatchObject({
      providerType: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-live",
      model: "deepseek-chat",
      temperature: 0.2,
      maxTokens: 1024,
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

  it("writes config and returns backup metadata from the backend", async () => {
    const invoke = createInvokeMock({
      write_openclaw_config: async () => ({
        success: true,
        data: {
          path: "C:\\OpenClaw\\config.json",
          backup_path: "C:\\OpenClaw\\config.json.bak",
          bytes_written: 128,
        },
      }),
    });

    const result = await configService.saveConfig(createOpenAiFixture());

    expect(invoke.mock.calls.map((call) => call[0])).toEqual(["write_openclaw_config"]);
    expect(result.status).toBe("success");
    expect(result.backupPath).toBe("C:\\OpenClaw\\config.json.bak");
  });

  it("returns failure when the write step fails", async () => {
    const invoke = createInvokeMock({
      write_openclaw_config: async () => ({
        success: false,
        error: {
          code: "E_CONFIG_WRITE_FAILED",
          message: "write failed",
          suggestion: "check permission",
        },
      }),
    });

    const result = await configService.saveConfig(createOpenAiFixture());

    expect(result.code).toBe("E_CONFIG_WRITE_FAILED");
    expect(invoke.mock.calls.map((call) => call[0])).toEqual(["write_openclaw_config"]);
  });

  it("returns API key guidance when openai-compatible connection test gets HTTP 401", async () => {
    const fetchMock = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await configService.testConnection(createOpenAiFixture({ apiKey: "sk-bad" }));

    expect(result.code).toBe("HTTP_401");
    expect(result.suggestion).toContain("API key");
  });
});
