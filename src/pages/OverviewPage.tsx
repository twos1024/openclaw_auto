import { useEffect, useMemo, useState } from "react";
import { OverviewActionList } from "../components/overview/OverviewActionList";
import { OverviewSectionCard } from "../components/overview/OverviewSectionCard";
import { OverviewSummaryCard } from "../components/overview/OverviewSummaryCard";
import { serviceService } from "../services/serviceService";
import { statusService } from "../services/statusService";
import type { OverviewAction, OverviewStatus } from "../types/status";

export interface OverviewPageProps {
  autoRefreshMs?: number;
}

type LoadState = "idle" | "loading" | "loaded" | "error";
type ActionTone = "info" | "error";

export function OverviewPage({ autoRefreshMs }: OverviewPageProps): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [status, setStatus] = useState<OverviewStatus | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<ActionTone>("info");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    setLoadState("loading");
    setErrorText(null);
    const result = await statusService.getOverviewStatus();
    if (!result.ok || !result.data) {
      setLoadState("error");
      setErrorText(result.error?.message ?? "Failed to load overview status.");
      return;
    }

    setStatus(result.data);
    setLoadState("loaded");
  };

  const handleAction = async (action: OverviewAction): Promise<void> => {
    if (action.kind !== "open-dashboard") {
      return;
    }

    setActionLoadingId(action.id);
    setActionFeedback(null);
    const result = await serviceService.openDashboard();
    setActionTone(result.status === "success" ? "info" : "error");
    setActionFeedback(result.status === "success" ? "Dashboard 已打开。" : result.detail);
    setActionLoadingId(null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, autoRefreshMs);
    return () => window.clearInterval(timer);
  }, [autoRefreshMs]);

  const headerText = useMemo(() => {
    if (loadState === "loading" && !status) return "Loading overview...";
    if (loadState === "error") return "Overview unavailable";
    if (status?.mode === "preview") return "OpenClaw Preview Overview";
    if (status?.mode === "runtime-unavailable") return "OpenClaw Desktop Runtime Overview";
    return "OpenClaw Runtime Overview";
  }, [loadState, status]);

  const sections = status ? [status.install, status.config, status.service, status.runtime, status.settings] : [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 8 }}>{headerText}</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          {status?.mode === "preview"
            ? "当前是浏览器预览态，只展示可预期结构，不代表本地真实运行状态。"
            : status?.mode === "runtime-unavailable"
              ? "当前已进入桌面窗口，但前端未连上 Tauri 命令桥。请先修复运行时集成，再继续安装、配置和服务控制。"
              : "Overview 现在会聚合安装、配置、服务与应用设置，帮助你快速找到下一步动作。"}
        </p>
      </header>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loadState === "loading"}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            background: "#0f172a",
            color: "#ffffff",
            cursor: loadState === "loading" ? "not-allowed" : "pointer",
            opacity: loadState === "loading" ? 0.6 : 1,
          }}
        >
          Refresh
        </button>
      </div>

      {errorText ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            borderRadius: 8,
            padding: 12,
            color: "#991b1b",
          }}
        >
          {errorText}
        </div>
      ) : null}

      {actionFeedback ? (
        <div
          style={{
            border: `1px solid ${actionTone === "info" ? "#93c5fd" : "#fecaca"}`,
            background: actionTone === "info" ? "#eff6ff" : "#fef2f2",
            borderRadius: 8,
            padding: 12,
            color: actionTone === "info" ? "#1d4ed8" : "#991b1b",
          }}
        >
          {actionFeedback}
        </div>
      ) : null}

      {status ? (
        <>
          <OverviewSummaryCard
            overall={status.overall}
            platform={status.platform}
            appVersion={status.appVersion}
            dashboardUrl={status.dashboardUrl}
          />

          <OverviewActionList
            actions={status.nextActions}
            actionLoadingId={actionLoadingId}
            onAction={(action) => {
              void handleAction(action);
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {sections.map((section) => (
              <OverviewSectionCard key={section.id} section={section} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
