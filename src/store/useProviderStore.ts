import { create } from "zustand";
import { providerService } from "@/services/providerService";
import type { BackendError } from "@/types/api";
import type { CreateProviderPayload, Provider, UpdateProviderPayload } from "@/types";

interface ProviderStore {
  providers: Provider[];
  loading: boolean;
  saving: boolean;
  error: BackendError | null;
  validatingId: string | null;
  lastFetchedAt: string | null;
  setProviders: (providers: Provider[]) => void;
  setError: (error: BackendError | null) => void;
  upsertProvider: (provider: Provider) => void;
  removeProvider: (id: string) => void;
  fetchProviders: () => Promise<void>;
  createProvider: (payload: CreateProviderPayload) => Promise<boolean>;
  patchProvider: (payload: UpdateProviderPayload) => Promise<boolean>;
  deleteProvider: (id: string) => Promise<boolean>;
  validateProvider: (id: string) => Promise<boolean>;
}

export const useProviderStore = create<ProviderStore>((set) => ({
  providers: [],
  loading: false,
  saving: false,
  error: null,
  validatingId: null,
  lastFetchedAt: null,
  setProviders: (providers) => set({ providers }),
  setError: (error) => set({ error }),
  upsertProvider: (provider) =>
    set((state) => {
      const next = state.providers.filter((item) => item.id !== provider.id);
      return { providers: [provider, ...next] };
    }),
  removeProvider: (id) =>
    set((state) => ({
      providers: state.providers.filter((provider) => provider.id !== id),
    })),
  fetchProviders: async () => {
    set({ loading: true, error: null });
    const result = await providerService.listProviders();
    if (result.ok && result.data) {
      set({
        providers: result.data,
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
        message: "Failed to load providers.",
        suggestion: "Retry after gateway status check.",
      },
    });
  },
  createProvider: async (payload) => {
    set({ saving: true, error: null });
    const result = await providerService.createProvider(payload);
    if (result.ok && result.data) {
      set((state) => ({
        providers: [result.data!, ...state.providers],
        error: null,
        saving: false,
      }));
      return true;
    }
    set({
      saving: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to create provider.",
        suggestion: "Check credentials and retry.",
      },
    });
    return false;
  },
  patchProvider: async (payload) => {
    set({ saving: true, error: null });
    const result = await providerService.updateProvider(payload);
    if (result.ok && result.data) {
      set((state) => ({
        providers: state.providers.map((provider) =>
          provider.id === result.data!.id ? result.data! : provider,
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
        message: "Failed to update provider.",
        suggestion: "Review provider settings and retry.",
      },
    });
    return false;
  },
  deleteProvider: async (id) => {
    const result = await providerService.deleteProvider(id);
    if (result.ok) {
      set((state) => ({
        providers: state.providers.filter((provider) => provider.id !== id),
        error: null,
      }));
      return true;
    }
    set({
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to delete provider.",
        suggestion: "Check dependencies and retry.",
      },
    });
    return false;
  },
  validateProvider: async (id) => {
    set({ validatingId: id, error: null });
    const result = await providerService.validateProvider(id);
    if (result.ok && result.data) {
      set((state) => ({
        providers: state.providers.map((provider) =>
          provider.id === id
            ? {
                ...provider,
                status: result.data!.valid ? "ready" : "error",
                updatedAt: new Date().toISOString(),
              }
            : provider,
        ),
        validatingId: null,
        error: null,
      }));
      return result.data.valid;
    }
    set({
      validatingId: null,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to validate provider.",
        suggestion: "Check network and credentials, then retry.",
      },
    });
    return false;
  },
}));
