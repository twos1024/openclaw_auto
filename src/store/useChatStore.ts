import { create } from "zustand";
import { gatewayFetch, getGatewayUrl } from "@/lib/gateway-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "image";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  data?: string; // base64
  mimeType?: string;
}

export interface AttachedFile {
  name: string;
  size: number;
  mimeType: string;
  data: string; // base64
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | ContentBlock[];
  timestamp: number;
  agentId?: string;
  attachments?: AttachedFile[];
}

export interface ChatSession {
  key: string;
  label: string;
  agentId: string;
  lastActivity: number;
  messageCount: number;
}

/** Extract plain text from a ChatMessage content field. */
export function getMessageText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

interface StreamingTool {
  id: string;
  name: string;
  status: "running" | "completed" | "error";
  durationMs?: number;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface ChatStore {
  // Session list
  sessions: ChatSession[];
  currentSessionKey: string;
  currentAgentId: string;

  // Messages in current session
  messages: ChatMessage[];
  streamingText: string;
  streamingTools: StreamingTool[];
  sending: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  setSessions: (sessions: ChatSession[]) => void;
  switchSession: (key: string) => void;
  newSession: (agentId?: string) => void;
  deleteSession: (key: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadHistory: (quiet?: boolean) => Promise<void>;
  sendMessage: (text: string, targetAgentId?: string | null, attachments?: AttachedFile[]) => Promise<void>;
  abortRun: () => void;
  clearError: () => void;
  cleanupEmptySession: () => void;
  setCurrentAgentId: (id: string) => void;
}

let _abortController: AbortController | null = null;

function generateSessionKey(agentId: string): string {
  const id = agentId || "main";
  return `agent:${id}:${Date.now()}`;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionKey: generateSessionKey("main"),
  currentAgentId: "main",
  messages: [],
  streamingText: "",
  streamingTools: [],
  sending: false,
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),

  switchSession: (key) => {
    const session = get().sessions.find((s) => s.key === key);
    set({
      currentSessionKey: key,
      currentAgentId: session?.agentId || "main",
      messages: [],
      streamingText: "",
      error: null,
    });
    void get().loadHistory(false);
  },

  newSession: (agentId) => {
    const id = agentId || get().currentAgentId || "main";
    const key = generateSessionKey(id);
    set({
      currentSessionKey: key,
      currentAgentId: id,
      messages: [],
      streamingText: "",
      error: null,
    });
  },

  deleteSession: async (key) => {
    try {
      await gatewayFetch(`/api/sessions/${encodeURIComponent(key)}`, { method: "DELETE" });
    } catch {
      // If gateway doesn't support delete, just remove from local state
    }
    set((s) => ({
      sessions: s.sessions.filter((x) => x.key !== key),
    }));
  },

  loadSessions: async () => {
    try {
      const data = await gatewayFetch<ChatSession[]>("/api/sessions");
      if (Array.isArray(data)) {
        set({ sessions: data });
      }
    } catch {
      // Gateway may not be running yet
    }
  },

  loadHistory: async (quiet = false) => {
    const { currentSessionKey } = get();
    if (!quiet) set({ loading: true, messages: [] });
    try {
      const data = await gatewayFetch<ChatMessage[]>(
        `/api/sessions/${encodeURIComponent(currentSessionKey)}/history`,
      );
      if (Array.isArray(data)) {
        set({ messages: data, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  sendMessage: async (text, targetAgentId, attachments) => {
    if (get().sending) return;
    const { currentSessionKey, currentAgentId } = get();

    // Optimistic user message
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now() / 1000,
      attachments: attachments?.length ? attachments : undefined,
    };
    set((s) => ({
      messages: [...s.messages, userMsg],
      sending: true,
      streamingText: "",
      streamingTools: [],
      error: null,
    }));

    _abortController = new AbortController();

    try {
      const base = await getGatewayUrl();
      if (!base) throw new Error("Gateway is not running. Please start the gateway first.");

      const agentId = targetAgentId ?? currentAgentId ?? "main";
      const endpoint = `${base}/api/sessions/${encodeURIComponent(currentSessionKey)}/stream`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          agentId,
          ...(attachments?.length ? { attachments } : {}),
        }),
        signal: _abortController.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`Send failed (${res.status}): ${errText}`);
      }

      // Stream SSE-style text/event-stream OR plain chunked JSON
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Handle SSE format: data: {...}\n\n
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
                      type GatewayEvent =
                | { type: "delta"; delta: string; content?: string }
                | { type: "tool_start"; tool: { name: string; id: string } }
                | { type: "tool_end"; toolId: string; toolStatus?: "running" | "completed" | "error"; durationMs?: number }
                | { type: "done" }
                | { type: string };

              const event = JSON.parse(json) as GatewayEvent;
              if (event.type === "delta") {
                const delta = (event as { type: "delta"; delta: string; content?: string }).delta
                  ?? (event as { type: "delta"; delta: string; content?: string }).content
                  ?? "";
                accumulated += delta;
                set({ streamingText: accumulated });
              } else if (event.type === "tool_start") {
                const { tool } = event as { type: "tool_start"; tool: { name: string; id: string } };
                set((s) => ({
                  streamingTools: [
                    ...s.streamingTools,
                    { id: tool.id, name: tool.name, status: "running" },
                  ],
                }));
              } else if (event.type === "tool_end") {
                const te = event as { type: "tool_end"; toolId: string; toolStatus?: "running" | "completed" | "error"; durationMs?: number };
                set((s) => ({
                  streamingTools: s.streamingTools.map((t) =>
                    t.id === te.toolId ? { ...t, status: te.toolStatus ?? "completed", durationMs: te.durationMs } : t,
                  ),
                }));
              } else if (event.type === "done") {
                // Final message committed
                break;
              }
            } catch {
              // Non-JSON SSE line — skip to avoid corrupting accumulated content
            }
          }
        }
      }

      // Finalise: push assistant message to messages list
      if (accumulated.trim()) {
        const assistantMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          role: "assistant",
          content: accumulated,
          timestamp: Date.now() / 1000,
          agentId,
        };
        set((s) => ({
          messages: [...s.messages, assistantMsg],
          streamingText: "",
          streamingTools: [],
          sending: false,
        }));
      } else {
        // Reload from gateway in case it committed differently
        set({ streamingText: "", streamingTools: [], sending: false });
        await get().loadHistory(true);
      }

      // Update sessions list to show new activity
      await get().loadSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AbortError") || msg.includes("abort")) {
        set({ sending: false, streamingText: "", streamingTools: [] });
        return;
      }
      // Fallback: echo-style mock for development when gateway unavailable
      const fallback = `[Gateway unavailable] Echo: ${text}`;
      const mockMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: fallback,
        timestamp: Date.now() / 1000,
      };
      set((s) => ({
        messages: [...s.messages, mockMsg],
        streamingText: "",
        streamingTools: [],
        sending: false,
        error: msg,
      }));
    }
  },

  abortRun: () => {
    _abortController?.abort();
    _abortController = null;
    set({ sending: false, streamingText: "", streamingTools: [] });
  },

  clearError: () => set({ error: null }),

  cleanupEmptySession: () => {
    const { messages, sessions, currentSessionKey } = get();
    if (messages.length === 0) {
      set({ sessions: sessions.filter((s) => s.key !== currentSessionKey) });
    }
  },

  setCurrentAgentId: (id) => set({ currentAgentId: id }),
}));
