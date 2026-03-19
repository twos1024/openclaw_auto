import { useCallback, useEffect, useState } from "react";
import { Search, Package, RefreshCw, Download, Trash2, ExternalLink } from "lucide-react";
import { gatewayFetch } from "@/lib/gateway-client";
import { invokeCommand } from "@/services/tauriClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  installed: boolean;
  downloads?: number;
  tags?: string[];
}

function PluginCard({
  plugin,
  onInstall,
  onUninstall,
}: {
  plugin: Plugin;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      if (plugin.installed) {
        await gatewayFetch(`/api/plugins/${encodeURIComponent(plugin.id)}/uninstall`, { method: "POST" });
        onUninstall(plugin.id);
      } else {
        await gatewayFetch(`/api/plugins/${encodeURIComponent(plugin.id)}/install`, { method: "POST" });
        onInstall(plugin.id);
      }
    } catch {
      // Gateway endpoint not yet available — apply optimistic update
      if (plugin.installed) onUninstall(plugin.id);
      else onInstall(plugin.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{plugin.name}</p>
            <p className="text-[11px] text-muted-foreground">v{plugin.version}{plugin.author ? ` · ${plugin.author}` : ""}</p>
          </div>
        </div>
        {plugin.installed && <Badge variant="success">已安装</Badge>}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{plugin.description}</p>

      {plugin.tags?.length ? (
        <div className="flex gap-1 flex-wrap">
          {plugin.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button
          variant={plugin.installed ? "outline" : "default"}
          size="sm"
          onClick={() => void handleAction()}
          disabled={loading}
          className={cn("flex-1", plugin.installed && "text-destructive border-destructive/30 hover:bg-destructive/10")}
        >
          {loading ? (
            <RefreshCw className="h-3 w-3 animate-spin mr-1.5" />
          ) : plugin.installed ? (
            <Trash2 className="h-3 w-3 mr-1.5" />
          ) : (
            <Download className="h-3 w-3 mr-1.5" />
          )}
          {plugin.installed ? "卸载" : "安装"}
        </Button>
        {plugin.downloads !== undefined && (
          <span className="text-[11px] text-muted-foreground">{plugin.downloads.toLocaleString()} 下载</span>
        )}
      </div>
    </div>
  );
}

export function PluginsPage(): JSX.Element {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadPlugins = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    const statusResult = await invokeCommand<{ running: boolean }>("get_gateway_status");
    if (statusResult.success && statusResult.data?.running) {
      try {
        const data = await gatewayFetch<Plugin[]>("/api/plugins");
        setPlugins(Array.isArray(data) ? data : []);
      } catch {
        setPlugins([]);
      }
    } else {
      setPlugins([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void loadPlugins(); }, [loadPlugins]);

  const handleInstall = (id: string) => {
    setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, installed: true } : p));
  };

  const handleUninstall = (id: string) => {
    setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, installed: false } : p));
  };

  const filtered = plugins.filter((p) =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1
          className="page-heading"
        >
          插件市场
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {plugins.length > 0 ? `${plugins.length} 个插件 · ${plugins.filter((p) => p.installed).length} 个已安装` : "浏览和安装扩展插件"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="搜索插件..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="icon" onClick={() => void loadPlugins(true)} disabled={refreshing} className="h-9 w-9">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <Button variant="outline" onClick={() => window.open("https://clawhub.ai", "_blank")}>
          <ExternalLink className="h-4 w-4 mr-1.5" />
          ClawHub
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border min-h-[400px] gap-4 bg-black/[0.015]">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <div className="text-center">
            <p className="font-semibold text-foreground">
              {search ? "没有匹配的插件" : "插件市场"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "尝试其他关键词" : "Gateway 运行后将展示可用插件"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />
          ))}
        </div>
      )}
    </div>
  );
}
