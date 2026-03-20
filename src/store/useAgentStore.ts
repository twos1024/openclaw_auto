import { create } from "zustand";
import { agentService } from "@/services/agentService";
import type { BackendError } from "@/types/api";
import type { Agent, CreateAgentPayload, UpdateAgentPayload } from "@/types";

interface AgentStore {
  agents: Agent[];
  agentsLoaded: boolean;
  loading: boolean;
  saving: boolean;
  error: BackendError | null;
  lastFetchedAt: string | null;
  setAgents: (agents: Agent[]) => void;
  setError: (error: BackendError | null) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  fetchAgents: (search?: string) => Promise<void>;
  createAgent: (payload: CreateAgentPayload) => Promise<boolean>;
  patchAgent: (payload: UpdateAgentPayload) => Promise<boolean>;
  startAgent: (id: string) => Promise<boolean>;
  stopAgent: (id: string) => Promise<boolean>;
  deleteAgent: (id: string) => Promise<boolean>;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  agentsLoaded: false,
  loading: false,
  saving: false,
  error: null,
  lastFetchedAt: null,
  setAgents: (agents) => set({ agents, agentsLoaded: true }),
  setError: (error) => set({ error }),
  addAgent: (agent) =>
    set((state) => ({
      agents: [agent, ...state.agents],
    })),
  updateAgent: (id, patch) =>
    set((state) => ({
      agents: state.agents.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)),
    })),
  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id),
    })),
  fetchAgents: async (search) => {
    set({ loading: true, error: null });
    const result = await agentService.listAgents(search);
    if (result.ok && result.data) {
      set({
        agents: result.data.agents,
        agentsLoaded: true,
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
        message: "Failed to load agents.",
        suggestion: "Retry after gateway status check.",
      },
    });
  },
  createAgent: async (payload) => {
    set({ saving: true, error: null });
    const result = await agentService.createAgent(payload);
    if (result.ok && result.data) {
      set((state) => ({
        agents: [result.data!, ...state.agents],
        agentsLoaded: true,
        error: null,
        saving: false,
      }));
      return true;
    }
    set({
      saving: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to create agent.",
        suggestion: "Review payload and retry.",
      },
    });
    return false;
  },
  patchAgent: async (payload) => {
    set({ saving: true, error: null });
    const result = await agentService.updateAgent(payload);
    if (result.ok && result.data) {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === result.data!.id ? result.data! : agent,
        ),
        agentsLoaded: true,
        error: null,
        saving: false,
      }));
      return true;
    }
    set({
      saving: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to update agent.",
        suggestion: "Review fields and retry.",
      },
    });
    return false;
  },
  startAgent: async (id) => {
    const result = await agentService.startAgent(id);
    if (result.ok && result.data) {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? result.data! : agent,
        ),
        agentsLoaded: true,
        error: null,
      }));
      return true;
    }
    set({
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to start agent.",
        suggestion: "Check runtime status and retry.",
      },
    });
    return false;
  },
  stopAgent: async (id) => {
    const result = await agentService.stopAgent(id);
    if (result.ok && result.data) {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? result.data! : agent,
        ),
        agentsLoaded: true,
        error: null,
      }));
      return true;
    }
    set({
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to stop agent.",
        suggestion: "Check runtime status and retry.",
      },
    });
    return false;
  },
  deleteAgent: async (id) => {
    const result = await agentService.deleteAgent(id);
    if (result.ok) {
      set((state) => ({
        agents: state.agents.filter((agent) => agent.id !== id),
        agentsLoaded: true,
        error: null,
      }));
      return true;
    }
    set({
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to delete agent.",
        suggestion: "Check dependencies and retry.",
      },
    });
    return false;
  },
}));
