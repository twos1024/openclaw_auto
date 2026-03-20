import { afterEach, describe, expect, it, vi } from "vitest";
import { useChannelStore } from "../../src/store/useChannelStore";
import type { Channel, CreateChannelPayload } from "../../src/types";

const mockListChannels = vi.hoisted(() => vi.fn());
const mockCreateChannel = vi.hoisted(() => vi.fn());
const mockUpdateChannel = vi.hoisted(() => vi.fn());
const mockDeleteChannel = vi.hoisted(() => vi.fn());

vi.mock("@/services/channelService", () => ({
  channelService: {
    listChannels: mockListChannels,
    createChannel: mockCreateChannel,
    updateChannel: mockUpdateChannel,
    deleteChannel: mockDeleteChannel,
  },
}));

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: "channel-1",
    name: "Default Channel",
    type: "openclaw",
    status: "idle",
    connectionType: "none",
    description: "Main delivery channel",
    providerId: "provider-1",
    agentIds: ["agent-1"],
    updatedAt: "2026-03-20T00:00:00Z",
    ...overrides,
  };
}

function resetStore(): void {
  useChannelStore.setState({
    channels: [],
    loading: false,
    saving: false,
    error: null,
    lastFetchedAt: null,
  });
}

describe("useChannelStore", () => {
  afterEach(() => {
    resetStore();
    mockListChannels.mockReset();
    mockCreateChannel.mockReset();
    mockUpdateChannel.mockReset();
    mockDeleteChannel.mockReset();
  });

  it("clears stale errors after a successful fetch", async () => {
    const channel = makeChannel({ id: "channel-2", status: "connected" });
    useChannelStore.setState({
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockListChannels.mockResolvedValue({
      ok: true,
      data: [channel],
    });

    await useChannelStore.getState().fetchChannels();

    const state = useChannelStore.getState();
    expect(state.error).toBeNull();
    expect(state.channels).toEqual([channel]);
    expect(state.loading).toBe(false);
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it("updates an existing channel on patch and clears stale errors", async () => {
    useChannelStore.setState({
      channels: [makeChannel({ id: "channel-1", status: "idle" })],
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockUpdateChannel.mockResolvedValue({
      ok: true,
      data: makeChannel({ id: "channel-1", status: "connected" }),
    });

    const success = await useChannelStore.getState().patchChannel({
      id: "channel-1",
      status: "connected",
    });

    const state = useChannelStore.getState();
    expect(success).toBe(true);
    expect(state.channels[0]?.status).toBe("connected");
    expect(state.error).toBeNull();
    expect(state.saving).toBe(false);
  });

  it("does not insert a fake channel when creation fails", async () => {
    const existing = makeChannel();
    useChannelStore.setState({
      channels: [existing],
    });
    mockCreateChannel.mockResolvedValue({
      ok: false,
      error: {
        code: "E_CREATE_FAILED",
        message: "backend refused the payload",
        suggestion: "check channel fields",
      },
    });

    const payload: CreateChannelPayload = {
      name: "Broken Channel",
      type: "openclaw",
      connectionType: "none",
      description: "No-op",
      providerId: "provider-1",
      agentIds: ["agent-1"],
    };

    const success = await useChannelStore.getState().createChannel(payload);

    const state = useChannelStore.getState();
    expect(success).toBe(false);
    expect(state.channels).toEqual([existing]);
    expect(state.error?.code).toBe("E_CREATE_FAILED");
    expect(state.saving).toBe(false);
  });
});
