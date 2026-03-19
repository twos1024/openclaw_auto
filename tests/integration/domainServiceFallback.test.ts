/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { channelService } from "../../src/services/channelService";
import { cronService } from "../../src/services/cronService";
import { providerService } from "../../src/services/providerService";
import { gatewayFetch } from "../../src/lib/gateway-client";
import { invokeCommand } from "../../src/services/tauriClient";

vi.mock("../../src/lib/gateway-client", () => ({
  gatewayFetch: vi.fn(),
}));

vi.mock("../../src/services/tauriClient", () => ({
  invokeCommand: vi.fn(),
}));

const mockedGatewayFetch = vi.mocked(gatewayFetch);
const mockedInvokeCommand = vi.mocked(invokeCommand);

describe("domain services fallback", () => {
  beforeEach(() => {
    mockedGatewayFetch.mockReset();
    mockedInvokeCommand.mockReset();
  });

  it("prefers direct gateway HTTP when channel list succeeds", async () => {
    mockedGatewayFetch.mockResolvedValueOnce({
      channels: [
        {
          id: "ch-1",
          name: "Main",
          type: "openclaw",
          status: "connected",
          connectionType: "oauth",
          agentIds: ["a-1"],
          updatedAt: "2026-03-20T00:00:00Z",
        },
      ],
    });

    const result = await channelService.listChannels();

    expect(result.ok).toBe(true);
    expect(result.data?.[0].id).toBe("ch-1");
    expect(mockedInvokeCommand).not.toHaveBeenCalled();
  });

  it("falls back to IPC for channel list when gateway HTTP fails", async () => {
    mockedGatewayFetch.mockRejectedValue(new Error("Gateway is not running"));
    mockedInvokeCommand.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: "ch-2",
          name: "IPC Channel",
          type: "custom",
          status: "idle",
          connectionType: "none",
          agentIds: [],
          updatedAt: "2026-03-20T00:00:00Z",
        },
      ],
    });

    const result = await channelService.listChannels();

    expect(result.ok).toBe(true);
    expect(result.data?.[0].name).toBe("IPC Channel");
    expect(mockedInvokeCommand).toHaveBeenCalledWith("list_channels");
  });

  it("falls back to IPC provider validation when HTTP endpoints fail", async () => {
    mockedGatewayFetch.mockRejectedValue(new Error("404"));
    mockedInvokeCommand.mockResolvedValueOnce({
      success: true,
      data: {
        valid: true,
        detail: "Provider validation succeeded.",
      },
    });

    const result = await providerService.validateProvider("provider-1");

    expect(result.ok).toBe(true);
    expect(result.data?.valid).toBe(true);
    expect(mockedInvokeCommand).toHaveBeenCalledWith("validate_provider", { id: "provider-1" });
  });

  it("falls back to IPC cron trigger when HTTP trigger fails", async () => {
    mockedGatewayFetch.mockRejectedValue(new Error("network error"));
    mockedInvokeCommand.mockResolvedValueOnce({
      success: true,
      data: {
        triggered: true,
        id: "job-1",
        detail: "Cron job triggered.",
      },
    });

    const result = await cronService.triggerCronJob("job-1");

    expect(result.ok).toBe(true);
    expect(result.data?.triggered).toBe(true);
    expect(mockedInvokeCommand).toHaveBeenCalledWith("trigger_cron_job", { id: "job-1" });
  });
});
