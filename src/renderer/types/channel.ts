export type ChannelType = "openclaw" | "openai-compatible" | "custom" | "webhook";
export type ChannelStatus = "connected" | "disconnected" | "error" | "idle";
export type ConnectionType = "api-key" | "oauth" | "none";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  status: ChannelStatus;
  connectionType: ConnectionType;
  description?: string;
  providerId?: string;
  agentIds: string[];
  updatedAt: string;
}

export interface CreateChannelPayload {
  name: string;
  type: ChannelType;
  connectionType: ConnectionType;
  description?: string;
  providerId?: string;
  agentIds?: string[];
}

export interface UpdateChannelPayload extends Partial<CreateChannelPayload> {
  id: string;
  status?: ChannelStatus;
}
