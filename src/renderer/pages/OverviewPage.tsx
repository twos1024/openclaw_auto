import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("overview");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [status, setStatus] = useState<OverviewStatus | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<ActionTone>("info");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setErrorText(null);
    const result = await statusService.getOverviewStatus();
    if (!result.data) {
      setLoadState("error");
      setErrorText(result.error?.message ?? t("errors.loadFailed"));
      return;
    }

    setStatus(result.data);
    setErrorText(result.ok ? null : result.error?.message ?? t("errors.loadFailed"));
    setLoadState("loaded");
  }, [t]);

  const handleAction = async (action: OverviewAction): Promise<void> => {
    if (action.kind !== "open-dashboard") {
      return;
    }

    setActionLoadingId(action.id);
    setActionFeedback(null);
    const result = await serviceService.openDashboard();
    setActionTone(result.status === "success" ? "info" : "error");
    setActionFeedback(result.status === "success" ? t("feedback.dashboardOpened") : result.detail);
    setActionLoadingId(null);
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, autoRefreshMs);
    return () => window.clearInterval(timer);
  }, [autoRefreshMs, refresh]);

  const headerText = useMemo(() => {
    if (loadState === "loading" && !status) return t("header.loading");
    if (loadState === "error") return t("header.error");
    if (status?.mode === "preview") return t("header.preview");
    if (status?.mode === "runtime-unavailable") return t("header.runtimeUnavailable");
    return t("header.title");
  }, [loadState, status, t]);

  const sections = status ? [status.install, status.config, status.service, status.runtime, status.settings] : [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 8 }}>{headerText}</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          {status?.mode === "preview"
            ? t("description.preview")
            : status?.mode === "runtime-unavailable"
              ? t("description.runtimeUnavailable")
              : t("description.default")}
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
          {t("actions.refresh")}
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
