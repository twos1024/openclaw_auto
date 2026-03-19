export type AgentStatus = "created" | "active" | "stopped" | "archived";

export interface AgentModelParams {
  temperature: number;
  maxTokens: number;
  topP?: number;
}

export interface Agent {
  id: string;
  displayName: string;
  systemPrompt: string;
  modelId: string;
  modelName: string;
  modelParams?: AgentModelParams;
  providerId?: string;
  channelIds?: string[];
  channelType: string;
  apiKeyRef: string;
  baseUrl: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  totalTokensUsed: number;
  totalConversations: number;
}

export interface CreateAgentPayload {
  displayName: string;
  systemPrompt: string;
  modelId: string;
  modelName: string;
  channelType: string;
  apiKeyRef: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
}

export interface UpdateAgentPayload extends Partial<CreateAgentPayload> {
  id: string;
}

export interface AgentListData {
  agents: Agent[];
  total: number;
  running: number;
}
