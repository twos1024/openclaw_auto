import { useEffect, useRef, useState, useCallback } from "react";
import { AlertCircle, SendHorizontal, Square, Sparkles, Paperclip, ChevronDown, ChevronRight, X, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useChatStore, getMessageText, type ChatMessage, type ContentBlock, type AttachedFile } from "@/store/useChatStore";
import { useAgentStore } from "@/store/useAgentStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── ContentBlock renderers ──────────────────────────────────────────────────

function ThinkingBlock({ block }: { block: ContentBlock }) {
  const { t } = useTranslation("chat");
  const [expanded, setExpanded] = useState(false);
  const text = block.thinking ?? block.text ?? "";
  if (!text) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {t("blocks.thinking")}
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

function ToolUseBlock({ block }: { block: ContentBlock }) {
  const { t } = useTranslation("chat");
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
      <span className="font-medium text-primary">{t("blocks.toolUse")}</span>
      <span className="ml-2 text-foreground">{block.name ?? block.id ?? "unknown"}</span>
    </div>
  );
}

function ToolResultBlock({ block }: { block: ContentBlock }) {
  const { t } = useTranslation("chat");
  const text = block.text ?? "";
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
      <span className="font-medium text-muted-foreground">{t("blocks.toolResult")}</span>
      {text ? <pre className="mt-1 whitespace-pre-wrap text-foreground">{text}</pre> : null}
    </div>
  );
}

function ImageBlock({ block }: { block: ContentBlock }) {
  if (!block.data) return null;
  const src = block.data.startsWith("data:") ? block.data : `data:${block.mimeType ?? "image/png"};base64,${block.data}`;
  return (
    <img
      src={src}
      alt="content"
      className="max-w-full rounded-lg border border-border/30"
      style={{ maxHeight: 400 }}
    />
  );
}

function renderContentBlocks(blocks: ContentBlock[]): JSX.Element {
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const key = block.id ?? `block-${i}`;
        switch (block.type) {
          case "thinking":
            return <ThinkingBlock key={key} block={block} />;
          case "tool_use":
            return <ToolUseBlock key={key} block={block} />;
          case "tool_result":
            return <ToolResultBlock key={key} block={block} />;
          case "image":
            return <ImageBlock key={key} block={block} />;
          case "text":
          default:
            return block.text ? (
              <ReactMarkdown key={key} remarkPlugins={[remarkGfm]}>
                {block.text}
              </ReactMarkdown>
            ) : null;
        }
      })}
    </div>
  );
}

// ─── Attachment pill ─────────────────────────────────────────────────────────

function AttachmentPills({ attachments }: { attachments: AttachedFile[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((file, i) => (
        <span
          key={`${file.name}-${i}`}
          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          <FileText className="h-3 w-3" />
          {file.name}
          <span className="opacity-60">({formatFileSize(file.size)})</span>
        </span>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const { t } = useTranslation("chat");
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const textContent = getMessageText(msg.content);

  const copy = async () => {
    await navigator.clipboard.writeText(textContent);
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
            <>
              <span className="whitespace-pre-wrap">{textContent}</span>
              {msg.attachments?.length ? <AttachmentPills attachments={msg.attachments} /> : null}
            </>
          ) : typeof msg.content === "string" ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content + (isStreaming ? "▍" : "")}
            </ReactMarkdown>
          ) : (
            renderContentBlocks(msg.content)
          )}
        </div>

        {/* Copy button */}
        {!isUser && !isStreaming && textContent && (
          <button
            onClick={() => void copy()}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-muted-foreground hover:text-foreground px-1"
          >
            {copied ? t("actions.copied") : t("actions.copy")}
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
  const { t } = useTranslation("chat");
  const agents = useAgentStore((state) => state.agents);
  const activeAgents = agents.filter((agent) => agent.status === "active");
  const currentAgent = activeAgents[0];
  const hints = [
    t("page.hints.python"),
    t("page.hints.translate"),
    t("page.hints.explain"),
    t("page.hints.brainstorm"),
  ];

  return (
    <div className="flex flex-col items-center justify-center h-[55vh] text-center">
      <h1 className="page-heading mb-6 text-5xl">
        {currentAgent
          ? t("page.titleWithAgent", { agentName: currentAgent.displayName })
          : t("page.subtitle")}
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        {currentAgent
          ? t("page.subtitleWithAgent", { agentModel: currentAgent.modelName || currentAgent.modelId })
          : t("page.description")}
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {hints.map((hint) => (
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
  onSend: (text: string, attachments?: AttachedFile[]) => void;
  onStop: () => void;
  disabled: boolean;
  sending: boolean;
  isEmpty: boolean;
}) {
  const { t } = useTranslation("chat");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    onSend(text, attachments.length > 0 ? attachments : undefined);
    setAttachments([]);
  }, [input, disabled, sending, onSend, attachments]);

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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: AttachedFile[] = [];
    for (const file of Array.from(files)) {
      const data = await fileToBase64(file);
      newAttachments.push({
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        data,
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    // Reset input so re-selecting the same file works
    e.target.value = "";
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className={cn("p-4 pb-6 w-full mx-auto transition-all", isEmpty ? "max-w-3xl" : "max-w-4xl")}>
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2">
          {attachments.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
            >
              <FileText className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="ml-0.5 hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className={cn(
          "relative bg-card rounded-[28px] shadow-sm border p-1.5",
          "border-black/10 dark:border-white/10",
        )}
      >
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.txt,.md,.json,.csv,.doc,.docx"
            onChange={(e) => void handleFileSelect(e)}
          />
          <button
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            disabled={disabled || sending}
            title={t("form.attachments")}
            onClick={() => fileInputRef.current?.click()}
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
            placeholder={disabled ? t("form.placeholderDisabled") : t("form.placeholder")}
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get raw base64
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ChatPage(): JSX.Element {
  const { t } = useTranslation("chat");
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
              {t("actions.close")}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={(text, attachments) => void sendMessage(text, null, attachments)}
        onStop={abortRun}
        disabled={sending}
        sending={sending}
        isEmpty={isEmpty}
      />
    </div>
  );
}
