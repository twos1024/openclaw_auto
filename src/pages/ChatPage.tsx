import { useEffect, useRef, useState, useCallback } from "react";
import { AlertCircle, SendHorizontal, Square, Sparkles, Paperclip, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useChatStore, type ChatMessage } from "@/store/useChatStore";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 bg-black/5 dark:bg-white/5">
          <Sparkles className="h-4 w-4 text-foreground/70" />
        </div>
      )}

      {/* Bubble */}
      <div className={cn("flex flex-col max-w-[80%] min-w-0 space-y-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-foreground text-background rounded-br-sm"
              : "bg-black/5 dark:bg-white/5 text-foreground rounded-bl-sm prose prose-sm dark:prose-invert max-w-none",
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content + (isStreaming ? "▍" : "")}
            </ReactMarkdown>
          )}
        </div>

        {/* Copy button */}
        {!isUser && !isStreaming && (
          <button
            onClick={() => void copy()}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-muted-foreground hover:text-foreground px-1"
          >
            {copied ? "已复制" : "复制"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 bg-black/5 dark:bg-white/5">
        <Sparkles className="h-4 w-4 text-foreground/70" />
      </div>
      <div className="bg-black/5 dark:bg-white/5 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce-dot"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen() {
  const instances = useAppStore((s) => s.instances);
  const activeInstances = instances.filter((i) => i.status === "active");

  return (
    <div className="flex flex-col items-center justify-center h-[55vh] text-center">
      <h1
        className="page-heading mb-6 text-5xl"
      >
        {activeInstances.length > 0
          ? `与 ${activeInstances[0].displayName} 对话`
          : "你好，有什么可以帮你的吗？"}
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        {activeInstances.length > 0
          ? `当前实例：${activeInstances[0].modelName || activeInstances[0].modelId}`
          : "在【实例管理】中创建并启动一个 AI 机器人开始对话。"}
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {["写一段 Python 代码", "帮我翻译", "解释这个概念", "头脑风暴"].map((hint) => (
          <span
            key={hint}
            className="px-4 py-1.5 rounded-full border border-black/10 dark:border-white/10 text-[13px] text-foreground/60 bg-black/[0.02] dark:bg-white/5"
          >
            {hint}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Chat input ───────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onStop,
  disabled,
  sending,
  isEmpty,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  sending: boolean;
  isEmpty: boolean;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || disabled || sending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(text);
  }, [input, disabled, sending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (isComposingRef.current) return;
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className={cn("p-4 pb-6 w-full mx-auto transition-all", isEmpty ? "max-w-3xl" : "max-w-4xl")}>
      <div
        className={cn(
          "relative bg-card rounded-[28px] shadow-sm border p-1.5",
          "border-black/10 dark:border-white/10",
        )}
      >
        <div className="flex items-end gap-1.5">
          <button
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            disabled={disabled || sending}
            title="附件（即将支持）"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder={disabled ? "请先启动 Gateway..." : "发送消息（Enter 发送，Shift+Enter 换行）"}
            disabled={disabled}
            className="min-h-[40px] max-h-[200px] border-0 focus-visible:ring-0 shadow-none bg-transparent py-2.5 px-2 text-[15px] placeholder:text-muted-foreground/50 leading-relaxed"
            rows={1}
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={sending ? onStop : handleSend}
            disabled={sending ? false : !input.trim() || disabled}
            className={cn(
              "shrink-0 h-10 w-10 rounded-full transition-colors",
              input.trim() || sending
                ? "bg-black/5 dark:bg-white/10 text-foreground hover:bg-black/10"
                : "text-muted-foreground/40",
            )}
          >
            {sending
              ? <Square className="h-4 w-4" fill="currentColor" />
              : <SendHorizontal className="h-4 w-4" strokeWidth={2} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ChatPage(): JSX.Element {
  const messages = useChatStore((s) => s.messages);
  const streamingText = useChatStore((s) => s.streamingText);
  const streamingTools = useChatStore((s) => s.streamingTools);
  const sending = useChatStore((s) => s.sending);
  const loading = useChatStore((s) => s.loading);
  const error = useChatStore((s) => s.error);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);
  const loadSessions = useChatStore((s) => s.loadSessions);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0 && !sending;

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingText]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <div className="relative flex flex-col -m-6 h-full dark:bg-background transition-colors duration-500">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce-dot" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          ) : isEmpty ? (
            <WelcomeScreen />
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {/* Streaming tool indicators */}
              {sending && streamingTools.length > 0 && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 bg-black/5 dark:bg-white/5">
                    <Sparkles className="h-4 w-4 text-foreground/70" />
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 rounded-2xl px-4 py-3 space-y-1">
                    {streamingTools.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          t.status === "running" ? "bg-amber-500 animate-pulse" :
                          t.status === "completed" ? "bg-green-500" : "bg-red-500",
                        )} />
                        <span>{t.name}</span>
                        {t.durationMs && <span className="text-[11px]">({(t.durationMs / 1000).toFixed(1)}s)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming message */}
              {sending && streamingText && (
                <MessageBubble
                  msg={{ id: "streaming", role: "assistant", content: streamingText, timestamp: Date.now() / 1000, agentId: currentAgentId }}
                  isStreaming
                />
              )}

              {/* Typing indicator */}
              {sending && !streamingText && streamingTools.length === 0 && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
            <button onClick={clearError} className="text-xs text-destructive/60 hover:text-destructive underline">
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={(text) => void sendMessage(text)}
        onStop={abortRun}
        disabled={sending}
        sending={sending}
        isEmpty={isEmpty}
      />
    </div>
  );
}
