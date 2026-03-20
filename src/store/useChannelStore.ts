import { create } from "zustand";
import { channelService } from "@/services/channelService";
import type { BackendError } from "@/types/api";
import type { Channel, CreateChannelPayload, UpdateChannelPayload } from "@/types";

interface ChannelStore {
  channels: Channel[];
  loading: boolean;
  saving: boolean;
  error: BackendError | null;
  lastFetchedAt: string | null;
  setChannels: (channels: Channel[]) => void;
  setError: (error: BackendError | null) => void;
  upsertChannel: (channel: Channel) => void;
  removeChannel: (id: string) => void;
  fetchChannels: () => Promise<void>;
  createChannel: (payload: CreateChannelPayload) => Promise<boolean>;
  patchChannel: (payload: UpdateChannelPayload) => Promise<boolean>;
  deleteChannel: (id: string) => Promise<boolean>;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channels: [],
  loading: false,
  saving: false,
  error: null,
  lastFetchedAt: null,
  setChannels: (channels) => set({ channels }),
  setError: (error) => set({ error }),
  upsertChannel: (channel) =>
    set((state) => {
      const next = state.channels.filter((item) => item.id !== channel.id);
      return { channels: [channel, ...next] };
    }),
  removeChannel: (id) =>
    set((state) => ({
      channels: state.channels.filter((channel) => channel.id !== id),
    })),
  fetchChannels: async () => {
    set({ loading: true, error: null });
    const result = await channelService.listChannels();
    if (result.ok && result.data) {
      set({
        channels: result.data,
        loading: false,
        error: null,
        lastFetchedAt: new Date().toISOString(),
      });
      return;
    }
    set({
      loading: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to load channels.",
        suggestion: "Retry after gateway check.",
      },
    });
  },
  createChannel: async (payload) => {
    set({ saving: true, error: null });
    const result = await channelService.createChannel(payload);
    if (result.ok && result.data) {
      set((state) => ({
        channels: [result.data!, ...state.channels],
        error: null,
        saving: false,
      }));
      return true;
    }
    set({
      saving: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to create channel.",
        suggestion: "Review fields and retry.",
      },
    });
    return false;
  },
  patchChannel: async (payload) => {
    set({ saving: true, error: null });
    const result = await channelService.updateChannel(payload);
    if (result.ok && result.data) {
      set((state) => ({
        channels: state.channels.map((channel) =>
          channel.id === result.data!.id ? result.data! : channel,
        ),
        error: null,
        saving: false,
      }));
      return true;
    }
    set({
      saving: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to update channel.",
        suggestion: "Review channel status and retry.",
      },
    });
    return false;
  },
  deleteChannel: async (id) => {
    const result = await channelService.deleteChannel(id);
    if (result.ok) {
      set((state) => ({
        channels: state.channels.filter((channel) => channel.id !== id),
        error: null,
      }));
      return true;
    }
    set({
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to delete channel.",
        suggestion: "Check references and retry.",
      },
    });
    return false;
  },
}));
