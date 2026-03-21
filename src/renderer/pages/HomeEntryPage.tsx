import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NoticeBanner } from "../components/common/NoticeBanner";
import { PageHero } from "../components/common/PageHero";
import { useRunbook } from "../hooks/useRunbook";
import { useShellActions } from "../hooks/useShellActions";
import { OverviewPage } from "./OverviewPage";

function blockerToneForLevel(level: string | undefined): "info" | "warning" | "error" | "success" {
  if (level === "offline") return "error";
  if (level === "degraded") return "warning";
  if (level === "healthy") return "success";
  return "info";
}

export function HomeEntryPage(): JSX.Element {
  const { t } = useTranslation("overview");
  const { model, isLoading, errorText } = useRunbook(true);
  const { openSetupAssistant } = useShellActions();
  const [hasAutoOpened, setHasAutoOpened] = useState<boolean>(false);

  const currentStepLabel = useMemo(() => {
    const route = model?.primaryRoute ?? "";
    if (route.startsWith("/install")) return t("home.entry.steps.install");
    if (route.startsWith("/config")) return t("home.entry.steps.config");
    if (route.startsWith("/service")) return t("home.entry.steps.service");
    if (route.startsWith("/dashboard")) return t("home.entry.steps.dashboard");
    return t("home.entry.steps.runbook");
  }, [model?.primaryRoute, t]);

  const blockerTone = blockerToneForLevel(model?.currentBlocker?.level);

  useEffect(() => {
    if (!hasAutoOpened && model?.currentBlocker) {
      openSetupAssistant();
      setHasAutoOpened(true);
    }
  }, [hasAutoOpened, model?.currentBlocker, openSetupAssistant]);

  if (model && !model.currentBlocker) {
    return <Navigate to={model.primaryRoute} replace />;
  }

  if (isLoading) {
    return (
      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 20,
          display: "grid",
          gap: 8,
        }}
      >
        <strong style={{ color: "#0f172a" }}>{t("home.loading.title")}</strong>
        <p style={{ margin: 0, color: "#475569" }}>{t("home.loading.description")}</p>
      </section>
    );
  }

  if (model?.currentBlocker) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <PageHero
          title={t("home.entry.title")}
          description={t("home.entry.description")}
          meta={t("home.entry.meta", {
            checkedAt: new Date(model.lastCheckedAt).toLocaleString(),
          })}
          action={
            <button
              type="button"
              onClick={openSetupAssistant}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#0f172a",
                color: "#ffffff",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("home.entry.openAssistant")}
            </button>
          }
        />

        <NoticeBanner title={t("home.entry.noticeTitle", { step: currentStepLabel })} tone={blockerTone}>
          <p style={{ margin: 0 }}>{t("home.entry.noticeDescription")}</p>
          <p style={{ margin: "8px 0 0" }}>{t("home.entry.noticePrimaryHint", { step: currentStepLabel })}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <Link
              to={model.primaryRoute}
              style={{
                display: "inline-block",
                borderRadius: 8,
                background: "#0f172a",
                color: "#ffffff",
                padding: "8px 12px",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              {t("home.entry.continue")}
            </Link>
            <Link
              to="/runbook"
              style={{
                display: "inline-block",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                padding: "8px 12px",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              {t("home.entry.openRunbook")}
            </Link>
          </div>
        </NoticeBanner>

        <OverviewPage autoRefreshMs={15000} />
      </div>
    );
  }

  return (
    <section
      style={{
        border: "1px solid #fecaca",
        borderRadius: 12,
        background: "#fef2f2",
        padding: 20,
        display: "grid",
        gap: 8,
      }}
    >
      <strong style={{ color: "#991b1b" }}>{t("home.error.title")}</strong>
      <p style={{ margin: 0, color: "#7f1d1d" }}>
        {errorText ?? t("home.error.description")}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          to="/overview"
          style={{
            display: "inline-block",
            borderRadius: 8,
            background: "#0f172a",
            color: "#ffffff",
            padding: "8px 12px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          {t("home.actions.overview")}
        </Link>
        <Link
          to="/install?wizard=1"
          style={{
            display: "inline-block",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            padding: "8px 12px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          {t("home.actions.installWizard")}
        </Link>
      </div>
    </section>
  );
}
