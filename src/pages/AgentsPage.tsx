import { useEffect, useState } from "react";
import { Bot, Play, Plus, RefreshCw, Search, Square, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/store/useAgentStore";
import type { Agent } from "@/types";
import { CreateAgentWizard } from "@/components/agents/CreateAgentWizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AgentCard({ agent }: { agent: Agent }) {
  const { t, i18n } = useTranslation("agents");
  const [actionLoading, setActionLoading] = useState<"start" | "stop" | "delete" | null>(null);
  const startAgent = useAgentStore((state) => state.startAgent);
  const stopAgent = useAgentStore((state) => state.stopAgent);
  const deleteAgent = useAgentStore((state) => state.deleteAgent);
  const isActive = agent.status === "active";
  const locale = i18n.language.startsWith("ja") ? "ja-JP" : i18n.language.startsWith("en") ? "en-US" : "zh-CN";

  const handleStart = async () => {
    setActionLoading("start");
    await startAgent(agent.id);
    setActionLoading(null);
  };

  const handleStop = async () => {
    setActionLoading("stop");
    await stopAgent(agent.id);
    setActionLoading(null);
  };

  const handleDelete = async () => {
    if (!window.confirm(t("actions.confirmDelete", { name: agent.displayName }))) {
      return;
    }

    setActionLoading("delete");
    await deleteAgent(agent.id);
    setActionLoading(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
              isActive ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/30",
            )}
          />
          <span className="truncate text-sm font-semibold text-foreground">{agent.displayName}</span>
        </div>
        <Badge variant={isActive ? "success" : "secondary"}>{isActive ? t("state.running") : t("state.stopped")}</Badge>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="default" className="text-[11px]">
          {agent.modelName || agent.modelId}
        </Badge>
        <span>{t(`wizard.stepChannel.channels.${agent.channelType}.label`, { defaultValue: agent.channelType })}</span>
      </div>

      {agent.systemPrompt ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{agent.systemPrompt}</p>
      ) : null}

      <div className="flex gap-4 text-[11px] text-muted-foreground/70">
        <span>{t("card.conversations", { count: agent.totalConversations })}</span>
        <span>{t("card.tokens", { value: agent.totalTokensUsed.toLocaleString(locale) })}</span>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-1">
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleStop()}
            disabled={actionLoading !== null}
            className="flex-1 border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/40"
          >
            {actionLoading === "stop" ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Square className="mr-1.5 h-3 w-3" fill="currentColor" />}
            {t("actions.stop")}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleStart()}
            disabled={actionLoading !== null}
            className="flex-1 border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950/40"
          >
            {actionLoading === "start" ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Play className="mr-1.5 h-3 w-3" fill="currentColor" />}
            {t("actions.start")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleDelete()}
          disabled={actionLoading !== null}
          className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          {actionLoading === "delete" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation("agents");
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-black/[0.015] dark:bg-white/[0.015]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
        <Bot className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">{t("empty.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("empty.description")}</p>
      </div>
      <Button onClick={onNew}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t("empty.cta")}
      </Button>
    </div>
  );
}

export function AgentsPage(): JSX.Element {
  const { t } = useTranslation("agents");
  const agents = useAgentStore((state) => state.agents);
  const agentsLoaded = useAgentStore((state) => state.agentsLoaded);
  const loading = useAgentStore((state) => state.loading);
  const error = useAgentStore((state) => state.error);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loadAgents = async (query?: string) => {
    setRefreshing(true);
    await fetchAgents(query);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!agentsLoaded) {
      void fetchAgents();
    }
  }, [agentsLoaded, fetchAgents]);

  const filteredAgents = search.trim()
    ? agents.filter((agent) => agent.displayName.toLowerCase().includes(search.toLowerCase()))
    : agents;
  const activeAgents = agents.filter((agent) => agent.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-heading">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("page.description")} · {t("page.stats", { total: agents.length, running: activeAgents })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("actions.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => void loadAgents(search.trim() || undefined)}
          disabled={refreshing}
          className="h-9 w-9"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("actions.create")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      {loading && !agentsLoaded ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">{t("actions.loading")}</div>
      ) : filteredAgents.length === 0 ? (
        <EmptyState onNew={() => setWizardOpen(true)} />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {wizardOpen ? <CreateAgentWizard onClose={() => setWizardOpen(false)} /> : null}
    </div>
  );
}
