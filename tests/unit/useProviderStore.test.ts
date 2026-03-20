import { afterEach, describe, expect, it, vi } from "vitest";
import { useProviderStore } from "../../src/store/useProviderStore";
import type { CreateProviderPayload, Provider } from "../../src/types";

const mockListProviders = vi.hoisted(() => vi.fn());
const mockCreateProvider = vi.hoisted(() => vi.fn());
const mockUpdateProvider = vi.hoisted(() => vi.fn());
const mockDeleteProvider = vi.hoisted(() => vi.fn());
const mockValidateProvider = vi.hoisted(() => vi.fn());

vi.mock("@/services/providerService", () => ({
  providerService: {
    listProviders: mockListProviders,
    createProvider: mockCreateProvider,
    updateProvider: mockUpdateProvider,
    deleteProvider: mockDeleteProvider,
    validateProvider: mockValidateProvider,
  },
}));

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "provider-1",
    name: "Default Provider",
    vendor: "openai",
    apiKeyMasked: "sk***",
    baseUrl: "https://api.example.com/v1",
    modelCount: 3,
    status: "disabled",
    updatedAt: "2026-03-20T00:00:00Z",
    ...overrides,
  };
}

function resetStore(): void {
  useProviderStore.setState({
    providers: [],
    loading: false,
    saving: false,
    error: null,
    validatingId: null,
    lastFetchedAt: null,
  });
}

describe("useProviderStore", () => {
  afterEach(() => {
    resetStore();
    mockListProviders.mockReset();
    mockCreateProvider.mockReset();
    mockUpdateProvider.mockReset();
    mockDeleteProvider.mockReset();
    mockValidateProvider.mockReset();
  });

  it("clears stale errors after a successful fetch", async () => {
    const provider = makeProvider({ id: "provider-2", status: "ready" });
    useProviderStore.setState({
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockListProviders.mockResolvedValue({
      ok: true,
      data: [provider],
    });

    await useProviderStore.getState().fetchProviders();

    const state = useProviderStore.getState();
    expect(state.error).toBeNull();
    expect(state.providers).toEqual([provider]);
    expect(state.loading).toBe(false);
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it("updates provider status after validation and clears stale errors", async () => {
    useProviderStore.setState({
      providers: [makeProvider({ id: "provider-1", status: "disabled" })],
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockValidateProvider.mockResolvedValue({
      ok: true,
      data: {
        valid: false,
        detail: "Provider validation failed.",
      },
    });

    const result = await useProviderStore.getState().validateProvider("provider-1");

    const state = useProviderStore.getState();
    expect(result).toBe(false);
    expect(state.providers[0]?.status).toBe("error");
    expect(state.error).toBeNull();
    expect(state.validatingId).toBeNull();
  });

  it("updates an existing provider on patch and clears stale errors", async () => {
    useProviderStore.setState({
      providers: [makeProvider({ id: "provider-1", status: "disabled" })],
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockUpdateProvider.mockResolvedValue({
      ok: true,
      data: makeProvider({
        id: "provider-1",
        name: "Renamed Provider",
        status: "ready",
      }),
    });

    const success = await useProviderStore.getState().patchProvider({
      id: "provider-1",
      name: "Renamed Provider",
      status: "ready",
    });

    const state = useProviderStore.getState();
    expect(success).toBe(true);
    expect(state.providers[0]?.name).toBe("Renamed Provider");
    expect(state.providers[0]?.status).toBe("ready");
    expect(state.error).toBeNull();
    expect(state.saving).toBe(false);
  });

  it("does not insert a fake provider when creation fails", async () => {
    const existing = makeProvider();
    useProviderStore.setState({
      providers: [existing],
    });
    mockCreateProvider.mockResolvedValue({
      ok: false,
      error: {
        code: "E_CREATE_FAILED",
        message: "backend refused the payload",
        suggestion: "check provider credentials",
      },
    });

    const payload: CreateProviderPayload = {
      name: "Broken Provider",
      vendor: "openai",
      apiKey: "sk-test",
      baseUrl: "https://api.example.com/v1",
    };

    const success = await useProviderStore.getState().createProvider(payload);

    const state = useProviderStore.getState();
    expect(success).toBe(false);
    expect(state.providers).toEqual([existing]);
    expect(state.error?.code).toBe("E_CREATE_FAILED");
    expect(state.saving).toBe(false);
  });
});
