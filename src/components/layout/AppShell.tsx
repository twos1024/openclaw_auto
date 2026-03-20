import { useCallback, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SetupAssistantDialog } from "@/components/dialogs/SetupAssistantDialog";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Button } from "@/components/ui/button";
import type { ShellOutletContext } from "@/hooks/useShellActions";

const shellTitleRoutes: Array<{ path: string; titleKey: string }> = [
  { path: "/", titleKey: "overview:header.title" },
  { path: "/overview", titleKey: "overview:header.title" },
  { path: "/install", titleKey: "install:page.hero.title" },
  { path: "/config", titleKey: "config:page.title" },
  { path: "/service", titleKey: "service:page.title" },
  { path: "/runbook", titleKey: "runbook:page.title" },
  { path: "/logs", titleKey: "logs:page.title" },
  { path: "/chat", titleKey: "chat:title" },
  { path: "/agents", titleKey: "agents:title" },
  { path: "/models", titleKey: "models:title" },
  { path: "/channels", titleKey: "channels:title" },
  { path: "/providers", titleKey: "providers:title" },
  { path: "/cron", titleKey: "cron:title" },
  { path: "/dashboard", titleKey: "navigation:dashboard" },
  { path: "/plugins", titleKey: "plugins:title" },
  { path: "/skills", titleKey: "skills:title" },
  { path: "/settings", titleKey: "settings:title" },
  { path: "/feedback", titleKey: "feedback:title" },
];

function resolveShellTitle(pathname: string, t: (key: string) => string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const matched = shellTitleRoutes.find(({ path }) =>
    path === "/" ? normalized === "/" : normalized === path || normalized.startsWith(`${path}/`),
  );
  return matched ? t(matched.titleKey) : t("overview:header.title");
}

export function AppShell(): JSX.Element {
  const [isSetupAssistantOpen, setSetupAssistantOpen] = useState(false);
  const { pathname } = useLocation();
  const { t } = useTranslation([
    "navigation",
    "overview",
    "install",
    "config",
    "service",
    "runbook",
    "logs",
    "chat",
    "agents",
    "models",
    "channels",
    "providers",
    "cron",
    "dashboard",
    "plugins",
    "skills",
    "settings",
    "feedback",
  ]);

  const openSetupAssistant = useCallback(() => {
    setSetupAssistantOpen(true);
  }, []);

  const closeSetupAssistant = useCallback(() => {
    setSetupAssistantOpen(false);
  }, []);

  const shellContext: ShellOutletContext = {
    openSetupAssistant,
    closeSetupAssistant,
  };
  const pageTitle = useMemo(() => resolveShellTitle(pathname, t), [pathname, t]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--content))] transition-colors">
        <header className="flex items-center justify-between gap-4 border-b border-border/70 bg-[hsl(var(--content))] px-6 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">{pageTitle}</h1>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={openSetupAssistant}>
            {t("navigation:setupAssistant")}
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet context={shellContext} />
        </div>
      </main>
      <SetupAssistantDialog open={isSetupAssistantOpen} onClose={closeSetupAssistant} />
    </div>
  );
}
