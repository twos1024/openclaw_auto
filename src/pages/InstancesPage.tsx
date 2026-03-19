import { useEffect, useState } from "react";
import { Plus, Search, Play, Square, Trash2, RefreshCw, Bot } from "lucide-react";
import { invokeCommand } from "@/services/tauriClient";
import { useAppStore, type InstanceRecord } from "@/store/useAppStore";
import { CreateInstanceWizard } from "@/components/instance/CreateInstanceWizard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Instance card ────────────────────────────────────────────────────────────

function InstanceCard({ instance }: { instance: InstanceRecord }) {
  const [actionLoading, setActionLoading] = useState<"start" | "stop" | "delete" | null>(null);
  const { updateInstance, removeInstance } = useAppStore();

  const isActive = instance.status === "active";

  const handleStart = async () => {
    setActionLoading("start");
    const result = await invokeCommand<{ status: string }>("start_instance", { id: instance.id });
    if (result.success) updateInstance(instance.id, { status: "active" });
    setActionLoading(null);
  };

  const handleStop = async () => {
    setActionLoading("stop");
    const result = await invokeCommand<{ status: string }>("stop_instance", { id: instance.id });
    if (result.success) updateInstance(instance.id, { status: "created" });
    setActionLoading(null);
  };

  const handleDelete = async () => {
    if (!window.confirm(`确认删除实例「${instance.displayName}」？`)) return;
    setActionLoading("delete");
    await invokeCommand("delete_instance", { id: instance.id });
    removeInstance(instance.id);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            "mt-0.5 h-2 w-2 rounded-full shrink-0",
            isActive ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/30",
          )} />
          <span className="font-semibold text-sm text-foreground truncate">{instance.displayName}</span>
        </div>
        <Badge variant={isActive ? "success" : "secondary"}>
          {isActive ? "运行中" : "已停止"}
        </Badge>
      </div>

      {/* Model tag */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="default" className="text-[11px]">
          {instance.modelName || instance.modelId}
        </Badge>
        <span>{instance.channelType}</span>
      </div>

      {/* System prompt preview */}
      {instance.systemPrompt ? (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {instance.systemPrompt}
        </p>
      ) : null}

      {/* Stats */}
      <div className="flex gap-4 text-[11px] text-muted-foreground/70">
        <span>{instance.totalConversations} 次对话</span>
        <span>{instance.totalTokensUsed.toLocaleString()} tokens</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleStop()}
            disabled={actionLoading !== null}
            className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/40"
          >
            {actionLoading === "stop" ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Square className="h-3 w-3 mr-1.5" fill="currentColor" />}
            停止
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleStart()}
            disabled={actionLoading !== null}
            className="flex-1 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950/40"
          >
            {actionLoading === "start" ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Play className="h-3 w-3 mr-1.5" fill="currentColor" />}
            启动
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleDelete()}
          disabled={actionLoading !== null}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7"
        >
          {actionLoading === "delete" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-black/[0.015] dark:bg-white/[0.015] min-h-[400px] gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
        <Bot className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">还没有实例</p>
        <p className="text-sm text-muted-foreground mt-1">创建你的第一个 AI 机器人实例，开始对话。</p>
      </div>
      <Button onClick={onNew}>
        <Plus className="h-4 w-4 mr-1.5" />
        新建实例
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function InstancesPage(): JSX.Element {
  const { instances, instancesLoaded, setInstances } = useAppStore();
  const [loading, setLoading] = useState(!instancesLoaded);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadInstances = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    const result = await invokeCommand<{ instances: InstanceRecord[]; total: number; running: number }>(
      "list_instances", {},
    );
    if (result.success && result.data) {
      setInstances(result.data.instances);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!instancesLoaded) void loadInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instancesLoaded]);

  const filtered = search.trim()
    ? instances.filter((i) => i.displayName.toLowerCase().includes(search.toLowerCase()))
    : instances;

  const active = instances.filter((i) => i.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1
          className="page-heading"
        >
          实例管理
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          管理你的 AI 机器人实例 · {instances.length} 个实例 · {active} 个运行中
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索实例..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => void loadInstances(true)} disabled={refreshing} className="h-9 w-9">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          新建实例
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          加载中...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => setWizardOpen(true)} />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((inst) => <InstanceCard key={inst.id} instance={inst} />)}
        </div>
      )}

      {wizardOpen && <CreateInstanceWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}
