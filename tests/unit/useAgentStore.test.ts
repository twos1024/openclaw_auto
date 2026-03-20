import { afterEach, describe, expect, it, vi } from "vitest";
import { useAgentStore } from "../../src/store/useAgentStore";
import type { Agent, CreateAgentPayload } from "../../src/types";

const mockListAgents = vi.hoisted(() => vi.fn());
const mockCreateAgent = vi.hoisted(() => vi.fn());
const mockUpdateAgent = vi.hoisted(() => vi.fn());
const mockStartAgent = vi.hoisted(() => vi.fn());
const mockStopAgent = vi.hoisted(() => vi.fn());
const mockDeleteAgent = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/agentService", () => ({
  agentService: {
    listAgents: mockListAgents,
    createAgent: mockCreateAgent,
    updateAgent: mockUpdateAgent,
    startAgent: mockStartAgent,
    stopAgent: mockStopAgent,
    deleteAgent: mockDeleteAgent,
  },
}));

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    displayName: "Primary Agent",
    systemPrompt: "Be helpful.",
    modelId: "gpt-4o",
    modelName: "GPT-4o",
    modelParams: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
    },
    channelType: "openclaw",
    apiKeyRef: "",
    baseUrl: "",
    status: "created",
    createdAt: "2026-03-20T00:00:00Z",
    updatedAt: "2026-03-20T00:00:00Z",
    lastActiveAt: null,
    totalTokensUsed: 0,
    totalConversations: 0,
    ...overrides,
  };
}

function resetStore(): void {
  useAgentStore.setState({
    agents: [],
    agentsLoaded: false,
    loading: false,
    saving: false,
    error: null,
    lastFetchedAt: null,
  });
}

describe("useAgentStore", () => {
  afterEach(() => {
    resetStore();
    mockListAgents.mockReset();
    mockCreateAgent.mockReset();
    mockUpdateAgent.mockReset();
    mockStartAgent.mockReset();
    mockStopAgent.mockReset();
    mockDeleteAgent.mockReset();
  });

  it("clears stale errors after a successful fetch", async () => {
    const agent = makeAgent({ id: "agent-2", status: "active" });
    useAgentStore.setState({
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockListAgents.mockResolvedValue({
      ok: true,
      data: {
        agents: [agent],
        total: 1,
        running: 1,
      },
    });

    await useAgentStore.getState().fetchAgents();

    const state = useAgentStore.getState();
    expect(state.error).toBeNull();
    expect(state.agentsLoaded).toBe(true);
    expect(state.agents).toEqual([agent]);
    expect(state.loading).toBe(false);
  });

  it("prepends a created agent and clears any previous error", async () => {
    const existing = makeAgent({ id: "agent-1" });
    const created = makeAgent({ id: "agent-2", displayName: "Secondary Agent" });
    useAgentStore.setState({
      agents: [existing],
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockCreateAgent.mockResolvedValue({
      ok: true,
      data: created,
    });

    const payload: CreateAgentPayload = {
      displayName: "Secondary Agent",
      systemPrompt: "Be precise.",
      modelId: "gpt-4o",
      modelName: "GPT-4o",
      channelType: "openclaw",
      apiKeyRef: "",
      baseUrl: "",
      temperature: 0.4,
      maxTokens: 2048,
    };

    const success = await useAgentStore.getState().createAgent(payload);

    const state = useAgentStore.getState();
    expect(success).toBe(true);
    expect(state.error).toBeNull();
    expect(state.agentsLoaded).toBe(true);
    expect(state.agents).toEqual([created, existing]);
    expect(state.saving).toBe(false);
  });

  it("does not insert a fake agent when create fails", async () => {
    useAgentStore.setState({
      agents: [makeAgent()],
    });
    mockCreateAgent.mockResolvedValue({
      ok: false,
      error: {
        code: "E_CREATE_FAILED",
        message: "backend refused the payload",
        suggestion: "check the form",
      },
    });

    const success = await useAgentStore.getState().createAgent({
      displayName: "Broken Agent",
      systemPrompt: "Prompt",
      modelId: "gpt-4o",
      modelName: "GPT-4o",
      channelType: "openclaw",
      apiKeyRef: "",
      baseUrl: "",
      temperature: 0.7,
      maxTokens: 4096,
    });

    const state = useAgentStore.getState();
    expect(success).toBe(false);
    expect(state.agents).toHaveLength(1);
    expect(state.agents[0]?.displayName).toBe("Primary Agent");
    expect(state.error?.code).toBe("E_CREATE_FAILED");
    expect(state.saving).toBe(false);
  });
});
