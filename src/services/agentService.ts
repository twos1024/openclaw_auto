import type { BackendError } from "@/types/api";
import type {
  Agent,
  AgentListData,
  CreateAgentPayload,
  UpdateAgentPayload,
} from "@/types/agent";
import type { ServiceResult } from "@/types/status";
import { invokeCommand } from "@/services/hostClient";
import { toBackendError } from "@/services/domainErrors";

interface AgentListCommandData {
  agents?: Agent[];
  instances?: Agent[];
  total?: number;
  running?: number;
}

interface DeleteResult {
  deleted: boolean;
  id: string;
}

function normalizeListData(raw: AgentListCommandData | undefined): AgentListData {
  const agents = raw?.agents ?? raw?.instances ?? [];
  const total = Number.isFinite(raw?.total) ? Number(raw?.total) : agents.length;
  const running = Number.isFinite(raw?.running)
    ? Number(raw?.running)
    : agents.filter((agent) => agent.status === "active").length;
  return { agents, total, running };
}

function mapCommandError(
  error: BackendError | undefined,
  fallbackMessage: string,
  fallbackSuggestion: string,
): BackendError {
  return toBackendError(error, fallbackMessage, fallbackSuggestion);
}

export const agentService = {
  async listAgents(search?: string): Promise<ServiceResult<AgentListData>> {
    const result = await invokeCommand<AgentListCommandData>("list_agents", {
      search: search?.trim() || null,
    });
    if (result.success) {
      return {
        ok: true,
        data: normalizeListData(result.data),
      };
    }
    return {
      ok: false,
      error: mapCommandError(
        result.error,
        "Failed to list agents.",
        "Check OpenClaw CLI availability, then retry.",
      ),
    };
  },

  async createAgent(payload: CreateAgentPayload): Promise<ServiceResult<Agent>> {
    const result = await invokeCommand<Agent>("create_agent", payload as unknown as Record<string, unknown>);
    if (result.success && result.data) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      error: mapCommandError(
        result.error,
        "Failed to create agent.",
        "Review model/channel settings and retry.",
      ),
    };
  },

  async updateAgent(payload: UpdateAgentPayload): Promise<ServiceResult<Agent>> {
    const result = await invokeCommand<Agent>("update_agent", payload as unknown as Record<string, unknown>);
    if (result.success && result.data) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      error: mapCommandError(
        result.error,
        "Failed to update agent.",
        "Review changed fields and retry.",
      ),
    };
  },

  async startAgent(id: string): Promise<ServiceResult<Agent>> {
    const result = await invokeCommand<Agent>("start_agent", { id });
    if (result.success && result.data) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      error: mapCommandError(
        result.error,
        "Failed to start agent.",
        "Check gateway/runtime status and retry.",
      ),
    };
  },

  async stopAgent(id: string): Promise<ServiceResult<Agent>> {
    const result = await invokeCommand<Agent>("stop_agent", { id });
    if (result.success && result.data) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      error: mapCommandError(
        result.error,
        "Failed to stop agent.",
        "Check gateway/runtime status and retry.",
      ),
    };
  },

  async deleteAgent(id: string): Promise<ServiceResult<DeleteResult>> {
    const result = await invokeCommand<DeleteResult>("delete_agent", { id });
    if (result.success && result.data) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      error: mapCommandError(
        result.error,
        "Failed to delete agent.",
        "Check if the agent is currently in use, then retry.",
      ),
    };
  },
};
