import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutGrid, MessageSquare, BarChart2, Puzzle, Zap, Settings,
  MessageCircle, PanelLeftClose, PanelLeft, Plus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BUCKET_LABELS, timeBucket } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/useChatStore";
import { APP_DISPLAY } from "@/lib/constants";
import { Button } from "@/components/ui/button";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/instances", label: "实例管理", icon: LayoutGrid },
  { to: "/chat",      label: "AI 对话",  icon: MessageSquare },
  { to: "/token",     label: "用量统计", icon: BarChart2 },
  { to: "/plugins",   label: "插件市场", icon: Puzzle },
  { to: "/skills",    label: "技能管理", icon: Zap },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const isOnChat = useLocation().pathname === "/chat";

  // Instances stats
  const instances = useAppStore((s) => s.instances);
  const running = instances.filter((i) => i.status === "active").length;

  // Chat sessions
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const messages = useChatStore((s) => s.messages);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Group sessions by time bucket
  const bucketed = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    const key = timeBucket(s.lastActivity || 0);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const bucketOrder = ["today", "yesterday", "thisWeek", "thisMonth", "older"] as const;

  const handleNewChat = () => {
    if (messages.length > 0) newSession();
    navigate("/chat");
  };

  const handleDeleteSession = async (key: string) => {
    await deleteSession(key);
    if (currentSessionKey === key) navigate("/chat");
    setDeleteTarget(null);
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border transition-all duration-300",
        "bg-[hsl(45_28%_88%)] dark:bg-[hsl(240_4%_9%)]",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className={cn("flex h-12 items-center p-2", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background text-xs font-bold">
              O
            </div>
            <div>
              <div className="text-sm font-bold text-foreground leading-none">OpenClaw</div>
              <div className="text-[10px] text-muted-foreground leading-none mt-0.5">POWERED BY APIMart</div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed
            ? <PanelLeft className="h-4 w-4" />
            : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat button */}
      <div className="px-2 pb-1">
        <button
          onClick={handleNewChat}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
            "bg-black/5 dark:bg-accent border border-transparent text-foreground hover:bg-black/10 dark:hover:bg-accent/80",
            collapsed && "justify-center px-0",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>新对话</span>}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col px-2 gap-0.5 pb-2 border-b border-black/5 dark:border-white/5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                "hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80",
                isActive && "bg-black/5 dark:bg-white/10 text-foreground",
                collapsed && "justify-center px-0",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} strokeWidth={2} />
                {!collapsed && label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Session history (only when expanded & on chat) */}
      {!collapsed && sessions.length > 0 && (
        <div className="flex-1 overflow-y-auto px-2 pt-3 pb-2 min-h-0">
          {bucketOrder.map((bucket) => {
            const list = bucketed[bucket];
            if (!list?.length) return null;
            return (
              <div key={bucket} className="mb-2">
                <div className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground/60 tracking-tight uppercase">
                  {BUCKET_LABELS[bucket]}
                </div>
                {list.map((s) => (
                  <div key={s.key} className="group relative flex items-center">
                    <button
                      onClick={() => { switchSession(s.key); navigate("/chat"); }}
                      className={cn(
                        "w-full text-left rounded-lg px-2.5 py-1.5 text-[13px] transition-colors pr-7 truncate",
                        "hover:bg-black/5 dark:hover:bg-white/5",
                        isOnChat && currentSessionKey === s.key
                          ? "bg-black/5 dark:bg-white/10 text-foreground font-medium"
                          : "text-foreground/70",
                      )}
                    >
                      {s.label || s.key}
                    </button>
                    {deleteTarget === s.key ? (
                      <div className="absolute right-1 flex items-center gap-0.5">
                        <button
                          onClick={() => void handleDeleteSession(s.key)}
                          className="text-[10px] font-medium text-destructive hover:underline px-1"
                        >确认</button>
                        <button
                          onClick={() => setDeleteTarget(null)}
                          className="text-[10px] text-muted-foreground hover:underline px-1"
                        >取消</button>
                      </div>
                    ) : (
                      <button
                        aria-label="删除会话"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.key); }}
                        className="absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
      )}

      {!collapsed && sessions.length === 0 && <div className="flex-1" />}
      {collapsed && <div className="flex-1" />}

      {/* Footer */}
      <div className="border-t border-black/5 dark:border-white/5 p-2 space-y-0.5">
        {/* Stats pills — only expanded */}
        {!collapsed && (
          <div className="flex gap-2 px-2 pb-2">
            <StatPill label="实例" value={instances.length} />
            <StatPill label="运行中" value={running} accent={running > 0} />
          </div>
        )}

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              "hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80",
              isActive && "bg-black/5 dark:bg-white/10 text-foreground",
              collapsed && "justify-center px-0",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} strokeWidth={2} />
              {!collapsed && "设置"}
            </>
          )}
        </NavLink>

        <NavLink
          to="/feedback"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              "hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80",
              isActive && "bg-black/5 dark:bg-white/10 text-foreground",
              collapsed && "justify-center px-0",
            )
          }
        >
          {({ isActive }) => (
            <>
              <MessageCircle className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} strokeWidth={2} />
              {!collapsed && "反馈"}
            </>
          )}
        </NavLink>

        {!collapsed && (
          <div className="px-2.5 pt-1 text-[11px] text-muted-foreground/50">
            {APP_DISPLAY}
          </div>
        )}
      </div>
    </aside>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl bg-black/5 dark:bg-white/5 p-2 text-center">
      <div className={cn("text-lg font-bold leading-none", accent && value > 0 ? "text-green-600 dark:text-green-400" : "text-foreground")}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
