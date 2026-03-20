import { useCallback, useEffect, useState } from "react";
import { Clock, Cpu, DollarSign, RefreshCw, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NoticeBanner } from "@/components/common/NoticeBanner";
import { gatewayFetch } from "@/lib/gateway-client";
import { cn, formatTokens } from "@/lib/utils";
import { serviceService } from "@/services/serviceService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

interface UsageEntry {
  date: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  agentId?: string;
}

function StatCard({
  title,
  value,
  subtitle,
  accent,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent?: "green" | "blue" | "amber";
  icon: React.ComponentType<{ className?: string }>;
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={cn("mt-1 text-2xl font-bold", accent ? textColors[accent] : "text-foreground")}>{value}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", accent ? bgColors[accent] : "bg-muted")}>
            <Icon className={cn("h-5 w-5", accent ? textColors[accent] : "text-muted-foreground")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageTable({ entries, loading }: { entries: UsageEntry[]; loading: boolean }) {
  const { t } = useTranslation("models");
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        {t("status.loading")}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <TrendingUp className="h-8 w-8 opacity-30" />
        <p className="text-sm">{t("status.empty")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{t("table.headers.date")}</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{t("table.headers.model")}</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">{t("table.headers.input")}</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">{t("table.headers.output")}</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">{t("table.headers.total")}</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">{t("table.headers.cost")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.date}-${entry.model}-${index}`} className="border-b border-border/50 transition-colors hover:bg-muted/20">
              <td className="px-4 py-2.5 text-muted-foreground">{entry.date}</td>
              <td className="px-4 py-2.5">
                <Badge variant="default" className="font-mono text-[11px]">
                  {entry.model}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatTokens(entry.promptTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatTokens(entry.completionTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">{formatTokens(entry.totalTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-green-600 dark:text-green-400">${entry.cost.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ModelsPage(): JSX.Element {
  const { t } = useTranslation("models");
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError(null);

    try {
      const status = await serviceService.getGatewayStatus();
      if (status.running) {
        setGatewayRunning(true);
        try {
          const data = await gatewayFetch<UsageEntry[]>("/api/usage/recent-token-history");
          setUsage(Array.isArray(data) ? data : []);
        } catch (error) {
          setUsage([]);
          setLoadError(error instanceof Error ? error.message : t("banner.error.description"));
        }
      } else {
        setGatewayRunning(false);
        setUsage([]);
      }
    } catch (error) {
      setGatewayRunning(false);
      setUsage([]);
      setLoadError(error instanceof Error ? error.message : t("banner.error.description"));
    }

    setLoading(false);
    setRefreshing(false);
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const now = Date.now();
  const windowMs = timeRange === "7d" ? 7 * 86400_000 : timeRange === "30d" ? 30 * 86400_000 : Infinity;
  const filteredEntries = usage.filter((entry) => now - new Date(entry.date).getTime() <= windowMs);
  const totalTokens = filteredEntries.reduce((sum, entry) => sum + entry.totalTokens, 0);
  const totalCost = filteredEntries.reduce((sum, entry) => sum + entry.cost, 0);
  const uniqueModels = [...new Set(filteredEntries.map((entry) => entry.model))];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-heading">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{gatewayRunning ? t("page.descriptionRunning") : t("page.descriptionIdle")}</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={timeRange} onChange={(event) => setTimeRange(event.target.value as "7d" | "30d" | "all")} className="w-32">
          <option value="7d">{t("toolbar.timeRange.7d")}</option>
          <option value="30d">{t("toolbar.timeRange.30d")}</option>
          <option value="all">{t("toolbar.timeRange.all")}</option>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void loadData(true)} disabled={refreshing} className="h-9 w-9">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {loadError ? (
        <NoticeBanner title={t("banner.error.title")} tone="error">
          <p style={{ margin: 0 }}>{loadError}</p>
        </NoticeBanner>
      ) : !gatewayRunning && !loading ? (
        <NoticeBanner title={t("banner.offline.title")} tone="warning">
          <p style={{ margin: 0 }}>{t("banner.offline.description")}</p>
        </NoticeBanner>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title={t("stats.totalTokens")} value={formatTokens(totalTokens)} subtitle={t("stats.records", { count: filteredEntries.length })} icon={TrendingUp} accent="blue" />
        <StatCard
          title={t("stats.estimatedCost")}
          value={`$${totalCost.toFixed(4)}`}
          subtitle={timeRange === "7d" ? t("stats.range.7d") : timeRange === "30d" ? t("stats.range.30d") : t("stats.range.all")}
          icon={DollarSign}
          accent="green"
        />
        <StatCard title={t("stats.modelCount")} value={String(uniqueModels.length)} subtitle={uniqueModels.slice(0, 2).join(", ")} icon={Cpu} accent="amber" />
        <StatCard title={t("stats.averageCost")} value={filteredEntries.length ? `$${(totalCost / filteredEntries.length).toFixed(5)}` : "-"} subtitle={t("stats.perRecord")} icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("table.title")}</CardTitle>
          <CardDescription>{t("table.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageTable entries={filteredEntries} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
