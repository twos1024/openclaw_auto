import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, DollarSign, Cpu, Clock } from "lucide-react";
import { gatewayFetch } from "@/lib/gateway-client";
import { invokeCommand } from "@/services/tauriClient";
import { cn, formatTokens } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UsageEntry {
  date: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  agentId?: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "green" | "blue" | "amber";
}) {
  const textColors = {
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  const bgColors = {
    green: "bg-green-500/10",
    blue: "bg-blue-500/10",
    amber: "bg-amber-500/10",
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={cn("text-2xl font-bold mt-1", accent ? textColors[accent] : "text-foreground")}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", accent ? bgColors[accent] : "bg-muted")}>
            <Icon className={cn("h-5 w-5", accent ? textColors[accent] : "text-muted-foreground")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Usage table ───────────────────────────────────────────────────────────────

function UsageTable({ entries, loading }: { entries: UsageEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" />加载中...
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <TrendingUp className="h-8 w-8 opacity-30" />
        <p className="text-sm">暂无用量数据。完成一次对话后会显示统计。</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">日期</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">模型</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">输入</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">输出</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">总计</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">费用</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={`${e.date}-${e.model}-${i}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 text-muted-foreground">{e.date}</td>
              <td className="px-4 py-2.5">
                <Badge variant="default" className="font-mono text-[11px]">{e.model}</Badge>
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatTokens(e.promptTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatTokens(e.completionTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">{formatTokens(e.totalTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-green-600 dark:text-green-400">
                ${e.cost.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TokenPage(): JSX.Element {
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    // Check gateway status
    const statusResult = await invokeCommand<{ running: boolean }>("get_gateway_status");
    if (statusResult.success && statusResult.data?.running) {
      setGatewayRunning(true);
      try {
        const data = await gatewayFetch<UsageEntry[]>("/api/usage/recent-token-history");
        setUsage(Array.isArray(data) ? data : []);
      } catch {
        setUsage([]);
      }
    } else {
      setGatewayRunning(false);
      setUsage([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { void loadData(); }, []);

  // Filter by window
  const now = Date.now();
  const windowMs = timeRange === "7d" ? 7 * 86400_000 : timeRange === "30d" ? 30 * 86400_000 : Infinity;
  const filtered = usage.filter((e) => now - new Date(e.date).getTime() <= windowMs);

  const totalTokens = filtered.reduce((s, e) => s + e.totalTokens, 0);
  const totalCost = filtered.reduce((s, e) => s + e.cost, 0);
  const uniqueModels = [...new Set(filtered.map((e) => e.model))];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1
          className="page-heading"
        >
          用量统计
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {gatewayRunning ? "Gateway 运行中 · 实时数据" : "Gateway 未运行 · 启动后查看数据"}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as "7d" | "30d" | "all")}
          className="w-32"
        >
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
          <option value="all">全部</option>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void loadData(true)} disabled={refreshing} className="h-9 w-9">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总 Token 消耗"
          value={formatTokens(totalTokens)}
          subtitle={`${filtered.length} 条记录`}
          icon={TrendingUp}
          accent="blue"
        />
        <StatCard
          title="预估费用"
          value={`$${totalCost.toFixed(4)}`}
          subtitle={timeRange === "7d" ? "近 7 天" : timeRange === "30d" ? "近 30 天" : "全部时间"}
          icon={DollarSign}
          accent="green"
        />
        <StatCard
          title="使用模型数"
          value={String(uniqueModels.length)}
          subtitle={uniqueModels.slice(0, 2).join(", ")}
          icon={Cpu}
          accent="amber"
        />
        <StatCard
          title="平均每次费用"
          value={filtered.length ? `$${(totalCost / filtered.length).toFixed(5)}` : "-"}
          subtitle="每条记录平均"
          icon={Clock}
        />
      </div>

      {/* Usage table */}
      <Card>
        <CardHeader>
          <CardTitle>用量明细</CardTitle>
          <CardDescription>按对话记录展示 token 消耗和费用</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageTable entries={filtered} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
