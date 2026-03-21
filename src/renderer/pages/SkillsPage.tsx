import { useCallback, useEffect, useState } from "react";
import { Search, Zap, Package, RefreshCw, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { gatewayFetch } from "@/lib/gateway-client";
import { serviceService } from "@/services/serviceService";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Skill {
  slug: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  enabled: boolean;
  installed: boolean;
  isBundled?: boolean;
  source?: string;
  tags?: string[];
}

// ─── Skill card ───────────────────────────────────────────────────────────────

function SkillCard({ skill, onToggle }: { skill: Skill; onToggle: (slug: string, enabled: boolean) => void }) {
  const { t } = useTranslation("skills");
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggle = async () => {
    setToggling(true);
    setToggleError(null);
    try {
      await gatewayFetch(`/api/skills/${encodeURIComponent(skill.slug)}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      onToggle(skill.slug, !skill.enabled);
    } catch {
      setToggleError(t("status.toggleFailed"));
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
      "hover:shadow-md transition-shadow",
      !skill.enabled && "opacity-60",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{skill.name}</p>
            <p className="text-[11px] text-muted-foreground">v{skill.version}</p>
          </div>
        </div>
        <Switch
          checked={skill.enabled}
          onCheckedChange={() => void handleToggle()}
          disabled={toggling}
        />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{skill.description}</p>
      {toggleError && (
        <p className="text-xs text-destructive">{toggleError}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {skill.isBundled && <Badge variant="secondary">{t("card.bundled")}</Badge>}
        {skill.source && !skill.isBundled && <Badge variant="outline">{skill.source}</Badge>}
        {skill.tags?.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SkillsPage(): JSX.Element {
  const { t } = useTranslation("skills");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [gatewayRunning, setGatewayRunning] = useState(false);

  const loadSkills = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    const status = await serviceService.getGatewayStatus();
    if (status.running) {
      setGatewayRunning(true);
      try {
        const data = await gatewayFetch<Skill[]>("/api/skills");
        setSkills(Array.isArray(data) ? data : []);
      } catch {
        setSkills([]);
      }
    } else {
      setGatewayRunning(false);
      setSkills([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void loadSkills(); }, [loadSkills]);

  const handleToggle = (slug: string, enabled: boolean) => {
    setSkills((prev) => prev.map((s) => s.slug === slug ? { ...s, enabled } : s));
  };

  const filtered = skills.filter((s) =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()),
  );

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1
          className="page-heading"
        >
          {t("page.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {gatewayRunning
            ? t("page.description", { count: skills.length, enabled: enabledCount })
            : t("page.descriptionIdle")}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t("toolbar.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="icon" onClick={() => void loadSkills(true)} disabled={refreshing} className="h-9 w-9">
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <Button variant="outline" onClick={() => window.open("https://clawhub.ai", "_blank")}>
          <ExternalLink className="h-4 w-4 mr-1.5" />
          {t("toolbar.market")}
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />{t("status.loading")}
        </div>
      ) : !gatewayRunning ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border min-h-[360px] gap-4 bg-black/[0.015]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/5">
            <Package className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{t("status.gatewayNotRunning")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("status.gatewayNotRunningDescription")}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border min-h-[360px] gap-4 bg-black/[0.015]">
          <Zap className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{search ? t("empty.noMatch") : t("empty.noSkills")}</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filtered.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
