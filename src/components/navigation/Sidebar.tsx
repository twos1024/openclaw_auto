import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart2,
  Bot,
  Clock3,
  LayoutDashboard,
  KeyRound,
  MessageCircle,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Puzzle,
  Radio,
  Settings,
  Trash2,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, timeBucket } from "@/lib/utils";
import { useAgentStore } from "@/store/useAgentStore";
import { useChatStore } from "@/store/useChatStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/button";

export function Sidebar(): JSX.Element {
  const { t } = useTranslation(["common", "navigation", "overview"]);
  const collapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useSettingsStore((state) => state.toggleSidebar);
  const agents = useAgentStore((state) => state.agents);
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionKey = useChatStore((state) => state.currentSessionKey);
  const switchSession = useChatStore((state) => state.switchSession);
  const newSession = useChatStore((state) => state.newSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const loadSessions = useChatStore((state) => state.loadSessions);
  const messages = useChatStore((state) => state.messages);
  const navigate = useNavigate();
  const location = useLocation();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const runningAgents = agents.filter((agent) => agent.status === "active").length;
  const isOnChat = location.pathname === "/chat";

  const navItems = [
    { to: "/agents", label: t("navigation:agents"), icon: Bot },
    { to: "/chat", label: t("navigation:chat"), icon: MessageSquare },
    { to: "/dashboard", label: t("navigation:dashboard"), icon: LayoutDashboard },
    { to: "/models", label: t("navigation:models"), icon: BarChart2 },
    { to: "/channels", label: t("navigation:channels"), icon: Radio },
    { to: "/providers", label: t("navigation:providers"), icon: KeyRound },
    { to: "/cron", label: t("navigation:cron"), icon: Clock3 },
    { to: "/plugins", label: t("navigation:plugins"), icon: Puzzle },
    { to: "/skills", label: t("navigation:skills"), icon: Zap },
  ];

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const bucketed = sessions.reduce<Record<string, typeof sessions>>((accumulator, session) => {
    const key = timeBucket(session.lastActivity || 0);
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(session);
    return accumulator;
  }, {});

  const handleNewChat = () => {
    if (messages.length > 0) {
      newSession();
    }
    navigate("/chat");
  };

  const handleDeleteSession = async (key: string) => {
    await deleteSession(key);
    if (currentSessionKey === key) {
      navigate("/chat");
    }
    setDeleteTarget(null);
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-all duration-300",
        collapsed ? "w-16" : "w-72",
      )}
    >
      <div className={cn("flex h-12 items-center p-2", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">O</div>
            <div>
              <div className="text-sm font-bold leading-none text-foreground">{t("overview:sidebar.brand")}</div>
              <div className="mt-0.5 text-[10px] leading-none text-muted-foreground">{t("common:poweredBy")}</div>
            </div>
          </div>
        ) : null}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={toggleSidebar}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <div className="px-2 pb-1">
        <button
          onClick={handleNewChat}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-transparent bg-black/5 px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/10 dark:bg-accent dark:hover:bg-accent/80",
            collapsed && "justify-center px-0",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed ? <span>{t("navigation:newChat")}</span> : null}
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 border-b border-black/5 px-2 pb-2 dark:border-white/5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                "text-foreground/80 hover:bg-black/5 dark:hover:bg-white/5",
                isActive && "bg-black/5 text-foreground dark:bg-white/10",
                collapsed && "justify-center px-0",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} strokeWidth={2} />
                {!collapsed ? label : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {!collapsed && sessions.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3">
          {(["today", "yesterday", "thisWeek", "thisMonth", "older"] as const).map((bucket) => {
            const list = bucketed[bucket];
            if (!list?.length) {
              return null;
            }
            return (
              <div key={bucket} className="mb-2">
                <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-tight text-muted-foreground/60">
                  {t(`navigation:buckets.${bucket}`)}
                </div>
                {list.map((session) => (
                  <div key={session.key} className="group relative flex items-center">
                    <button
                      onClick={() => {
                        switchSession(session.key);
                        navigate("/chat");
                      }}
                      className={cn(
                        "w-full truncate rounded-lg px-2.5 py-1.5 pr-7 text-left text-[13px] transition-colors",
                        "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5",
                        isOnChat && currentSessionKey === session.key && "bg-black/5 font-medium text-foreground dark:bg-white/10",
                      )}
                    >
                      {session.label || session.key}
                    </button>
                    {deleteTarget === session.key ? (
                      <div className="absolute right-1 flex items-center gap-0.5">
                        <button onClick={() => void handleDeleteSession(session.key)} className="px-1 text-[10px] font-medium text-destructive hover:underline">
                          {t("overview:sidebar.confirmDelete")}
                        </button>
                        <button onClick={() => setDeleteTarget(null)} className="px-1 text-[10px] text-muted-foreground hover:underline">
                          {t("common:cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        aria-label={t("overview:sidebar.deleteSession")}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(session.key);
                        }}
                        className="absolute right-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="space-y-0.5 border-t border-black/5 p-2 dark:border-white/5">
        {!collapsed ? (
          <div className="flex gap-2 px-2 pb-2">
            <StatPill label={t("navigation:agentsCount")} value={agents.length} />
            <StatPill label={t("navigation:running")} value={runningAgents} accent={runningAgents > 0} />
          </div>
        ) : null}

        <FooterLink to="/settings" label={t("navigation:settings")} icon={Settings} collapsed={collapsed} />
        <FooterLink to="/feedback" label={t("navigation:feedback")} icon={MessageCircle} collapsed={collapsed} />

        {!collapsed ? <div className="px-2.5 pt-1 text-[11px] text-muted-foreground/50">{t("overview:sidebar.appDisplay")}</div> : null}
      </div>
    </aside>
  );
}

function FooterLink({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          "text-foreground/80 hover:bg-black/5 dark:hover:bg-white/5",
          isActive && "bg-black/5 text-foreground dark:bg-white/10",
          collapsed && "justify-center px-0",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} strokeWidth={2} />
          {!collapsed ? label : null}
        </>
      )}
    </NavLink>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl bg-black/5 p-2 text-center dark:bg-white/5">
      <div className={cn("text-lg font-bold leading-none", accent && value > 0 ? "text-green-600 dark:text-green-400" : "text-foreground")}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
