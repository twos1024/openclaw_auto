export type ProviderVendor =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "ollama"
  | "google"
  | "qwen"
  | "zhipu"
  | "moonshot"
  | "groq"
  | "mistral"
  | "custom";

export type ProviderStatus = "ready" | "checking" | "error" | "disabled";

export interface Provider {
  id: string;
  name: string;
  vendor: ProviderVendor;
  apiKeyMasked?: string;
  baseUrl?: string;
  modelCount: number;
  status: ProviderStatus;
  updatedAt: string;
}

export interface CreateProviderPayload {
  name: string;
  vendor: ProviderVendor;
  apiKey: string;
  baseUrl?: string;
}

export interface UpdateProviderPayload extends Partial<CreateProviderPayload> {
  id: string;
  status?: ProviderStatus;
}
